import type { ARec } from '@tsofist/stem';
import { entries } from '@tsofist/stem/lib/object/entries';
import { substr } from '@tsofist/stem/lib/string/substr';
import type { SchemaObject } from 'ajv';
import type { JSONSchemaFakerRefs } from 'json-schema-faker';
import type { SchemaForgeRegistry } from '../schema-registry/types';
import type { SchemaForgeDefinitionRef } from '../types';
import { createFakeGeneratorHost } from './generator-host';
import type { FakeGeneratorHost, FakeGeneratorOptions } from './types';

export function generateFakeData<T = unknown>(
    schemaRegistry: SchemaForgeRegistry,
    source: SchemaForgeDefinitionRef,
    options?: FakeGeneratorOptions,
): T;
export function generateFakeData<T = unknown>(
    host: FakeGeneratorHost,
    source: SchemaForgeDefinitionRef,
): T;
export function generateFakeData<T = unknown>(
    schemaRegistryOrHost: SchemaForgeRegistry | FakeGeneratorHost,
    source: SchemaForgeDefinitionRef,
    options: FakeGeneratorOptions = {},
): T {
    const host =
        'schemaRegistry' in schemaRegistryOrHost
            ? schemaRegistryOrHost
            : createFakeGeneratorHost(schemaRegistryOrHost, options);

    const { schemaRegistry, generator } = host;

    const refs: JSONSchemaFakerRefs = {};

    {
        const rootSchemaId = substr(source, 0, '#')!;
        for (const def of schemaRegistry.listDefinitions()) {
            const schema = schemaRegistry.getSchema(def.ref) as SchemaObject;

            if (rootSchemaId === def.schemaId) {
                refs[`#/definitions/${def.name}`] = schema;
            } else {
                refs[def.ref] = schema;
            }
        }
    }

    const schema = schemaRegistry.getSchema(source);
    if (schema == null) throw new Error(`Schema not found: ${source}`);

    const result = generator.generate(schema as SchemaObject, refs) as T;
    cleanJSFQuirksArtefacts(result as unknown as ARec);
    return result;
}

function cleanJSFQuirksArtefacts<T extends ARec>(target: T): T {
    const stack: [value: ARec | any[]][] = [[target]];

    const hasProblem = (item: unknown | ARec): boolean => {
        return (
            typeof item === 'object' &&
            item !== null &&
            ('$ref' in item || 'anyOf' in item || 'allOf' in item || 'not' in item)
        );
    };

    while (stack.length > 0) {
        const [current] = stack.pop()!;

        if (Array.isArray(current)) {
            for (let i = current.length - 1; i >= 0; i--) {
                const element = current[i];
                if (hasProblem(element)) {
                    current.splice(i, 1);
                } else if (typeof element === 'object' && element !== null) {
                    stack.push([element]);
                }
            }
        } else if (current != null && typeof current === 'object') {
            for (const [propKey, propValue] of entries(current)) {
                if (hasProblem(propValue)) {
                    delete current[propKey];
                } else if (typeof propValue === 'object' && propValue !== null) {
                    stack.push([propValue]);
                }
            }
        }
    }

    return target;
}
