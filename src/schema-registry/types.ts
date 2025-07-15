import type { ArrayMay, Nullable } from '@tsofist/stem';
import type { NonNegativeInt } from '@tsofist/stem/lib/number/integer/types';
import type { ErrorsTextOptions, Options } from 'ajv';
import type { Options as AjvOptions } from 'ajv/dist/core';
import type { JSONSchema7 } from 'json-schema';
import type { SchemaDefinitionInfo } from '../definition-info/types';
import type { SchemaForgeValidationContextBase } from '../efc';
import type {
    SchemaForgeDefinitionRef,
    SchemaForgeValidationFunction,
    SchemaForgeValidationReport,
    SchemaForgeValidationResult,
} from '../types';

export type SchemaForgeRegistryListDefinitionsPredicate = (
    info: SchemaDefinitionInfo,
    keywords: Set<string>,
) => boolean;

export interface SchemaForgeRegistry {
    /**
     * Number of compiled schemas in registry
     */
    readonly compilationArtifactCount: NonNegativeInt;

    /**
     * Revision number of registry.
     * This number is represented as a number of add/remove/clear operations.
     */
    readonly rev: NonNegativeInt;

    /**
     * Clone schemaRegistry with overridden options
     */
    clone: (
        options?: Omit<Options, 'schemas'>,
        onSchema?: (schema: JSONSchema7) => JSONSchema7,
    ) => SchemaForgeRegistry;

    /**
     * Remove all schemas from registry
     */
    clear: VoidFunction;

    /**
     * Add root schema's to registry
     */
    addSchema: (schema: JSONSchema7[]) => void;

    /**
     * Check if schema (or definition) is already registered
     */
    hasSchema: (ref: SchemaForgeDefinitionRef) => boolean;

    /**
     * Remove schema (or definition) from registry
     */
    removeSchema: (ref: ArrayMay<SchemaForgeDefinitionRef>) => void;

    /**
     * Get schema (or definition) object
     */
    getSchema: (ref: SchemaForgeDefinitionRef) => JSONSchema7 | undefined;

    /**
     * Get schema (or definition) validation function
     */
    getValidator: <TData = unknown>(
        ref: SchemaForgeDefinitionRef | JSONSchema7,
    ) => SchemaForgeValidationFunction<TData> | undefined;

    /**
     * Get root schema object
     */
    getRootSchema: (schemaId: string) => JSONSchema7 | undefined;

    /**
     * Validate data by schema definition reference
     */
    validateBySchema: (
        ref: SchemaForgeDefinitionRef,
        data: unknown,
        instancePath?: string,
    ) => SchemaForgeValidationResult;

    /**
     * Check (throw error if invalid) data by schema definition reference
     */
    checkBySchema: <
        T = unknown,
        Ctx extends SchemaForgeValidationContextBase = SchemaForgeValidationContextBase,
    >(
        ref: SchemaForgeDefinitionRef,
        data: T,
        context?: Ctx,
    ) => data is T;

    /**
     * Get validation errors text
     */
    validationErrorsText: (
        errors: Nullable<SchemaForgeValidationReport>,
        options?: ErrorsTextOptions,
    ) => string;

    /**
     * List schema definitions
     */
    listDefinitions: (
        predicate?: SchemaForgeRegistryListDefinitionsPredicate,
    ) => SchemaDefinitionInfo[];

    /**
     * Asynchronously warm up schemaRegistry cache.
     * This action is useful to pre-compile all schemas and their definitions
     */
    warmupCache: (schemasPerIteration?: number, delayMs?: number) => Promise<void>;

    /**
     * Synchronously warm up schemaRegistry cache.
     * This action is useful to pre-compile all schemas and their definitions
     */
    warmupCacheSync: VoidFunction;
}

export interface SchemaForgeRegistryOptions {
    /**
     * Extra ajv options
     *
     * @see https://ajv.js.org/options.html Options reference
     * @see https://ajv.js.org/json-schema.html Schema reference
     */
    engine?: AjvOptions;
    /**
     * Use additional formats via ajv-formats
     *
     * @see https://ajv.js.org/packages/ajv-formats.html ajv-formats
     * @default true
     */
    extendedVocabulary?: boolean;
    /**
     * @deprecated
     * @default false
     */
    legacyDefinitions?: boolean;
}
