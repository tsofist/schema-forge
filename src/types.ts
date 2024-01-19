import { Nullable } from '@tsofist/stem';
import { ErrorCode } from '@tsofist/stem/lib/error';
import { ErrorObject, SchemaObject, ErrorsTextOptions } from 'ajv';
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
    readonly sourcesFilesPattern: string;
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
     *      result.schema-definitions.json
     *      /absolute/path/to/result.schema-definitions.json
     */
    readonly outputDefinitionsFile?: string;
}

export interface SchemaForgeResult {
    schema: SchemaObject;
    generatedFiles: readonly string[];
    refs: readonly SchemaForgeDefinitionRef[];
}

export const SchemaNotFoundErrorCode: ErrorCode = 'EC_SCHEMA_NOT_FOUND';
export type SchemaNotFoundErrorContext = SchemaForgeValidationContextBase & {
    schema: SchemaForgeDefinitionRef;
};

export const SchemaForgeValidationErrorCode: ErrorCode = 'EC_SCHEMA_VALIDATION_FAILED';
export type SchemaForgeValidationErrorContext = SchemaForgeValidationErrorContextBase & {
    schema: SchemaForgeDefinitionRef;
    errors: ErrorObject[];
};

export interface SchemaForgeValidationContextBase {
    errorMessage?: string;
    instancePath?: string;
}

export interface SchemaForgeValidationErrorContextBase extends SchemaForgeValidationContextBase {
    schema: SchemaForgeDefinitionRef;
    errors: ErrorObject[];
}

export type SchemaForgeDefinitionRef = `${string}#/definitions/${string}`;

export enum SchemaDefinitionKind {
    Type,
    Interface,
    InterfaceMethodResult,
    InterfaceMethodArguments,
}

export type SchemaDefinitionInfo = {
    name: string;
    schema: string;
} & (
    | {
          kind: SchemaDefinitionKind.Interface;
          interface: string;
      }
    | {
          kind: SchemaDefinitionKind.InterfaceMethodArguments;
          interface: string;
          method: string;
      }
    | {
          kind: SchemaDefinitionKind.InterfaceMethodResult;
          interface: string;
          method: string;
      }
    | {
          kind: SchemaDefinitionKind.Type;
          type: string;
      }
);

export interface SchemaForgeValidationResult {
    valid: boolean;
    errors: Nullable<ErrorObject[]>;
    errorsText(options?: ErrorsTextOptions): string;
}
