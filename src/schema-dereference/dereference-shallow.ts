import type { ARec, ReintroduceExact } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import type { JSONSchema7 } from 'json-schema';

/**
 * Shallow dereference a JSON Schema by resolving only the top-level `$ref` pointer
 *   for each definition.
 *
 * @param schema Root JSON Schema to dereference
 * @param soloRefs If true, only dereference `$ref` entries that appear once in the schema
 * @returns New (shallow copy) schema with top-level `$ref` pointers resolved.
 */
export function shallowDereferenceSchema(schema: JSONSchema7, soloRefs = true): JSONSchema7 {
    const result: JSONSchema7 = { ...schema };
    let defs;

    if (result.$defs) {
        defs = result.$defs = { ...result.$defs };
    } else if (result.definitions) {
        defs = result.definitions = { ...result.definitions };
    } else {
        return result;
    }

    const usedRefs = new Map<string, number>();

    eachReferencedDefinition(defs, ({ $ref }) => {
        const count = (usedRefs.get($ref) || 0) + 1;
        usedRefs.set($ref, count);
    });

    eachReferencedDefinition(defs, (def, name) => {
        const seen = usedRefs.get(def.$ref);
        if (!soloRefs || seen === 1) {
            const resolved = resolveRef(def.$ref, schema);
            if (!resolved) {
                raise(`Failed to dereference $ref: ${def.$ref} during shallow dereference`);
            }
            defs[name] = resolved;
        }
    });

    return result;
}

function eachReferencedDefinition<T extends ReintroduceExact<JSONSchema7, { $ref: string }>>(
    defs: JSONSchema7['definitions'],
    cb: (def: T, name: string) => void,
) {
    for (const [nameRaw, raw] of entries(defs)) {
        const def = typeof raw === 'object' && raw !== null ? raw : undefined;
        if (def && def.$ref && def.$ref.startsWith('#/') && Object.keys(def).length === 1) {
            cb(def as T, nameRaw as string);
        }
    }
}

function resolveRef(ref: string, root: JSONSchema7): JSONSchema7 | undefined {
    const path = ref.slice(2).split('/').map(decodeURIComponent);
    let current: ARec = root;

    for (const segment of path) {
        if (current && typeof current === 'object' && segment in current) {
            current = current[segment];
        } else {
            return undefined;
        }
    }

    return current as JSONSchema7;
}
