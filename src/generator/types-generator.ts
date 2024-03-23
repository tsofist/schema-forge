import { writeFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';
import { asBool } from '@tsofist/stem/lib/as-bool';
import { raise } from '@tsofist/stem/lib/error';
import { TextBuilder } from '@tsofist/stem/lib/string/text-builder';
import { Config, createProgram } from 'ts-json-schema-generator';
import {
    DeclarationStatement,
    EnumDeclaration,
    getAllJSDocTags,
    getAllJSDocTagsOfKind,
    getJSDocDeprecatedTag,
    getJSDocPrivateTag,
    getJSDocPublicTag,
    getTextOfJSDocComment,
    Identifier,
    InterfaceDeclaration,
    isInterfaceDeclaration,
    JSDocTag,
    MethodSignature,
    Program,
    SignatureDeclaration,
    Statement,
    SyntaxKind,
    TypeAliasDeclaration,
    TypeChecker,
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
        expose: options.expose,
        path: `${options.sourcesPattern}`,
        tsconfig: options.tsconfig,
        ...SG_CONFIG_MANDATORY,
    };

    const files: string[] = [];
    let definitions: string[] = [];

    const program: Program = createProgram(sourcesTypesGeneratorConfig);
    const checker = program.getTypeChecker();
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
                case SyntaxKind.EnumDeclaration:
                    passDeclaration(statement as EnumDeclaration, context);
                    break;
                case SyntaxKind.ImportDeclaration:
                    continue;
                case SyntaxKind.TypeAliasDeclaration:
                    passDeclaration(statement as TypeAliasDeclaration, context);
                    break;
                case SyntaxKind.InterfaceDeclaration:
                    if (hasJSDocTag(statement, 'api')) {
                        processAPIInterfaceDeclaration(
                            statement as InterfaceDeclaration,
                            context,
                            checker,
                        );
                    } else {
                        passDeclaration(statement as InterfaceDeclaration, context);
                    }
                    break;
                default:
                    console.error(`[current statement]`, statement.getText(), '\n');
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

function passDeclaration(
    statement: TypeAliasDeclaration | EnumDeclaration | InterfaceDeclaration,
    context: GeneratorContext,
) {
    context.definitions.push(statement.name.getText());
}

interface DefinitionMetadata {
    name: string;
    description?: string;
    deprecated?: string;
    desc: [argsText: string, resultTypeName: string] | string;
}

function processAPIInterfaceDeclaration(
    statement: InterfaceDeclaration,
    context: GeneratorContext,
    checker: TypeChecker,
) {
    const definitionsMetaList: DefinitionMetadata[] = [];

    const interfaceName = readNodeName(statement);
    const interfaceGenericText = readInterfaceGenericText(statement);
    const interfaceDesc = readJSDocDescription(
        statement,
        context.options.allowUseFallbackDescription,
    );
    const interfaceDeprecated = getTextOfJSDocComment(getJSDocDeprecatedTag(statement)?.comment);

    function onMember(member: TypeElement) {
        const isPrivate = getJSDocPrivateTag(member) != null;
        if (isPrivate) return;

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
                    ` * @interface ${interfaceName}`,
                    ` * @member ${interfaceName}#${memberName}`,
                    ` * @description Arguments for ${comment}`,
                    ` * @comment ${comment}`,
                    ` *`,
                    minArgsNum > 0 ? ` * @minItems ${minArgsNum}` : ``,
                    ` * @maxItems ${maxArgsNum}`,
                    ` */`,
                    `export type ${definitionNameArgs} = [${argsTypesText}];`,
                    ``,
                    // RESULT
                    `/**`,
                    ` * @interface ${interfaceName}`,
                    ` * @member ${interfaceName}#${memberName}`,
                    ` * @description Result type for ${comment}`,
                    ` * @comment ${comment}`,
                    ` */`,
                    `export type ${definitionNameResult} = ${resultTypeName};`,
                    ``,
                ],
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

    // inheritance first
    if (statement.heritageClauses) {
        for (const clause of statement.heritageClauses) {
            for (const type of clause.types) {
                const declaration = checker.getTypeAtLocation(type).symbol?.declarations?.[0];
                if (
                    declaration &&
                    isInterfaceDeclaration(declaration) &&
                    declaration.members?.length
                ) {
                    for (const member of declaration.members) {
                        onMember(member);
                    }
                }
            }
        }
    }

    for (const member of statement.members) {
        onMember(member);
    }

    if (definitionsMetaList.length) {
        const membersText = new TextBuilder();
        for (const member of definitionsMetaList) {
            const isMethod = Array.isArray(member.desc);
            membersText.push(
                [
                    `/**`,
                    ` * @interface ${interfaceName}`,
                    ` * @${isMethod ? 'method' : 'property'} ${member.name}`,
                    member.description && ` * @description ${member.description}`,
                    member.deprecated && ` * @deprecated ${member.deprecated}`,
                    ` * @comment ${isMethod ? 'Method' : 'Property'}:${interfaceName}#${
                        member.name
                    }`,
                    ` */`,
                    isMethod
                        ? `${member.name}: [${member.desc[0]}, ${member.desc[1]}];`
                        : `${member.name}: ${member.desc};`,
                ],
                2,
            );
        }

        const interfaceText = new TextBuilder([
            `/**`,
            ` * @interface ${interfaceName}`,
            interfaceDesc && ` * @description ${interfaceDesc}`,
            interfaceDeprecated && ` * @deprecated ${interfaceDeprecated}`,
            ` * @comment Interface:${interfaceName}`,
            ` */`,
            `export interface ${buildInterfaceSchemaSignature(interfaceName)}${interfaceGenericText} {`,
            membersText.stringify('\n'),
            `}`,
            ``,
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

function readInterfaceGenericText(node: TypeElement | DeclarationStatement): string {
    if (isInterfaceDeclaration(node) && node.typeParameters?.length) {
        return `<${node.typeParameters[0].getText()}>`;
    }
    return '';
}

function hasJSDocTag(statement: Statement, tagName: string) {
    return (
        getAllJSDocTagsOfKind(statement, SyntaxKind.JSDocTag).find((tag) => {
            return tag.tagName.escapedText === tagName;
        }) != null
    );
}
