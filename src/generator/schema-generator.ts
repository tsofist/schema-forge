import { raise } from '@tsofist/stem/lib/error';
import '../util/patch.extended-annotations-reader';
import Ajv, { SchemaObject } from 'ajv';
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
    NumberType,
    SchemaGenerator,
    StringType,
    SubNodeParser,
    TupleType,
} from 'ts-json-schema-generator';
import {
    Identifier,
    isNamedTupleMember,
    isTupleTypeNode,
    Node,
    SyntaxKind,
    TupleTypeNode,
    TypeChecker,
    TypeFlags,
} from 'typescript';
import { sortProperties } from '../util/sort-properties';
import { readJSDocDescription } from '../util/tsc';
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
    allowUseFallbackDescription?: boolean;
}

export async function generateSchemaByDraftTypes(options: Options): Promise<SchemaObject> {
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
        ...SG_CONFIG_DEFAULTS,
        expose: options.expose ?? SG_CONFIG_DEFAULTS.expose,
        path: `${options.sourcesDirectoryPattern}/*${TMP_FILES_SUFFIX}.ts`,
        tsconfig: options.tsconfig,
        discriminatorType: options.openAPI ? 'open-api' : DEFAULT_CONFIG.discriminatorType,
        ...SG_CONFIG_MANDATORY,
    };
    const generatorProgram = createProgram(generatorConfig);
    const typeChecker = generatorProgram.getTypeChecker();
    const parser = createParser(generatorProgram, options.sourcesTypesGeneratorConfig, (parser) => {
        parser.addNodeParser(
            new TupleTypeParser(parser as ChainNodeParser, allowUseFallbackDescription),
        );
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

export class TupleTypeParser implements SubNodeParser {
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
                if (nullable) console.log(description, nullable);
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
