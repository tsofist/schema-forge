import { PRec, Rec } from '@tsofist/stem';
import { UUID } from '@tsofist/stem/lib/crypto/uuid/types';

/** @public */
export type CollectionItem = {
    f1: number;
    f2: string;
    f3: CollectionItemID1[];
    f4: UUID[];
    f5: Rec<number, CollectionItemID1>;
    f6: Rec<number, CollectionItemID4>;
    f7: Rec<number, CollectionItemID6>;
    f8: Rec<number, CollectionItemID7>;
};

/**
 * This is Collection item ID (inherits from UUID)
 * @public
 * @inheritDoc
 */
export type CollectionItemID1 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @comment This is a comment for CollectionItemID2
 * @public
 */
export type CollectionItemID2 = UUID;
/** @public */
export type CollectionItemID3 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @dbFK
 * @format uuid
 * @public
 */
export type CollectionItemID7 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @dbFK
 * @public
 */
export type CollectionItemID6 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @format uuid
 * @public
 */
export type CollectionItemID4 = UUID;
/**
 * This is Collection item ID (non-inherits from UUID)
 * @public
 */
export type CollectionItemID5 = UUID;

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
