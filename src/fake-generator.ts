import * as fakerModule from '@faker-js/faker';
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
        //
        ...(SG_CONFIG_DEFAULTS.extraTags || []),
    ]),
);

export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: string;
    setupFakerModules?(faker: fakerModule.Faker): object;
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
            let schema = validator.getSchema(def.ref) as SchemaObject;

            // todo: fix this
            if (schema.$ref) {
                const { description, examples, ...rest } = schema;
                schema = rest;
            }

            if (rootSchemaId === def.schemaId) {
                refs[`#/definitions/${def.name}`] = schema;
            } else {
                refs[def.ref] = schema;
            }
        }
    }

    const localeName = options.locale || 'en';
    const locale = localeName in fakerModule ? (fakerModule as any)[localeName] : undefined;
    const generator = JSONSchemaFaker.extend('faker', () => {
        const faker = new fakerModule.Faker({ locale });
        if (options.setupFakerModules) {
            const modules = options.setupFakerModules(faker);
            Object.assign(faker, modules);
        }
        return faker;
    });

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
