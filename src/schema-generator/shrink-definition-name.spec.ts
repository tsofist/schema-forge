import type { Rec } from '@tsofist/stem';
import type { ForgedSchemaDefinition, ShrinkDefinitionNameContext } from '../types';
import { shrinkDefinitionName, shrinkDefinitionNameStable } from './shrink-definition-name';

/**
 * The end-to-end coverage lives in `forge.spec.ts` (`shrinkDefinitionNames for a12`).
 * What is left here are the cases a fixture cannot reach: the exact digest earlier releases
 *   produced, and definition bodies a real source file would not make the generator emit.
 */
describe('shrinkDefinitionName', () => {
    const contextOf = (
        name: string,
        definitions: Rec<ForgedSchemaDefinition> = {},
    ): ShrinkDefinitionNameContext => ({
        name,
        definition: definitions[name] ?? {},
        definitions,
        assigned: new Map(),
    });

    it('should leave non-generic names alone', () => {
        for (const shrink of [shrinkDefinitionName, shrinkDefinitionNameStable]) {
            expect(shrink(contextOf('CollectionItem'))).toBeUndefined();
            expect(shrink(contextOf('API__APIMethodArgs_methodA'))).toBeUndefined();
        }
    });

    it('should keep producing the digests earlier releases produced', () => {
        // Frozen on purpose: `shrinkDefinitionNames: true` still selects this function, so
        //   schemas generated before `shrinkDefinitionNameStable` existed must not move.
        expect(shrinkDefinitionName(contextOf('UniqueItemsArray<CMSTagID>'))).toStrictEqual(
            'DSNUniqueItemsArray_H809778',
        );
    });
});

describe('shrinkDefinitionNameStable', () => {
    const shrink = (name: string, definitions: Rec<ForgedSchemaDefinition>) =>
        shrinkDefinitionNameStable({
            name,
            definition: definitions[name],
            definitions,
            assigned: new Map(),
        });

    it('should ignore the node keys embedded in names', () => {
        // The same type, generated from two working directories: only the node keys differ,
        //   both in the definition names and in the refs pointing at them.
        const a = {
            'Box<structure-591612816-523-542>': { $ref: '#/definitions/structure-591612816-523' },
            'structure-591612816-523': { type: 'string' as const },
        };
        const b = {
            'Box<structure-77-1-2>': { $ref: '#/definitions/structure-77-1' },
            'structure-77-1': { type: 'string' as const },
        };

        expect(shrink('Box<structure-591612816-523-542>', a)).toStrictEqual(
            shrink('Box<structure-77-1-2>', b),
        );
    });

    it('should notice a change in the definition itself', () => {
        const before = { 'Box<X>': { type: 'string' as const } };
        const after = { 'Box<X>': { type: 'number' as const } };

        expect(shrink('Box<X>', before)).not.toStrictEqual(shrink('Box<X>', after));
    });

    it('should ignore the key order of the generated body', () => {
        const a = { 'Box<X>': { type: 'object' as const, title: 'a', description: 'b' } };
        const b = { 'Box<X>': { description: 'b', type: 'object' as const, title: 'a' } };

        expect(shrink('Box<X>', a)).toStrictEqual(shrink('Box<X>', b));
    });

    it('should follow local refs through to their structure', () => {
        const withString = {
            'Box<X>': { $ref: '#/definitions/Item' },
            'Item': { type: 'string' as const },
        };
        const withNumber = {
            'Box<X>': { $ref: '#/definitions/Item' },
            'Item': { type: 'number' as const },
        };
        const inlined = { 'Box<X>': { type: 'string' as const } };

        expect(shrink('Box<X>', withString)).not.toStrictEqual(shrink('Box<X>', withNumber));
        // A ref is not the same thing as what it points at: the schemas differ, so must the names.
        expect(shrink('Box<X>', withString)).not.toStrictEqual(shrink('Box<X>', inlined));
    });

    it('should keep refs pointing outside the local definitions verbatim', () => {
        const toOther = { 'Box<X>': { $ref: 'other.schema#/definitions/Item' } };
        const toAnother = { 'Box<X>': { $ref: 'another.schema#/definitions/Item' } };

        expect(shrink('Box<X>', toOther)).toBeTruthy();
        expect(shrink('Box<X>', toOther)).not.toStrictEqual(shrink('Box<X>', toAnother));
    });

    it('should survive a ref with no definition behind it', () => {
        const dangling = { 'Box<X>': { $ref: '#/definitions/Absent' } };

        expect(shrink('Box<X>', dangling)).toMatch(/^DSNBox_H[0-9a-f]{6}$/);
    });

    it('should terminate on self-referential and mutually recursive definitions', () => {
        const definitions = {
            'Box<X>': { $ref: '#/definitions/Node' },
            'Node': {
                type: 'object' as const,
                properties: {
                    self: { $ref: '#/definitions/Node' },
                    peer: { $ref: '#/definitions/Peer' },
                },
            },
            'Peer': {
                type: 'object' as const,
                properties: { owner: { $ref: '#/definitions/Node' } },
            },
        };

        expect(shrink('Box<X>', definitions)).toMatch(/^DSNBox_H[0-9a-f]{6}$/);
        // Deterministic across calls: the cycle placeholder must not depend on cache state.
        expect(shrink('Box<X>', { ...definitions })).toStrictEqual(shrink('Box<X>', definitions));
    });
});
