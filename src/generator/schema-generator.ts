import { URec } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { compareStringsAsc } from '@tsofist/stem/lib/string/compare';
import Ajv, { SchemaObject } from 'ajv';
import {
    Annotations,
    createFormatter,
    createParser,
    createProgram,
    ExtendedAnnotationsReader,
    LiteralType,
    LiteralValue,
    NumberType,
    SchemaGenerator,
    StringType,
    SubNodeParser,
    CompletedConfig,
    DEFAULT_CONFIG,
} from 'ts-json-schema-generator';
import {
    getAllJSDocTags,
    Identifier,
    isIdentifier,
    isIntersectionTypeNode,
    isTypeAliasDeclaration,
    isTypeReferenceNode,
    isUnionTypeNode,
    JSDocTag,
    Node,
    Program,
    SymbolFlags,
    SyntaxKind,
    TypeChecker,
    TypeFlags,
} from 'typescript';
import { SG_CONFIG_DEFAULTS, SG_CONFIG_MANDATORY, TMP_FILES_SUFFIX, TypeExposeKind } from './types';

interface Options {
    tsconfig: string;
    sourcesDirectoryPattern: string;
    sourcesTypesGeneratorConfig: CompletedConfig;
    outputSchemaFile: string;
    definitions: string[];
    schemaId?: string;
    expose?: TypeExposeKind;
    openAPI?: boolean;
    sortObjectProperties?: boolean;
}

export async function generateSchemaByDraftTypes(options: Options): Promise<SchemaObject> {
    {
        const seen = new Set<string>();
        for (const name of options.definitions) {
            if (seen.has(name)) raise(`Definition ${name} is duplicated`);
            seen.add(name);
        }
    }

    const generatorConfig: CompletedConfig = {
        ...DEFAULT_CONFIG,
        ...SG_CONFIG_DEFAULTS,
        expose: options.expose ?? SG_CONFIG_DEFAULTS.expose,
        path: `${options.sourcesDirectoryPattern}/*${TMP_FILES_SUFFIX}.ts`,
        tsconfig: options.tsconfig,
        discriminatorType: options.openAPI ? 'open-api' : DEFAULT_CONFIG.discriminatorType,
        ...SG_CONFIG_MANDATORY,
    };
    const generatorProgram: Program = createProgram(generatorConfig);
    const typeChecker = generatorProgram.getTypeChecker();
    const parser = createParser(generatorProgram, options.sourcesTypesGeneratorConfig, (parser) => {
        parser.addNodeParser(new ArrayLiteralExpressionIdentifierParser(typeChecker));
    });

    const formatter = createFormatter(options.sourcesTypesGeneratorConfig);
    const generator = new SchemaGenerator(generatorProgram, parser, formatter, generatorConfig);

    const result: SchemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: options.schemaId,
        hash: '',
        definitions: {},
    };
    for (const definitionName of options.definitions) {
        const schema = generator.createSchema(definitionName);
        Object.assign(result.definitions, schema.definitions);
    }
    result.definitions = Object.fromEntries(Object.entries(result.definitions || {}).sort());

    if (options.sortObjectProperties) sortProperties(result.definitions);

    await new Ajv({
        strict: true,
        allErrors: true,
    }).validateSchema(result, true);

    return result;
}

function sortProperties<T extends SchemaObject>(schema: T): T {
    const stack: unknown[] = [];

    const isTarget = (
        target: unknown,
    ): target is { type: 'object'; properties: URec; required?: string[] } => {
        return (
            target != null &&
            typeof target === 'object' &&
            'type' in target &&
            target.type === 'object' &&
            'properties' in target &&
            typeof target.properties === 'object' &&
            !isEmptyObject(target.properties)
        );
    };

    const process = (item: unknown) => {
        if (!item) return;

        if (Array.isArray(item)) {
            stack.push(...item);
        } else {
            if (isTarget(item)) {
                item.properties = Object.fromEntries(
                    Object.entries(item.properties).sort(([a], [b]) => compareStringsAsc(a, b)),
                );
                if (item.required?.length) item.required.sort(compareStringsAsc);
            }
            if (typeof item === 'object') {
                stack.push(...Object.values(item));
            }
        }
    };

    process(schema);
    while (stack.length) {
        process(stack.pop());
    }

    return schema;
}

class ArrayLiteralExpressionIdentifierParser implements SubNodeParser {
    constructor(private readonly checker: TypeChecker) {}

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

function hasInheritDocTag(node: Node): boolean {
    return (
        getAllJSDocTags(node, (tag): tag is JSDocTag => {
            return tag.tagName.text === 'inheritDoc';
        }).length > 0
    );
}

{
    // Support for @inheritDoc tag to enforce inheritance of annotations

    const getAnnotations = ExtendedAnnotationsReader.prototype.getAnnotations;

    ExtendedAnnotationsReader.prototype.getAnnotations = function getAnnotationsWithInheritance(
        node: Node,
    ): Annotations | undefined {
        if (!hasInheritDocTag(node)) return getAnnotations.call(this, node);

        const checker =
            ((this as any).typeChecker as TypeChecker) || raise('TypeChecker is not available');
        const result: Annotations = {};

        if (
            !('ref' in result) &&
            !('$ref' in result) &&
            //
            isTypeAliasDeclaration(node) &&
            //
            isTypeReferenceNode(node.type) &&
            isIdentifier(node.type.typeName) &&
            !isUnionTypeNode(node.type) &&
            !isIntersectionTypeNode(node.type)
        ) {
            const alias = checker.getSymbolAtLocation(node.type.typeName);
            const symbol =
                alias && SymbolFlags.Alias & alias.flags
                    ? checker.getAliasedSymbol(alias)
                    : undefined;

            const inheritedAnn: Annotations = {};
            if (symbol && symbol.declarations?.length) {
                for (const declaration of symbol.declarations) {
                    const ann = getAnnotations.call(this, declaration);
                    if (ann) Object.assign(inheritedAnn, ann);
                }
            }

            Object.assign(result, inheritedAnn);
        }

        {
            const ann = getAnnotations.call(this, node);
            if (ann) Object.assign(result, ann);
        }

        return isEmptyObject(result) ? undefined : result;
    };
}
