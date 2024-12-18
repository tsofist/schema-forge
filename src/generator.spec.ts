import { unlink } from 'node:fs/promises';
import { readErrorCode, readErrorContext } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { forgeSchema, loadJSONSchema } from './generator';
import {
    SchemaDefinitionInfo,
    SchemaDefinitionKind,
    SchemaForgeResult,
    SchemaForgeValidationErrorCode,
    SchemaForgeValidationErrorContext,
    SchemaNotFoundErrorCode,
    SchemaNotFoundErrorContext,
} from './types';
import { createSchemaForgeValidator, SchemaForgeValidator } from './validator';

const KEEP_ARTEFACTS = false;

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('generator for a7', () => {
    const outputSchemaFile = './a7.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a7.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;
    let validator: SchemaForgeValidator;

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
        });
        validator = createSchemaForgeValidator({}, true);
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    });
    afterAll(async () => {
        if (!KEEP_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const schema = validator.getSchema('test#/definitions/SomeAPI_doSomeWithUser_Args') as any;
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

describe('generator for a6', () => {
    const outputSchemaFile = './a6.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a6.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;
    let validator: SchemaForgeValidator;

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
        validator = createSchemaForgeValidator({}, true);
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    });
    afterAll(async () => {
        if (!KEEP_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();

        expect(validator.getValidator('test#/definitions/CollectionItemID1')!.schema).toStrictEqual(
            {
                $ref: '#/definitions/UUID',
                format: 'uuid',
                description: 'This is Collection item ID (inherits from UUID)',
            },
        );

        expect(validator.getValidator('test#/definitions/CollectionItemID2')!.schema).toStrictEqual(
            {
                format: 'uuid',
                type: 'string',
            },
        );

        {
            const rec = validator.getValidator(
                'test#/definitions/PRec<CollectionItem,UUID>',
            )!.schema;
            expect(rec).toBeTruthy();
            expect((rec as any).propertyNames).toStrictEqual({
                format: 'uuid',
            });
        }
        {
            const rec = validator.getValidator(
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

    let forgeSchemaResult: SchemaForgeResult | undefined;
    let validator: SchemaForgeValidator;

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
        });
        validator = createSchemaForgeValidator({}, true);
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    });
    afterAll(async () => {
        if (!KEEP_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();
        expect(Object.keys(defs)).toStrictEqual([
            'DomainNum',
            'DomainValue',
            'DomainValuesType',
            'NamesType',
            'NamesTypeAbnormal',
            'NumN',
            'Nums',
            'Some',
            'Variadic',
            'Variadic1',
            'VariadicList',
            'VariadicList1',
        ]);
        expect(validator.getValidator('test#/definitions/NamesType')!.schema).toStrictEqual({
            type: 'string',
            enum: ['v:name1', 'v:name2'],
        });
        expect(validator.getValidator('test#/definitions/NamesTypeAbnormal')!.schema).toStrictEqual(
            { type: 'string' },
        );
        expect(validator.getValidator('test#/definitions/Some')!.schema).toStrictEqual({
            type: 'object',
            properties: {
                vals: {
                    $ref: '#/definitions/DomainValuesType',
                },
                name0: {
                    $ref: '#/definitions/NamesType',
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
                    type: 'number',
                },
                indexedField2: {
                    dbIndex: true,
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
            ],
            additionalProperties: false,
            dbEntity: 'cmn.some',
        });
    });
});

describe('generator for a4', () => {
    const outputSchemaFile = './a4.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a4.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

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
        if (!KEEP_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();
        expect(Object.keys(defs)).toStrictEqual(['API', 'Enum', 'FormatMode', 'Some', 'Some2']);
    });
});

describe('generator for a3', () => {
    const outputSchemaFile = './a3.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a3.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

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
        if (!KEEP_ARTEFACTS) {
            await unlink(outputSchemaFile).catch(noop);
            await unlink(outputSchemaMetadataFile).catch(noop);
        }
    });

    it('generated schema should be valid', () => {
        expect(forgeSchemaResult).toBeTruthy();
    });

    it('interface generics should works', () => {
        const props =
            forgeSchemaResult!.schema.definitions?.InterfaceWithGeneric_InterfaceDeclaration
                .properties;
        expect(props).toBeTruthy();
        expect(props.propWithGeneric).toBeTruthy();
        expect(props.propWithGeneric.$ref).toStrictEqual('#/definitions/NonEmptyString');
    });
    it('optional args in API methods should works', () => {
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG0_Args;
            expect(props).toBeTruthy();
            expect(props.minItems).toStrictEqual(0);
            expect(props.maxItems).toStrictEqual(1);
        }
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG1_Args;
            expect(props).toBeTruthy();
            expect(props.minItems).toStrictEqual(0);
            expect(props.maxItems).toStrictEqual(2);
        }
        {
            const props = forgeSchemaResult!.schema.definitions?.API_methodG2_Args;
            expect(props).toBeTruthy();
            expect(props.minItems).toStrictEqual(1);
            expect(props.maxItems).toStrictEqual(2);
        }
        // {
        //     const props = forgeSchemaResult!.schema.definitions?.API_methodG3_Args;
        //     expect(props).toBeTruthy();
        //     expect(props.minItems).toStrictEqual(0);
        //     expect(props.maxItems).toBeUndefined();
        // }
        // {
        //     const props = forgeSchemaResult!.schema.definitions?.API_methodG4_Args;
        //     expect(props).toBeTruthy();
        //     expect(props.minItems).toStrictEqual(1);
        //     expect(props.maxItems).toBeUndefined();
        // }
    });

    it('extends should works', () => {
        const props = forgeSchemaResult!.schema.definitions?.BAPI_InterfaceDeclaration.properties;
        expect(props).toBeTruthy();
        expect(Object.keys(props)).toStrictEqual([
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

    let forgeSchemaResult: SchemaForgeResult | undefined;

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
        if (!KEEP_ARTEFACTS) {
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

    let forgeSchemaResult: SchemaForgeResult | undefined;
    let validator: ReturnType<typeof createSchemaForgeValidator>;

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
        validator = createSchemaForgeValidator({}, true);
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    }, 10_000);

    afterAll(async () => {
        if (!KEEP_ARTEFACTS) {
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
        expect(validator.getValidator('test#/definitions/Int')!.schema).toStrictEqual({
            type: 'integer',
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
        expect(validator.hasValidator('test#/definitions/Int')).toStrictEqual(true);
        expect(validator.hasValidator('test#/definitions/!Int')).toStrictEqual(false);
    });
    it('checkBySchema', () => {
        expect(() =>
            validator.checkBySchema(
                'test#/definitions/ExportedInterfaceB_InterfaceDeclaration',
                {},
            ),
        ).toThrow(SchemaForgeValidationErrorCode);
        expect(validator.checkBySchema('test#/definitions/Int', 1)).toStrictEqual(true);
        expect(() => validator.checkBySchema('test#/definitions/Int', 1.1)).toThrow(
            SchemaForgeValidationErrorCode,
        );
        expect(() => validator.checkBySchema('!test#/definitions/Int', 1)).toThrow(
            SchemaNotFoundErrorCode,
        );

        {
            const schema = '!test#/definitions/Int';
            try {
                validator.checkBySchema(schema, 1.1);
            } catch (e: any) {
                const context = readErrorContext<SchemaNotFoundErrorContext>(e);
                const code = readErrorCode(e);

                expect(e.message).toStrictEqual(SchemaNotFoundErrorCode);
                expect(code).toStrictEqual(SchemaNotFoundErrorCode);
                expect(context).toBeTruthy();
                expect(context!.schema).toStrictEqual(schema);
                expect(context!.errorMessage).toStrictEqual(undefined);
            }
        }

        {
            const schema = 'test#/definitions/Int';
            const message = 'ERROR!';
            try {
                validator.checkBySchema(schema, 1.1, { errorMessage: message });
            } catch (e: any) {
                const context = readErrorContext<SchemaForgeValidationErrorContext>(e);
                const code = readErrorCode(e);

                expect(e.message).toStrictEqual(message);
                expect(code).toStrictEqual(SchemaForgeValidationErrorCode);
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
                ref: 'test#/definitions/ExportedInterfaceB_InterfaceDeclaration',
                kind: 1,
                name: 'ExportedInterfaceB_InterfaceDeclaration',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodA_Args',
                kind: 3,
                name: 'ExportedInterfaceB_methodA_Args',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodA_Result',
                kind: 2,
                name: 'ExportedInterfaceB_methodA_Result',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodB_Args',
                kind: 3,
                name: 'ExportedInterfaceB_methodB_Args',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            {
                ref: 'test#/definitions/ExportedInterfaceB_methodB_Result',
                kind: 2,
                name: 'ExportedInterfaceB_methodB_Result',
                schemaId: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            {
                ref: 'test#/definitions/Int',
                kind: 0,
                name: 'Int',
                schemaId: 'test',
                type: 'Int',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD_InterfaceDeclaration',
                kind: 1,
                name: 'NonExportedInterfaceD_InterfaceDeclaration',
                schemaId: 'test',
                interface: 'NonExportedInterfaceD',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD_methodA_Args',
                kind: 3,
                name: 'NonExportedInterfaceD_methodA_Args',
                schemaId: 'test',
                interface: 'NonExportedInterfaceD',
                method: 'methodA',
            },
            {
                ref: 'test#/definitions/NonExportedInterfaceD_methodA_Result',
                kind: 2,
                name: 'NonExportedInterfaceD_methodA_Result',
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
                (info) => info.kind === SchemaDefinitionKind.Type && !info.name.startsWith('Some'),
            ),
        ).toStrictEqual([defsByName['Int'], defsByName['PositiveInt']]);

        expect(
            validator.listDefinitions((info) => info.kind === SchemaDefinitionKind.API),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_InterfaceDeclaration'],
            defsByName['NonExportedInterfaceD_InterfaceDeclaration'],
        ]);

        expect(
            validator.listDefinitions((info) => info.kind === SchemaDefinitionKind.APIMethodResult),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Result'],
            defsByName['ExportedInterfaceB_methodB_Result'],
            defsByName['NonExportedInterfaceD_methodA_Result'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionKind.APIMethodArguments,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Args'],
            defsByName['ExportedInterfaceB_methodB_Args'],
            defsByName['NonExportedInterfaceD_methodA_Args'],
        ]);
    });

    it('should be valid descriptions', () => {
        const schema: any = validator.getSchema(
            'test#/definitions/ExportedInterfaceB_InterfaceDeclaration',
        );
        expect(schema).toBeTruthy();
        expect(schema.description).toStrictEqual('TAG: Description for ExportedInterfaceB');
        expect(schema.properties.propertyA.description).toStrictEqual('Description for propertyA');
        expect(schema.properties.methodA.description).toBeUndefined();
        expect(schema.properties.methodB.description).toStrictEqual('Description for methodB');
    });
});
