import {
    _SDS_SUFFIX_API,
    _SDS_SUFFIX_METHOD_ARGS,
    _SDS_SUFFIX_METHOD_RES,
    APIInterfaceSDS,
    APIMemberSDS,
    APIMethodArgsSDS,
    APIMethodResultSDS,
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
