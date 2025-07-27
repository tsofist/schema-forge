import { unlink } from 'node:fs/promises';
import { readErrorCode, readErrorContext } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { keysOf } from '@tsofist/stem/lib/object/keys';
import { pickProps } from '@tsofist/stem/lib/object/pick';
import { SchemaObject } from 'ajv';
import { KEEP_SPEC_ARTEFACTS } from '../artefacts-policy';
import { SchemaDefinitionInfo, SchemaDefinitionInfoKind } from '../definition-info/types';
import {
    SchemaForgeErrorCode,
    SchemaForgeErrors,
    SchemaForgeSchemaNotFoundErrorContext,
    SchemaForgeValidationErrorContext,
} from '../efc';
import { loadJSONSchema } from '../schema-registry/loader';
import { createSchemaForgeRegistry } from '../schema-registry/registry';
import type { SchemaForgeRegistry } from '../schema-registry/types';
import type { ForgeSchemaOptions, ForgeSchemaResult } from '../types';
import { forgeSchema } from './forge';

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('generator for a8', () => {
    const outputSchemaFile = './a8.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a8.generated.definitions.tmp.json';

    const schemaMetadata: ForgeSchemaOptions['schemaMetadata'] = {
        title: 'Generator TEST',
        version: '1.0.0',
        $comment: 'WARN: This is a test schema.',
    };

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let validator: ReturnType<typeof createSchemaForgeRegistry>;
    let loadedSchema: SchemaObject[];

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            schemaId: 'test',
            allowUseFallbackDescription: true,
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a8',
            sourcesFilesPattern: ['service-api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: true,
            schemaMetadata,
        });
        validator = createSchemaForgeRegistry();
        loadedSchema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(loadedSchema);
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should have correct metadata', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const schema = forgeSchemaResult!.schema;
        expect(pickProps(schema, keysOf(schemaMetadata))).toStrictEqual(schemaMetadata);
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const schema = validator.getSchema('test#/definitions/TypeFromJSON') as any;
        expect(schema).toBeTruthy();
    });
});

describe('generator for a7', () => {
    const outputSchemaFile = './a7.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a7.generated.definitions.tmp.json';

    const schemaMetadata: ForgeSchemaOptions['schemaMetadata'] = {
        title: 'Generator TEST',
        version: '1.0.0',
        $comment: 'WARN: This is a test schema.',
    };

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let registry: SchemaForgeRegistry;
    let loadedSchema: SchemaObject[];

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            schemaId: 'test',
            allowUseFallbackDescription: true,
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a7',
            sourcesFilesPattern: ['service-api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: true,
            schemaMetadata,
        });
        registry = createSchemaForgeRegistry();
        loadedSchema = await loadJSONSchema([outputSchemaFile]);
        registry.addSchema(loadedSchema);
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should have correct metadata', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const schema = forgeSchemaResult!.schema;
        expect(pickProps(schema, keysOf(schemaMetadata))).toStrictEqual(schemaMetadata);
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const schema = registry.getSchema(
            'test#/definitions/SomeAPI_doSomeWithUser__APIMethodArgs',
        ) as any;
        expect(schema).toBeTruthy();
        expect(schema.items).toStrictEqual([
            { $ref: '#/definitions/User', title: 'user', description: 'Target user' },
            { type: 'boolean', title: 'checkActive' },
            { type: 'boolean', title: 'useLogger' },
        ]);
        expect(schema.description).toStrictEqual(
            'Arguments for Method:SomeAPI#doSomeWithUser (user*, checkActive*, useLogger)',
        );
        expect(schema.minItems).toStrictEqual(2);
        expect(schema.maxItems).toStrictEqual(3);
    });
});

describe('validator for a7', () => {
    const outputSchemaFile = './a7.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a7.generated.definitions.tmp.json';

    let registry: SchemaForgeRegistry;
    let loadedSchema: SchemaObject[];

    beforeAll(async () => {
        await forgeSchema({
            schemaId: 'test',
            allowUseFallbackDescription: true,
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a7',
            sourcesFilesPattern: ['service-api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: true,
        });
        registry = createSchemaForgeRegistry();
        loadedSchema = await loadJSONSchema([outputSchemaFile]);
        registry.addSchema(loadedSchema);
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('should be able to warm-up cache', async () => {
        const initial = registry.compilationArtifactCount;
        expect(initial).toStrictEqual(2);

        registry.warmupCacheSync();
        const warmed = registry.compilationArtifactCount;
        expect(warmed).toStrictEqual(9);

        registry.clear();
        const cleared = registry.compilationArtifactCount;
        expect(cleared).toStrictEqual(1);

        registry.addSchema(loadedSchema);
        expect(registry.compilationArtifactCount).toStrictEqual(initial);

        await registry.warmupCache();
        expect(registry.compilationArtifactCount).toStrictEqual(warmed);
    });
});

describe('generator for a6', () => {
    const outputSchemaFile = './a6.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a6.generated.definitions.tmp.json';

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let registry: SchemaForgeRegistry;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            schemaId: 'test',
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a6',
            sourcesFilesPattern: ['service-api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: true,
        });
        registry = createSchemaForgeRegistry();
        const schema = await loadJSONSchema([outputSchemaFile]);
        registry.addSchema(schema);
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();

        expect(registry.getValidator('test#/definitions/CollectionItemID1')!.schema).toStrictEqual({
            $ref: '#/definitions/UUID',
            format: 'uuid',
            description: 'This is Collection item ID (inherits from UUID)',
        });

        expect(registry.getValidator('test#/definitions/CollectionItemID2')!.schema).toStrictEqual({
            format: 'uuid',
            type: 'string',
        });

        {
            const rec = registry.getValidator(
                'test#/definitions/PRec<CollectionItem,UUID>',
            )!.schema;
            expect(rec).toBeTruthy();
            expect((rec as any).propertyNames).toStrictEqual({
                format: 'uuid',
            });
        }
        {
            const rec = registry.getValidator(
                'test#/definitions/PRec<CollectionItem,CollectionItemID1>',
            )!.schema;
            expect(rec).toBeTruthy();
            expect((rec as any).propertyNames).toStrictEqual({
                format: 'uuid',
                description: 'This is Collection item ID (inherits from UUID)',
            });
        }
    });
});

describe('generator for a5', () => {
    const outputSchemaFile = './a5.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a5.generated.definitions.tmp.json';

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let registry: SchemaForgeRegistry;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            schemaId: 'test',
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a5',
            sourcesFilesPattern: ['service-api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: true,
            shrinkDefinitionNames: (definitionName) => {
                if (definitionName === 'NamesType') return 'NT';
                return undefined;
            },
        });
        registry = createSchemaForgeRegistry();
        const schema = await loadJSONSchema([outputSchemaFile]);
        registry.addSchema(schema);
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();
        expect(keysOf(defs)).toStrictEqual([
            'DomainNum',
            'DomainValue',
            'DomainValuesType',
            'NT', // 'NamesType',
            'NamesTypeAbnormal',
            'NumN',
            'Nums',
            'Some',
            'Variadic',
            'Variadic1',
            'VariadicList',
            'VariadicList1',
        ]);
        expect(registry.getValidator('test#/definitions/NT')!.schema).toStrictEqual({
            type: 'string',
            enum: ['v:name1', 'v:name2'],
        });
        expect(registry.getValidator('test#/definitions/NamesTypeAbnormal')!.schema).toStrictEqual({
            type: 'string',
        });
        expect(registry.getValidator('test#/definitions/Some')!.schema).toStrictEqual({
            type: 'object',
            properties: {
                vals: {
                    $ref: '#/definitions/DomainValuesType',
                },
                name0: {
                    $ref: '#/definitions/NT',
                },
                name1: {
                    type: 'string',
                    const: 'v:name1',
                },
                abnormalNames: {
                    $ref: '#/definitions/NamesTypeAbnormal',
                },
                num0: {
                    $ref: '#/definitions/Nums',
                },
                num1: {
                    type: 'number',
                    const: 1,
                },
                variadic: {
                    $ref: '#/definitions/Variadic',
                },
                variadic1: {
                    $ref: '#/definitions/Variadic1',
                },
                variadicList: {
                    $ref: '#/definitions/VariadicList',
                },
                variadicList1: {
                    $ref: '#/definitions/VariadicList1',
                },
                indexedField1: {
                    dbIndex: 'ix_some_indexed_field',
                    dbFK: true,
                    type: 'number',
                },
                indexedField2: {
                    dbIndex: true,
                    dbFK: false,
                    type: 'number',
                },
                indexedField3: {
                    dbIndex: {
                        name: 'ix_some_indexed_field3WithExtra',
                        type: 'gin',
                        unique: true,
                    },
                    type: 'number',
                },
                indexedField4: {
                    dbIndex: [
                        {
                            name: 'ix_some_indexed_field4',
                            type: 'gin',
                            unique: true,
                        },
                        {
                            type: 'btree',
                        },
                        'ix_some_indexed_field4_1',
                        true,
                    ],
                    type: 'number',
                },
            },
            required: [
                'vals',
                'name0',
                'name1',
                'num0',
                'num1',
                'variadic',
                'variadic1',
                'variadicList',
                'variadicList1',
                'abnormalNames',
                'indexedField1',
                'indexedField2',
                'indexedField3',
                'indexedField4',
            ],
            additionalProperties: false,
            dbEntity: 'cmn.some',
        });
    });
});

describe('generator for a4', () => {
    const outputSchemaFile = './a4.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a4.generated.definitions.tmp.json';

    let forgeSchemaResult: ForgeSchemaResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a4',
            sourcesFilesPattern: 'service-api.ts',
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
            explicitPublic: false,
        });
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();
        expect(keysOf(defs)).toStrictEqual(['API', 'Enum', 'FormatMode', 'Some', 'Some2']);
    });
});

describe('generator for a3', () => {
    const outputSchemaFile = './a3.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a3.generated.definitions.tmp.json';

    let forgeSchemaResult: ForgeSchemaResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a3',
            sourcesFilesPattern: 'service-api.ts',
            outputSchemaFile,
            outputSchemaMetadataFile,
            expose: 'all',
        });
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
    });

    it('should generate root schema normally', () => {
        const registry = createSchemaForgeRegistry({
            engine: { schemas: [forgeSchemaResult!.schema] },
        });
        expect(registry.getRootSchema('')).toBeTruthy();
    });

    it('interface generics should works', () => {
        const props =
            forgeSchemaResult!.schema.definitions?.InterfaceWithGeneric__APIInterface?.properties;
        expect(props).toBeTruthy();
        expect(props!.propWithGeneric).toBeTruthy();
        // @ts-expect-error It's a test
        expect(props!.propWithGeneric.$ref).toStrictEqual('#/definitions/NonEmptyString');
    });
    it('optional args in API methods should works', () => {
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG0__APIMethodArgs;
            expect(props).toBeTruthy();
            expect(props!.minItems).toStrictEqual(0);
            expect(props!.maxItems).toStrictEqual(1);
        }
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG1__APIMethodArgs;
            expect(props).toBeTruthy();
            expect(props!.minItems).toStrictEqual(0);
            expect(props!.maxItems).toStrictEqual(2);
        }
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG2__APIMethodArgs;
            expect(props).toBeTruthy();
            expect(props!.minItems).toStrictEqual(1);
            expect(props!.maxItems).toStrictEqual(2);
        }
        // {
        //     const props = forgeSchemaResult!.schema.definitions?.API_methodG3__APIMethodArgs;
        //     expect(props).toBeTruthy();
        //     expect(props.minItems).toStrictEqual(0);
        //     expect(props.maxItems).toBeUndefined();
        // }
        // {
        //     const props = forgeSchemaResult!.schema.definitions?.API_methodG4__APIMethodArgs;
        //     expect(props).toBeTruthy();
        //     expect(props.minItems).toStrictEqual(1);
        //     expect(props.maxItems).toBeUndefined();
        // }
    });

    it('extends should works', () => {
        const props = forgeSchemaResult!.schema.definitions?.BAPI__APIInterface?.properties;
        expect(props).toBeTruthy();
        expect(keysOf(props)).toStrictEqual([
            'propertyA',
            'propertyB',
            'propertyC',
            'propertyD',
            'methodA',
            'methodB',
            'methodC',
            'methodE1',
            'methodE2',
            'methodF',
            'methodG0',
            'methodG1',
            'methodG2',
            'methodY',
        ]);
    });
});

describe('generator for a2', () => {
    const outputSchemaFile = './a2.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a2.generated.definitions.tmp.json';

    let forgeSchemaResult: ForgeSchemaResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a2',
            sourcesFilesPattern: 'service-api.ts',
            outputSchemaFile,
            outputSchemaMetadataFile,
        });
    });
    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
    });
});

describe('generator for a1', () => {
    const outputSchemaFile = './a1.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a1.generated.definitions.tmp.json';
    const schemaId = 'test';

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let validator: ReturnType<typeof createSchemaForgeRegistry>;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            allowUseFallbackDescription: false,
            explicitPublic: true,

            schemaId,
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/a1',
            sourcesFilesPattern: ['service.api.ts', '*.api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
        });
        validator = createSchemaForgeRegistry();
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    }, 10_000);

    afterAll(async () => {
        if (!KEEP_SPEC_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        expect(forgeSchemaResult!.schema.$id).toStrictEqual(schemaId);
        expect(forgeSchemaResult!.generatedTemporaryFiles.length).toStrictEqual(2);
        expect(forgeSchemaResult!.refs.length).toStrictEqual(10);
    });
    it('getSchema', () => {
        expect(validator.getValidator('test#/definitions/PositiveInt')!.schema).toStrictEqual({
            type: 'integer',
            minimum: 1,
            maximum: 9007199254740991,
            description: 'Positive integer value.',
            faker: { 'number.int': [{ max: 10000, min: 1 }] },
        });
        expect(validator.getValidator('#/definitions/NotExists')).toStrictEqual(undefined);
        expect(validator.getSchema('test#/definitions/SomeName')).toStrictEqual({
            faker: { 'lorem.words': [{ min: 5, max: 10 }] },
            type: 'string',
        });
        expect(validator.getSchema('test#/definitions/SomeType1')).toStrictEqual({
            const: 123,
            description: 'Important type',
            type: 'number',
        });
    });
    it('hasSchema', () => {
        expect(validator.hasSchema('test#/definitions/SomeType1')).toStrictEqual(true);
        expect(validator.hasSchema('test#/definitions/PositiveInt')).toStrictEqual(true);
        expect(validator.hasSchema('test#/definitions/Int')).toStrictEqual(false);
        expect(validator.hasSchema('test#/definitions/!Int')).toStrictEqual(false);
    });
    it('checkBySchema', () => {
        expect(() =>
            validator.checkBySchema('test#/definitions/ExportedInterfaceB__APIInterface', {}),
        ).toThrow(SchemaForgeErrors.msg('EC_SF_VALIDATION_FAILED' satisfies SchemaForgeErrorCode));
        expect(validator.checkBySchema('test#/definitions/PositiveInt', 1)).toStrictEqual(true);
        expect(() => validator.checkBySchema('test#/definitions/PositiveInt', 1.1)).toThrow(
            SchemaForgeErrors.msg('EC_SF_VALIDATION_FAILED' satisfies SchemaForgeErrorCode),
        );
        expect(() => validator.checkBySchema('!test#/definitions/PositiveInt', 1)).toThrow(
            SchemaForgeErrors.msg('EC_SF_SCHEMA_NOT_FOUND' satisfies SchemaForgeErrorCode),
        );

        {
            const schema = '!test#/definitions/Int';
            try {
                validator.checkBySchema(schema, 1.1);
            } catch (e: any) {
                const context = readErrorContext<SchemaForgeSchemaNotFoundErrorContext>(e);
                const code = readErrorCode(e);

                expect(e.message).toStrictEqual(
                    SchemaForgeErrors.msg('EC_SF_SCHEMA_NOT_FOUND' satisfies SchemaForgeErrorCode),
                );
                expect(code).toStrictEqual('EC_SF_SCHEMA_NOT_FOUND' satisfies SchemaForgeErrorCode);
                expect(context).toBeTruthy();
                expect(context!.schema).toStrictEqual(schema);
                expect(context!.errorMessage).toStrictEqual(undefined);
            }
        }

        {
            const schema = 'test#/definitions/PositiveInt';
            const message = 'ERROR!';
            try {
                validator.checkBySchema(schema, 1.1, { errorMessage: message });
            } catch (e: any) {
                const context = readErrorContext<SchemaForgeValidationErrorContext>(e);
                const code = readErrorCode(e);

                expect(code).toStrictEqual(
                    'EC_SF_VALIDATION_FAILED' satisfies SchemaForgeErrorCode,
                );
                expect(e.message).toStrictEqual(
                    SchemaForgeErrors.msg(code as SchemaForgeErrorCode),
                );
                expect(context).toBeTruthy();
                expect(context!.schema).toStrictEqual(schema);
                expect(context!.errorMessage).toStrictEqual(message);
                expect(context!.errors.length).toStrictEqual(1);
            }
        }
    });
    it('listDefinitions', () => {
        const defs: SchemaDefinitionInfo[] = [
            {
                ref: 'test#/definitions/ExportedInterfaceB__APIInterface',
                kind: 1,
                name: 'ExportedInterfaceB__APIInterface',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodA__APIMethodArgs',
                kind: 3,
                name: 'ExportedInterfaceB_methodA__APIMethodArgs',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodA__APIMethodResult',
                kind: 2,
                name: 'ExportedInterfaceB_methodA__APIMethodResult',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodB__APIMethodArgs',
                kind: 3,
                name: 'ExportedInterfaceB_methodB__APIMethodArgs',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodB__APIMethodResult',
                kind: 2,
                name: 'ExportedInterfaceB_methodB__APIMethodResult',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD__APIInterface',
                kind: 1,
                name: 'NonExportedInterfaceD__APIInterface',
                schemaId: 'test',
                interface: 'NonExportedInterfaceD',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD_methodA__APIMethodArgs',
                kind: 3,
                name: 'NonExportedInterfaceD_methodA__APIMethodArgs',
                schemaId: 'test',
                interface: 'NonExportedInterfaceD',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD_methodA__APIMethodResult',
                kind: 2,
                name: 'NonExportedInterfaceD_methodA__APIMethodResult',
                schemaId: 'test',
                interface: 'NonExportedInterfaceD',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/PositiveInt',
                kind: 0,
                name: 'PositiveInt',
                schemaId: 'test',
                type: 'PositiveInt',
            },
            {
                kind: 0,
                name: 'SomeName',
                ref: 'test#/definitions/SomeName',
                schemaId: 'test',
                type: 'SomeName',
            },
            {
                kind: 0,
                name: 'SomeType1',
                ref: 'test#/definitions/SomeType1',
                schemaId: 'test',
                type: 'SomeType1',
            },
        ];
        const defsByName: any = {};
        for (const def of defs) {
            defsByName[def.name] = def;
        }
        expect(validator.listDefinitions()).toStrictEqual(defs);

        expect(
            validator.listDefinitions(
                (info) =>
                    info.kind === SchemaDefinitionInfoKind.Type && !info.name.startsWith('Some'),
            ),
        ).toStrictEqual([defsByName['PositiveInt']]);

        expect(
            validator.listDefinitions((info) => info.kind === SchemaDefinitionInfoKind.API),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB__APIInterface'],
            defsByName['NonExportedInterfaceD__APIInterface'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionInfoKind.APIMethodResult,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA__APIMethodResult'],
            defsByName['ExportedInterfaceB_methodB__APIMethodResult'],
            defsByName['NonExportedInterfaceD_methodA__APIMethodResult'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionInfoKind.APIMethodArguments,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA__APIMethodArgs'],
            defsByName['ExportedInterfaceB_methodB__APIMethodArgs'],
            defsByName['NonExportedInterfaceD_methodA__APIMethodArgs'],
        ]);
    });

    it('should be valid descriptions', () => {
        const schema: any = validator.getSchema(
            'test#/definitions/ExportedInterfaceB__APIInterface',
        );
        expect(schema).toBeTruthy();
        expect(schema.description).toStrictEqual('TAG: Description for ExportedInterfaceB');
        expect(schema.properties.propertyA.description).toStrictEqual('Description for propertyA');
        expect(schema.properties.methodA.description).toBeUndefined();
        expect(schema.properties.methodB.description).toStrictEqual('Description for methodB');
    });
});
