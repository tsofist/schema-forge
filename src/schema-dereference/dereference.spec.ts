import { DefaultSchemaDereferenceSharedCache } from './cache';
import { dereferenceSchema } from './dereference';

describe('schema-dereference', () => {
    beforeAll(() => {
        DefaultSchemaDereferenceSharedCache.clear();
    });

    it('should resolve schema references correctly (using definitions)', () => {
        const schema = {
            $id: 'https://example.com/schema.json',
            type: 'object',
            properties: { user: { $ref: '#/definitions/User' } },
            definitions: {
                User: {
                    type: 'object',
                    properties: { id: { type: 'string' }, name: { type: 'string' } },
                },
            },
        } as const;

        const dereferenced = dereferenceSchema(schema);

        expect(dereferenced).toStrictEqual({
            ...schema,
            properties: { user: schema.definitions.User },
        });
    });

    it('should resolve schema references correctly (using $defs)', () => {
        const schema = {
            $id: 'https://example.com/schema.json',
            type: 'object',
            properties: { user: { $ref: '#/$defs/User' } },
            $defs: {
                User: {
                    type: 'object',
                    properties: { id: { type: 'string' }, name: { type: 'string' } },
                },
            },
        } as const;

        const dereferenced = dereferenceSchema(schema);

        expect(dereferenced).toStrictEqual({
            ...schema,
            properties: { user: schema.$defs.User },
        });
    });

    it('should handle circular references', () => {
        const schema = {
            $id: 'https://example.com/circular-schema.json',
            type: 'object',
            properties: {
                self: { $ref: '#' },
            },
        } as const;

        const dereferenced = dereferenceSchema(schema);

        expect(dereferenced).toStrictEqual({
            ...schema,
            properties: {
                self: dereferenced,
            },
        });
    });

    it('should return undefined for unresolved references', () => {
        const schema = {
            $id: 'https://example.com/unresolved-schema.json',
            type: 'object',
            properties: {
                missing: { $ref: '#/definitions/Missing' },
            },
        } as const;

        const dereferenced = dereferenceSchema(schema, {
            throwOnDereferenceFailure: false,
        });

        expect(dereferenced).toStrictEqual({
            ...schema,
            properties: {
                missing: undefined,
            },
        });
    });

    it('shared cache should be used', () => {
        expect(DefaultSchemaDereferenceSharedCache.clear()).toBeGreaterThan(0);
        expect(DefaultSchemaDereferenceSharedCache.size).toStrictEqual(0);
    });
});
