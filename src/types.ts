import type { NonEmptyString, Nullable, PRec } from '@tsofist/stem';
import type { ErrorObject, ErrorsTextOptions, SchemaObject, ValidateFunction } from 'ajv';
import type { Config } from 'ts-json-schema-generator';

export interface ForgeSchemaOptions {
    /**
     * Generate schema definitions for public types only
     * This option can help to protect leaked internal types
     */
    readonly explicitPublic?: boolean;
    /**
     * By default, generator use description jsdoc-tag
     * If this option is true, then generator will use fallback description from type comment
     */
    readonly allowUseFallbackDescription?: boolean;
    /**
     * Filter for definitions
     * Important: dependencies will not be filtered
     */
    readonly definitionsFilter?: (name: string) => boolean;
    /**
     * Create shared $ref definitions for all types.
     *   Or: Do not create shared $ref definitions.
     *   Or: (default) Create shared $ref definitions only for exported types (not tagged as `@internal`).
     */
    readonly expose?: TypeExposeKind;
    /**
     * $id for generated schema
     */
    readonly schemaId?: string;
    /**
     * Metadata keywords for schema
     *
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
     *
     * @example
     *   src/**
     *   {src,types}/**
     */
    readonly sourcesDirectoryPattern: string;
    /**
     * Filenames pattern of source files
     *
     * @example
     *   service-api.ts
     *   *.{api,api-types}.ts
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
     *
     * @example
     *   result.schema.json
     *   /absolute/path/to/result.schema.json
     */
    readonly outputSchemaFile: string;
    /**
     * Definitions file location
     *
     * @example
     *   result.schema-metadata.json
     *   /absolute/path/to/result.schema-metadata.json
     */
    readonly outputSchemaMetadataFile?: string;
    // todo
    readonly discriminatorType?: DiscriminatorType;
    /**
     * Determines whether to sort the properties of object schemas in alphabetical order.
     *   If set to `true`, the tool will sort both the fields in the `properties` section
     *     and the field names in the `required` array for object-schema definitions.
     *   Sorting can improve readability and consistency,
     *     but may affect the order in which properties appear in generated outputs.
     *   Applicable only to schemas of type `object`.
     *
     * @default false
     */
    readonly sortObjectProperties?: boolean;
    /**
     * If you want to shrink the schema definition names,
     *   you have to provide a replacement function.
     *
     * @see shrinkDefinitionName
     */
    readonly shrinkDefinitionNames?:
        | boolean
        | ((definitionName: string) => undefined | NonEmptyString);
    /**
     * @deprecated
     * @default false
     */
    readonly legacyDefinitions?: boolean;
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

export interface ForgeSchemaResult {
    schema: SchemaObject;
    refs: readonly SchemaForgeDefinitionRef[];
    generatedTemporaryFiles: readonly string[];
    generatedNamesBySourceFile: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Reference to schema definition
 * @example
 *     ''
 *     '#/definitions/MyType'
 *     'SomeSchemaId#/definitions/MyType'
 */
export type SchemaForgeDefinitionRef = '' | `${string}#/definitions/${string}`;

export interface SchemaForgeValidationResult {
    valid: boolean;
    errors: Nullable<SchemaForgeValidationReport>;
    errorsText: (options?: ErrorsTextOptions) => string;
}

export type SchemaForgeValidationFunction<T = unknown> = ValidateFunction<T>;
export type SchemaForgeValidationReport = ErrorObject[];

type TypeExposeKind = Config['expose'];
type DiscriminatorType = Config['discriminatorType'];
