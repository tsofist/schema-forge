import type { ForgedSchemaDefinitionShortName } from '../types';
import {
    _SDS_SUFFIX_API,
    _SDS_SUFFIX_METHOD_ARGS,
    _SDS_SUFFIX_METHOD_RES,
    APIInterfaceSDS,
    APIMemberSDS,
    APIMethodArgsSDS,
    APIMethodResultSDS,
    SchemaDefinitionInfo,
    SchemaDefinitionInfoForAPIInterface,
    SchemaDefinitionInfoForAPIMethodArguments,
    SchemaDefinitionInfoForAPIMethodResult,
    SchemaDefinitionInfoForType,
    SchemaDefinitionInfoKind,
    SDS_SUFFIX_API,
    SDS_SUFFIX_MEMBER,
    SDS_SUFFIX_METHOD_ARGS,
    SDS_SUFFIX_METHOD_RES,
} from './types';

export function isAPIDefinitionName(definitionName: string): definitionName is APIInterfaceSDS {
    return definitionName.endsWith(SDS_SUFFIX_API) || definitionName.endsWith(_SDS_SUFFIX_API);
}

export function isAPIMemberDefinitionName(definitionName: string): definitionName is APIMemberSDS {
    return definitionName.endsWith(SDS_SUFFIX_MEMBER);
}

export function isAPIMethodArgsDefinitionName(
    definitionName: string,
): definitionName is APIMethodArgsSDS {
    return (
        definitionName.endsWith(SDS_SUFFIX_METHOD_ARGS) ||
        definitionName.endsWith(_SDS_SUFFIX_METHOD_ARGS)
    );
}

export function isAPIMethodResultDefinitionName(
    definitionName: string,
): definitionName is APIMethodResultSDS {
    return (
        definitionName.endsWith(SDS_SUFFIX_METHOD_RES) ||
        definitionName.endsWith(_SDS_SUFFIX_METHOD_RES)
    );
}

export function isSchemaDefinitionForType(
    value: SchemaDefinitionInfo,
): value is SchemaDefinitionInfoForType {
    return value.kind === SchemaDefinitionInfoKind.Type;
}

export function isSchemaDefinitionForAPIInterface(
    value: SchemaDefinitionInfo,
): value is SchemaDefinitionInfoForAPIInterface {
    return value.kind === SchemaDefinitionInfoKind.API;
}

export function isSchemaDefinitionForAPIMethodArguments(
    value: SchemaDefinitionInfo,
): value is SchemaDefinitionInfoForAPIMethodArguments {
    return value.kind === SchemaDefinitionInfoKind.APIMethodArguments;
}

export function isSchemaDefinitionForAPIMethodResult(
    value: SchemaDefinitionInfo,
): value is SchemaDefinitionInfoForAPIMethodResult {
    return value.kind === SchemaDefinitionInfoKind.APIMethodResult;
}

export function isSchemaDefinitionShortName(name: string): name is ForgedSchemaDefinitionShortName {
    return name.startsWith('DSN') && name.includes('_H');
}
