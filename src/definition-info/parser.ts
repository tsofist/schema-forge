import { substr } from '@tsofist/stem/lib/string/substr';
import { buildSchemaDefinitionRef } from './ref';
import {
    type SchemaDefinitionInfo,
    SchemaDefinitionInfoKind,
    SDS_SUFFIX_API,
    SDS_SUFFIX_METHOD_ARGS,
    SDS_SUFFIX_METHOD_RES,
} from './types';

export function parseSchemaDefinitionInfo(
    definitionName: string,
    schemaId: string,
): SchemaDefinitionInfo {
    const kind: SchemaDefinitionInfoKind = definitionName.endsWith(SDS_SUFFIX_API)
        ? SchemaDefinitionInfoKind.API
        : definitionName.endsWith(SDS_SUFFIX_METHOD_ARGS)
          ? SchemaDefinitionInfoKind.APIMethodArguments
          : definitionName.endsWith(SDS_SUFFIX_METHOD_RES)
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
                interface: substr(definitionName, 0, SDS_SUFFIX_API)!,
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
