import * as fakerModule from '@faker-js/faker';
import { ArrayMay } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { ISOTimeString } from '@tsofist/stem/lib/cldr';
import { hasOwn } from '@tsofist/stem/lib/object/has-own';
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
export type FakerRangeNum = Parameters<fakerModule.HelpersModule['rangeToNumber']>[0];

export type FakeGeneratorLocaleName = keyof typeof fakerModule.allLocales;
export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: ArrayMay<FakeGeneratorLocaleName>;
    setupFakerModules?: SetupFakerModules[];
}

export function generateFakeData<T = unknown>(
    validator: SchemaForgeValidator,
    source: SchemaForgeDefinitionRef,
    options: FakeGeneratorOptions = {},
): T {
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

    const faker = new fakerModule.Faker({
        locale: asArray<FakeGeneratorLocaleName>(
            options.locale || ['en' satisfies FakeGeneratorLocaleName],
        ).map((name) => fakerModule.allLocales[name]),
    });

    const generator = JSONSchemaFaker.extend('faker', () => {
        Object.assign(faker, {
            date: proxyFakerDateModule(faker.date),
        });

        for (const item of [
            //
            ...EmbeddedModules,
            ...(options.setupFakerModules || []),
        ]) {
            const modules = item(faker);
            Object.assign(faker, modules);
        }

        return faker;
    });

    generator.option({
        alwaysFakeOptionals: true,
        refDepthMax: 1_000,
        ...options,
        resolveJsonPath: false,
        pruneProperties: PRUNE_PROPS,
    });

    generator.format('iso-time', (): ISOTimeString => {
        return substr(faker.date.anytime() as unknown as string, 'T', '.')!;
    });

    const schema = validator.getSchema(source);
    if (schema == null) throw new Error(`Schema not found: ${source}`);

    return generator.generate(schema as SchemaObject, refs) as T;
}

const EmbeddedModules: SetupFakerModules[] = [
    (faker) => ({
        sf: {
            url(
                prefix: string = 'https://example.com',
                parts: FakerRangeNum = { min: 1, max: 5 },
                words: FakerRangeNum = { min: 1, max: 3 },
            ): string {
                const pathParts = new Array(faker.helpers.rangeToNumber(parts))
                    .fill('')
                    .map(() => faker.lorem.slug(words));
                return `${prefix}/${pathParts.join('/')}`;
            },
        },
    }),
];

function proxyFakerDateModule<T extends object>(obj: T): T {
    return new Proxy(obj, {
        get(target, prop, receiver) {
            const originalValue = Reflect.get(target, prop, receiver);

            if (typeof originalValue === 'function') {
                return function (this: any, ...args: any[]) {
                    const result: unknown = originalValue.apply(this, args);
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
            if (hasOwn(rest, key)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                rest[key] = fixJSONSchemaFakerQuirks(rest[key]);
            }
        }
        return rest;
    } else if (Array.isArray(schema)) {
        return (schema as SchemaObject[]).map(fixJSONSchemaFakerQuirks);
    }

    const result: SchemaObject = {};
    for (const key in schema) {
        if (hasOwn(schema, key)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            result[key] = fixJSONSchemaFakerQuirks(schema[key]);
        }
    }
    return result;
}
