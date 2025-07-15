import {
    _SDS_SUFFIX_API,
    _SDS_SUFFIX_METHOD_ARGS,
    _SDS_SUFFIX_METHOD_RES,
    type APIInterfaceSDS,
    type APIMemberSDS,
    type APIMethodArgsSDS,
    type APIMethodResultSDS,
    SDS_SUFFIX_API,
    SDS_SUFFIX_MEMBER,
    SDS_SUFFIX_METHOD_ARGS,
    SDS_SUFFIX_METHOD_RES,
} from './types';

/**
 * Builds the type signature for the API Interface
 */
export function buildAPIInterfaceSDS(interfaceName: string, legacy = false): APIInterfaceSDS {
    return `${interfaceName}${legacy ? _SDS_SUFFIX_API : SDS_SUFFIX_API}` as APIInterfaceSDS;
}

/**
 * Builds the type signature for the API Interface member
 */
export function buildAPIMemberSDS(interfaceName: string, memberName: string): APIMemberSDS {
    return `${interfaceName}_${memberName}${SDS_SUFFIX_MEMBER}`;
}

/**
 * Builds the type signature for the API Interface method arguments
 */
export function buildAPIMethodArgsSDS(
    interfaceName: string,
    methodName: string,
    legacy = false,
): APIMethodArgsSDS {
    return `${interfaceName}_${methodName}${legacy ? _SDS_SUFFIX_METHOD_ARGS : SDS_SUFFIX_METHOD_ARGS}` as APIMethodArgsSDS;
}

/**
 * Builds the type signature for the API Interface method result
 */
export function buildAPIMethodResultSDS(
    interfaceName: string,
    methodName: string,
    legacy = false,
): APIMethodResultSDS {
    return `${interfaceName}_${methodName}${legacy ? _SDS_SUFFIX_METHOD_RES : SDS_SUFFIX_METHOD_RES}` as APIMethodResultSDS;
}
