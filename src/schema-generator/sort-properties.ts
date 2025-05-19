import type { URec } from '@tsofist/stem';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { compareStringsAsc } from '@tsofist/stem/lib/string/compare';
import type { JSONSchema7Object } from 'json-schema';

export function sortSchemaProperties<T extends JSONSchema7Object>(schema: T): T {
    const stack: T[] = [];

    const isTarget = (
        target: unknown,
    ): target is { type: 'object'; properties: URec; required?: string[] } => {
        return (
            target != null &&
            typeof target === 'object' &&
            'type' in target &&
            target.type === 'object' &&
            'properties' in target &&
            typeof target.properties === 'object' &&
            !isEmptyObject(target.properties)
        );
    };

    const process = (item: T | T[] | undefined) => {
        if (!item) return;

        if (Array.isArray(item)) {
            stack.push(...item);
        } else {
            if (isTarget(item)) {
                item.properties = Object.fromEntries(
                    Object.entries(item.properties).sort(([a], [b]) => compareStringsAsc(a, b)),
                );
                if (item.required?.length) item.required.sort(compareStringsAsc);
            }
            if (typeof item === 'object') {
                stack.push(...(Object.values(item) as T[]));
            }
        }
    };

    process(schema);
    while (stack.length) {
        process(stack.pop());
    }

    return schema;
}
