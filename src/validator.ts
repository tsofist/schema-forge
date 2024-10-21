import { Nullable } from '@tsofist/stem';
import { raiseEx } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import Ajv, { AnySchema, ErrorsTextOptions, Options, Schema, SchemaObject } from 'ajv';
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
import { parseSchemaDefinitionInfo } from './index';

export type SchemaForgeValidator = ReturnType<typeof createSchemaForgeValidator>;

export function createSchemaForgeValidator(engineOptions?: Options, useAdditionalFormats = false) {
    let engine = new Ajv({
        allErrors: true,
        strict: true,
        strictSchema: true,
        strictTypes: false,
        strictTuples: false,
        allowUnionTypes: true,
        coerceTypes: false,
        removeAdditional: false,
        unicodeRegExp: true,
        ...engineOptions,
    });
    addJSDocKeywords(engine);
    if (useAdditionalFormats) engine = addFormats(engine);

    /**
     * Get schema (or definition) validation function
     */
    function getValidator<TData = unknown>(
        ref: SchemaForgeDefinitionRef | AnySchema,
    ): SchemaForgeValidationFunction<TData> | undefined {
        if (typeof ref === 'string') return engine.getSchema<TData>(ref);
        return engine.compile<TData>(ref);
    }

    /**
     * Check if schema exists
     */
    function hasValidator(ref: SchemaForgeDefinitionRef) {
        return engine.getSchema(ref) != null;
    }

    /**
     * Add root schema(s) to registry
     */
    function addSchema(schema: Schema[]) {
        engine.addSchema(schema);
    }

    /**
     * Remove root schema(s) from registry using Schema object, Reference or RegExp pattern to math Schema ID
     */
    function removeSchema(schemaIdentity?: AnySchema | SchemaForgeDefinitionRef | RegExp) {
        engine.removeSchema(schemaIdentity);
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

    function forEachDefinitions(callback: (definitionName: string, schemaId: string) => void) {
        for (const [schemaId, env] of entries(engine.schemas)) {
            if (
                env &&
                typeof env.schema === 'object' &&
                !schemaId.startsWith('http') &&
                env.schema.definitions
            ) {
                for (const name of Object.keys(env.schema.definitions)) {
                    callback(name, schemaId);
                }
            }
        }
    }

    /**
     * List schema definitions
     */
    function listDefinitions(
        predicate?: (info: SchemaDefinitionInfo) => boolean,
    ): SchemaDefinitionInfo[] {
        const result: SchemaDefinitionInfo[] = [];
        forEachDefinitions((name, schemaId) => {
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
            | (SchemaObject & { definitions?: AnySchema })
            | undefined;
    }

    return {
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
    };
}

function addJSDocKeywords(engine: Ajv) {
    const InterfaceNamePattern = '^[A-Z][a-zA-Z0-9]+$';
    const PropertyNamePattern = '^[a-z][a-zA-Z0-9]+$';
    const MethodNamePattern = PropertyNamePattern;
    const MemberNamePattern = `${InterfaceNamePattern.substring(0, InterfaceNamePattern.length - 1)}#${PropertyNamePattern.substring(1)}`;
    const IXNamePattern = '^ix_[a-z][a-zA-Z0-9_]+$';
    const EntityNamePattern = '^([a-zA-Z_][a-z0-9_]*\\.)?[a-z_][a-z0-9_]*$';
    const FakerModulePattern = '^[a-zA-Z.]+$';

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

    engine.addKeyword({
        keyword: 'dbIndex',
        metaSchema: {
            type: ['string', 'boolean'],
            pattern: IXNamePattern,
        },
    });

    engine.addKeyword({
        keyword: 'dbEntity',
        metaSchema: {
            type: 'string',
            pattern: EntityNamePattern,
        },
    });
}
