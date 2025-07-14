import * as process from 'node:process';
import { asBool } from '@tsofist/stem/lib/as-bool';
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

export interface SchemaDefinitionInfoForType extends SDIBase {
    kind: SchemaDefinitionInfoKind.Type;
    type: string;
}

export interface SchemaDefinitionInfoForAPIInterface extends SDIBase {
    kind: SchemaDefinitionInfoKind.API;
    interface: string;
}

export interface SchemaDefinitionInfoForAPIMethodArguments extends SDIBase {
    kind: SchemaDefinitionInfoKind.APIMethodArguments;
    interface: string;
    method: string;
}

export interface SchemaDefinitionInfoForAPIMethodResult extends SDIBase {
    kind: SchemaDefinitionInfoKind.APIMethodResult;
    interface: string;
    method: string;
}

interface SDIBase {
    name: string;
    schemaId: string;
    ref: SchemaForgeDefinitionRef;
    kind: SchemaDefinitionInfoKind;
}

const LEGACY_DEFINITIONS = asBool((process.env || {}).SF_LEGACY_DEFINITIONS); // todo?

export const SDS_SUFFIX_API = LEGACY_DEFINITIONS ? '_InterfaceDeclaration' : '__APIInterface';
export const SDS_SUFFIX_MEMBER = '__APIMember';
export const SDS_SUFFIX_METHOD_ARGS = LEGACY_DEFINITIONS ? '_Args' : '__APIMethodArgs';
export const SDS_SUFFIX_METHOD_RES = LEGACY_DEFINITIONS ? '_Result' : '__APIMethodResult';

export type APIInterfaceSDS = `${string}${typeof SDS_SUFFIX_API}`;
export type APIMemberSDS = `${string}_${string}${typeof SDS_SUFFIX_MEMBER}`;
export type APIMethodArgsSDS = `${string}_${string}${typeof SDS_SUFFIX_METHOD_ARGS}`;
export type APIMethodResultSDS = `${string}_${string}${typeof SDS_SUFFIX_METHOD_RES}`;
