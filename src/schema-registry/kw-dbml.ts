import type { PickFieldsWithPrefix, Rec } from '@tsofist/stem';
import type { KeywordDefinition } from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import {
    DBMLColumnTypeList,
    type DBMLEntityOptions,
    type DBMLIndexOptions,
    DBMLIndexTypeList,
} from '../dbml-generator/types';
import type { SF_EXTRA_JSS_TAG_NAME } from '../schema-generator/types';

const NP_IX = '^ix_[a-z][a-zA-Z0-9_]+$';
const NP_ENTITY = '^([a-zA-Z_][a-z0-9_]*\\.)?[a-z_][a-z0-9_]*$';
const NP_NESTED_PROP = '^[a-z][a-zA-Z0-9-\\._]+$';

const DBMLIndexOptionsProperties: Rec<JSONSchema7, keyof DBMLIndexOptions> = {
    name: { type: 'string', pattern: NP_IX },
    unique: { type: 'boolean' },
    pk: { type: 'boolean' },
    type: {
        type: 'string',
        enum: DBMLIndexTypeList as unknown as string[],
    },
    note: { type: 'string' },
    comment: { type: 'string' },
} as const;

const DBMLForeignKeySchema = {
    type: ['boolean'],
};

const DBMLIndexSchema = {
    type: ['string', 'boolean', 'object', 'array'],
    pattern: NP_IX,
    additionalProperties: false,
    properties: DBMLIndexOptionsProperties,
    items: {},
    minItems: 1,
    examples: [
        true,
        false,
        `ix_my_index`,
        `{ unique: true, name: 'ix_my_index', note: 'This is important' }`,
    ],
} satisfies JSONSchema7;

DBMLIndexSchema.items = {
    ...DBMLIndexSchema,
    type: ['string', 'boolean', 'object'],
} as const satisfies JSONSchema7;

export const SFRDBMLKeywords: readonly KeywordDefinition[] = [
    {
        keyword: 'dbEnum',
        metaSchema: { type: ['boolean', 'string'], pattern: NP_NESTED_PROP },
    },
    {
        keyword: 'dbFK',
        metaSchema: DBMLForeignKeySchema,
    },
    {
        keyword: 'dbIndex',
        metaSchema: DBMLIndexSchema,
    },
    {
        keyword: 'dbColumn',
        metaSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                pk: { type: 'boolean' },
                type: { enum: DBMLColumnTypeList },
                // name: { type: 'string' }, todo
            },
        },
    },
    {
        keyword: 'dbEntity',
        metaSchema: {
            type: ['string', 'object'],
            pattern: NP_ENTITY,
            additionalProperties: false,
            properties: {
                name: { type: 'string', pattern: NP_ENTITY },
                indexes: {
                    type: 'object',
                    additionalProperties: DBMLIndexSchema,
                    propertyNames: { type: 'string', pattern: NP_NESTED_PROP },
                },
                note: { type: 'string' },
                comment: { type: 'string' },
                alias: { type: 'string' },
                settings: {
                    type: 'object',
                    properties: {
                        headercolor: { type: 'string' },
                    },
                },
            } satisfies Rec<unknown, keyof DBMLEntityOptions>,
        },
    },
] as const satisfies (KeywordDefinition & {
    keyword: keyof PickFieldsWithPrefix<Rec<unknown, SF_EXTRA_JSS_TAG_NAME>, 'db'>;
})[];
