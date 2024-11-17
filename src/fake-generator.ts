import * as fakerModule from '@faker-js/faker';
import { ARec, ArrayMay } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { ISOTimeString } from '@tsofist/stem/lib/cldr';
import { entries } from '@tsofist/stem/lib/object/entries';
import { substr } from '@tsofist/stem/lib/string/substr';
import { SchemaObject } from 'ajv';
import { JSONSchemaFaker, JSONSchemaFakerOptions, JSONSchemaFakerRefs } from 'json-schema-faker';
import { SchemaForgeDefinitionRef } from './types';
import { SchemaForgeValidator } from './validator';

export type SetupFakerModules = (faker: fakerModule.Faker) => object;
export type FakerRangeNum = Parameters<fakerModule.HelpersModule['rangeToNumber']>[0];

export type FakeGeneratorLocaleName = keyof typeof fakerModule.allLocales;
export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: ArrayMay<FakeGeneratorLocaleName>;
    setupFakerModules?: SetupFakerModules[];
}

export interface FakeGeneratorHost {
    readonly validator: SchemaForgeValidator;
    readonly faker: fakerModule.Faker;
    readonly generator: typeof JSONSchemaFaker;
    readonly rebuild: () => this;
}

export function createFakeGeneratorHost(
    source: SchemaForgeValidator,
    options: FakeGeneratorOptions = {},
): FakeGeneratorHost {
    const rebuild = (): FakeGeneratorHost => {
        const validator = source;

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
        });

        generator.format('iso-time', (): ISOTimeString => {
            return substr(faker.date.anytime() as unknown as string, 'T', '.')!;
        });

        return {
            rebuild,
            generator,
            faker,
            validator,
        };
    };

    return rebuild();
}

export function generateFakeData<T = unknown>(
    validator: SchemaForgeValidator,
    source: SchemaForgeDefinitionRef,
    options?: FakeGeneratorOptions,
): T;
export function generateFakeData<T = unknown>(
    host: FakeGeneratorHost,
    source: SchemaForgeDefinitionRef,
): T;
export function generateFakeData<T = unknown>(
    validatorOrHost: SchemaForgeValidator | FakeGeneratorHost,
    source: SchemaForgeDefinitionRef,
    options: FakeGeneratorOptions = {},
): T {
    const host =
        'validator' in validatorOrHost
            ? validatorOrHost
            : createFakeGeneratorHost(validatorOrHost, options);

    const { validator, generator } = host;

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

    const schema = validator.getSchema(source);
    if (schema == null) throw new Error(`Schema not found: ${source}`);

    const result = generator.generate(schema as SchemaObject, refs) as T;
    cleanJSFQuirksArtefacts(result as unknown as ARec);
    return result;
}

const EmbeddedModules: SetupFakerModules[] = [
    (faker) => ({
        sf: {
            /** FakerModule: sf.url */
            url(
                origin: string = 'https://example.com',
                paths: FakerRangeNum = { min: 1, max: 5 },
                pathWords: FakerRangeNum = { min: 1, max: 3 },
            ): string {
                const pathParts = new Array(faker.helpers.rangeToNumber(paths))
                    .fill('')
                    .map(() => faker.lorem.slug(pathWords));
                return `${origin}/${pathParts.join('/')}`;
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

function cleanJSFQuirksArtefacts<T extends ARec>(target: T): T {
    const stack: [value: ARec | any[]][] = [[target]];

    const hasProblem = (item: unknown | ARec): boolean => {
        return (
            typeof item === 'object' &&
            item !== null &&
            ('$ref' in item || 'anyOf' in item || 'allOf' in item || 'not' in item)
        );
    };

    while (stack.length > 0) {
        const [current] = stack.pop()!;

        if (Array.isArray(current)) {
            for (let i = current.length - 1; i >= 0; i--) {
                const element = current[i];
                if (hasProblem(element)) {
                    current.splice(i, 1);
                } else if (typeof element === 'object' && element !== null) {
                    stack.push([element]);
                }
            }
        } else if (current != null && typeof current === 'object') {
            for (const [propKey, propValue] of entries(current)) {
                if (hasProblem(propValue)) {
                    delete current[propKey];
                } else if (typeof propValue === 'object' && propValue !== null) {
                    stack.push([propValue]);
                }
            }
        }
    }

    return target;
}
