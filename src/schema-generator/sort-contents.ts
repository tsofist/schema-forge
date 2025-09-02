import type { CompareResult, NonPrimitive, URec } from '@tsofist/stem';
import { isPrimitive } from '@tsofist/stem/lib/is-primitive';
import { entries } from '@tsofist/stem/lib/object/entries';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { omitProps } from '@tsofist/stem/lib/object/omit';
import { compareStringsAsc } from '@tsofist/stem/lib/string/compare';
import type { JSONSchema7, JSONSchema7Object, JSONSchema7TypeName } from 'json-schema';
import { SchemaForgeDefaultSortableContents, SchemaForgeSortableContentSet } from '../types';
import { SFG_EXTRA_TAGS } from './types';

export function sortSchemaContents<T extends JSONSchema7Object | JSONSchema7>(
    schema: T,
    contents: boolean | SchemaForgeSortableContentSet = SchemaForgeDefaultSortableContents,
): T {
    contents =
        contents === true ? SchemaForgeDefaultSortableContents : contents == false ? [] : contents;
    const stack: T[] = [];

    const process = (item: T | T[] | undefined) => {
        if (isPrimitive(item)) return;

        if (Array.isArray(item)) {
            stack.push(...item);
        } else {
            const processedProps = new Set<string>();
            const hr = hasRequired(item);
            const hp = hasProperties(item);

            if (hr || hp) {
                if (hr) {
                    if (contents.includes('required')) {
                        item.required.sort(compareStringsAsc);
                    }
                    processedProps.add('required');
                }
                if (hp) {
                    if (contents.includes('properties')) {
                        item.properties = Object.fromEntries(
                            Object.entries(item.properties).sort(entitiesComparatorAsk),
                        );
                    }
                    processedProps.add('properties');
                }
            } else {
                if (hasEnum(item)) {
                    if (contents.includes('enum')) {
                        item.enum.sort(indexComparatorAsk);
                    }
                    processedProps.add('enum');
                } else if (hasAnyOf(item)) {
                    if (contents.includes('anyOf')) {
                        item.anyOf.sort(nullTypeFirstComparator);
                    }
                    processedProps.add('anyOf');
                } else if (hasOneOf(item)) {
                    if (contents.includes('oneOf')) {
                        item.oneOf.sort(nullTypeFirstComparator);
                    }
                    processedProps.add('oneOf');
                }
            }

            {
                const saved: URec = { ...item };
                for (const k in item) delete item[k];
                for (const [k, v] of entries(saved).sort(entitiesComparatorAsk)) {
                    // @ts-expect-error It's OK
                    item[k] = v;
                }
            }

            stack.push(
                ...(Object.values(omitProps(item, [...processedProps, ...SFG_EXTRA_TAGS])) as T[]),
            );
        }
    };

    process(schema);
    while (stack.length) {
        process(stack.pop());
    }

    return schema;
}

function entitiesComparatorAsk([a]: [string, unknown], [b]: [string, unknown]) {
    return compareStringsAsc(a, b);
}

function indexComparatorAsk<T extends string | number>(a: T, b: T): CompareResult {
    return a === b ? 0 : a > b ? 1 : -1;
}

function nullTypeFirstComparator(
    a: { type?: JSONSchema7TypeName },
    b: { type?: JSONSchema7TypeName },
): CompareResult {
    const an = a.type === 'null';
    const bn = b.type === 'null';
    if (an && !bn) return -1;
    if (!an && bn) return 1;
    return 0;
}

function hasProperties(target: NonPrimitive): target is {
    properties: URec;
} {
    return (
        'properties' in target &&
        typeof target.properties === 'object' &&
        !isEmptyObject(target.properties)
    );
}

function hasRequired(target: NonPrimitive): target is {
    required: string[];
} {
    return 'required' in target && Array.isArray(target.required) && target.required.length > 0;
}

function hasEnum(target: NonPrimitive): target is {
    enum: (string | number)[];
} {
    return 'enum' in target && Array.isArray(target.enum) && target.enum.length > 0;
}

function hasAnyOf(target: NonPrimitive): target is {
    anyOf: { type?: JSONSchema7TypeName }[];
} {
    return 'anyOf' in target && Array.isArray(target.anyOf) && target.anyOf.length > 0;
}

function hasOneOf(target: NonPrimitive): target is {
    oneOf: { type?: JSONSchema7TypeName }[];
} {
    return 'oneOf' in target && Array.isArray(target.oneOf) && target.oneOf.length > 0;
}
