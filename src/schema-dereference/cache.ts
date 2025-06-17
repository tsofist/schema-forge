import type { JSONSchema7 } from 'json-schema';

export type SchemaDereferenceSharedCache = ReturnType<typeof createSchemaDereferenceSharedCache>;

export function createSchemaDereferenceSharedCache() {
    const main = new Map<JSONSchema7, JSONSchema7 | undefined>();
    const resolver = new Map<JSONSchema7, Map<string, JSONSchema7 | undefined>>();

    return {
        main,
        resolver,
        get size() {
            return main.size + resolver.size;
        },
        clear() {
            const size = this.size;
            main.clear();
            resolver.clear();
            return size;
        },
    } as const;
}

export const DefaultSchemaDereferenceSharedCache = createSchemaDereferenceSharedCache();
