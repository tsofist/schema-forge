import { raise } from '@tsofist/stem/lib/error';
import Ajv, { SchemaObject } from 'ajv';
import {
    Config,
    createFormatter,
    createParser,
    createProgram,
    LiteralType,
    NumberType,
    SchemaGenerator,
    StringType,
    SubNodeParser,
} from 'ts-json-schema-generator';
import { LiteralValue } from 'ts-json-schema-generator/src/Type/LiteralType';
import { Identifier, Node, Program, SyntaxKind, TypeChecker, TypeFlags } from 'typescript';
import { SG_CONFIG_DEFAULTS, SG_CONFIG_MANDATORY, TMP_FILES_SUFFIX, TypeExposeKind } from './types';

interface Options {
    tsconfig: string;
    sourcesDirectoryPattern: string;
    sourcesTypesGeneratorConfig: Config;
    outputSchemaFile: string;
    definitions: string[];
    schemaId?: string;
    expose?: TypeExposeKind;
    openAPI?: boolean;
}

export async function generateSchemaByDraftTypes(options: Options): Promise<SchemaObject> {
    {
        const seen = new Set<string>();
        for (const name of options.definitions) {
            if (seen.has(name)) raise(`Definition ${name} is duplicated`);
            seen.add(name);
        }
    }

    const generatorConfig: Config = {
        ...SG_CONFIG_DEFAULTS,
        expose: options.expose,
        path: `${options.sourcesDirectoryPattern}/*${TMP_FILES_SUFFIX}.ts`,
        tsconfig: options.tsconfig,
        discriminatorType: options.openAPI ? 'open-api' : undefined,
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
        definitions: {},
    };
    for (const definitionName of options.definitions) {
        const schema = generator.createSchema(definitionName);
        Object.assign(result.definitions, schema.definitions);
    }
    result.definitions = Object.fromEntries(Object.entries(result.definitions || {}).sort());

    await new Ajv({
        strict: true,
        allErrors: true,
    }).validateSchema(result, true);

    return result;
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
