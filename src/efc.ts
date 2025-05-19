import { ErrorFamily } from '@tsofist/stem/lib/error/family';
import type { ErrorCodeFamily, ErrorFamilyCode } from '@tsofist/stem/lib/error/types';
import type { SchemaForgeDefinitionRef, SchemaForgeValidationReport } from './types';

export type SchemaForgeErrorCode = ErrorFamilyCode<typeof SchemaForgeErrors>;
export type SchemaForgeErrorCodeFamily = ErrorCodeFamily<'EC_SF'>;
export const SchemaForgeErrorPrefix: SchemaForgeErrorCodeFamily = 'EC_SF_';

export const SchemaForgeErrors = ErrorFamily.declare(SchemaForgeErrorPrefix, {
    EC_SF_SCHEMA_NOT_FOUND: ErrorFamily.member<SchemaForgeSchemaNotFoundErrorContext>(
        '[SchemaForge] Schema not found',
    ),
    EC_SF_VALIDATION_FAILED: ErrorFamily.member<SchemaForgeValidationErrorContext>(
        '[SchemaForge] Data validation failed',
    ),
});

export type SchemaForgeValidationErrorContext = SchemaForgeValidationContextBase & {
    schema: SchemaForgeDefinitionRef;
    errors: SchemaForgeValidationReport;
};
export type SchemaForgeSchemaNotFoundErrorContext = SchemaForgeValidationContextBase & {
    schema: SchemaForgeDefinitionRef;
};

export type SchemaForgeValidationContextBase = {
    errorMessage?: string;
    instancePath?: string;
};
