import { Faker, allLocales, HelpersModule } from '@faker-js/faker';
import type { ArrayMay } from '@tsofist/stem';
import { JSONSchemaFaker, type JSONSchemaFakerOptions } from 'json-schema-faker';
import type { SchemaForgeRegistry } from '../schema-registry/types';

export type SetupFakerModules = (faker: Faker) => object;
export type FakerRangeNum = Parameters<HelpersModule['rangeToNumber']>[0];

export type FakeGeneratorLocaleName = keyof typeof allLocales;

export type FakeGeneratorOptions = {
    locale?: ArrayMay<FakeGeneratorLocaleName>;
    setupFakerModules?: SetupFakerModules[];
} & JSONSchemaFakerOptions;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface FakeGeneratorHost {
    readonly schemaRegistry: SchemaForgeRegistry;
    readonly faker: Faker;
    readonly generator: typeof JSONSchemaFaker;
    readonly rebuild: () => this;
}
