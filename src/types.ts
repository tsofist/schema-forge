import { NonEmptyString, Nullable, PRec } from '@tsofist/stem';
import { ErrorCode } from '@tsofist/stem/lib/error';
import { ErrorObject, ErrorsTextOptions, SchemaObject, ValidateFunction } from 'ajv';
import { SchemaForgeBaseOptions } from './generator/types';

export enum SchemaForgeSignatureSuffix {
    MethodArguments,
    MethodResult,
}

export interface SchemaForgeOptions extends SchemaForgeBaseOptions {
    /**
     * $id for generated schema
     */
    readonly schemaId?: string;
    /**
     * Metadata keywords for schema
     * @see https://ajv.js.org/json-schema.html#metadata-keywords ajv
     */
    readonly schemaMetadata?: {
        title?: string;
        description?: string;
        $comment?: string;
        version?: string;
        hash?: boolean | 'md5' | 'sha1' | 'sha256' | 'sha512';
    };
    /**
     * Directories pattern for searching source files
     * @example
     *      src/**
     *      {src,types}/**
     */
    readonly sourcesDirectoryPattern: string;
    /**
     * Filenames pattern of source files
     * @example
     *      service-api.ts
     *      *.{api,api-types}.ts
     */
    readonly sourcesFilesPattern: string | string[];
    /**
     * Path to tsconfig.json
     */
    readonly tsconfig?: string;
    /**
     * Path to tsconfig.json from which to inherit compiler options
     */
    readonly tsconfigFrom?: string;
    /**
     * Schema file locations
     * @example
     *      result.schema.json
     *      /absolute/path/to/result.schema.json
     */
    readonly outputSchemaFile: string;
    /**
     * Definitions file location
     * @example
     *      result.schema-metadata.json
     *      /absolute/path/to/result.schema-metadata.json
     */
    readonly outputSchemaMetadataFile?: string;
    /**
     * Generate openapi compatible schema
     * @default false
     */
    readonly openapiCompatible?: boolean;
    /**
     * Determines whether to sort the properties of object schemas in alphabetical order.
     *      If set to `true`, the tool will sort both the fields in the `properties` section
     *        and the field names in the `required` array for object-schema definitions.
     *      Sorting can improve readability and consistency,
     *        but may affect the order in which properties appear in generated outputs.
     *      Applicable only to schemas of type `object`.
     * @default false
     */
    readonly sortObjectProperties?: boolean;
    /**
     * If you want to shrink the schema definition names, you have to provide a replacement function.
     * WARN: this functionality is not compatible (yet) with `encodeRefs=true` option.
     *
     * @see shrinkDefinitionName
     */
    readonly shrinkDefinitionNames?:
        | boolean
        | ((definitionName: string) => undefined | NonEmptyString);
}

export interface SchemaForgeMetadata {
    $id: string;
    title?: string;
    description?: string;
    $comment?: string;
    version?: string;
    schemaHash?: string;
    refs: PRec<string, SchemaForgeDefinitionRef>;
    names: PRec<SchemaForgeDefinitionRef>;
    serviceRefs: PRec<string, SchemaForgeDefinitionRef>;
    serviceNames: PRec<SchemaForgeDefinitionRef>;
}

export interface SchemaForgeResult {
    schema: SchemaObject;
    refs: readonly SchemaForgeDefinitionRef[];
    generatedTemporaryFiles: readonly string[];
    generatedNamesBySourceFile: ReadonlyMap<string, ReadonlySet<string>>;
}

export const SchemaNotFoundErrorCode: ErrorCode = 'EC_SCHEMA_NOT_FOUND';
export type SchemaNotFoundErrorContext = SchemaForgeValidationContextBase & {
    schema: SchemaForgeDefinitionRef;
};

export const SchemaForgeValidationErrorCode: ErrorCode = 'EC_SCHEMA_VALIDATION_FAILED';
export type SchemaForgeValidationErrorContext = SchemaForgeValidationErrorContextBase & {
    schema: SchemaForgeDefinitionRef;
    errors: SchemaForgeValidationReport;
};

export interface SchemaForgeValidationContextBase {
    errorMessage?: string;
    instancePath?: string;
}

export interface SchemaForgeValidationErrorContextBase extends SchemaForgeValidationContextBase {
    schema: SchemaForgeDefinitionRef;
    errors: SchemaForgeValidationReport;
}

/**
 * Reference to schema definition
 * @example
 *     ''
 *     '#/definitions/MyType'
 *     'SomeSchemaId#/definitions/MyType'
 */
export type SchemaForgeDefinitionRef = '' | `${string}#/definitions/${string}`;

export enum SchemaDefinitionKind {
    Type,
    API,
    APIMethodResult,
    APIMethodArguments,
}

interface SDIBase {
    name: string;
    schemaId: string;
    ref: SchemaForgeDefinitionRef;
    kind: SchemaDefinitionKind;
}

export interface SDIType extends SDIBase {
    kind: SchemaDefinitionKind.Type;
    type: string;
}

export interface SDIAPIInterface extends SDIBase {
    kind: SchemaDefinitionKind.API;
    interface: string;
}

export interface SDIMethodArguments extends SDIBase {
    kind: SchemaDefinitionKind.APIMethodArguments;
    interface: string;
    method: string;
}

export interface SDIMethodResult extends SDIBase {
    kind: SchemaDefinitionKind.APIMethodResult;
    interface: string;
    method: string;
}

export type SchemaDefinitionInfo = SDIType | SDIAPIInterface | SDIMethodArguments | SDIMethodResult;

export interface SchemaForgeValidationResult {
    valid: boolean;
    errors: Nullable<SchemaForgeValidationReport>;
    errorsText: (options?: ErrorsTextOptions) => string;
}

export type SchemaForgeValidationFunction<T = unknown> = ValidateFunction<T>;
export type SchemaForgeValidationReport = ErrorObject[];
