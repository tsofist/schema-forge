import * as fakerModule from '@faker-js/faker';
import type { ArrayMay } from '@tsofist/stem';
import { JSONSchemaFaker, type JSONSchemaFakerOptions } from 'json-schema-faker';
import type { SchemaForgeRegistry } from '../schema-registry/types';

export type SetupFakerModules = (faker: fakerModule.Faker) => object;
export type FakerRangeNum = Parameters<fakerModule.HelpersModule['rangeToNumber']>[0];

export type FakeGeneratorLocaleName = keyof typeof fakerModule.allLocales;
export interface FakeGeneratorOptions extends JSONSchemaFakerOptions {
    locale?: ArrayMay<FakeGeneratorLocaleName>;
    setupFakerModules?: SetupFakerModules[];
}

export interface FakeGeneratorHost {
    readonly schemaRegistry: SchemaForgeRegistry;
    readonly faker: fakerModule.Faker;
    readonly generator: typeof JSONSchemaFaker;
    readonly rebuild: () => this;
}
