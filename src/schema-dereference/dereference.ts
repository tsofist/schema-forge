import type { ARec, ArrayMay } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import * as structuredCloneModule from '@ungap/structured-clone';
import type { JSONSchema7 } from 'json-schema';
import type { SchemaForgeDefinitionRef } from '../types';
import { DefaultSchemaDereferenceSharedCache, SchemaDereferenceSharedCache } from './cache';
import type { SchemaForgeDereferenceOptions } from './types';

/**
 * Recursively dereference a JSON Schema by resolving all relative `$ref` pointers.
 *
 * @returns new schema with no `$ref` pointers
 */
export function dereferenceSchema(
    schema: JSONSchema7,
    options?: SchemaForgeDereferenceOptions,
): JSONSchema7 | undefined;
export function dereferenceSchema(
    raw: JSONSchema7,
    options: SchemaForgeDereferenceOptions = {},
): OperationalValue {
    const cache = options.sharedCacheStorage || DefaultSchemaDereferenceSharedCache;
    if (cache.main.has(raw)) return cache.main.get(raw)!;

    const schema = structuredClone<JSONSchema7>(raw);
    const seen = new WeakMap<JSONSchema7 | OperationalValue[], OperationalValueAA>();
    const seenRefs = new Set<SchemaForgeDefinitionRef>();
    const {
        throwOnDereferenceFailure = true,
        onDereferenceFailure,
        onDereferenceSuccess,
        definitionsSource = schema,
    } = options;

    function resolve(current: OperationalValueA, path: string): OperationalValueA;
    function resolve(current: OperationalValue, path: string): OperationalValue;
    function resolve(current: OperationalValueAA, path: string): OperationalValueAA {
        if (current == undefined || typeof current !== 'object') return current;

        // Circular
        if (seen.has(current)) return seen.get(current);

        // Arrays
        if (Array.isArray(current)) {
            const arr = current.map((item, i) => resolve(item, `${path}/${i}`));
            seen.set(current, arr);
            return arr;
        }

        // $ref
        if ('$ref' in current && typeof current.$ref === 'string') {
            const ref = current.$ref;
            const resolvedSchema = resolveRef(cache, definitionsSource, ref);

            if (resolvedSchema == null) {
                const replacement =
                    onDereferenceFailure && !throwOnDereferenceFailure
                        ? onDereferenceFailure(ref, current, schema)
                        : undefined;

                if (throwOnDereferenceFailure) {
                    raise(`Failed to dereference schema: unresolved reference ${ref} at ${path}`);
                } else if (!onDereferenceFailure && options.throwOnDereferenceFailure == null) {
                    console.warn(`WARNING: Reference ${ref} at ${path} cannot be resolved`);
                }

                return replacement;
            }

            if (Array.isArray(resolvedSchema)) {
                if (seen.has(resolvedSchema)) return seen.get(resolvedSchema);
                const originalResolved = resolve(resolvedSchema, ref);
                seen.set(resolvedSchema, originalResolved);
                return originalResolved;
            }

            const placeholder = {};
            seen.set(current, placeholder);
            const originalResolved = resolve(resolvedSchema, ref);

            const result: JSONSchema7 = Object.assign(
                {},
                originalResolved,
                resolvedSchema,
                current,
            );
            delete result.$ref; // !

            seen.set(current, result);

            if (onDereferenceSuccess != null && !seenRefs.has(ref)) {
                seenRefs.add(ref as SchemaForgeDefinitionRef);
                onDereferenceSuccess(ref as SchemaForgeDefinitionRef, result);
            }

            return result;
        }

        // Objects
        const obj = Object.fromEntries(
            Object.entries(current).map(([key, value]) => [
                key,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                resolve(value, `${path}/${key}`),
            ]),
        );

        seen.set(current, obj);

        return obj;
    }

    const result = resolve(schema, '#');
    cache.main.set(raw, result);

    return result;
}

function resolveRef(
    cache: SchemaDereferenceSharedCache,
    schema: JSONSchema7,
    ref: string,
): JSONSchema7 | undefined {
    if (!cache.resolver.has(schema)) cache.resolver.set(schema, new Map());

    const schemaCache = cache.resolver.get(schema)!;
    if (schemaCache.has(ref)) return schemaCache.get(ref);

    const pathParts = ref.split('/').slice(1);
    let current: ARec | undefined = schema;

    for (const segment of pathParts) {
        if (current === undefined || typeof current !== 'object') {
            current = undefined;
        } else {
            current = current[segment] ?? undefined;
        }
    }

    schemaCache.set(ref, current);

    return current;
}

type OperationalValue = undefined | JSONSchema7;
type OperationalValueA = undefined | OperationalValue[];
type OperationalValueAA = undefined | ArrayMay<OperationalValue>;

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
// @ts-expect-error CommonJS module fix
const structuredClone: typeof structuredCloneModule = structuredCloneModule.default;
