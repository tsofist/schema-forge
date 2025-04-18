import { ArrayMay } from '@tsofist/stem';

/**
 * Database index types.
 *
 * @see https://www.postgresql.org/docs/current/indexes-types.html PostgreSQL
 */
export const DBIndexTypeList = [
    //
    'btree',
    'hash',
    'gin',
    'gist',
    'spgist',
    'brin',
] as const;

/**
 * Database index type.
 *
 * @see https://www.postgresql.org/docs/current/indexes-types.html PostgreSQL
 * @default 'btree'
 */
export type DBIndexType = (typeof DBIndexTypeList)[number];

/**
 * Database index options.
 */
export type DBIndexOptions = {
    /**
     * Type of index.
     * @default 'btree'
     */
    type?: DBIndexType;
    /**
     * Name of index.
     * @default 'ix_[schema]_[table]_[column]'
     */
    name?: string;
    /**
     * If true, the index will be unique.
     * @default false
     */
    unique?: boolean;
};

export type DBIndexOptionsDef<B extends boolean = boolean> = ArrayMay<DBIndexOptions | string | B>;

/**
 * Database entity options.
 */
export type DBEntityOptions = {
    /**
     * Table name.
     *
     * @default '[schema].[table]'
     */
    name?: string;
    /**
     * Indexes of the table.
     * They can be overridden/added at the column level.
     *
     * Use `true` to apply default index options.
     * Use string literal to set index name.
     */
    indexes?: {
        [field: string]: DBIndexOptionsDef<true>;
    };
};

export type DBEntityOptionsDef = DBEntityOptions | string;
