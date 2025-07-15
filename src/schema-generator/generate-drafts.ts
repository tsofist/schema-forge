import { writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import { raise } from '@tsofist/stem/lib/error';
import { TextBuilder } from '@tsofist/stem/lib/string/text-builder';
import { createProgram } from 'ts-json-schema-generator';
import { type CompletedConfig, DEFAULT_CONFIG } from 'ts-json-schema-generator/dist/src/Config';
import {
    type EnumDeclaration,
    type ExportDeclaration,
    type InterfaceDeclaration,
    type NodeArray,
    type ParameterDeclaration,
    type Program,
    type SignatureDeclarationBase,
    type SourceFile,
    type Statement,
    type TypeAliasDeclaration,
    type TypeElement,
    type VariableDeclaration,
    SyntaxKind,
    createCompilerHost,
    getJSDocDeprecatedTag,
    getJSDocPrivateTag,
    getJSDocPublicTag,
    getTextOfJSDocComment,
    isEnumDeclaration,
    isExportDeclaration,
    isFunctionTypeNode,
    isInterfaceDeclaration,
    isMethodSignature,
    isNamedExports,
    isPropertySignature,
    isStringLiteral,
    isTypeAliasDeclaration,
} from 'typescript';
import {
    buildAPIInterfaceSDS,
    buildAPIMethodArgsSDS,
    buildAPIMethodResultSDS,
} from '../definition-info/api-signature';
import { ForgeSchemaOptions } from '../types';
import {
    hasJSDocTag,
    readInterfaceGenericText,
    readJSDocDescription,
    readMemberTypeName,
    readNodeName,
    resolveModuleFileName,
} from './helpers-tsc';
import { SFG_CONFIG_DEFAULTS, SFG_CONFIG_MANDATORY, TMP_FILES_SUFFIX } from './types';

/**
 * @internal
 */
export async function generateDraftTypeFiles(options: SFDTGOptions) {
    const sourcesTypesGeneratorConfig: CompletedConfig = {
        ...DEFAULT_CONFIG,
        ...SFG_CONFIG_DEFAULTS,
        expose: options.expose ?? SFG_CONFIG_DEFAULTS.expose,
        path: options.sourcesPattern.length > 1 ? undefined : options.sourcesPattern[0],
        tsconfig: options.tsconfig,
        discriminatorType: DEFAULT_CONFIG.discriminatorType,
        ...SFG_CONFIG_MANDATORY,
    };
    // const files: string[] = [];
    const ctx = createContext(options, sourcesTypesGeneratorConfig);
    let definitions = ctx.definitions;

    for (const sourceFileName of ctx.fileNames) {
        ctx.currentSourceFileName = sourceFileName;
        ctx.currentFileContent = [];

        await processSourceFile(sourceFileName, ctx);
    }

    if (options.definitionsFilter) {
        definitions = definitions.filter(options.definitionsFilter);
    }

    definitions.sort();

    return {
        files: ctx.files,
        definitions,
        sourcesTypesGeneratorConfig,
        namesBySourceFile: ctx.namesBySourceFile,
    };
}

async function processSourceFile(sourceFileName: string, context: SFDTGContext) {
    const source = context.program.getSourceFile(sourceFileName);
    if (!source) return;

    const explicitPublic = context.options.explicitPublic ?? true;
    const statements = [...source.statements];
    const outputFileName = `${dirname(sourceFileName)}/${basename(
        sourceFileName,
        extname(sourceFileName),
    )}${TMP_FILES_SUFFIX}.ts`;

    while (statements.length) {
        const statement = statements.pop();
        if (!statement) break;

        if (isExportDeclaration(statement)) {
            processExportDeclaration(statement, statements, context);
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

    await writeFile(
        outputFileName,
        [source.getFullText(), context.currentFileContent.join('\n')].join('\n'),
        { encoding: 'utf8' },
    );

    context.files.push(outputFileName);
}

function passDeclaration(
    statement: TypeAliasDeclaration | EnumDeclaration | InterfaceDeclaration | VariableDeclaration,
    context: SFDTGContext,
) {
    context.registerDefinition(context.currentSourceFileName, statement.name.getText());
}

function processExportDeclaration(
    statement: ExportDeclaration,
    list: Statement[],
    context: SFDTGContext,
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
        const fn = resolve(dirname(context.currentSourceFileName), moduleSpecifier) + '.ts';
        module = context.program.getSourceFile(fn);
    }

    if (!module) {
        const filename = resolveModuleFileName(
            context.currentSourceFileName,
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

function processAPIInterfaceDeclaration(statement: InterfaceDeclaration, context: SFDTGContext) {
    /** @deprecated */
    const legacy = context.options.legacyDefinitions ?? false;
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
        const minArgsNum = countRequiredParams(method.parameters);
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

        const definitionNameArgs = buildAPIMethodArgsSDS(interfaceName, memberName, legacy);
        const definitionNameResult = buildAPIMethodResultSDS(interfaceName, memberName, legacy);

        const comment = `Method:${interfaceName}#${memberName}`;

        definitionsMetaList.push({
            name: memberName,
            description: memberDescription,
            deprecated,
            desc: [definitionNameArgs, definitionNameResult],
        });

        context.registerDefinition(
            context.currentSourceFileName,
            definitionNameArgs,
            definitionNameResult,
        );
        context.currentFileContent.push(
            ...[
                // Arguments ->
                `/**`,
                ` * @apiInterface ${interfaceName}`,
                ` * @apiMember ${interfaceName}#${memberName}`,
                ` * @description Arguments for ${comment} ${argsNames.length ? `(${argsNamesText})` : ''}`,
                ` * @comment ${comment}`,
                ` *`,
                ` * @minItems ${minArgsNum}`,
                ` * @maxItems ${maxArgsNum}`,
                ` */`,
                `export type ${definitionNameArgs} = readonly [\n${argsTypesText}\n];`,
                ``,
                // Result ->
                `/**`,
                ` * @apiInterface ${interfaceName}`,
                ` * @apiMember ${interfaceName}#${memberName}`,
                ` *`,
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

    // Inheritance first
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
                    ` * @apiInterface ${interfaceName}`,
                    ` *`,
                    ` * @${isMethod ? 'apiMethod' : 'apiProperty'} ${member.name}`,
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
            ` * @apiInterface ${interfaceName}`,
            ` *`,
            interfaceDesc && ` * @description ${interfaceDesc}`,
            interfaceDeprecated && ` * @deprecated ${interfaceDeprecated}`,
            ` * @comment Interface:${interfaceName}`,
            ` */`,
            `export interface ${buildAPIInterfaceSDS(interfaceName, legacy)}${interfaceGenericText} {`,
            membersText.stringify('\n'),
            `}`,
            ``,
        ]);

        context.registerDefinition(
            context.currentSourceFileName,
            buildAPIInterfaceSDS(interfaceName, legacy),
        );
        context.currentFileContent.push(interfaceText.stringify('\n'));
    }
}

function countRequiredParams(params: NodeArray<ParameterDeclaration>) {
    let result = 0;
    for (const param of params) {
        if (param.questionToken != null) break;
        if (param.dotDotDotToken != null) raise('Rest arguments are not supported yet');
        result++;
    }
    return result;
}

function createContext(options: SFDTGOptions, sourcesTypesGeneratorConfig: CompletedConfig) {
    const program: Program = createProgram(sourcesTypesGeneratorConfig);
    const checker = program.getTypeChecker();
    const compilerOptions = program.getCompilerOptions();
    const compilerHost = createCompilerHost(compilerOptions);
    const fileNames = program.getRootFileNames();
    const namesBySourceFile = new Map<string, Set<string>>();
    const definitions: string[] = [];
    const files: string[] = [];
    const currentFileContent: string[] = [];

    return {
        currentFileContent,
        currentSourceFileName: '',
        namesBySourceFile,
        fileNames,
        definitions,
        program,
        compilerOptions,
        compilerHost,
        typeChecker: checker,
        options,
        files,
        registerDefinition(sourceFilename: string, ...names: string[]) {
            let set = namesBySourceFile.get(sourceFilename);
            if (!set) namesBySourceFile.set(sourceFilename, (set = new Set()));
            for (const name of names) {
                definitions.push(name);
                set.add(name);
            }
        },
    };
}

const S = ' '.repeat(4);

interface DefinitionMetadata {
    name: string;
    description?: string;
    deprecated?: string;
    desc:
        | [argsText: string, resultTypeName: string] // <- Method signature
        | string; // <- Property type
}

interface SFDTGOptions extends ForgeSchemaOptions {
    tsconfig: string;
    sourcesPattern: string[];
}

type SFDTGContext = ReturnType<typeof createContext>;
