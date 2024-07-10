import { Nullable } from '@tsofist/stem';
import { raiseEx } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import Ajv, {
    AnySchema,
    ErrorObject,
    ErrorsTextOptions,
    Options,
    Schema,
    SchemaObject,
    ValidateFunction,
} from 'ajv';
import addFormats from 'ajv-formats';
import {
    SchemaDefinitionInfo,
    SchemaForgeDefinitionRef,
    SchemaForgeValidationContextBase,
    SchemaForgeValidationErrorCode,
    SchemaForgeValidationErrorContext,
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

    function getValidator<T = unknown>(
        ref: SchemaForgeDefinitionRef,
    ): ValidateFunction<T> | undefined {
        return engine.getSchema(ref);
    }

    function hasValidator(ref: SchemaForgeDefinitionRef) {
        return engine.getSchema(ref) != null;
    }

    function addSchema(schema: Schema[]) {
        engine.addSchema(schema, undefined, undefined, true);
    }

    function validationErrorsText(errors: Nullable<ErrorObject[]>, options?: ErrorsTextOptions) {
        return engine.errorsText(errors, options);
    }

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

        return {
            valid,
            errors: validator.errors,
            errorsText(options?: ErrorsTextOptions) {
                return validationErrorsText(validator.errors, options);
            },
        };
    }

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

    function forEachDefinitions(callback: (name: string, schema: string) => void) {
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

    function getSchema(ref: SchemaForgeDefinitionRef) {
        return getValidator(ref)?.schema;
    }

    function getRootSchema(schemaId: string) {
        return engine.schemas[schemaId]?.schema as
            | (SchemaObject & { definitions?: AnySchema })
            | undefined;
    }

    return {
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
    const FakerModulePattern = '^faker\\.[a-zA-Z.]+$';

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
                    //   faker: 'faker.person.fullName'
                    //   faker: 'faker.person.firstName'
                    //   faker: 'faker.company.name'
                    // example (jsdoc):
                    //   @faker faker.company.name
                    type: 'string',
                    pattern: FakerModulePattern,
                },
                {
                    // https://fakerjs.dev/api/lorem.html#words
                    // example (schema):
                    //   faker: { 'faker.lorem.words': [{ min: 30, max: 50 }] },
                    // example (jsdoc):
                    //   @faker { 'faker.lorem.words': [{ min: 5, max: 10 }] }
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
