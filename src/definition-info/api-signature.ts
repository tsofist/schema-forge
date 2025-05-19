import {
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
export function buildAPIInterfaceSDS(interfaceName: string): APIInterfaceSDS {
    return `${interfaceName}${SDS_SUFFIX_API}`;
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
export function buildAPIMethodArgsSDS(interfaceName: string, methodName: string): APIMethodArgsSDS {
    return `${interfaceName}_${methodName}${SDS_SUFFIX_METHOD_ARGS}`;
}

/**
 * Builds the type signature for the API Interface method result
 */
export function buildAPIMethodResultSDS(
    interfaceName: string,
    methodName: string,
): APIMethodResultSDS {
    return `${interfaceName}_${methodName}${SDS_SUFFIX_METHOD_RES}`;
}
