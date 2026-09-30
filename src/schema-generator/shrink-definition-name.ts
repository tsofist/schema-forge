import { createHash } from 'node:crypto';
import type { Rec } from '@tsofist/stem';
import type {
    ForgedSchemaDefinition,
    ForgedSchemaDefinitionShortName,
    ShrinkDefinitionNameContext,
} from '../types';

const REF_PREFIX = '#/definitions/';

/**
 * Shrink definition name by removing generic type parameters
 *   and appending a digest of the removed part.
 *
 * ```
 * UniqueItemsArray<CMSTagID> => DSNUniqueItemsArray_H809778
 * PickExistsKeys<CMSBanner,("name"|alias-731470504-74264-74374-731470504-0-218439<…>)> => DSNPickExistsKeys_Ha3bc1b
 * ```
 *
 * The digest is taken over the name itself, and raw definition names embed the generator's
 *   own node keys — `hash(path relative to process.cwd())` plus `node.pos`/`node.end` per AST
 *   ancestor, see `ts-json-schema-generator/src/Utils/nodeKey.ts`. So the result changes when
 *   the same sources are built from a different working directory, or when an unrelated edit
 *   shifts byte offsets within a file.
 *
 * This is the legacy behaviour, kept so that already published schemas keep their names.
 *
 * @see shrinkDefinitionNameStable
 */
export function shrinkDefinitionName(
    context: ShrinkDefinitionNameContext,
    suffixLength = 6,
): ForgedSchemaDefinitionShortName | undefined {
    const { name } = context;
    const startPos = name.indexOf('<');
    if (startPos < 0) return undefined;

    return buildShortName(
        name.substring(0, startPos),
        digest(name.substring(startPos)),
        suffixLength,
    );
}

/**
 * Shrink definition name by removing generic type parameters
 *   and appending a digest of what the definition actually is.
 *
 * Unlike {@link shrinkDefinitionName}, the digest is taken over the definition body with its
 *   `$ref` targets resolved structurally, never over the name. Nothing in it depends on where
 *   the sources live or on where within a file a type is declared, so the name changes only
 *   when the definition itself does.
 *
 * The readable prefix — everything before the first `<` — is kept as-is in both cases.
 */
export function shrinkDefinitionNameStable(
    context: ShrinkDefinitionNameContext,
    suffixLength = 6,
): ForgedSchemaDefinitionShortName | undefined {
    const { name, definition, definitions } = context;
    const startPos = name.indexOf('<');
    if (startPos < 0) return undefined;

    const value =
        definitions[name] === definition
            ? definitionStructureDigest(definitions, name)
            : // A caller handing us a body that is not the one `definitions` holds under this
              //   name gets it hashed as-is, unmemoized.
              digest(
                  serialize(definition, definitions, digestCacheOf(definitions), [name], {
                      minIndex: Infinity,
                  }),
              );

    return buildShortName(name.substring(0, startPos), value, suffixLength);
}

/**
 * Digest of what a definition is, with every local `$ref` resolved through to its structure.
 *
 * Two definitions sharing a digest are the very same JSON Schema under two names — every
 *   keyword, description and annotation included — and are therefore interchangeable.
 *
 * @see shrinkDefinitionNameStable
 */
export function definitionStructureDigest(
    definitions: Readonly<Rec<ForgedSchemaDefinition>>,
    name: string,
): string {
    return refDigest(name, definitions, digestCacheOf(definitions), [], { minIndex: Infinity });
}

function buildShortName(
    prefix: string,
    value: string,
    suffixLength: number,
): ForgedSchemaDefinitionShortName {
    return `DSN${prefix}_H${value.substring(0, suffixLength)}`;
}

function digest(source: string): string {
    return createHash('sha256').update(source).digest('hex');
}

type DigestCache = Map<string, string>;

/**
 * Digests are only comparable within a single set of definitions,
 *   so the cache is keyed by that very object and dies with it.
 */
const digestCaches = new WeakMap<object, DigestCache>();

function digestCacheOf(definitions: Readonly<Rec<ForgedSchemaDefinition>>): DigestCache {
    let cache = digestCaches.get(definitions);
    if (cache == null) {
        cache = new Map();
        digestCaches.set(definitions, cache);
    }
    return cache;
}

/**
 * Tracks the shallowest stack position a cycle jumped back to, Tarjan-lowlink style.
 * A subtree that only closes cycles within itself is self-contained and may be cached;
 *   one that jumps above its own root is entry-point dependent and may not.
 */
type CycleState = { minIndex: number };

function refDigest(
    name: string,
    definitions: Readonly<Rec<ForgedSchemaDefinition>>,
    cache: DigestCache,
    stack: string[],
    state: CycleState,
): string {
    const openAt = stack.indexOf(name);
    if (openAt >= 0) {
        // Depth of the back-jump rather than the name it lands on: the name may itself be
        //   one of the unstable generated ones, the depth never is.
        state.minIndex = Math.min(state.minIndex, openAt);
        return `cycle:${stack.length - openAt}`;
    }

    const cached = cache.get(name);
    if (cached != null) return cached;

    const definition = definitions[name];
    // A dangling ref carries no structure to hash; keeping the name is the best available
    //   identity, and it is exactly as (un)stable as leaving the definition unrenamed.
    if (definition == null) return `absent:${name}`;

    const position = stack.length;
    const inner: CycleState = { minIndex: Infinity };

    stack.push(name);
    const value = digest(serialize(definition, definitions, cache, stack, inner));
    stack.pop();

    if (inner.minIndex >= position) {
        cache.set(name, value);
    } else {
        state.minIndex = Math.min(state.minIndex, inner.minIndex);
    }

    return value;
}

/**
 * Canonical JSON: object keys sorted, array order preserved (it is significant for `enum`,
 *   `oneOf` and friends), every local `$ref` replaced by the digest of what it points at.
 *
 * Sorting is not redundant with `sortSchemaContents`: that one runs after the renaming pass,
 *   so at this point the key order is whatever the generator happened to emit.
 */
function serialize(
    value: unknown,
    definitions: Readonly<Rec<ForgedSchemaDefinition>>,
    cache: DigestCache,
    stack: string[],
    state: CycleState,
): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';

    if (Array.isArray(value)) {
        const items = value.map((item) => serialize(item, definitions, cache, stack, state));
        return `[${items.join(',')}]`;
    }

    const source = value as Rec<unknown>;
    const entries = Object.keys(source)
        .sort()
        .map((key) => {
            const item = source[key];
            if (key === '$ref' && typeof item === 'string' && item.startsWith(REF_PREFIX)) {
                // Refs pointing outside `#/definitions/` address another schema by its $id,
                //   which is stable on its own and must stay verbatim.
                const target = refDigest(
                    item.substring(REF_PREFIX.length),
                    definitions,
                    cache,
                    stack,
                    state,
                );
                return `${JSON.stringify(key)}:${JSON.stringify(`~${target}`)}`;
            }
            return `${JSON.stringify(key)}:${serialize(item, definitions, cache, stack, state)}`;
        });

    return `{${entries.join(',')}}`;
}
