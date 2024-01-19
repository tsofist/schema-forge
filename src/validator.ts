import { Nullable } from '@tsofist/stem';
import { raiseEx } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import Ajv, { Options, ValidateFunction, ErrorsTextOptions, ErrorObject, Schema } from 'ajv';
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

export function createSchemaForgeValidator(engineOptions?: Options, useAdditionalFormats = false) {
    let engine = new Ajv({
        allErrors: true,
        strict: true,
        strictTypes: 'log',
        strictTuples: false,
        coerceTypes: false,
        removeAdditional: true,
        ...engineOptions,
    });
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

    return {
        hasValidator,
        getValidator,
        addSchema,
        validateBySchema,
        checkBySchema,
        validationErrorsText,
        listDefinitions,
    };
}
