import { substr } from '@tsofist/stem/lib/string/substr';
import { SchemaObject } from 'ajv';
import { JSONSchemaFaker, JSONSchemaFakerOptions, JSONSchemaFakerRefs } from 'json-schema-faker';
import { SG_CONFIG_DEFAULTS } from './generator/types';
import { SchemaForgeDefinitionRef } from './types';
import { SchemaForgeValidator } from './validator';

const PRUNE_PROPS = Array.from(
    new Set([
        '$ref',
        '$comment',
        'description',
        'examples',
        ...(SG_CONFIG_DEFAULTS.extraTags || []),
    ]),
);

export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: string;
}

export async function generateFakeData<T = unknown>(
    validator: SchemaForgeValidator,
    source: SchemaForgeDefinitionRef,
    options: FakeGeneratorOptions = {},
): Promise<T> {
    const refs: JSONSchemaFakerRefs = {};

    {
        const rootSchemaId = substr(source, 0, '#')!;
        for (const def of validator.listDefinitions()) {
            const schema = validator.getSchema(def.ref) as SchemaObject;
            if (rootSchemaId === def.schemaId) {
                refs[`#/definitions/${def.name}`] = schema;
            } else {
                refs[def.ref] = schema;
            }
        }
    }

    const locale = options.locale;
    const faker = await import(locale ? `@faker-js/faker/locale/${locale}` : '@faker-js/faker');
    const generator = JSONSchemaFaker.extend('faker', () => faker);

    generator.option({
        alwaysFakeOptionals: true,
        refDepthMax: 1_000,
        pruneProperties: PRUNE_PROPS,
        ...options,
    });

    const schema = validator.getSchema(source);
    if (schema == null) throw new Error(`Schema not found: ${source}`);

    return generator.generate(schema as SchemaObject, refs) as T;
}
