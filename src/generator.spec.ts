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
import { createSchemaForgeValidator } from './validator';

describe('generator for a3', () => {
    const outputSchemaFile = './a3.generated.schema.tmp.json';
    const outputDefinitionsFile = './a3.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build.json',
            sourcesDirectoryPattern: 'test-sources/a3',
            sourcesFilesPattern: 'service-api.ts',
            outputSchemaFile,
            outputDefinitionsFile,
            expose: 'all',
        });
    });
    afterAll(async () => {
        await unlink(outputSchemaFile).catch(noop);
        await unlink(outputDefinitionsFile).catch(noop);
    });

    it('generated schema should be valid', async () => {
        expect(forgeSchemaResult).toBeTruthy();
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
            'methodY',
        ]);
    });
});
describe('generator for a2', () => {
    const outputSchemaFile = './a2.generated.schema.tmp.json';
    const outputDefinitionsFile = './a2.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build.json',
            sourcesDirectoryPattern: 'test-sources/a2',
            sourcesFilesPattern: 'service-api.ts',
            outputSchemaFile,
            outputDefinitionsFile,
        });
    });
    afterAll(async () => {
        await unlink(outputSchemaFile).catch(noop);
        await unlink(outputDefinitionsFile).catch(noop);
    });

    it('generated schema should be valid', async () => {
        expect(forgeSchemaResult).toBeTruthy();
    });
});

describe('generator for a1', () => {
    const outputSchemaFile = './a1.generated.schema.tmp.json';
    const outputDefinitionsFile = './a1.generated.definitions.tmp.json';
    const schemaId = 'test';

    let forgeSchemaResult: SchemaForgeResult | undefined;
    let validator: ReturnType<typeof createSchemaForgeValidator>;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            allowUseFallbackDescription: false,
            explicitPublic: true,

            schemaId,
            tsconfigFrom: './tsconfig.build.json',
            sourcesDirectoryPattern: 'test-sources/a1',
            sourcesFilesPattern: 'service.api.ts',
            outputSchemaFile,
            outputDefinitionsFile,
        });
        validator = createSchemaForgeValidator({}, true);
        const schema = await loadJSONSchema([outputSchemaFile]);
        validator.addSchema(schema);
    }, 10_000);

    afterAll(async () => {
        await unlink(outputSchemaFile).catch(noop);
        await unlink(outputDefinitionsFile).catch(noop);
    });

    it('generated schema should be valid', async () => {
        expect(forgeSchemaResult).toBeTruthy();
        expect(forgeSchemaResult!.schema.$id).toStrictEqual(schemaId);
        expect(forgeSchemaResult!.generatedFiles.length).toStrictEqual(1);
        expect(forgeSchemaResult!.refs.length).toStrictEqual(8);
    });
    it('getSchema', async () => {
        expect(validator.getValidator('test#/definitions/Int')!.schema).toMatchObject({
            type: 'integer',
        });
        expect(validator.getValidator('#/definitions/NotExists')).toStrictEqual(undefined);
    });
    it('hasSchema', async () => {
        expect(validator.hasValidator('test#/definitions/Int')).toStrictEqual(true);
        expect(validator.hasValidator('test#/definitions/!Int')).toStrictEqual(false);
    });
    it('checkBySchema', async () => {
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
    it('listDefinitions', async () => {
        const defs: SchemaDefinitionInfo[] = [
            {
                kind: 1,
                name: 'ExportedInterfaceB_InterfaceDeclaration',
                schema: 'test',
                interface: 'ExportedInterfaceB',
            },
            {
                kind: 3,
                name: 'ExportedInterfaceB_methodA_Args',
                schema: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                kind: 2,
                name: 'ExportedInterfaceB_methodA_Result',
                schema: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodA',
            },
            {
                kind: 3,
                name: 'ExportedInterfaceB_methodB_Args',
                schema: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            {
                kind: 2,
                name: 'ExportedInterfaceB_methodB_Result',
                schema: 'test',
                interface: 'ExportedInterfaceB',
                method: 'methodB',
            },
            { kind: 0, name: 'Int', schema: 'test', type: 'Int' },
            {
                kind: 1,
                name: 'NonExportedInterfaceD_InterfaceDeclaration',
                schema: 'test',
                interface: 'NonExportedInterfaceD',
            },
            {
                kind: 3,
                name: 'NonExportedInterfaceD_methodA_Args',
                schema: 'test',
                interface: 'NonExportedInterfaceD',
                method: 'methodA',
            },
            {
                kind: 2,
                name: 'NonExportedInterfaceD_methodA_Result',
                schema: 'test',
                interface: 'NonExportedInterfaceD',
                method: 'methodA',
            },
            { kind: 0, name: 'PositiveInt', schema: 'test', type: 'PositiveInt' },
        ];
        const defsByName: any = {};
        for (const def of defs) {
            defsByName[def.name] = def;
        }
        expect(validator.listDefinitions()).toStrictEqual(defs);

        expect(
            validator.listDefinitions((info) => info.kind === SchemaDefinitionKind.Type),
        ).toStrictEqual([defsByName['Int'], defsByName['PositiveInt']]);

        expect(
            validator.listDefinitions((info) => info.kind === SchemaDefinitionKind.Interface),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_InterfaceDeclaration'],
            defsByName['NonExportedInterfaceD_InterfaceDeclaration'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionKind.InterfaceMethodResult,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Result'],
            defsByName['ExportedInterfaceB_methodB_Result'],
            defsByName['NonExportedInterfaceD_methodA_Result'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionKind.InterfaceMethodArguments,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Args'],
            defsByName['ExportedInterfaceB_methodB_Args'],
            defsByName['NonExportedInterfaceD_methodA_Args'],
        ]);
    });
});
