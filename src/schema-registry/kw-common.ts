import type { Rec } from '@tsofist/stem';
import type { KeywordDefinition } from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import type { SF_EXTRA_JSS_TAG_NAME } from '../schema-generator/types';

const FakerModulePattern = '^[a-zA-Z.]+$';
const NP_ENUM_KEY = '^[a-zA-Z0-9-\\._]+$';
const NP_ENUM_VALUE = '^[a-zA-Z0-9-\\._:]+$';

export const SFRCommonKeywords: readonly KeywordDefinition[] = [
    {
        keyword: 'version',
        dependencies: ['$id', '$schema'],
        metaSchema: { type: 'string' },
    },
    {
        keyword: 'hash',
        dependencies: ['$id', '$schema'],
        metaSchema: { type: 'string' },
    },
    // {
    //     keyword: 'see',
    //     metaSchema: {
    //         additionalProperties: false,
    //         type: ['string', 'array'],
    //         items: {
    //             anyOf: [
    //                 { type: 'string', format: 'uri' },
    //                 {
    //                     type: 'array',
    //                     items: [{ type: 'string', format: 'uri' }, { type: 'string' }],
    //                     minItems: 2,
    //                 },
    //             ],
    //         },
    //     },
    // },
    {
        keyword: 'spec',
        metaSchema: {
            type: 'array',
            items: { type: 'string' },
        },
    },
    {
        keyword: 'enumAnnotation',
        dependencies: ['enum'],
        metaSchema: {
            type: 'object',
            propertyNames: { type: 'string', pattern: NP_ENUM_KEY },
            additionalProperties: {
                type: 'array',
                minItems: 1,
                maxItems: 3,
                items: [
                    { title: 'value', type: ['string', 'number'], pattern: NP_ENUM_VALUE },
                    { title: 'note', type: 'string' },
                    { title: 'comment', type: 'string' },
                ],
            },
        } satisfies JSONSchema7,
    },
    {
        keyword: 'faker',
        metaSchema: {
            oneOf: [
                {
                    // https://fakerjs.dev/api/person.html
                    // https://fakerjs.dev/api/company.html#name
                    // https://github.com/json-schema-faker/json-schema-faker/blob/master/docs/USAGE.md
                    // example (schema):
                    //   faker: 'person.fullName'
                    //   faker: 'person.firstName'
                    //   faker: 'company.name'
                    // example (jsdoc):
                    //   @faker company.name
                    type: 'string',
                    pattern: FakerModulePattern,
                },
                {
                    // https://fakerjs.dev/api/lorem.html#words
                    // example (schema):
                    //   faker: { 'lorem.words': [{ min: 30, max: 50 }] },
                    // example (jsdoc):
                    //   @faker { 'lorem.words': [{ min: 5, max: 10 }] }
                    type: 'object',
                    propertyNames: {
                        pattern: FakerModulePattern,
                    },
                },
            ],
        },
    },
] as const satisfies (KeywordDefinition & {
    keyword: keyof Rec<unknown, SF_EXTRA_JSS_TAG_NAME>;
})[];
