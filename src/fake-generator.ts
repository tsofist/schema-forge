import * as fakerModule from '@faker-js/faker';
import { hasOwnProperty } from '@tsofist/stem';
import { ISOTimeString } from '@tsofist/stem/lib/cldr';
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

export type SetupFakerModules = (faker: fakerModule.Faker) => object;

export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: string;
    setupFakerModules?: SetupFakerModules[];
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
            schema = fixJSONSchemaFakerQuirks(schema);

            if (rootSchemaId === def.schemaId) {
                refs[`#/definitions/${def.name}`] = schema;
            } else {
                refs[def.ref] = schema;
            }
        }
    }

    const localeName = options.locale || 'en';
    const locale = localeName in fakerModule ? (fakerModule as any)[localeName] : undefined;
    const faker = new fakerModule.Faker({ locale });

    const generator = JSONSchemaFaker.extend('faker', () => {
        Object.assign(faker, {
            date: proxyFakerDateModule(faker.date),
        });

        if (options.setupFakerModules?.length) {
            for (const item of options.setupFakerModules) {
                const modules = item(faker);
                Object.assign(faker, modules);
            }
        }
        return faker;
    });

    generator.option({
        alwaysFakeOptionals: true,
        refDepthMax: 1_000,
        ...options,
        pruneProperties: PRUNE_PROPS,
    });

    generator.format('iso-time', (): ISOTimeString => {
        return substr(faker.date.anytime() as unknown as string, 'T', '.')!;
    });

    const schema = validator.getSchema(source);
    if (schema == null) throw new Error(`Schema not found: ${source}`);

    return generator.generate(schema as SchemaObject, refs) as T;
}

function proxyFakerDateModule<T extends object>(obj: T): T {
    return new Proxy(obj, {
        get(target, prop, receiver) {
            const originalValue = Reflect.get(target, prop, receiver);

            if (typeof originalValue === 'function') {
                return function (this: any, ...args: any[]) {
                    const result = originalValue.apply(this, args);
                    return result instanceof Date ? result.toISOString() : result;
                };
            }

            return originalValue;
        },
    });
}

function fixJSONSchemaFakerQuirks(schema: SchemaObject): SchemaObject {
    if (typeof schema !== 'object' || schema == null) {
        return schema;
    }

    if (schema.$ref) {
        const { description, examples, ...rest } = schema;

        for (const key in rest) {
            if (hasOwnProperty.call(rest, key)) {
                rest[key] = fixJSONSchemaFakerQuirks(rest[key]);
            }
        }
        return rest;
    } else if (Array.isArray(schema)) {
        return schema.map(fixJSONSchemaFakerQuirks);
    }

    const result: SchemaObject = {};
    for (const key in schema) {
        if (hasOwnProperty.call(schema, key)) {
            result[key] = fixJSONSchemaFakerQuirks(schema[key]);
        }
    }
    return result;
}
