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
        case SchemaDefinitionInfoKind.API:
            return {
                ref,
                kind,
                name: definitionName,
                schemaId,
                interface: substr(definitionName, 0, legacy ? _SDS_SUFFIX_API : SDS_SUFFIX_API)!,
            };
        case SchemaDefinitionInfoKind.APIMethodArguments:
        case SchemaDefinitionInfoKind.APIMethodResult:
            return {
                ref,
                kind,
                name: definitionName,
                schemaId,
                interface: substr(definitionName, 0, '_')!,
                method: substr(definitionName, '_', '_')!,
            };
        case SchemaDefinitionInfoKind.Type:
            return {
                ref,
                kind,
                name: definitionName,
                schemaId,
                type: definitionName,
            };
    }
}
