import type { ArrayMay, HexString } from '@tsofist/stem';
import type { SchemaDefinitionInfoForType } from '../definition-info/types';

/**
 * DBML Project Source
 */
export interface DBMLProjectScope {
    schemaId: string;
    scopeName?: string;
    definitions: SchemaDefinitionInfoForType[];
    comment?: string;
}

/**
 * DBML Project Metadata
 */
export interface DBMLProjectMeta {
    name: string;
    note?: string;
    comment?: string;
}

/**
 * DBML Generator Options
 */
export interface DBMLGeneratorOptions {
    meta?: DBMLProjectMeta;
    // /**
    //  * @deprecated use notes
    //  */
    includeNotes?: boolean;
    columnsOrder?: string[];
    // todo implement
    // notes?:
    //     | boolean
    //     | {
    //           project?: boolean;
    //           tables?: boolean;
    //           columns?: boolean;
    //           indexes?: boolean;
    //       };
    // enforceSnakeCase?: boolean; // todo implement
    // columnTypeInference?: {
    //     arraysAsJSONB?: boolean; // todo implement
    // };
}

/**
 * Database index type list.
 *
 * @see https://www.postgresql.org/docs/current/indexes-types.html PostgreSQL
 */
export const DBMLIndexTypeList = [
    //
    'btree',
    'hash',
    'gin',
    'gist',
    'spgist',
    'brin',
] as const;

/**
 * Database column type list.
 */
export const DBMLColumnTypeList = [
    'uuid',
    'integer',
    'bigint',
    'smallint',
    'numeric',
    'numeric(12,2)',
    'numeric(15,2)',
    'numeric(30,18)',
    'float',
    'float8',
    'boolean',
    'text',
    'date',
    'time',
    'timestamp',
    'timestamptz',
    //
    'uuid[]',
    'integer[]',
    'bigint[]',
    'smallint[]',
    'numeric[]',
    'numeric(12,2)[]',
    'numeric(15,2)[]',
    'numeric(30,18)[]',
    'float[]',
    'float8[]',
    'boolean[]',
    'text[]',
    'date[]',
    'time[]',
    'timestamp[]',
    'timestamptz[]',
] as const;

/**
 * Table column type.
 */
export type DBMLColumnType = (typeof DBMLColumnTypeList)[number];

/**
 * Database index type.
 *
 * @see https://www.postgresql.org/docs/current/indexes-types.html PostgreSQL
 * @default 'btree'
 */
export type DBMLIndexType = (typeof DBMLIndexTypeList)[number];

/**
 * Database index options.
 *
 * @see https://dbml.dbdiagram.io/docs/#index-definition dbml spec
 */
export type DBMLIndexOptions = {
    /**
     * Type of index.
     * @default 'btree'
     */
    type?: DBMLIndexType;
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
    /**
     * Is it a primary key
     * @default false
     */
    pk?: boolean;
    /**
     * Any important notes.
     * Can be used in DDL.
     */
    note?: string;
    /**
     * Any important developer comments.
     * Can't be used in DDL.
     */
    comment?: string;
};

export type DBMLIndexOptionsDef<B extends boolean = boolean> = ArrayMay<
    DBMLIndexOptions | string | B
>;

export type DBMLForeignKeyOptionsDef = boolean;
export type DBMLForeignKeyOptions = DBMLForeignKeyOptionsDef;

/**
 * Database entity options.
 *
 * @see https://dbml.dbdiagram.io/docs/#table-definition dbml spec
 */
export type DBMLEntityOptions = {
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
        [field: string]: DBMLIndexOptionsDef<true>;
    };
    /**
     * Any important notes.
     * Can be used in DDL.
     */
    note?: string;
    /**
     * Any important developer comments.
     * Can't be used in DDL.
     */
    comment?: string;
    /**
     * Table name alias.
     */
    alias?: string;
    /**
     * Settings.
     */
    settings?: { headercolor: HexString };
};

export type DBMLEntityOptionsDef = DBMLEntityOptions | string;

export type DBMLColumnOptions = {
    /**
     * Is it a primary key
     *
     * @default false
     */
    pk?: boolean;
    /**
     * Column type.
     *
     * If `undefined`, the type will be inferred automatically.
     */
    type?: DBMLColumnType;
};

export type DBMLEnumOptionsDef = boolean | string;
