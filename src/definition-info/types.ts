import type { SchemaForgeDefinitionRef } from '../types';

/**
 * Kind of schema definition information
 */
export enum SchemaDefinitionInfoKind {
    Type,
    API,
    APIMethodResult,
    APIMethodArguments,
}

/**
 * Schema definition information
 */
export type SchemaDefinitionInfo =
    | SchemaDefinitionInfoForType
    | SchemaDefinitionInfoForAPIInterface
    | SchemaDefinitionInfoForAPIMethodArguments
    | SchemaDefinitionInfoForAPIMethodResult;

export type SchemaDefinitionInfoForType = {
    kind: SchemaDefinitionInfoKind.Type;
    type: string;
} & SDIBase;

export type SchemaDefinitionInfoForAPIInterface = {
    kind: SchemaDefinitionInfoKind.API;
    interface: string;
} & SDIBase;

export type SchemaDefinitionInfoForAPIMethodArguments = {
    kind: SchemaDefinitionInfoKind.APIMethodArguments;
    interface: string;
    method: string;
} & SDIBase;

export type SchemaDefinitionInfoForAPIMethodResult = {
    kind: SchemaDefinitionInfoKind.APIMethodResult;
    interface: string;
    method: string;
} & SDIBase;

type SDIBase = {
    name: string;
    schemaId: string;
    ref: SchemaForgeDefinitionRef;
    kind: SchemaDefinitionInfoKind;
};

/** @deprecated */
export const _SDS_SUFFIX_API = '_InterfaceDeclaration';
/** @deprecated */
export const _SDS_SUFFIX_METHOD_ARGS = '_Args';
/** @deprecated */
export const _SDS_SUFFIX_METHOD_RES = '_Result';

export const SDS_SUFFIX_API = '__APIInterface';
export const SDS_SUFFIX_MEMBER = '__APIMember';
export const SDS_SUFFIX_METHOD_ARGS = '__APIMethodArgs';
export const SDS_SUFFIX_METHOD_RES = '__APIMethodResult';

export type APIInterfaceSDS = `${string}${typeof SDS_SUFFIX_API}`;
export type APIMemberSDS = `${string}_${string}${typeof SDS_SUFFIX_MEMBER}`;
export type APIMethodArgsSDS = `${string}_${string}${typeof SDS_SUFFIX_METHOD_ARGS}`;
export type APIMethodResultSDS = `${string}_${string}${typeof SDS_SUFFIX_METHOD_RES}`;
