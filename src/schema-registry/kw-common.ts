import type { Rec, URec } from '@tsofist/stem';
import { txt } from '@tsofist/stem/lib/string/text-builder';
import Ajv, { KeywordDefinition, FuncKeywordDefinition } from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import type { SF_EXTRA_JSS_TAG_NAME } from '../schema-generator/types';
import type { ForgedPropertySchema, ForgedSchema, SchemaForgeValidationFunction } from '../types';

const FakerModulePattern = '^[a-zA-Z.]+$';
const NP_ENUM_KEY = '^[a-zA-Z0-9-\\._]+$';

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
        keyword: 'repository',
        dependencies: ['$id', '$schema'],
        metaSchema: { type: 'string', format: 'uri' },
    },
    {
        keyword: 'package',
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
                    { title: 'value', type: ['string', 'number'] },
                    { title: 'note', type: 'string' },
                    { title: 'comment', type: 'string' },
                ],
            },
        } satisfies JSONSchema7,
    },
    {
        keyword: 'enumMember',
        dependencies: ['const'],
        metaSchema: {
            type: 'object',
            properties: {
                enum: { type: 'string' },
                title: { type: 'string', pattern: NP_ENUM_KEY },
                note: { type: 'string' },
                comment: { type: 'string' },
            },
            required: ['enum', 'title'],
            additionalProperties: false,
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
    {
        keyword: 'discriminateBy',
        metaSchema: { type: 'string' },
        type: 'object',
        schemaType: 'string',
        compile(propertyName: string, targetSchema, ctx) {
            const check = () => {
                const fail = (message: string) => {
                    const t = txt([message]);
                    t.at([
                        ['Property:', propertyName],
                        ['Schema path:', ctx.errSchemaPath],
                    ]);
                    throw new Error(String(t));
                };
                const variants = (targetSchema.anyOf || targetSchema.oneOf) as
                    | ForgedPropertySchema[]
                    | undefined;

                if (!variants?.length) {
                    return fail(`Schema must have "oneOf" or "anyOf" keyword`);
                }

                const rootSchema = ctx.schemaEnv.root.schema as ForgedSchema;
                const rootDefs = rootSchema.definitions || rootSchema.$defs || {};
                const validators = new Map<PropertyKey, SchemaForgeValidationFunction>();

                const deref = (schema: ForgedSchema | ForgedPropertySchema | undefined) => {
                    if (!schema) return undefined;
                    if (schema.$ref) {
                        if (typeof schema.$ref !== 'string' || !schema.$ref.startsWith('#/'))
                            return undefined;
                        const localRef = schema.$ref.slice(2).split('/').at(1);
                        if (!localRef) return undefined;

                        const result = rootDefs[localRef];
                        if (result?.$ref) return deref(result as ForgedSchema);
                        return result;
                    }
                    return schema;
                };

                for (const variant of variants) {
                    const val = deref(variant);
                    if (val) {
                        if (
                            !val.properties ||
                            !val.required ||
                            !val.required.includes(propertyName)
                        ) {
                            return fail(`Variant schema must require discriminator property`);
                        }

                        const propSchema = deref(
                            val.properties[propertyName] as ForgedPropertySchema,
                        );

                        if (propSchema && 'const' in propSchema) {
                            validators.set(
                                propSchema.const as PropertyKey,
                                ctx.self.compile({ ...val, definitions: rootDefs }),
                            );
                        }
                    }
                }

                return validators;
            };

            const preparedValidators = check();

            const validator: DataValidateFunction = function ValidatorForDiscriminateBy(
                //
                this: Ajv,
                data: URec,
                ctx,
            ): boolean {
                validator.errors = [];

                if (!(propertyName in data)) {
                    validator.errors.push({
                        keyword: 'discriminateBy',
                        propertyName,
                        message: 'Discriminator property is missing',
                    });
                } else {
                    const discriminationValue = data[propertyName] as PropertyKey;
                    const preparedValidator = preparedValidators.get(discriminationValue);

                    if (!preparedValidator) {
                        validator.errors.push({
                            keyword: 'discriminateBy',
                            propertyName,
                            message: `No matching schema for discriminator value: ${String(
                                discriminationValue,
                            )}`,
                        });
                    } else {
                        preparedValidator(data, ctx);
                        if (preparedValidator.errors && preparedValidator.errors.length) {
                            validator.errors.push(
                                ...preparedValidator.errors.map((item) => {
                                    delete item.parentSchema?.definitions;
                                    return item;
                                }),
                            );
                        }
                    }
                }

                return validator.errors.length === 0;
            };

            return validator;
        },
    },
] as const satisfies (KeywordDefinition & {
    keyword: keyof Rec<unknown, SF_EXTRA_JSS_TAG_NAME>;
})[];

type DataValidateFunction = ReturnType<Exclude<FuncKeywordDefinition['compile'], undefined>>;
