import { substr } from '@tsofist/stem/lib/string/substr';
import {
    isAPIDefinitionName,
    isAPIMethodArgsDefinitionName,
    isAPIMethodResultDefinitionName,
} from './guards';
import { buildSchemaDefinitionRef } from './ref';
import {
    _SDS_SUFFIX_API,
    type SchemaDefinitionInfo,
    SchemaDefinitionInfoKind,
    SDS_SUFFIX_API,
} from './types';

export function parseSchemaDefinitionInfo<T extends SchemaDefinitionInfo>(
    definitionName: string,
    schemaId: string,
    legacy?: boolean,
): T;
export function parseSchemaDefinitionInfo(
    definitionName: string,
    schemaId: string,
    legacy = false,
): SchemaDefinitionInfo {
    const kind: SchemaDefinitionInfoKind = isAPIDefinitionName(definitionName)
        ? SchemaDefinitionInfoKind.API
        : isAPIMethodArgsDefinitionName(definitionName)
          ? SchemaDefinitionInfoKind.APIMethodArguments
          : isAPIMethodResultDefinitionName(definitionName)
            ? SchemaDefinitionInfoKind.APIMethodResult
            : SchemaDefinitionInfoKind.Type;
    const ref = buildSchemaDefinitionRef(definitionName, schemaId);

    switch (kind) {
        case SchemaDefinitionInfoKind.Type:
            return {
                ref,
                schemaId,
                name: definitionName,
                kind,
                type: definitionName,
            };
        case SchemaDefinitionInfoKind.APIMethodArguments:
        case SchemaDefinitionInfoKind.APIMethodResult:
            return {
                ref,
                schemaId,
                name: definitionName,
                kind,
                interface: substr(definitionName, 0, '_')!,
                method: substr(definitionName, '_', '_')!,
            };
        case SchemaDefinitionInfoKind.API:
            return {
                ref,
                schemaId,
                name: definitionName,
                kind,
                interface: substr(definitionName, 0, legacy ? _SDS_SUFFIX_API : SDS_SUFFIX_API)!,
            };
    }
}
