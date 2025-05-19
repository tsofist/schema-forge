import { unlink } from 'node:fs/promises';
import { env } from 'node:process';
import { asBool } from '@tsofist/stem/lib/as-bool';
import { noop } from '@tsofist/stem/lib/noop';
import { SchemaDefinitionInfoForType, SchemaDefinitionInfoKind } from '../definition-info/types';
import { forgeSchema } from '../schema-generator/forge';
import { loadJSONSchema } from '../schema-registry/loader';
import { createSchemaForgeRegistry } from '../schema-registry/registry';
import { ForgeSchemaResult } from '../types';
import { generateDBMLSpec } from './generator';

const KEEP_ARTEFACTS = asBool(env['SFG_KEEP_ARTEFACTS'], false); // TODO!

describe('DBML Generator', () => {
    const outputSchemaFile = './dbml.c1.generated.schema.tmp.json';
    const outputSchemaMetadataFile = './dbml.c1.generated.definitions.tmp.json';
    const schemaId = 'test-dbml';

    let forgeSchemaResult: ForgeSchemaResult | undefined;
    let registry: ReturnType<typeof createSchemaForgeRegistry>;

    beforeAll(async () => {
        forgeSchemaResult = await forgeSchema({
            allowUseFallbackDescription: false,
            explicitPublic: true,
            schemaId,
            tsconfigFrom: './tsconfig.build-test.json',
            sourcesDirectoryPattern: 'test-sources/dbml/c1',
            sourcesFilesPattern: ['service.api.ts', '*.api.ts', 'types.ts'],
            outputSchemaFile,
            outputSchemaMetadataFile,
        });
        registry = createSchemaForgeRegistry();
        const schema = await loadJSONSchema([outputSchemaFile]);
        registry.addSchema(schema);
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
        expect(forgeSchemaResult!.generatedTemporaryFiles.length).toStrictEqual(1);
        expect(forgeSchemaResult!.refs.length).toStrictEqual(13);
    });

    it('basic cases', () => {
        const definitions = registry.listDefinitions((info, keywords) => {
            return (
                info.name.endsWith('Basic') &&
                info.kind === SchemaDefinitionInfoKind.Type &&
                keywords.has('dbEntity')
            );
        }) as SchemaDefinitionInfoForType[];

        const dbml = generateDBMLSpec(
            registry,
            [
                {
                    scopeName: 'TestScope',
                    comment: 'Test comment for TestScope',
                    schemaId,
                    definitions,
                },
            ],
            {
                meta: {
                    name: 'TestProject',
                    comment: 'Test comment!',
                    note: [
                        //
                        'Multi-line note',
                        '',
                        '> Powered by [SchemaForge]',
                    ].join('\n'),
                },
                includeNotes: true,
            },
        );

        expect(dbml).toMatchSnapshot();
    });

    it('table meta cases', () => {
        const definitions = registry.listDefinitions((info, keywords) => {
            return (
                info.name.endsWith('TableMeta') &&
                info.kind === SchemaDefinitionInfoKind.Type &&
                keywords.has('dbEntity')
            );
        }) as SchemaDefinitionInfoForType[];

        const dbml = generateDBMLSpec(
            //
            registry,
            [{ schemaId, definitions }],
            { includeNotes: true },
        );

        expect(dbml).toMatchSnapshot();
    });

    it('index meta cases', () => {
        const definitions = registry.listDefinitions((info, keywords) => {
            return (
                info.name.endsWith('IndexMeta') &&
                info.kind === SchemaDefinitionInfoKind.Type &&
                keywords.has('dbEntity')
            );
        }) as SchemaDefinitionInfoForType[];

        const dbml = generateDBMLSpec(
            //
            registry,
            [{ schemaId, definitions }],
            { includeNotes: true },
        );

        expect(dbml).toMatchSnapshot();
    });
});
