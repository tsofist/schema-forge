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

const KEEP_ARTEFACTS = false;

describe('generator for a4', () => {
    const outputSchemaFile = './a4.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a4.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build.json',
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

    it('generated schema should be valid', async () => {
        expect(forgeSchemaResult).toBeTruthy();
        const defs = forgeSchemaResult?.schema?.definitions;
        expect(defs).toBeTruthy();
        expect(Object.keys(defs)).toStrictEqual(['API', 'Enum', 'Some', 'Some2']);
    });
});

describe('generator for a3', () => {
    const outputSchemaFile = './a3.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './a3.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build.json',
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

    it('generated schema should be valid', async () => {
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
    const outputSchemaMetadataFile = './a2.generated.definitions.tmp.json';

    let forgeSchemaResult: SchemaForgeResult | undefined;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            tsconfigFrom: './tsconfig.build.json',
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

    it('generated schema should be valid', async () => {
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
            tsconfigFrom: './tsconfig.build.json',
            sourcesDirectoryPattern: 'test-sources/a1',
            sourcesFilesPattern: 'service.api.ts',
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

    it('generated schema should be valid', async () => {
        expect(forgeSchemaResult).toBeTruthy();
        expect(forgeSchemaResult!.schema.$id).toStrictEqual(schemaId);
        expect(forgeSchemaResult!.generatedTemporaryFiles.length).toStrictEqual(1);
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
    it('listDefinitions', async () => {
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
            validator.listDefinitions((info) => info.kind === SchemaDefinitionKind.APIInterface),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_InterfaceDeclaration'],
            defsByName['NonExportedInterfaceD_InterfaceDeclaration'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionKind.APIInterfaceMethodResult,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Result'],
            defsByName['ExportedInterfaceB_methodB_Result'],
            defsByName['NonExportedInterfaceD_methodA_Result'],
        ]);

        expect(
            validator.listDefinitions(
                (info) => info.kind === SchemaDefinitionKind.APIInterfaceMethodArguments,
            ),
        ).toStrictEqual([
            defsByName['ExportedInterfaceB_methodA_Args'],
            defsByName['ExportedInterfaceB_methodB_Args'],
            defsByName['NonExportedInterfaceD_methodA_Args'],
        ]);
    });
});
