/* eslint-disable @typescript-eslint/consistent-type-definitions */

/**
 * A generic instantiated with a local, non-exposed type alias.
 * The generator has no name for that alias, so it falls back to a node key
 *   built from the source file path and the node offsets.
 *
 * @public
 */
export type BoxedLocal = Box<'a' | 'b'>;

/**
 * The same generic instantiated with a different local alias:
 *   distinct structure, so the two must never collapse into one definition.
 *
 * @public
 */
export type BoxedOther = Box<{ deep: LocalKeys }>;

/**
 * Two instantiations whose arguments are distinct types with an identical schema.
 * The generator keeps them apart by name; by content they are the very same definition.
 *
 * @public
 */
export type BoxedKeys = Box<LocalKeys>;

/**
 * @public
 */
export type BoxedTwinKeys = Box<TwinKeys>;

/**
 * Self-referential definition.
 *
 * @public
 */
export interface TreeNode {
    id: string;
    children: TreeNode[];
    peer: TreePeer | null;
}

/**
 * The other half of a mutually recursive pair.
 *
 * @public
 */
export interface TreePeer {
    owner: TreeNode | null;
}

type LocalKeys = 'a' | 'b';

type OtherKeys = 'c' | 'd' | 'e';

type TwinKeys = 'a' | 'b';

type Box<T> = {
    keys: T[];
    total: number;
    /** Pulls the mutually recursive pair into the digest of every `Box` instantiation. */
    root: TreeNode | null;
};
