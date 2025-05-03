import { ArrayMay, Nullable, Rec, URec } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { chunk } from '@tsofist/stem/lib/chunk';
import { raise, raiseEx } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import { nonNullableValues } from '@tsofist/stem/lib/object/values';
import { delay } from '@tsofist/stem/lib/timers/delay';
import Ajv, {
    ErrorsTextOptions,
    Options,
    SchemaObject,
    ValidateFunction,
    AsyncValidateFunction,
} from 'ajv';
import addFormats from 'ajv-formats';
import {
    SchemaDefinitionInfo,
    SchemaForgeDefinitionRef,
    SchemaForgeValidationContextBase,
    SchemaForgeValidationErrorCode,
    SchemaForgeValidationErrorContext,
    SchemaForgeValidationFunction,
    SchemaForgeValidationReport,
    SchemaForgeValidationResult,
    SchemaNotFoundErrorCode,
    SchemaNotFoundErrorContext,
} from './types';
import { DBEntityOptions, DBIndexOptions, DBIndexTypeList } from './types/db.types';
import { buildSchemaDefinitionRef, parseSchemaDefinitionInfo } from './index';

export type SchemaForgeValidator = ReturnType<typeof createSchemaForgeValidator>;
export type SchemaForgeValidatorOptions = Parameters<typeof createSchemaForgeValidator>;

const DEF_OPTIONS: Options = {
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
    code: {
        es5: false,
        esm: false,
        optimize: 2,
    },
};

/**
 * Create SchemaForge Registry: a json-schema validator with additional features
 */
export function createSchemaForgeValidator(engineOptions?: Options, useAdditionalFormats = false) {
    engineOptions = {
        ...DEF_OPTIONS,
        ...engineOptions,
    };
    const initialSchemas = engineOptions.schemas;
    if (initialSchemas) delete engineOptions.schemas;

    let rev = 0;
    let engine = new Ajv(engineOptions);

    engine.removeSchema();
    if (initialSchemas) engine.addSchema(initialSchemas);

    addJSDocKeywords(engine);
    if (useAdditionalFormats) engine = addFormats(engine);

    /**
     * Clone validator with overridden options
     */
    function clone(
        options?: Omit<Options, 'schemas'>,
        onSchema?: (value: SchemaObject) => SchemaObject,
    ) {
        const schemas: SchemaObject[] = [];
        for (const env of nonNullableValues(engine.schemas)) {
            if (env.meta) continue;
            const schema = onSchema
                ? onSchema(env.schema as SchemaObject)
                : (env.schema as SchemaObject);
            schemas.push(schema);
        }

        const opts: Options = {
            ...engineOptions,
            schemas,
            ...options,
        };

        return createSchemaForgeValidator(opts, useAdditionalFormats);
    }

    /**
     * Get schema (or definition) validation function
     */
    function getValidator<TData = unknown>(
        ref: SchemaForgeDefinitionRef | SchemaObject,
    ): SchemaForgeValidationFunction<TData> | undefined {
        if (typeof ref === 'string') return engine.getSchema<TData>(ref);
        const result = engine.compile<TData>(ref);
        checkIsSyncValidator(result);
        return result;
    }

    /**
     * Check if schema exists
     * WARN: this method may compile schema if it's not compiled yet
     */
    function hasValidator(ref: SchemaForgeDefinitionRef) {
        return ref in engine.schemas || ref in engine.refs || engine.getSchema(ref) != null;
    }

    /**
     * Add root schema(s) to registry
     */
    function addSchema(schema: SchemaObject[]) {
        engine.addSchema(schema);
        rev++;
    }

    /**
     * Remove root schema(s) from registry
     */
    function removeSchema(ref: ArrayMay<SchemaForgeDefinitionRef>) {
        for (const item of asArray(ref)) engine.removeSchema(item);
        rev++;
    }

    /**
     * Remove all schemas from registry
     */
    function clear() {
        engine.removeSchema();
        rev++;
    }

    /**
     * Get validation errors text
     */
    function validationErrorsText(
        errors: Nullable<SchemaForgeValidationReport>,
        options?: ErrorsTextOptions,
    ) {
        return engine.errorsText(errors, options);
    }

    /**
     * Validate data by schema definition reference
     */
    function validateBySchema(
        ref: SchemaForgeDefinitionRef,
        data: unknown,
        instancePath = '',
    ): SchemaForgeValidationResult {
        const validator = getValidator(ref);
        if (!validator) {
            raiseEx(SchemaNotFoundErrorCode, { schema: ref } satisfies SchemaNotFoundErrorContext);
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

    /**
     * Check (throw error if invalid) data by schema definition reference
     */
    function checkBySchema<
        T = unknown,
        Ctx extends SchemaForgeValidationContextBase = SchemaForgeValidationContextBase,
    >(ref: SchemaForgeDefinitionRef, data: unknown, context?: Ctx): data is T {
        const result = validateBySchema(ref, data, context?.instancePath);
        if (!result.valid) {
            const ctx: SchemaForgeValidationErrorContext = {
                ...context,
                schema: ref,
                errors: result.errors!,
            };
            raiseEx(SchemaForgeValidationErrorCode, ctx, context?.errorMessage);
        }
        return result.valid;
    }

    function mapDefinitions<R>(callback: (definitionName: string, schemaId: string) => R): R[] {
        const result = [];
        for (const [schemaId, env] of entries(engine.schemas)) {
            if (
                env &&
                typeof env.schema === 'object' &&
                !schemaId.startsWith('http') &&
                env.schema.definitions &&
                typeof env.schema.definitions === 'object'
            ) {
                for (const name of Object.keys(env.schema.definitions as URec)) {
                    result.push(callback(name, schemaId));
                }
            }
        }
        return result;
    }

    /**
     * List schema definitions
     */
    function listDefinitions(
        predicate?: (info: SchemaDefinitionInfo) => boolean,
    ): SchemaDefinitionInfo[] {
        const result: SchemaDefinitionInfo[] = [];
        mapDefinitions((name, schemaId) => {
            const info = parseSchemaDefinitionInfo(name, schemaId);
            if (predicate === undefined || predicate(info)) result.push(info);
        });
        return result;
    }

    /**
     * Get schema object of definition by reference
     */
    function getSchema(ref: SchemaForgeDefinitionRef) {
        return getValidator(ref)?.schema;
    }

    /**
     * Get root schema object
     */
    function getRootSchema(schemaId: string) {
        return engine.schemas[schemaId]?.schema as
            | (SchemaObject & { definitions?: SchemaObject })
            | undefined;
    }

    /**
     * Synchronously warm up validator cache
     * This action is useful to pre-compile all schemas and their definitions
     */
    function warmupCacheSync() {
        mapDefinitions((name, schemaId) => {
            const ref = buildSchemaDefinitionRef(name, schemaId);
            checkIsSyncValidator(engine.getSchema(ref));
        });
    }

    /**
     * Asynchronously warm up validator cache
     * This action is useful to pre-compile all schemas and their definitions
     */
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
        removeSchema,
        hasValidator,
        getValidator,
        getSchema,
        getRootSchema,
        addSchema,
        validateBySchema,
        checkBySchema,
        validationErrorsText,
        listDefinitions,
        warmupCache,
        warmupCacheSync,
    };
}

function addJSDocKeywords(engine: Ajv) {
    const InterfaceNamePattern = '^[A-Z][a-zA-Z0-9]+$';
    const PropertyNamePattern = '^[a-z][a-zA-Z0-9]+$';
    const NestedPropertyNamePattern = '^[a-z][a-zA-Z0-9.-]+$';
    const MethodNamePattern = PropertyNamePattern;
    const MemberNamePattern = `${InterfaceNamePattern.substring(0, InterfaceNamePattern.length - 1)}#${PropertyNamePattern.substring(1)}`;
    const IXNamePattern = '^ix_[a-z][a-zA-Z0-9_]+$';
    const EntityNamePattern = '^([a-zA-Z_][a-z0-9_]*\\.)?[a-z_][a-z0-9_]*$';
    const FakerModulePattern = '^[a-zA-Z.]+$';

    engine.addKeyword({
        keyword: 'version',
        metaSchema: {
            type: 'string',
        },
        dependencies: ['$id', '$schema'],
    });

    engine.addKeyword({
        keyword: 'hash',
        metaSchema: {
            type: 'string',
        },
        dependencies: ['$id', '$schema'],
    });

    engine.addKeyword({
        keyword: 'interface',
        metaSchema: {
            type: 'string',
            pattern: InterfaceNamePattern,
        },
    });

    engine.addKeyword({
        keyword: 'property',
        metaSchema: {
            type: 'string',
            pattern: PropertyNamePattern,
        },
    });

    engine.addKeyword({
        keyword: 'method',
        metaSchema: {
            type: 'string',
            pattern: MethodNamePattern,
        },
    });

    engine.addKeyword({
        keyword: 'member',
        metaSchema: {
            type: 'string',
            pattern: MemberNamePattern,
        },
    });

    /**
     * @see https://fakerjs.dev/api/person.html
     */
    engine.addKeyword({
        keyword: 'faker',
        metaSchema: {
            oneOf: [
                {
                    // https://fakerjs.dev/api/person.html
                    // https://fakerjs.dev/api/company.html#name
                    // https://github.com/json-schema-faker/json-schema-faker/blob/master/docs/USAGE.md
                    // example (schema):
                    //   faker: 'person.fullName'
                    //   faker: 'person.firstName'
                    //   faker: 'company.name'
                    // example (jsdoc):
                    //   @faker company.name
                    type: 'string',
                    pattern: FakerModulePattern,
                },
                {
                    // https://fakerjs.dev/api/lorem.html#words
                    // example (schema):
                    //   faker: { 'lorem.words': [{ min: 30, max: 50 }] },
                    // example (jsdoc):
                    //   @faker { 'lorem.words': [{ min: 5, max: 10 }] }
                    type: 'object',
                    propertyNames: {
                        pattern: FakerModulePattern,
                    },
                },
            ],
        },
    });

    const DBIndexOptionsProperties = {
        name: { type: 'string', pattern: IXNamePattern },
        unique: { type: 'boolean' },
        pk: { type: 'boolean' },
        type: {
            type: 'string',
            enum: DBIndexTypeList,
        },
    } as const satisfies Rec<unknown, keyof DBIndexOptions>;

    const DBIndexSchema = {
        type: ['string', 'boolean', 'object', 'array'],
        pattern: IXNamePattern,
        additionalProperties: false,
        properties: DBIndexOptionsProperties,
        items: {},
        minItems: 1,
    };

    DBIndexSchema.items = {
        ...DBIndexSchema,
        type: ['string', 'boolean', 'object'],
    };

    engine.addKeyword({
        keyword: 'dbIndex',
        metaSchema: DBIndexSchema,
    });

    engine.addKeyword({
        keyword: 'dbEntity',
        metaSchema: {
            type: ['string', 'object'],
            pattern: EntityNamePattern,
            additionalProperties: false,
            properties: {
                name: {
                    type: 'string',
                    pattern: EntityNamePattern,
                },
                indexes: {
                    type: 'object',
                    additionalProperties: DBIndexSchema,
                    propertyNames: {
                        pattern: NestedPropertyNamePattern,
                    },
                },
            } satisfies Rec<unknown, keyof DBEntityOptions>,
        },
    });
}

function checkIsSyncValidator(
    fn: Nullable<ValidateFunction | AsyncValidateFunction>,
): asserts fn is AsyncValidateFunction {
    if (typeof fn === 'function' && '$async' in fn) {
        raise('[SchemaForge] Asynchronous validation schemas are not supported');
    }
}
