import { writeFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { asBool } from '@tsofist/stem/lib/as-bool';
import { raise } from '@tsofist/stem/lib/error';
import { TextBuilder } from '@tsofist/stem/lib/string/text-builder';
import { Config, createProgram } from 'ts-json-schema-generator';
import {
    DeclarationStatement,
    getAllJSDocTags,
    getJSDocDeprecatedTag,
    getJSDocPrivateTag,
    getJSDocPublicTag,
    getTextOfJSDocComment,
    Identifier,
    InterfaceDeclaration,
    JSDocTag,
    MethodSignature,
    Program,
    SignatureDeclaration,
    SyntaxKind,
    TypeAliasDeclaration,
    TypeElement,
    TypeReferenceNode,
} from 'typescript';
import { buildInterfaceSchemaSignature } from '../index';
import { SchemaForgeSignatureSuffix } from '../types';
import {
    SchemaForgeBaseOptions,
    SG_CONFIG_DEFAULTS,
    SG_CONFIG_MANDATORY,
    TMP_FILES_SUFFIX,
} from './types';

interface Options extends SchemaForgeBaseOptions {
    tsconfig: string;
    sourcesPattern: string;
}

interface GeneratorContext {
    readonly options: Options;
    readonly definitions: string[];
    readonly fileContent: string[];
}

export async function generateDraftTypeFiles(options: Options) {
    const explicitPublic = asBool(options.explicitPublic, true);
    const sourcesTypesGeneratorConfig: Config = {
        ...SG_CONFIG_DEFAULTS,
        path: `${options.sourcesPattern}`,
        tsconfig: options.tsconfig,
        ...SG_CONFIG_MANDATORY,
    };

    const files: string[] = [];
    let definitions: string[] = [];

    const program: Program = createProgram(sourcesTypesGeneratorConfig);
    const fileNames = program.getRootFileNames();

    for (const sourceFileName of fileNames) {
        const context: GeneratorContext = {
            options,
            definitions,
            fileContent: [],
        };

        const source = program.getSourceFile(sourceFileName);
        if (!source) continue;

        for (const statement of source.statements) {
            if (explicitPublic) {
                const isPublic = getJSDocPublicTag(statement) != null;
                if (!isPublic) continue;
            } else {
                const isPrivate = getJSDocPrivateTag(statement) != null;
                if (isPrivate) continue;
            }

            switch (statement.kind) {
                case SyntaxKind.ImportDeclaration:
                    continue;
                case SyntaxKind.TypeAliasDeclaration:
                    processTypeAliasDeclaration(statement as TypeAliasDeclaration, context);
                    break;
                case SyntaxKind.InterfaceDeclaration:
                    processInterfaceDeclaration(statement as InterfaceDeclaration, context);
                    break;
                default:
                    console.error('[current statement]\n\t', statement.getText(), '\n');
                    raise(
                        `Unsupported statement kind: ${statement.kind} (${
                            SyntaxKind[statement.kind]
                        }) in ${sourceFileName}`,
                    );
            }
        }
        const outputFileName = `${dirname(sourceFileName)}/${basename(
            sourceFileName,
            extname(sourceFileName),
        )}${TMP_FILES_SUFFIX}.ts`;

        await writeFile(
            outputFileName,
            [source.getText(), context.fileContent.join('\n')].join('\n'),
            { encoding: 'utf8' },
        );
        files.push(outputFileName);
    }

    if (options.definitionsFilter) {
        definitions = definitions.filter(options.definitionsFilter);
    }
    definitions.sort();

    return {
        sourcesTypesGeneratorConfig,
        files,
        definitions,
    };
}

function processTypeAliasDeclaration(statement: TypeAliasDeclaration, context: GeneratorContext) {
    context.definitions.push(statement.name.getText());
}

interface DefinitionMetadata {
    name: string;
    description?: string;
    deprecated?: string;
    desc: [argsText: string, resultTypeName: string] | string;
}

function processInterfaceDeclaration(statement: InterfaceDeclaration, context: GeneratorContext) {
    const definitionsMetaList: DefinitionMetadata[] = [];

    const interfaceName = readNodeName(statement);
    const interfaceDesc = readJSDocDescription(
        statement,
        context.options.allowUseFallbackDescription,
    );
    const interfaceDeprecated = getTextOfJSDocComment(getJSDocDeprecatedTag(statement)?.comment);

    for (const member of statement.members) {
        const isPrivate = getJSDocPrivateTag(member) != null;
        if (isPrivate) continue;

        const memberName = readNodeName(member);
        const memberDescription = readJSDocDescription(
            member,
            context.options.allowUseFallbackDescription,
        );

        const deprecated = getTextOfJSDocComment(getJSDocDeprecatedTag(member)?.comment);

        if (member.kind === SyntaxKind.MethodSignature) {
            const method = member as MethodSignature;
            const minArgsNum = method.parameters.filter((param) => !param.questionToken).length;
            const maxArgsNum = method.parameters.length;

            const argsTypesText = method.parameters
                .map((parameter) => {
                    return (
                        parameter.type?.getText() ||
                        raise(`No type specified for ${method.name.getText()}`)
                    );
                })
                .join(',');

            const resultTypeName = readMemberType(method);

            const definitionNameArgs = buildInterfaceSchemaSignature(
                interfaceName,
                memberName,
                SchemaForgeSignatureSuffix.MethodArguments,
            );
            const definitionNameResult = buildInterfaceSchemaSignature(
                interfaceName,
                memberName,
                SchemaForgeSignatureSuffix.MethodResult,
            );

            const comment = `Method:${interfaceName}#${memberName}`;

            definitionsMetaList.push({
                name: memberName,
                description: memberDescription,
                deprecated,
                desc: [definitionNameArgs, definitionNameResult],
            });

            context.definitions.push(definitionNameArgs, definitionNameResult);
            context.fileContent.push(
                ...[
                    // ARGUMENTS
                    `/**`,
                    ` * @description Arguments for ${comment}`,
                    ` * @comment ${comment}`,
                    ` *`,
                    minArgsNum > 0 ? ` * @minItems ${minArgsNum}` : ``,
                    ` * @maxItems ${maxArgsNum}`,
                    `*/`,
                    `export type ${definitionNameArgs} = [${argsTypesText}];`,
                    ` `,
                    // RESULT
                    `/**`,
                    ` * @description Result type for ${comment}`,
                    ` * @comment ${comment}`,
                    `*/`,
                    `export type ${definitionNameResult} = ${resultTypeName};`,
                    ` `,
                ].filter((line) => line.length),
            );
        } else {
            definitionsMetaList.push({
                name: memberName,
                description: memberDescription,
                deprecated,
                desc: readMemberType(member as SignatureDeclaration)!,
            });
        }
    }

    if (definitionsMetaList.length) {
        const membersText = new TextBuilder();
        for (const member of definitionsMetaList) {
            const isMethod = Array.isArray(member.desc);
            membersText.push(
                [
                    `/**`,
                    member.description && ` * @description ${member.description}`,
                    member.deprecated && ` * @deprecated ${member.deprecated}`,
                    ` * @comment ${isMethod ? 'Method' : 'Property'}:${interfaceName}#${
                        member.name
                    }`,
                    ` */`,
                    isMethod
                        ? `${member.name}: [${member.desc[0]}, ${member.desc[1]}]`
                        : `${member.name}: ${member.desc}`,
                ],
                2,
            );
        }

        const interfaceText = new TextBuilder([
            `/**`,
            interfaceDesc && ` * @description ${interfaceDesc}`,
            interfaceDeprecated && ` * @deprecated ${interfaceDeprecated}`,
            ` * @comment Interface:${interfaceName}`,
            ` */`,
            `export interface ${buildInterfaceSchemaSignature(interfaceName)} {`,
            membersText.stringify('\n'),
            `}`,
        ]);

        context.definitions.push(buildInterfaceSchemaSignature(interfaceName));
        context.fileContent.push(interfaceText.stringify('\n'));
    }
}

function readMemberType(member: MethodSignature | SignatureDeclaration): string | undefined {
    if (member.type?.kind === SyntaxKind.TypeReference) {
        const type = member.type as TypeReferenceNode;
        if (type.typeName.getText() !== 'Promise') {
            return type.getText();
        } else if (type.typeArguments) {
            return type.typeArguments[0].getText();
        }
        return 'unknown';
    }
    return member.type?.getText();
}

function readJSDocDescription(
    node: TypeElement | DeclarationStatement,
    useFallbackDescription: boolean = false,
): string | undefined {
    let value = undefined;
    let fallback: string | undefined = undefined;
    const isTag = (tag: JSDocTag): tag is JSDocTag => {
        if (tag.kind === SyntaxKind.JSDocTag && tag.tagName.escapedText === 'description') {
            value = getTextOfJSDocComment(tag.comment);
        }
        if (
            useFallbackDescription &&
            fallback === undefined &&
            tag.parent.kind === SyntaxKind.JSDoc &&
            tag.parent.comment
        ) {
            fallback = getTextOfJSDocComment(tag.parent.comment);
        }
        return false;
    };
    getAllJSDocTags(node, isTag);

    if (value === undefined && useFallbackDescription && fallback !== undefined) {
        value = fallback;
    }

    return value;
}

function readNodeName(node: TypeElement | DeclarationStatement): string {
    return (node.name as Identifier).escapedText + '';
}
