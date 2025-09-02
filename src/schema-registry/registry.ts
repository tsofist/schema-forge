import type { ArrayMay, Nullable, Rec } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { chunk } from '@tsofist/stem/lib/chunk';
import { raise } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import { nonNullableValues } from '@tsofist/stem/lib/object/values';
import { delay } from '@tsofist/stem/lib/timers/delay';
import Ajv, {
    type AsyncValidateFunction,
    type ErrorsTextOptions,
    type Options as AjvOptions,
    type ValidateFunction,
} from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';
import { parseSchemaDefinitionInfo } from '../definition-info/parser';
import { buildSchemaDefinitionRef } from '../definition-info/ref';
import { SchemaDefinitionInfo, SchemaDefinitionInfoKind } from '../definition-info/types';
import { SchemaForgeErrors, type SchemaForgeValidationContextBase } from '../efc';
import { SF_EXTRA_JSS_TAG_NAME, SFG_EXTRA_TAGS } from '../schema-generator/types';
import type {
    ForgedSchemaDefinition,
    SchemaForgeDefinitionRef,
    SchemaForgeValidationFunction,
    SchemaForgeValidationReport,
    SchemaForgeValidationResult,
} from '../types';
import { SFRAPIDefinitionKeywords } from './kw-api';
import { SFRCommonKeywords } from './kw-common';
import { SFRDBMLKeywords } from './kw-dbml';
import {
    SchemaForgeRegistry,
    SchemaForgeRegistryListDefinitionsPredicate,
    SchemaForgeRegistryOptions,
} from './types';

const SFR_DEFAULT_OPTIONS = {
    meta: true,
    defaultMeta: 'http://json-schema.org/draft-07/schema',
    allErrors: true,
    strict: true,
    strictSchema: true,
    strictTypes: false,
    strictTuples: false,
    allowUnionTypes: true,
    coerceTypes: false,
    removeAdditional: false,
    unicodeRegExp: true,
    useDefaults: false,
    addUsedSchema: false,
    inlineRefs: true,
    ownProperties: true,
    discriminator: false,
    code: { es5: false, esm: false, optimize: 2 },
} as const satisfies AjvOptions;

/**
 * Create JSON schema data validation registry
 *
 * @see https://ajv.js.org/json-schema.html ajv
 */
export function createSchemaForgeRegistry(
    options?: SchemaForgeRegistryOptions,
): SchemaForgeRegistry {
    /** @deprecated */
    const legacy = options?.legacyDefinitions ?? false;
    const engineOptions = { ...SFR_DEFAULT_OPTIONS, ...options?.engine };
    const useAdditionalFormats = options?.extendedVocabulary ?? true;

    const initialSchemas = engineOptions.schemas;
    if (initialSchemas) delete engineOptions.schemas;

    let rev = 0;
    let engine = new Ajv(engineOptions);

    engine.removeSchema();
    if (initialSchemas) engine.addSchema(initialSchemas);

    addJSDocKeywords(engine);
    if (useAdditionalFormats) engine = addFormats(engine);

    function clone(
        options?: Omit<AjvOptions, 'schemas'>,
        onSchema?: (value: JSONSchema7) => JSONSchema7,
    ) {
        const schemas: JSONSchema7[] = [];
        for (const env of nonNullableValues(engine.schemas)) {
            if (env.meta) continue;
            const schema = onSchema
                ? onSchema(env.schema as JSONSchema7)
                : (env.schema as JSONSchema7);
            schemas.push(schema);
        }

        const opts: AjvOptions = {
            ...options,
            schemas,
            ...options,
        };

        return createSchemaForgeRegistry({
            engine: opts,
            extendedVocabulary: useAdditionalFormats,
        });
    }

    function getValidator<TData = unknown>(
        ref: SchemaForgeDefinitionRef | JSONSchema7,
    ): SchemaForgeValidationFunction<TData> | undefined {
        if (typeof ref === 'string') return engine.getSchema<TData>(ref);
        const result = engine.compile<TData>(ref);
        checkIsSyncValidator(result);
        return result;
    }

    function hasSchema(ref: SchemaForgeDefinitionRef) {
        return ref in engine.schemas || ref in engine.refs || engine.getSchema(ref) != null;
    }

    function addSchema(schema: JSONSchema7[]) {
        engine.addSchema(schema);
        rev++;
    }

    function removeSchema(ref: ArrayMay<SchemaForgeDefinitionRef>) {
        for (const item of asArray(ref)) engine.removeSchema(item);
        rev++;
    }

    function clear() {
        engine.removeSchema();
        rev++;
    }

    function validationErrorsText(
        errors: Nullable<SchemaForgeValidationReport>,
        options?: ErrorsTextOptions,
    ) {
        return engine.errorsText(errors, options);
    }

    function validateBySchema(
        ref: SchemaForgeDefinitionRef,
        data: unknown,
        instancePath = '',
    ): SchemaForgeValidationResult {
        const validator = getValidator(ref);
        if (!validator) {
            return SchemaForgeErrors.raise(SchemaForgeErrors.EC_SF_SCHEMA_NOT_FOUND, {
                schema: ref,
                instancePath,
            });
        }

        const valid = validator(data, {
            instancePath,
            parentData: {},
            parentDataProperty: '',
            rootData: {},
            dynamicAnchors: {},
        });
        const errors = validator.errors;

        return {
            valid,
            errors,
            errorsText(options?: ErrorsTextOptions) {
                return validationErrorsText(errors, options);
            },
        };
    }

    function checkBySchema<
        T = unknown,
        Ctx extends SchemaForgeValidationContextBase = SchemaForgeValidationContextBase,
    >(ref: SchemaForgeDefinitionRef, data: unknown, context?: Ctx): data is T {
        const result = validateBySchema(ref, data, context?.instancePath);
        if (!result.valid) {
            SchemaForgeErrors.raise(SchemaForgeErrors.EC_SF_VALIDATION_FAILED, {
                ...context,
                schema: ref,
                errors: result.errors!,
            });
        }
        return result.valid;
    }

    function mapDefinitions<R>(
        callback: (definitionName: string, schemaId: string, schema: ForgedSchemaDefinition) => R,
    ): R[] {
        const result = [];
        for (const [schemaId, env] of entries(engine.schemas)) {
            if (
                env &&
                typeof env.schema === 'object' &&
                !schemaId.startsWith('http') &&
                env.schema.definitions &&
                typeof env.schema.definitions === 'object'
            ) {
                for (const [name, def] of Object.entries(
                    env.schema.definitions as Rec<JSONSchema7>,
                )) {
                    result.push(callback(name, schemaId, def));
                }
            }
        }
        return result;
    }

    function readSchemaKeywords(schema: ForgedSchemaDefinition) {
        const result = new Map<SF_EXTRA_JSS_TAG_NAME>();
        for (const tag of SFG_EXTRA_TAGS) {
            if (tag in schema) {
                result.set(
                    tag,
                    // @ts-expect-error It's OK
                    schema[tag],
                );
            }
        }
        return result;
    }

    function listDefinitions<T extends SchemaDefinitionInfo>(
        predicate?: SchemaForgeRegistryListDefinitionsPredicate | SchemaDefinitionInfoKind,
    ): T[] {
        const result: T[] = [];
        const filter =
            typeof predicate === 'number'
                ? (info: SchemaDefinitionInfo) => info.kind === predicate
                : predicate;

        mapDefinitions((name, schemaId, schema) => {
            const info = parseSchemaDefinitionInfo<T>(name, schemaId, legacy);
            if (filter === undefined || filter(info, readSchemaKeywords(schema))) {
                result.push(info);
            }
        });
        return result;
    }

    function getSchema(ref: SchemaForgeDefinitionRef) {
        return getValidator(ref)?.schema as JSONSchema7 | undefined;
    }

    function getRootSchema(schemaId: string) {
        return engine.schemas[schemaId]?.schema as JSONSchema7 | undefined;
    }

    function warmupCacheSync() {
        mapDefinitions((name, schemaId) => {
            const ref = buildSchemaDefinitionRef(name, schemaId);
            checkIsSyncValidator(engine.getSchema(ref));
        });
    }

    async function warmupCache(schemasPerIteration = 5, delayMs = 1) {
        await chunk(
            mapDefinitions((name, schemaId) => buildSchemaDefinitionRef(name, schemaId)),
            schemasPerIteration,
            async (items) => {
                for (const ref of items) engine.getSchema(ref);
                return delay(delayMs);
            },
        );
    }

    return {
        get compilationArtifactCount(): number {
            const names = new Set([
                //
                ...Object.keys(engine.refs),
                ...Object.keys(engine.schemas),
            ]);
            return names.size;
        },
        get rev() {
            return rev;
        },

        clear,

        clone,

        getRootSchema,
        addSchema,
        getSchema,
        hasSchema,
        removeSchema,

        getValidator,

        validationErrorsText,

        validateBySchema,
        checkBySchema,

        listDefinitions,

        warmupCache,
        warmupCacheSync,
    };
}

function addJSDocKeywords(engine: Ajv) {
    engine.addVocabulary([
        //
        ...SFRCommonKeywords,
        ...SFRAPIDefinitionKeywords,
        ...SFRDBMLKeywords,
    ]);
}

function checkIsSyncValidator(
    fn: Nullable<ValidateFunction | AsyncValidateFunction>,
): asserts fn is AsyncValidateFunction {
    if (typeof fn === 'function' && '$async' in fn) {
        raise('[SchemaForge] Asynchronous validation schemas are not supported');
    }
}
