import type { KeywordDefinition } from 'ajv';

const FakerModulePattern = '^[a-zA-Z.]+$';

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
] as const;
