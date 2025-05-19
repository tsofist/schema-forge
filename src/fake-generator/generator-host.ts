import * as fakerModule from '@faker-js/faker';
import { asArray } from '@tsofist/stem/lib/as-array';
import { JSONSchemaFaker } from 'json-schema-faker';
import type { SchemaForgeRegistry } from '../schema-registry/types';
import { EmbeddedFakerModules } from './modules';
import type { FakeGeneratorHost, FakeGeneratorLocaleName, FakeGeneratorOptions } from './types';

export function createFakeGeneratorHost(
    source: SchemaForgeRegistry,
    options: FakeGeneratorOptions = {},
): FakeGeneratorHost {
    const rebuild = (): FakeGeneratorHost => {
        const schemaRegistry = source;

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
                ...EmbeddedFakerModules,
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
            pruneProperties: ['dbEntity', 'dbIndex', 'dbColumn'],
            ...options,
            resolveJsonPath: false,
        });

        return {
            rebuild,
            generator,
            faker,
            schemaRegistry,
        };
    };

    return rebuild();
}

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
