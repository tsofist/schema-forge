import type { JSONSchema7 } from 'json-schema';
import { inlineSingleUseDefinitions } from './inline-single-use';

describe('inline single-use definitions', () => {
    describe('common behaviour', () => {
        it('should return a new schema and keep the source intact', () => {
            const schema = {
                $id: 'https://example.com/intact.json',
                type: 'object',
                properties: {
                    user: { $ref: '#/definitions/User' },
                },
                definitions: {
                    User: { type: 'object' },
                },
            } as const;

            const before = JSON.stringify(schema);
            const result = inlineSingleUseDefinitions(schema);

            expect(result).not.toBe(schema);
            expect(JSON.stringify(schema)).toStrictEqual(before);
        });

        it('should return a copy as-is when there are no definitions at all', () => {
            const schema = {
                $id: 'https://example.com/no-definitions.json',
                type: 'object',
                properties: { name: { type: 'string' } },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            expect(result).not.toBe(schema);
            expect(result).toStrictEqual(schema);
        });

        it('should inline definitions declared in $defs', () => {
            const schema = {
                $id: 'https://example.com/defs.json',
                type: 'object',
                properties: {
                    user: { $ref: '#/$defs/User' },
                },
                $defs: {
                    User: { type: 'object' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            expect(result.properties).toStrictEqual({ user: { type: 'object' } });
            expect(result.$defs).toStrictEqual({});
        });

        it('should process both containers when both are present', () => {
            const schema = {
                $id: 'https://example.com/both-containers.json',
                type: 'object',
                properties: {
                    d: { $ref: '#/$defs/Deffed' },
                    n: { $ref: '#/definitions/Defined' },
                },
                $defs: {
                    Deffed: { type: 'number' },
                },
                definitions: {
                    Defined: { type: 'string' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            // `#/$defs/X` and `#/definitions/X` are independent namespaces,
            //   so neither container shadows the other.
            expect(result.properties).toStrictEqual({
                d: { type: 'number' },
                n: { type: 'string' },
            });
            expect(result.$defs).toStrictEqual({});
            expect(result.definitions).toStrictEqual({});
        });

        it('should leave pointers that do not address a definition untouched', () => {
            const schema = {
                $id: 'https://example.com/foreign-pointers.json',
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    self: { $ref: '#' },
                    outside: { $ref: '#/properties/name' },
                    external: { $ref: 'https://example.com/other.json#/definitions/Target' },
                },
                definitions: {
                    Target: { type: 'string' },
                },
            } as const;

            // `Target` is never referenced from within this schema, so it stays as well.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });
    });

    describe('single-use inlining', () => {
        it('should inline a single-use definition and drop it from the root', () => {
            const schema = {
                $id: 'https://example.com/single-use.json',
                type: 'object',
                properties: {
                    user: { $ref: '#/definitions/User' },
                },
                definitions: {
                    User: { type: 'object', properties: { id: { type: 'string' } } },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema)).toStrictEqual({
                $id: 'https://example.com/single-use.json',
                type: 'object',
                properties: {
                    user: { type: 'object', properties: { id: { type: 'string' } } },
                },
                definitions: {},
            });
        });

        it('should keep a definition referenced more than once', () => {
            const schema = {
                $id: 'https://example.com/multi-use.json',
                type: 'object',
                properties: {
                    a: { $ref: '#/definitions/Shared' },
                    b: { $ref: '#/definitions/Shared' },
                },
                definitions: {
                    Shared: { type: 'string' },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should keep a definition that is not referenced at all', () => {
            const schema = {
                $id: 'https://example.com/unreferenced.json',
                type: 'object',
                definitions: {
                    Orphan: { type: 'string' },
                },
            } as const;

            // Only a reference count of exactly one is acted on: zero means the definition
            //   may well be addressed from outside the document.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should count references made from inside other definitions', () => {
            const schema = {
                $id: 'https://example.com/nested-usage.json',
                definitions: {
                    Order: {
                        type: 'object',
                        properties: {
                            item: { $ref: '#/definitions/Item' },
                            other: { $ref: '#/definitions/Item' },
                        },
                    },
                },
            } as const;

            // `Item` is referenced twice, both times from inside another definition.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should count references made from inside arrays', () => {
            const schema: JSONSchema7 = {
                $id: 'https://example.com/array-usage.json',
                type: 'object',
                properties: {
                    value: {
                        anyOf: [{ $ref: '#/definitions/Value' }, { type: 'null' }],
                    },
                },
                definitions: {
                    Value: { type: 'string' },
                },
            };

            const result = inlineSingleUseDefinitions(schema);

            expect(result.properties!.value).toStrictEqual({
                anyOf: [{ type: 'string' }, { type: 'null' }],
            });
            expect(result.definitions).toStrictEqual({});
        });

        it('should inline a whole chain of single-use definitions in one pass', () => {
            const schema = {
                $id: 'https://example.com/chain.json',
                type: 'object',
                properties: {
                    order: { $ref: '#/definitions/Order' },
                },
                definitions: {
                    Order: {
                        type: 'object',
                        properties: { item: { $ref: '#/definitions/Item' } },
                    },
                    Item: {
                        type: 'object',
                        properties: { sku: { $ref: '#/definitions/Sku' } },
                    },
                    Sku: { type: 'string' },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema)).toStrictEqual({
                $id: 'https://example.com/chain.json',
                type: 'object',
                properties: {
                    order: {
                        type: 'object',
                        properties: {
                            item: {
                                type: 'object',
                                properties: { sku: { type: 'string' } },
                            },
                        },
                    },
                },
                definitions: {},
            });
        });
    });

    describe('$ref siblings', () => {
        it('should let keywords next to the $ref win over the inlined ones', () => {
            const schema = {
                $id: 'https://example.com/siblings.json',
                type: 'object',
                properties: {
                    name: { $ref: '#/definitions/Name', description: 'Overridden' },
                },
                definitions: {
                    Name: { type: 'string', description: 'Original', minLength: 1 },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            expect(result.properties).toStrictEqual({
                name: { type: 'string', description: 'Overridden', minLength: 1 },
            });
            expect(result.definitions).toStrictEqual({});
        });

        it('should expand the siblings of an inlined $ref as well', () => {
            const schema = {
                $id: 'https://example.com/siblings-expanded.json',
                type: 'object',
                properties: {
                    order: {
                        $ref: '#/definitions/Order',
                        additionalProperties: { $ref: '#/definitions/Extra' },
                    },
                },
                definitions: {
                    Order: { type: 'object' },
                    Extra: { type: 'string' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            expect(result.properties).toStrictEqual({
                order: { type: 'object', additionalProperties: { type: 'string' } },
            });
            expect(result.definitions).toStrictEqual({});
        });
    });

    describe('protected definitions', () => {
        it('should never inline a protected definition, even a single-use one', () => {
            const schema = {
                $id: 'https://example.com/protected.json',
                type: 'object',
                properties: {
                    order: { $ref: '#/definitions/PublicOrder' },
                },
                definitions: {
                    PublicOrder: { type: 'object' },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema, { keep: ['PublicOrder'] })).toStrictEqual(
                schema,
            );

            // Without the protection the very same definition is inlined away.
            expect(inlineSingleUseDefinitions(schema).definitions).toStrictEqual({});
        });

        it('should accept keep as a predicate', () => {
            const schema = {
                $id: 'https://example.com/protected-predicate.json',
                type: 'object',
                properties: {
                    order: { $ref: '#/definitions/PublicOrder' },
                    detail: { $ref: '#/definitions/Detail' },
                },
                definitions: {
                    PublicOrder: { type: 'object' },
                    Detail: { type: 'string' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema, {
                keep: (name) => name.startsWith('Public'),
            });

            expect(result.definitions).toStrictEqual({ PublicOrder: { type: 'object' } });
            expect(result.properties).toStrictEqual({
                order: { $ref: '#/definitions/PublicOrder' },
                detail: { type: 'string' },
            });
        });

        it('should still inline single-use children into a protected definition', () => {
            const schema = {
                $id: 'https://example.com/protected-children.json',
                definitions: {
                    PublicOrder: {
                        type: 'object',
                        properties: { item: { $ref: '#/definitions/Item' } },
                    },
                    Item: { type: 'string' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema, { keep: ['PublicOrder'] });

            expect(result.definitions).toStrictEqual({
                PublicOrder: {
                    type: 'object',
                    properties: { item: { type: 'string' } },
                },
            });
        });

        it('should protect the name in every container it appears in', () => {
            const schema = {
                $id: 'https://example.com/protected-both-containers.json',
                type: 'object',
                properties: {
                    a: { $ref: '#/$defs/Shared' },
                    b: { $ref: '#/definitions/Shared' },
                },
                $defs: {
                    Shared: { type: 'number' },
                },
                definitions: {
                    Shared: { type: 'string' },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema, { keep: ['Shared'] })).toStrictEqual(schema);
        });
    });

    describe('cycles and self-references', () => {
        it('should keep a self-referencing definition', () => {
            const schema = {
                $id: 'https://example.com/self-reference.json',
                definitions: {
                    Node: {
                        type: 'object',
                        properties: { next: { $ref: '#/definitions/Node' } },
                    },
                },
            } as const;

            // Its only reference sits inside its own body, so inlining it would have to
            //   re-enter the definition being removed.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should resolve an unreachable mutual cycle without leaving a dangling $ref', () => {
            const schema = {
                $id: 'https://example.com/mutual-cycle.json',
                definitions: {
                    A: {
                        type: 'object',
                        properties: { b: { $ref: '#/definitions/B' } },
                    },
                    B: {
                        type: 'object',
                        properties: { a: { $ref: '#/definitions/A' } },
                    },
                },
            } as const;

            // Nothing outside the cycle points at either one, so the containers are walked
            //   in key order: `B` is inlined into `A`, and the pointer back to `A` — which
            //   is still present — stays a `$ref`.
            expect(inlineSingleUseDefinitions(schema).definitions).toStrictEqual({
                A: {
                    type: 'object',
                    properties: {
                        b: {
                            type: 'object',
                            properties: { a: { $ref: '#/definitions/A' } },
                        },
                    },
                },
            });
        });

        it('should keep a cycle reachable from a protected definition intact', () => {
            const schema = {
                $id: 'https://example.com/reachable-cycle.json',
                definitions: {
                    PublicRoot: {
                        type: 'object',
                        properties: { a: { $ref: '#/definitions/A' } },
                    },
                    A: {
                        type: 'object',
                        properties: { b: { $ref: '#/definitions/B' } },
                    },
                    B: {
                        type: 'object',
                        properties: { a: { $ref: '#/definitions/A' } },
                    },
                },
            } as const;

            // `A` is referenced twice (from `PublicRoot` and from `B`), so it stays put;
            //   `B` is referenced once and is inlined into `A`.
            expect(
                inlineSingleUseDefinitions(schema, { keep: ['PublicRoot'] }).definitions,
            ).toStrictEqual({
                PublicRoot: {
                    type: 'object',
                    properties: { a: { $ref: '#/definitions/A' } },
                },
                A: {
                    type: 'object',
                    properties: {
                        b: {
                            type: 'object',
                            properties: { a: { $ref: '#/definitions/A' } },
                        },
                    },
                },
            });
        });
    });

    describe('known limitations', () => {
        // These specs pin down the current behaviour, not the desired one.

        it('should keep a definition some pointer addresses the inside of', () => {
            const schema = {
                $id: 'https://example.com/sub-pointer.json',
                type: 'object',
                properties: {
                    whole: { $ref: '#/definitions/Target' },
                    part: { $ref: '#/definitions/Target/properties/id' },
                },
                definitions: {
                    Target: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                    },
                },
            } as const;

            // `Target` is referenced exactly once as a whole, but removing it would break
            //   the pointer addressing a node inside it.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should never inline a boolean definition body', () => {
            const schema = {
                $id: 'https://example.com/boolean-body.json',
                type: 'object',
                properties: {
                    anything: { $ref: '#/definitions/Anything' },
                    nothing: { $ref: '#/definitions/Nothing' },
                },
                definitions: {
                    Anything: true,
                    Nothing: false,
                },
            } as const;

            // A boolean schema cannot absorb the keywords sitting next to the `$ref`
            //   it would replace.
            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should not decode JSON Pointer escape sequences', () => {
            const schema = {
                $id: 'https://example.com/pointer-escapes.json',
                type: 'object',
                properties: {
                    value: { $ref: '#/definitions/a~1b' },
                },
                definitions: {
                    'a/b': { type: 'string' },
                },
            } as const;

            expect(inlineSingleUseDefinitions(schema)).toStrictEqual(schema);
        });

        it('should decode percent-encoded pointer segments', () => {
            const schema = {
                $id: 'https://example.com/pointer-percent.json',
                type: 'object',
                properties: {
                    value: { $ref: '#/definitions/a%20b' },
                },
                definitions: {
                    'a b': { type: 'string' },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            expect(result.properties).toStrictEqual({ value: { type: 'string' } });
            expect(result.definitions).toStrictEqual({});
        });

        it('should not share any visited node with the source schema', () => {
            const schema = {
                $id: 'https://example.com/no-sharing.json',
                definitions: {
                    Kept: { type: 'object', properties: { id: { type: 'string' } } },
                },
            } as const;

            const result = inlineSingleUseDefinitions(schema);

            // Every node the walker visits is rebuilt.
            expect(result.definitions!.Kept).toStrictEqual(schema.definitions.Kept);
            expect(result.definitions!.Kept).not.toBe(schema.definitions.Kept);
        });
    });
});
