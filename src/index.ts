import { substr } from '@tsofist/stem/lib/string/substr';
import { SchemaDefinitionInfo, SchemaDefinitionKind, SchemaForgeSignatureSuffix } from './types';

const N_I = '_InterfaceDeclaration';
const N_A = '_Args';
const N_R = '_Result';

export function buildInterfaceSchemaSignature(interfaceName: string): string;
export function buildInterfaceSchemaSignature(interfaceName: string, memberName: string): string;
export function buildInterfaceSchemaSignature(
    interfaceName: string,
    methodName: string,
    suffix: SchemaForgeSignatureSuffix,
): string;
export function buildInterfaceSchemaSignature(
    interfaceName: string,
    memberName?: string,
    suffix?: SchemaForgeSignatureSuffix,
): string {
    let result = `${interfaceName}${memberName ? `_${memberName}` : N_I}`;
    switch (suffix) {
        case SchemaForgeSignatureSuffix.MethodArguments:
            result += N_A;
            break;
        case SchemaForgeSignatureSuffix.MethodResult:
            result += N_R;
            break;
    }
    return result;
}

export function parseSchemaDefinitionInfo(name: string, schema: string): SchemaDefinitionInfo {
    const kind: SchemaDefinitionKind = name.endsWith(N_I)
        ? SchemaDefinitionKind.Interface
        : name.endsWith(N_A)
          ? SchemaDefinitionKind.InterfaceMethodArguments
          : name.endsWith(N_R)
            ? SchemaDefinitionKind.InterfaceMethodResult
            : SchemaDefinitionKind.Type;
    switch (kind) {
        case SchemaDefinitionKind.Interface:
            return {
                kind,
                name,
                schema,
                interface: substr(name, 0, N_I)!,
            };
        case SchemaDefinitionKind.InterfaceMethodArguments:
        case SchemaDefinitionKind.InterfaceMethodResult:
            return {
                kind,
                name,
                schema,
                interface: substr(name, 0, '_')!,
                method: substr(name, '_', '_')!,
            };
        case SchemaDefinitionKind.Type:
            return {
                kind,
                name,
                schema,
                type: name,
            };
    }
}
