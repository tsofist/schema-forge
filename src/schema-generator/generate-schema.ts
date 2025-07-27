import './extended-annotations-reader';
import type { ARec } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import Ajv from 'ajv';
import { JSONPath } from 'jsonpath-plus';
import {
    AnnotatedType,
    ChainNodeParser,
    CompletedConfig,
    Context,
    createFormatter,
    createParser,
    createProgram,
    DEFAULT_CONFIG,
    LiteralType,
    LiteralValue,
    NodeParser,
    NumberType,
    ReferenceType,
    SchemaGenerator,
    StringType,
    SubNodeParser,
    TupleType,
    TypeofNodeParser,
} from 'ts-json-schema-generator';
import {
    Identifier,
    isExpressionStatement,
    isNamedTupleMember,
    isSourceFile,
    isTupleTypeNode,
    Node,
    SymbolFlags,
    SyntaxKind,
    TupleTypeNode,
    TypeChecker,
    TypeFlags,
    TypeQueryNode,
} from 'typescript';
import type { ForgedSchema, ForgeSchemaOptions } from '../types';
import { readJSDocDescription } from './helpers-tsc';
import { shrinkDefinitionName } from './shrink-definition-name';
import { sortSchemaProperties } from './sort-properties';
import { SFG_CONFIG_DEFAULTS, SFG_CONFIG_MANDATORY, TMP_FILES_SUFFIX } from './types';

/**
 * @internal
 */
export async function generateSchemaByDraftTypes(options: InternalOptions): Promise<ForgedSchema> {
    {
        const seen = new Set<string>();
        for (const name of options.definitions) {
            if (seen.has(name)) raise(`Definition ${name} is duplicated`);
            seen.add(name);
        }
    }

    const allowUseFallbackDescription = options.allowUseFallbackDescription;
    const generatorConfig: CompletedConfig = {
        ...DEFAULT_CONFIG,
        ...SFG_CONFIG_DEFAULTS,
        expose: options.expose ?? SFG_CONFIG_DEFAULTS.expose,
        path: `${options.sourcesDirectoryPattern}/*${TMP_FILES_SUFFIX}.ts`,
        tsconfig: options.tsconfig,
        discriminatorType: options.discriminatorType ?? DEFAULT_CONFIG.discriminatorType,
        ...SFG_CONFIG_MANDATORY,
    };
    const generatorProgram = createProgram(generatorConfig);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const typeChecker: TypeChecker = generatorProgram.getTypeChecker();
    const parser = createParser(generatorProgram, options.sourcesTypesGeneratorConfig, (parser) => {
        parser.addNodeParser(
            new TupleTypeParser(parser as ChainNodeParser, allowUseFallbackDescription),
        );
        parser.addNodeParser(new ArrayLiteralExpressionIdentifierParser(typeChecker));
        parser.addNodeParser(new TypeofNodeParserEx(typeChecker, parser as unknown as NodeParser));
    });
    const formatter = createFormatter(options.sourcesTypesGeneratorConfig);
    const generator = new SchemaGenerator(generatorProgram, parser, formatter, generatorConfig);
    const result: ForgedSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: options.schemaId,
        hash: '',
        title: undefined,
        description: undefined,
        version: undefined,
        $comment: undefined,
    } as const;
    const defs = (result.definitions ??= {});

    for (const definitionName of options.definitions) {
        const schema = generator.createSchema(definitionName);
        Object.assign(defs, schema.definitions);
    }

    const shrinkDefinitionNames = !options.shrinkDefinitionNames
        ? undefined
        : options.shrinkDefinitionNames === true
          ? shrinkDefinitionName
          : options.shrinkDefinitionNames;

    if (shrinkDefinitionNames) {
        const replacement = new Set<string>();
        for (const name of Object.keys(defs)) {
            const shortName = shrinkDefinitionNames(name);
            if (shortName) {
                if (replacement.has(shortName) || shortName in defs) {
                    raise(`Duplicate replacement definition name: ${shortName}`);
                }

                // rename property
                defs[shortName] = defs[name];
                delete defs[name];

                // rename references
                const targets: { $ref: string }[] = JSONPath({
                    path: `$..[?(@ && @.$ref == "#/definitions/${escapeDefinitionNameForJSONPath(name)}")]`,
                    json: result,
                    eval: 'safe',
                });
                targets?.forEach((item) => {
                    item.$ref = item.$ref.replace(
                        `#/definitions/${name}`,
                        `#/definitions/${shortName}`,
                    );
                });
            }
        }
    }

    result.definitions = Object.fromEntries(Object.entries((defs || {}) as ARec).sort());

    if (options.sortObjectProperties) sortSchemaProperties(result.definitions);

    await new Ajv({
        strict: true,
        allErrors: true,
        strictSchema: true,
        strictTypes: false,
        strictTuples: true,
        allowUnionTypes: true,
    }).validateSchema(result, true);

    return result;
}

function escapeDefinitionNameForJSONPath(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

class TypeofNodeParserEx extends TypeofNodeParser {
    override createType(node: TypeQueryNode, context: Context, reference?: ReferenceType) {
        const tc: TypeChecker = this.typeChecker;

        let symbol = tc.getSymbolAtLocation(node.exprName);
        if (symbol && symbol.flags & SymbolFlags.Alias) {
            symbol = tc.getAliasedSymbol(symbol);
            const declaration = symbol.valueDeclaration;
            if (
                declaration &&
                isSourceFile(declaration) &&
                declaration.fileName.endsWith('.json')
            ) {
                const statement = declaration.statements.at(0);
                if (statement && isExpressionStatement(statement)) {
                    return this.childNodeParser.createType(
                        statement.expression,
                        context,
                        reference,
                    );
                }
            }
        }

        return super.createType(node, context, reference);
    }
}

class TupleTypeParser implements SubNodeParser {
    constructor(
        protected readonly childNodeParser: ChainNodeParser,
        protected readonly allowUseFallbackDescription: boolean | undefined,
    ) {}

    supportsNode(node: Node): boolean {
        return isTupleTypeNode(node);
    }

    createType(node: TupleTypeNode, context: Context) {
        const items = node.elements.map((element) => {
            const type = this.childNodeParser.createType(element, context);

            if (isNamedTupleMember(element)) {
                const description = readJSDocDescription(element, this.allowUseFallbackDescription);
                const nullable = type instanceof AnnotatedType ? type.isNullable() : false;
                return description ? new AnnotatedType(type, { description }, nullable) : type;
            }

            return type;
        });

        return new TupleType(items);
    }
}

class ArrayLiteralExpressionIdentifierParser implements SubNodeParser {
    constructor(protected readonly checker: TypeChecker) {}

    supportsNode(node: Node): boolean {
        return (
            node.kind === SyntaxKind.Identifier &&
            node.parent.kind === SyntaxKind.ArrayLiteralExpression
        );
    }

    createType(node: Identifier) {
        const type = this.checker.getTypeAtLocation(node);

        if (
            type.flags & TypeFlags.StringOrNumberLiteral ||
            type.flags & TypeFlags.UnionOrIntersection
        ) {
            const val = getIdentifierLiteralValue(node, this.checker);
            if (val == null) raise(`Literal value for ${node.getText()} can't be inferred`);
            return new LiteralType(val);
        } else if (type.flags & TypeFlags.StringLike) {
            return new StringType();
        } else if (type.flags & TypeFlags.NumberLike) {
            return new NumberType();
        } else {
            raise(`Identifier ${node.getText()} is of unsupported type`);
        }
    }
}

function getIdentifierLiteralValue(
    node: Identifier,
    checker: TypeChecker,
): LiteralValue | undefined {
    const type = checker.getTypeAtLocation(node);
    if (type.isNumberLiteral() || type.isStringLiteral()) {
        return type.value;
    }
    return undefined;
}

interface InternalOptions extends ForgeSchemaOptions {
    tsconfig: string;
    definitions: readonly string[];
    sourcesTypesGeneratorConfig: CompletedConfig;
}
