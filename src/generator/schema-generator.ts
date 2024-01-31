import { raise } from '@tsofist/stem/lib/error';
import Ajv, { SchemaObject } from 'ajv';
import {
    Config,
    createFormatter,
    createParser,
    createProgram,
    SchemaGenerator,
} from 'ts-json-schema-generator';
import { Program } from 'typescript';
import { SG_CONFIG_DEFAULTS, SG_CONFIG_MANDATORY, TMP_FILES_SUFFIX, TypeExposeKind } from './types';

interface Options {
    tsconfig: string;
    sourcesDirectoryPattern: string;
    sourcesTypesGeneratorConfig: Config;
    outputSchemaFile: string;
    definitions: string[];
    schemaId?: string;
    expose?: TypeExposeKind;
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
        ...SG_CONFIG_MANDATORY,
    };
    const generatorProgram: Program = createProgram(generatorConfig);
    const parser = createParser(generatorProgram, options.sourcesTypesGeneratorConfig);
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

    void new Ajv().validateSchema(result, true);

    return result;
}
