import type { Nullable, PRec, Rec, Reintroduce } from '@tsofist/stem';
import type { ErrorObject, ErrorsTextOptions, ValidateFunction } from 'ajv';
import type { JSONSchema7 as Schema } from 'json-schema';
import type { Config } from 'ts-json-schema-generator';
import {
    DBMLColumnOptions,
    DBMLEntityOptionsDef,
    DBMLEnumOptionsDef,
    DBMLForeignKeyOptions,
    DBMLIndexOptionsDef,
} from './dbml-generator/types';
import { SGEnumAnnotationOptions, SGEnumMemberOptions } from './schema-generator/kw.types';

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
        repository?: string;
        package?: string;
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
     * Determines whether to sort the contents of the schema.
     * If set to `true`, the tool will sort certain parts of the schema in alphabetical order.
     * Sorting can significantly improve readability and consistency
     *   of the data across iterations of updates.
     *
     * The following are sorted:
     *   - `properties` (optional)
     *   - `required`
     *   - `enum`
     *   - `anyOf` (type=null is always first)
     *   - `oneOf` (type=null is always first)
     *   - `definitions` / `$defs`
     *
     * @default true
     */
    readonly sortContents?: boolean | SchemaForgeSortableContentSet;
    /**
     * If true, the top-level `$ref` pointers for each definition will be resolved.
     * This improves schema readability by reducing the number of references
     *   while still keeping the schema relatively compact.
     * Note: only references used once will be dereferenced.
     *
     * @see shallowDereferenceSchema
     * @see dereferenceSchema
     * @default false
     */
    readonly shallowDeref?: boolean;
    /**
     * If you want to shrink the schema definition names,
     *   you have to provide a replacement function.
     *
     * @see shrinkDefinitionName
     */
    readonly shrinkDefinitionNames?:
        | boolean
        | ((definitionName: string) => undefined | ForgedSchemaDefinitionShortName);
    /**
     * @deprecated
     * @default false
     */
    readonly legacyDefinitions?: boolean;
    /**
     * Skip type checking.
     * This may help with some complex projects, but can lead to incorrect schema generation.
     *
     * @default false
     */
    readonly skipTypeCheck?: boolean;
    /**
     * Suppress errors about multiple definitions with the same name.
     * By default, an error is thrown if multiple definitions with the same name are found.
     * This option can be useful in monorepo setups where multiple packages may have types with the same name.
     *
     * @default false
     */
    readonly suppressMultipleDefinitionsErrors?: boolean;
    /**
     * Extra JSDoc tags to be recognized by the generator and included in the schema definitions.
     */
    readonly extraTags?: string[];
}

export type ForgedSchemaDefinitionShortName = `DSN${string}_H${string}`;

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

const ForgedSchemaDraft7Id = 'http://json-schema.org/draft-07/schema#';

export type ForgedSchema = Reintroduce<
    Schema,
    Pick<ForgedSchemaDefinition, 'see' | 'spec'> & {
        $schema: typeof ForgedSchemaDraft7Id;
        hash?: string;
        version?: string;
        package?: string;
        repository?: string;
        //
        $defs?: Rec<ForgedSchemaDefinition>;
        definitions?: Rec<ForgedSchemaDefinition>;
    }
>;

export type ForgedEntitySchema = Schema &
    Pick<ForgedSchemaDefinition, 'see' | 'spec' | 'dbEntity'> & {
        properties?: Rec<ForgedEntitySchema>;
    };

export type ForgedPropertySchema = Schema &
    Pick<
        ForgedSchemaDefinition,
        'dbFK' | 'dbColumn' | 'dbIndex' | 'dbEnum' | 'enumAnnotation' | 'enumMember'
    >;

export type ForgedSchemaDefinition = Schema & {
    see?: (string | [ref: string, title: string])[];
    spec?: string;
    //
    dbFK?: DBMLForeignKeyOptions;
    dbColumn?: DBMLColumnOptions;
    dbIndex?: DBMLIndexOptionsDef;
    dbEnum?: DBMLEnumOptionsDef;
    enumAnnotation?: SGEnumAnnotationOptions;
    enumMember?: SGEnumMemberOptions;
    //
    dbEntity?: DBMLEntityOptionsDef;
    properties?: PRec<ForgedEntitySchema>;
};

export interface ForgeSchemaResult {
    schema: ForgedSchema;
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
export type SchemaForgeSortableContents = 'properties' | 'required' | 'enum' | 'anyOf' | 'oneOf';
export type SchemaForgeSortableContentSet = SchemaForgeSortableContents[];

export const SchemaForgeDefaultSortableContents = [
    'required',
    'enum',
    'anyOf',
    'oneOf',
] as const satisfies SchemaForgeSortableContentSet;

type TypeExposeKind = Config['expose'];
type DiscriminatorType = Config['discriminatorType'];
