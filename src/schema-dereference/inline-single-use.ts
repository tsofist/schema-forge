import type { URec } from '@tsofist/stem';
import { entriesOf } from '@tsofist/stem/lib/object/entries-of';
import type { JSONSchema7 } from 'json-schema';

/**
 * Inline definitions that are referenced exactly once.
 *
 * Every entry of the root `definitions` / `$defs` containers whose pointer occurs exactly
 *   once anywhere in the schema is replaced into that single reference site and dropped
 *   from the container. Both containers are processed when both are present: they are
 *   independent namespaces addressed by distinct pointers (`#/$defs/X` vs
 *   `#/definitions/X`).
 * Keywords sitting next to the inlined `$ref` win over the ones coming from the definition
 *   itself, which is how `dereferenceSchema` merges as well.
 * A definition is deleted only when it was actually inlined, so the result can never
 *   contain a dangling pointer.
 *
 * A definition is never inlined nor removed when it is named by `keep`, when it is
 *   referenced any number of times other than once, when some pointer addresses a node
 *   *inside* it (`#/definitions/A/properties/x`), or when inlining it would have to
 *   re-enter a reference cycle.
 *
 * Known limitations: every visited node is rebuilt, so the result shares nothing by
 *   reference with the source; JSON Pointer escape sequences (`~0`/`~1`) are not decoded;
 *   only single-segment pointers into a container are recognized; a definition whose body
 *   is a boolean schema (`true`/`false`) is never inlined, because it cannot absorb the
 *   keywords sitting next to the `$ref` it would replace.
 *
 * @param schema Root JSON Schema to compact
 * @param options.keep Definition names that must never be inlined nor removed
 * @returns New schema with single-use definitions inlined. The source is never mutated.
 */
export function inlineSingleUseDefinitions(
    schema: JSONSchema7,
    options: InlineSingleUseDefinitionsOptions = {},
): JSONSchema7 {
    const source = schema as unknown as URec;
    const containers = DEFINITION_CONTAINERS.filter((name) => isRecord(source[name]));

    if (containers.length === 0) return { ...schema };

    const containerKeys = new Set<string>(containers);
    const isProtected = createKeepPredicate(options.keep);
    const { counts, pinned } = collectUsages(source, containers);

    const candidates = new Set<string>();

    for (const container of containers) {
        for (const [name, body] of entriesOf(source[container] as URec)) {
            const key = definitionKey(container, name);
            if (
                counts.get(key) === 1 &&
                !pinned.has(key) &&
                !isProtected(name) &&
                // A boolean definition body cannot absorb the keywords
                //   sitting next to the `$ref` it would replace.
                isRecord(body)
            ) {
                candidates.add(key);
            }
        }
    }

    const inlined = new Set<string>();
    const stack = new Set<string>();

    function expand(value: unknown): unknown {
        if (Array.isArray(value)) return value.map((item) => expand(item));
        if (!isRecord(value)) return value;

        if (typeof value.$ref === 'string') {
            const target = parseDefinitionRef(value.$ref, containers);

            if (target?.exact) {
                const key = definitionKey(target.container, target.name);

                if (candidates.has(key) && !stack.has(key)) {
                    const body = (source[target.container] as URec)[target.name];

                    stack.add(key);
                    const resolved = expand(body) as URec;
                    stack.delete(key);
                    inlined.add(key);

                    const merged: URec = { ...resolved };
                    for (const [entryKey, entryValue] of entriesOf(value)) {
                        if (entryKey !== '$ref') merged[entryKey] = expand(entryValue);
                    }
                    return merged;
                }
            }
        }

        const result: URec = {};
        for (const [entryKey, entryValue] of entriesOf(value)) {
            result[entryKey] = expand(entryValue);
        }
        return result;
    }

    const rootValues = new Map<string>();
    for (const [key, value] of entriesOf(source)) {
        if (!containerKeys.has(key)) rootValues.set(key, expand(value));
    }

    const bodies = new Map<string>();
    for (const container of containers) {
        for (const [name, body] of entriesOf(source[container] as URec)) {
            const key = definitionKey(container, name);
            if (!candidates.has(key)) bodies.set(key, expand(body));
        }
    }

    // A candidate nothing reachable points at (a mutual cycle, for instance) is expanded
    //   on its own, with its own name on the stack so it cannot inline itself.
    for (const container of containers) {
        for (const [name, body] of entriesOf(source[container] as URec)) {
            const key = definitionKey(container, name);
            if (candidates.has(key) && !inlined.has(key)) {
                stack.add(key);
                bodies.set(key, expand(body));
                stack.delete(key);
            }
        }
    }

    const result: URec = {};
    for (const [key, value] of entriesOf(source)) {
        if (!containerKeys.has(key)) {
            result[key] = rootValues.get(key);
            continue;
        }

        const container: URec = {};
        for (const [name] of entriesOf(value as URec)) {
            const definition = definitionKey(key, name);
            if (!inlined.has(definition)) container[name] = bodies.get(definition);
        }
        result[key] = container;
    }

    return result as JSONSchema7;
}

export type InlineSingleUseDefinitionsOptions = {
    /**
     * Definition names that must never be inlined nor removed.
     * A name is matched in every container it appears in.
     */
    readonly keep?: Iterable<string> | ((definitionName: string) => boolean);
};

const DEFINITION_CONTAINERS = ['$defs', 'definitions'] as const;

type DefinitionContainer = (typeof DEFINITION_CONTAINERS)[number];

type DefinitionRefTarget = {
    container: DefinitionContainer;
    name: string;
    /** False when the pointer addresses a node *inside* the definition */
    exact: boolean;
};

function collectUsages(source: URec, containers: readonly DefinitionContainer[]) {
    const counts = new Map<string, number>();
    const pinned = new Set<string>();

    walk(source);

    return { counts, pinned };

    function walk(value: unknown): void {
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }
        if (!isRecord(value)) return;

        if (typeof value.$ref === 'string') {
            const target = parseDefinitionRef(value.$ref, containers);
            if (target) {
                const key = definitionKey(target.container, target.name);
                if (target.exact) {
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                } else {
                    // A pointer addressing a node inside a definition pins that definition
                    //   in place: removing it would break the pointer.
                    pinned.add(key);
                }
            }
        }

        for (const [, entryValue] of entriesOf(value)) walk(entryValue);
    }
}

function parseDefinitionRef(
    ref: string,
    containers: readonly DefinitionContainer[],
): DefinitionRefTarget | undefined {
    for (const container of containers) {
        const prefix = `#/${container}/`;
        if (!ref.startsWith(prefix)) continue;

        const path = ref.slice(prefix.length);
        if (path.length === 0) return undefined;

        const separator = path.indexOf('/');
        const name = separator < 0 ? path : path.slice(0, separator);

        return { container, name: decodeURIComponent(name), exact: separator < 0 };
    }

    return undefined;
}

function createKeepPredicate(
    keep: InlineSingleUseDefinitionsOptions['keep'],
): (definitionName: string) => boolean {
    if (keep == undefined) return () => false;
    if (typeof keep === 'function') return keep;

    const names = new Set(keep);
    return (definitionName) => names.has(definitionName);
}

function definitionKey(container: string, definitionName: string) {
    return `${container}/${definitionName}`;
}

function isRecord(value: unknown): value is URec {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
