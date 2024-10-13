import { PRec, Rec } from '@tsofist/stem';
import { UUID } from '@tsofist/stem/lib/crypto/uuid/types';

/** @public */
export type CollectionItem = {
    f1: number;
    f2: string;
    f3: CollectionItemID1[];
    f4: UUID[];
    f5: Rec<number, CollectionItemID1>;
};

/**
 * This is Collection item ID (inherits from UUID)
 * @public
 * @inheritDoc
 */
export type CollectionItemID1 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @public
 */
export type CollectionItemID2 = UUID;

/**
 * Col #2
 * @public
 */
export type Collection2 = PRec<CollectionItem, UUID>;

/**
 * Col #1
 * @public
 */
export type Collection1 = PRec<CollectionItem, CollectionItemID1>;

/**
 * Col #3
 * @public
 */
export type Collection3 = PRec<CollectionItem, CollectionItemID2>;

/** @public */
export interface CollectionWithID {
    id: CollectionItemID1;
    item: CollectionItem;
}
