import type { DeepReadonly } from '@tsofist/stem';
import type { JSONSchema7 } from 'json-schema';
import type { ForgedSchema, SchemaForgeDefinitionRef } from '../types';
import type { SchemaDereferenceSharedCache } from './cache';

export interface SchemaForgeDereferenceOptions {
    /**
     * Handler called when a reference is successfully dereferenced.
     */
    onDereferenceSuccess?: (
        resolvedRef: SchemaForgeDefinitionRef,
        resolvedNode: DeepReadonly<JSONSchema7>,
    ) => void;
    /**
     * Handler called when dereferencing fails.
     *
     * @see throwOnDereferenceFailure
     * @returns the value of the node where dereferencing failed
     * @default undefined
     */
    onDereferenceFailure?: SchemaForgeDereferenceFailureHandler;
    /**
     * Defines the behavior when dereferencing fails.
     * Possible options:
     *   * true - an exception will be thrown;
     *   * false - the value of the node where dereferencing failed will be set to undefined;
     *   * undefined - if onDereferenceFailure is not set (or it returns undefined), an exception will be thrown;
     *
     * @see onDereferenceFailure
     * @default true
     */
    throwOnDereferenceFailure?: boolean;
    /**
     * Use a shared cache to store intermediate dereferencing results.
     * This can significantly speed up the process if the schema contains many repeated references.
     *
     * @see DefaultSchemaDereferenceSharedCache
     * @see createSchemaDereferenceSharedCache
     * @default DefaultSchemaDereferenceSharedCache
     */
    sharedCacheStorage?: SchemaDereferenceSharedCache;
    /**
     * Source of definitions for resolving $ref references.
     * If not provided, the definitions from the root schema will be used.
     *
     * @see ForgedSchema
     */
    definitionsSource?: ForgedSchema | JSONSchema7;
}

export type SchemaForgeDereferenceFailureHandler = (
    unresolvedRef: string,
    currentNode: JSONSchema7,
    resultSchema: JSONSchema7,
) => JSONSchema7 | undefined;
