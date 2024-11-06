import { writeFile } from 'fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'path';
import { asBool } from '@tsofist/stem/lib/as-bool';
import { raise } from '@tsofist/stem/lib/error';
import { TextBuilder } from '@tsofist/stem/lib/string/text-builder';
import { createProgram } from 'ts-json-schema-generator';
import { CompletedConfig, DEFAULT_CONFIG } from 'ts-json-schema-generator/dist/src/Config';
import {
    CompilerHost,
    CompilerOptions,
    createCompilerHost,
    EnumDeclaration,
    ExportDeclaration,
    getJSDocDeprecatedTag,
    getJSDocPrivateTag,
    getJSDocPublicTag,
    getTextOfJSDocComment,
    InterfaceDeclaration,
    isEnumDeclaration,
    isExportDeclaration,
    isFunctionTypeNode,
    isInterfaceDeclaration,
    isMethodSignature,
    isNamedExports,
    isPropertySignature,
    isStringLiteral,
    isTypeAliasDeclaration,
    Program,
    SignatureDeclarationBase,
    SourceFile,
    Statement,
    SyntaxKind,
    TypeAliasDeclaration,
    TypeChecker,
    TypeElement,
    VariableDeclaration,
} from 'typescript';
import { buildAPIInterfaceSchemaSignature } from '../index';
import { SchemaForgeSignatureSuffix } from '../types';
import {
    hasJSDocTag,
    readInterfaceGenericText,
    readJSDocDescription,
    readMemberTypeName,
    readNodeName,
    resolveModuleFileName,
} from '../util/tsc';
import {
    SchemaForgeBaseOptions,
    SG_CONFIG_DEFAULTS,
    SG_CONFIG_MANDATORY,
    TMP_FILES_SUFFIX,
} from './types';

interface Options extends SchemaForgeBaseOptions {
    tsconfig: string;
    sourcesPattern: string[];
}

interface GeneratorContext {
    readonly program: Program;
    readonly compilerOptions: CompilerOptions;
    readonly compilerHost: CompilerHost;
    readonly typeChecker: TypeChecker;
    readonly options: Options;
    readonly fileContent: string[];

    registerDefinition: (...name: string[]) => void;
}

export async function generateDraftTypeFiles(options: Options) {
    const explicitPublic = asBool(options.explicitPublic, true);
    const sourcesTypesGeneratorConfig: CompletedConfig = {
        ...DEFAULT_CONFIG,
        ...SG_CONFIG_DEFAULTS,
        expose: options.expose ?? SG_CONFIG_DEFAULTS.expose,
        path: options.sourcesPattern.length > 1 ? undefined : options.sourcesPattern[0],
        tsconfig: options.tsconfig,
        discriminatorType: DEFAULT_CONFIG.discriminatorType,
        ...SG_CONFIG_MANDATORY,
    };

    const files: string[] = [];
    let definitions: string[] = [];

    const program: Program = createProgram(sourcesTypesGeneratorConfig);
    const checker = program.getTypeChecker();
    const compilerOptions = program.getCompilerOptions();
    const compilerHost = createCompilerHost(compilerOptions);

    const fileNames = program.getRootFileNames();
    const namesBySourceFile = new Map<string, Set<string>>();

    for (const sourceFileName of fileNames) {
        const context: GeneratorContext = {
            program,
            compilerOptions,
            compilerHost,
            typeChecker: checker,
            options,
            fileContent: [],
            registerDefinition(...names: string[]) {
                let set = namesBySourceFile.get(sourceFileName);
                if (!set) namesBySourceFile.set(sourceFileName, (set = new Set()));
                for (const name of names) {
                    definitions.push(name);
                    set.add(name);
                }
            },
        };

        const source = program.getSourceFile(sourceFileName);
        if (!source) continue;

        const statements = [...source.statements];
        while (statements.length) {
            const statement = statements.pop();
            if (!statement) break;

            if (isExportDeclaration(statement)) {
                processExportDeclaration(statement, sourceFileName, statements, context);
                continue;
            }

            if (explicitPublic) {
                const isPublic = getJSDocPublicTag(statement) != null;
                if (!isPublic) continue;
            } else {
                const isPrivate =
                    getJSDocPrivateTag(statement) != null || hasJSDocTag(statement, 'internal');
                if (isPrivate) continue;
            }

            switch (statement.kind) {
                case SyntaxKind.ImportDeclaration:
                case SyntaxKind.VariableStatement:
                    continue;
                case SyntaxKind.EnumDeclaration:
                    passDeclaration(statement as EnumDeclaration, context);
                    break;
                case SyntaxKind.TypeAliasDeclaration:
                    passDeclaration(statement as TypeAliasDeclaration, context);
                    break;
                case SyntaxKind.InterfaceDeclaration:
                    if (hasJSDocTag(statement, 'api')) {
                        processAPIInterfaceDeclaration(statement as InterfaceDeclaration, context);
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
            [source.getFullText(), context.fileContent.join('\n')].join('\n'),
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
        namesBySourceFile,
    };
}

const S = ' '.repeat(4);

function passDeclaration(
    statement: TypeAliasDeclaration | EnumDeclaration | InterfaceDeclaration | VariableDeclaration,
    context: GeneratorContext,
) {
    context.registerDefinition(statement.name.getText());
}

function processExportDeclaration(
    statement: ExportDeclaration,
    sourceFileName: string,
    list: Statement[],
    context: GeneratorContext,
) {
    if (
        !statement.exportClause ||
        !isNamedExports(statement.exportClause) ||
        !statement.moduleSpecifier ||
        !isStringLiteral(statement.moduleSpecifier)
    ) {
        raise(`
            Only inline types reexport supported.
            Use: export { Type } from './some-module';
            Or: export { Type } from 'some-external-module';
        `);
    }

    let module: SourceFile | undefined;
    const moduleSpecifier = statement.moduleSpecifier.text;

    if (!isAbsolute(moduleSpecifier)) {
        const fn = resolve(dirname(sourceFileName), moduleSpecifier) + '.ts';
        module = context.program.getSourceFile(fn);
    }

    if (!module) {
        const filename = resolveModuleFileName(
            sourceFileName,
            moduleSpecifier,
            context.compilerOptions,
            context.compilerHost,
        );
        if (filename) module = context.program.getSourceFile(filename);
    }

    if (!module) {
        raise(`Module for ${moduleSpecifier} not found`);
    }

    for (const element of statement.exportClause.elements) {
        const typeName = element.name.getText();
        const statement = module.statements.find((value) => {
            if (
                isTypeAliasDeclaration(value) ||
                isInterfaceDeclaration(value) ||
                isEnumDeclaration(value)
            ) {
                return value.name.escapedText === typeName;
            }
            return false;
        });

        if (statement) {
            list.push(statement);
        }
    }
}

interface DefinitionMetadata {
    name: string;
    description?: string;
    deprecated?: string;
    desc:
        | [argsText: string, resultTypeName: string] // Method signature
        | string; // Property type
}

function processAPIInterfaceDeclaration(
    statement: InterfaceDeclaration,
    context: GeneratorContext,
) {
    const allowUseFallbackDescription = context.options.allowUseFallbackDescription;
    const definitionsMetaList: DefinitionMetadata[] = [];

    const interfaceName = readNodeName(statement);
    const interfaceGenericText = readInterfaceGenericText(statement);
    const interfaceDesc = readJSDocDescription(statement, allowUseFallbackDescription);
    const interfaceDeprecated = getTextOfJSDocComment(getJSDocDeprecatedTag(statement)?.comment);

    function onSignature(
        method: SignatureDeclarationBase,
        memberName: string,
        memberDescription: string | undefined,
        deprecated: string | undefined,
    ) {
        const minArgsNum = method.parameters.filter((param) => !param.questionToken).length;
        const maxArgsNum = method.parameters.length;
        const argsNames: string[] = [];
        const argsTypesText = method.parameters
            .map((parameter) => {
                const name = parameter.name.getText();
                argsNames.push(name);
                const text = parameter.type?.getText() || raise(`No type specified for ${name}`);
                let desc = readJSDocDescription(parameter, allowUseFallbackDescription, false);
                desc = desc ? `/** @description ${desc} */ ` : '';
                return `${S}${desc}${name}: ${text}`;
            })
            .join(',\n');
        const argsNamesText = argsNames
            .map((item, index) => {
                return `${item}${index + 1 <= minArgsNum ? '*' : ''}`;
            })
            .join(', ');

        const resultTypeName = readMemberTypeName(method);

        const definitionNameArgs = buildAPIInterfaceSchemaSignature(
            interfaceName,
            memberName,
            SchemaForgeSignatureSuffix.MethodArguments,
        );
        const definitionNameResult = buildAPIInterfaceSchemaSignature(
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

        context.registerDefinition(definitionNameArgs, definitionNameResult);
        context.fileContent.push(
            ...[
                // ARGUMENTS
                `/**`,
                ` * @interface ${interfaceName}`,
                ` * @member ${interfaceName}#${memberName}`,
                ` * @description Arguments for ${comment} ${argsNames.length ? `(${argsNamesText})` : ''}`,
                ` * @comment ${comment}`,
                ` *`,
                minArgsNum > 0 ? ` * @minItems ${minArgsNum}` : ` *`,
                ` * @maxItems ${maxArgsNum}`,
                ` */`,
                `export type ${definitionNameArgs} = readonly [\n${argsTypesText}\n];`,
                ``,
                // RESULT
                `/**`,
                ` * @interface ${interfaceName}`,
                ` * @member ${interfaceName}#${memberName}`,
                ` * @description Result type for ${comment}`,
                ` * @comment ${comment}`,
                ` */`,
                `export type ${definitionNameResult} = ${resultTypeName || '[ unnamed ]'};`,
                ``,
            ],
        );
    }

    function onMember(member: TypeElement) {
        const isPrivate = getJSDocPrivateTag(member) != null || hasJSDocTag(member, 'internal');
        if (isPrivate) return;

        const memberName = readNodeName(member);
        const memberDescription = readJSDocDescription(member, allowUseFallbackDescription);

        const deprecated = getTextOfJSDocComment(getJSDocDeprecatedTag(member)?.comment);

        if (isMethodSignature(member)) {
            onSignature(member, memberName, memberDescription, deprecated);
        } else if (isPropertySignature(member)) {
            if (member.type && isFunctionTypeNode(member.type)) {
                onSignature(member.type, memberName, memberDescription, deprecated);
            } else {
                definitionsMetaList.push({
                    name: memberName,
                    description: memberDescription,
                    deprecated,
                    desc: readMemberTypeName(member) || 'unknown',
                });
            }
        }
    }

    // inheritance first
    if (statement.heritageClauses) {
        for (const clause of statement.heritageClauses) {
            for (const type of clause.types) {
                const declaration =
                    context.typeChecker.getTypeAtLocation(type).symbol?.declarations?.[0];
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
                        : `${member.name}: ${member.desc as string};`,
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
            `export interface ${buildAPIInterfaceSchemaSignature(interfaceName)}${interfaceGenericText} {`,
            membersText.stringify('\n'),
            `}`,
            ``,
        ]);

        context.registerDefinition(buildAPIInterfaceSchemaSignature(interfaceName));
        context.fileContent.push(interfaceText.stringify('\n'));
    }
}
