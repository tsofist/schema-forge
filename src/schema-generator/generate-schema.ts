import './extended-annotations-reader';
import type { ARec } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { valueIn } from '@tsofist/stem/lib/value-in';
import Ajv from 'ajv';
import { JSONSchema7Type } from 'json-schema';
import { JSONPath } from 'jsonpath-plus';
import {
    AnnotatedType,
    BaseType,
    ChainNodeParser,
    CompletedConfig,
    Context,
    createFormatter,
    createParser,
    createProgram,
    DEFAULT_CONFIG,
    Definition,
    DefinitionType,
    EnumType,
    EnumTypeFormatter,
    LiteralType,
    LiteralValue,
    NodeParser,
    NumberType,
    ReferenceType,
    SchemaGenerator,
    StringMap,
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
import { ForgedPropertySchema, ForgedSchema, ForgeSchemaOptions } from '../types';
import { readJSDocDescription } from './helpers-tsc';
import { SGEnumAnnotationOptions, SGEnumMemberOptions } from './kw.types';
import { patchEnumNodeParser, SFEnumMetadataMap } from './patch-enum-node-parser';
import { shrinkDefinitionName } from './shrink-definition-name';
import { sortSchemaContents } from './sort-contents';
import { SFG_CONFIG_DEFAULTS, SFG_CONFIG_MANDATORY, TMP_FILES_SUFFIX } from './types';

/**
 * @internal
 */
export async function generateSchemaByDraftTypes(options: InternalOptions): Promise<ForgedSchema> {
    const allowUseFallbackDescription = options.allowUseFallbackDescription;
    const generatorConfig: CompletedConfig = {
        ...DEFAULT_CONFIG,
        ...SFG_CONFIG_DEFAULTS,
        expose: options.expose ?? SFG_CONFIG_DEFAULTS.expose,
        path: `${options.sourcesDirectoryPattern}/*${TMP_FILES_SUFFIX}.ts`,
        tsconfig: options.tsconfig,
        skipTypeCheck: options.skipTypeCheck ?? SFG_CONFIG_DEFAULTS.skipTypeCheck,
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
    const enumMetadataMap: SFEnumMetadataMap = new Map();

    patchEnumNodeParser(parser, typeChecker, enumMetadataMap, allowUseFallbackDescription);

    const result: ForgedSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: options.schemaId,
        version: undefined,
        hash: '',
        package: undefined,
        repository: undefined,
        description: undefined,
        title: undefined,
        $comment: undefined,
        definitions: undefined,
        $defs: undefined,
    } as const;
    const defs = (result.definitions ??= {});
    const formatter = createFormatter(options.sourcesTypesGeneratorConfig, (formatter) => {
        formatter.addTypeFormatter(new EnumTypeFormatterEx(enumMetadataMap));
    });
    const generator = new SchemaGeneratorEx(generatorProgram, parser, formatter, generatorConfig);

    if (options.suppressMultipleDefinitionsErrors) {
        generator.setMultipleDefinitionsErrorSuppression(true);
    }

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

    if (options.sortContents ?? true) sortSchemaContents(result.definitions, options.sortContents);

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

class EnumTypeFormatterEx extends EnumTypeFormatter {
    constructor(protected readonly metaMap: SFEnumMetadataMap) {
        super();
    }

    override getDefinition(type: EnumType): ForgedPropertySchema {
        const id = type.getId();
        const inherited = super.getDefinition(type);
        const isMember = 'const' in inherited;

        if (inherited && (inherited.enum || inherited.const)) {
            let count = 0;
            const enumAnnotation: SGEnumAnnotationOptions = {};
            const enumMember = {} as SGEnumMemberOptions;
            const append = (value: JSONSchema7Type) => {
                if (valueIn(typeof value, ['string', 'number'])) {
                    const v = value as string | number;
                    const key = `${id}.${v}`;
                    const doc = this.metaMap.get(key);
                    if (doc) {
                        count++;
                        if (isMember) {
                            enumMember.title = doc.title;
                            if (doc.description) enumMember.note = doc.description;
                            if (doc.comment) enumMember.comment = doc.comment;
                            if (doc.typeName) enumMember.enum = doc.typeName;
                        } else {
                            const rec = (enumAnnotation[doc.title] = [doc.value]);
                            if (doc.description) rec.push(doc.description);
                            if (doc.comment) rec.push(doc.comment);
                            if (isMember && doc.typeName) {
                                enumAnnotation[''] = [doc.typeName];
                            }
                        }
                    }
                }
            };

            if (inherited.const) {
                append(inherited.const);
            } else if (inherited.enum) {
                for (const value of inherited.enum) {
                    append(value);
                }
            }

            if (count > 0) {
                if (isMember && !isEmptyObject(enumMember)) {
                    return {
                        ...inherited,
                        enumMember,
                    };
                } else if (!isMember && !isEmptyObject(enumAnnotation)) {
                    return {
                        ...inherited,
                        enumAnnotation,
                    };
                }
            }
        }
        return inherited;
    }
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

class SchemaGeneratorEx extends SchemaGenerator {
    #multipleDefinitionsErrorSuppression = false;

    setMultipleDefinitionsErrorSuppression(value: boolean) {
        this.#multipleDefinitionsErrorSuppression = value;
    }

    protected override appendRootChildDefinitions(
        rootType: BaseType,
        childDefinitions: StringMap<Definition>,
    ) {
        if (this.#multipleDefinitionsErrorSuppression) {
            const seen = new Set<string>();
            const children = this.typeFormatter
                .getChildren(rootType)
                .filter((child): child is DefinitionType => child instanceof DefinitionType)
                .filter((child) => {
                    if (!seen.has(child.getId())) {
                        seen.add(child.getId());
                        return true;
                    }
                    return false;
                });

            children.reduce((definitions, child) => {
                const name = child.getName();
                if (!(name in definitions)) {
                    definitions[name] = this.typeFormatter.getDefinition(child.getType());
                }
                return definitions;
            }, childDefinitions);
        } else {
            super.appendRootChildDefinitions(rootType, childDefinitions);
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

function escapeDefinitionNameForJSONPath(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

interface InternalOptions extends ForgeSchemaOptions {
    tsconfig: string;
    definitions: readonly string[];
    sourcesTypesGeneratorConfig: CompletedConfig;
}
