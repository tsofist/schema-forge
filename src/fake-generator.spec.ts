import { Rec } from '@tsofist/stem';
import {
    isLocalISODateString,
    isLocalISODateTimeString,
    isLocalISOTimeString,
    isZuluISODateString,
    isZuluISODateTimeString,
    isZuluISOTimeString,
} from '@tsofist/stem/lib/cldr/date-time/guards';
import { ISODateTimeType, TypedDateTimeString } from '@tsofist/stem/lib/cldr/date-time/types';
import { EnumKeys, extractEnumKeys } from '@tsofist/stem/lib/enum';
import { isInt } from '@tsofist/stem/lib/number/integer/guards';
import { entries } from '@tsofist/stem/lib/object/entries';
import { camelCase } from '@tsofist/stem/lib/string/case/camel';
import { SchemaObject } from 'ajv';
import { generateFakeData } from './fake-generator';
import { createSchemaForgeValidator, SchemaForgeValidator } from './validator';

/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument */

describe('generateFakeData', () => {
    const testSchema1: SchemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test-1',
        definitions: {
            Int: {
                type: 'integer',
                minimum: 0,
                description: 'This is an integer from test-1',
            },
        },
    };
    const testSchema2: SchemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test-2',
        definitions: {
            'Int': {
                type: 'integer',
                maximum: 0,
                description: 'This is an integer from test-2',
            },
            'Url': {
                type: 'string',
                format: 'uri',
                faker: 'sf.url',
                $comment: 'Test comment',
            },
            'ForeignInt': {
                $ref: 'test-1#/definitions/Int',
                description: 'Foreign Int from test-1',
                $comment: 'Test comment',
            },
            'ListOfNames': {
                type: 'array',
                items: {
                    type: 'string',
                    faker: 'person.fullName',
                    minLength: 20,
                },
            },
            'IntWithDescription': {
                $ref: 'test-1#/definitions/Int',
                description: 'Foreign Int from test-1',
                $comment: 'Test comment',
            },
            'JSFQuirks': {
                type: 'array',
                minItems: 10,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id2: {
                            type: 'array',
                            items: { $ref: '#/definitions/IntWithDescription' },
                            examples: [
                                [1, 2, 3],
                                [4, 5, 6],
                            ],
                        },
                    },
                    required: ['id2'],
                },
            },
            'List': {
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        id: { $ref: 'test-1#/definitions/Int' },
                        id2: {
                            type: 'array',
                            items: { $ref: '#/definitions/ForeignInt' },
                            examples: [
                                [1, 2, 3],
                                [4, 5, 6],
                            ],
                        },
                        url: { $ref: '#/definitions/Url' },
                    },
                    required: ['id', 'url'],
                },
            },
            'UUID': {
                type: 'string',
                format: 'uuid',
            },
            'ServiceID': {
                $ref: '#/definitions/UUID',
                description: 'ID of a service',
            },
            'UniqueItemsArray<ServiceID>': {
                type: 'array',
                items: {
                    $ref: '#/definitions/ServiceID',
                },
                uniqueItems: true,
            },
            'Entity': {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: {
                        type: 'string',
                        description: 'Name',
                        // https://github.com/json-schema-faker/json-schema-faker/blob/master/docs/USAGE.md
                        // https://fakerjs.dev/api/company.html
                        // faker: 'company.name',
                        // faker: { 'finance.amount': [100, 10000, 2, '$'] },
                        faker: { 'lorem.words': [{ min: 30, max: 50 }] },
                    },
                    datetime: {
                        type: 'string',
                        faker: 'date.recent',
                    },
                    time: {
                        type: 'string',
                        faker: 'cldr.localTime',
                    },
                    refs: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            services: {
                                $ref: '#/definitions/UniqueItemsArray<ServiceID>',
                                description: 'Linked services',
                            },
                        },
                        required: ['services'],
                        description: 'Linked entities',
                    },
                },
                required: ['name', 'refs', 'datetime', 'time'],
                description: 'Entity',
                dbEntity: 'entity',
            },
        },
    };
    const testSchema3: SchemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test-3',
        definitions: {
            RecursiveObject: {
                type: 'object',
                properties: {
                    some1: { type: 'string' },
                    some2: { $ref: '#/definitions/RecursiveObject' },
                },
            },
        },
    };
    const testSchema4: SchemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test-4',
        definitions: {
            CLDR: {
                type: 'object',
                properties: {},
            },
        },
    } as const;

    {
        for (const name of extractEnumKeys(ISODateTimeType)) {
            const method = camelCase(name);
            testSchema4.definitions.CLDR.properties[name] = {
                type: 'string',
                faker: `cldr.${method}`,
            };
        }
    }

    let validator: SchemaForgeValidator;

    beforeEach(() => {
        validator = createSchemaForgeValidator(
            { schemas: [testSchema1, testSchema2, testSchema3, testSchema4] },
            true,
        );
    });

    it('default behavior', async () => {
        {
            const data = await generateFakeData(validator, 'test-1#/definitions/Int');
            expect(data).toBeDefined();
            expect(data).toBeGreaterThanOrEqual(0);
            expect(isInt(data)).toStrictEqual(true);
        }
        {
            const data = await generateFakeData(validator, 'test-2#/definitions/Url');
            expect(data).toBeDefined();
            expect(data).toMatch(/^https?:\/\/(.*)/);
        }
    });

    it('cross-schema references should be handled correctly', async () => {
        const source = 'test-2#/definitions/ForeignInt';
        const data = await generateFakeData(validator, source);
        expect(data).toBeDefined();
        expect(data).toBeGreaterThanOrEqual(0);
        expect(isInt(data)).toStrictEqual(true);
        expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);
    });

    it('complex, nested data should be handled correctly', async () => {
        {
            const source = 'test-2#/definitions/JSFQuirks';
            const data = await generateFakeData(validator, source, {});
            expect(data).toBeDefined();
            expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);
        }
        {
            const source = 'test-2#/definitions/List';
            const data = await generateFakeData(validator, source);
            expect(data).toBeDefined();
            expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);
        }
        {
            const source = 'test-2#/definitions/ListOfNames';
            const len = 15;
            const data = await generateFakeData(validator, source, { minItems: len, locale: 'ru' });
            expect(data).toBeDefined();
            expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);
            expect(Array.isArray(data)).toStrictEqual(true);
            expect((data as string[]).length).toBeGreaterThanOrEqual(len);
            expect((data as string[]).join(' ')).toMatch(/[=^+U+0400–U+04FF\s\S@/_-]+/);
        }
        {
            const source = 'test-2#/definitions/Entity';
            const data = await generateFakeData<any>(validator, source, { locale: 'ru' });

            expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);

            expect(typeof data.datetime).toStrictEqual('string');
            expect(data.datetime).toMatch(/.*Z$/);
            expect(new Date(data.datetime)).not.toStrictEqual('Invalid Date');

            expect(typeof data.time).toStrictEqual('string');
            expect(data.time).toMatch(/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/);
        }
    });

    it('should handle recursive schemas', async () => {
        const source = 'test-3#/definitions/RecursiveObject';
        const count = 10;
        for (let i = 0; i < count; i++) {
            const data = await generateFakeData(validator, source, {
                reuseProperties: false,
                failOnInvalidFormat: true,
                failOnInvalidTypes: true,

                minItems: 1,
                maxItems: 4,
                locale: ['ru', 'en'],
                fixedProbabilities: false,
                optionalsProbability: 0.75,
                refDepthMax: 20,
            });
            expect(data).toBeDefined();
            expect(validator.validateBySchema(source, data).valid).toStrictEqual(true);
        }
    });

    it('should handle CLDR formats', async () => {
        const data: Rec<
            TypedDateTimeString,
            EnumKeys<typeof ISODateTimeType>
        > = await generateFakeData(validator, 'test-4#/definitions/CLDR');

        const guards: Rec<(v: unknown) => boolean, ISODateTimeType> = {
            [ISODateTimeType.LocalDate]: isLocalISODateString,
            [ISODateTimeType.LocalTime]: isLocalISOTimeString,
            [ISODateTimeType.LocalDateTime]: isLocalISODateTimeString,
            [ISODateTimeType.ZuluDate]: isZuluISODateString,
            [ISODateTimeType.ZuluTime]: isZuluISOTimeString,
            [ISODateTimeType.ZuluDateTime]: isZuluISODateTimeString,
        };

        expect(data).toBeDefined();

        for (const [name, value] of entries(data)) {
            const g = guards[ISODateTimeType[name]];
            expect(g).toBeDefined();
            expect(g(value)).toStrictEqual(true);
        }
    });
});
