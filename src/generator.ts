import { readFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { unlink } from 'node:fs/promises';
import { Rec } from '@tsofist/stem';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { randomString } from '@tsofist/stem/lib/string/random';
import { SchemaObject } from 'ajv';
import { generateSchemaByDraftTypes } from './generator/schema-generator';
import { generateDraftTypeFiles } from './generator/types-generator';
import { SchemaForgeDefinitionRef, SchemaForgeOptions, SchemaForgeResult } from './types';

export async function forgeSchema(options: SchemaForgeOptions): Promise<SchemaForgeResult> {
    const { schemaId, sourcesDirectoryPattern, outputSchemaFile } = options;
    const sourcesPattern = `${sourcesDirectoryPattern}/${options.sourcesFilesPattern}`;

    let tsconfig = options.tsconfig;
    let tsconfigGenerated = false;

    try {
        if (options.tsconfigFrom) {
            tsconfigGenerated = true;
            const source = await readFile(options.tsconfigFrom, { encoding: 'utf8' });
            const config = JSON.parse(source) as object & {
                include: string[];
                compilerOptions: { noUnusedLocals: boolean };
            };

            config.include = [sourcesPattern];
            config.compilerOptions.noUnusedLocals = false;

            tsconfig = `./tsconfig.schema-forge-generated.${randomString(5)}.tmp.json`;
            await writeFile(tsconfig, JSON.stringify(config, null, 2), { encoding: 'utf8' });
        }

        if (!tsconfig) raise('tsconfig is not specified');

        const { sourcesTypesGeneratorConfig, files, definitions } = await generateDraftTypeFiles({
            ...options,
            tsconfig,
            sourcesPattern,
        });

        const refs = definitions.map(
            (item) => `${options.schemaId || ''}#/definitions/${item}`,
        ) as SchemaForgeDefinitionRef[];

        let schema: SchemaObject | undefined;

        try {
            {
                schema = await generateSchemaByDraftTypes({
                    schemaId,
                    tsconfig,
                    definitions,
                    sourcesDirectoryPattern,
                    outputSchemaFile,
                    sourcesTypesGeneratorConfig,
                    expose: options.expose,
                });
                const content = JSON.stringify(schema, null, 2);
                await writeFile(options.outputSchemaFile, content, { encoding: 'utf8' });
            }
            if (options.outputDefinitionsFile) {
                const defs = new Set(Object.keys(schema.definitions));
                const map: {
                    refs: Rec<string, SchemaForgeDefinitionRef>;
                    names: Rec<SchemaForgeDefinitionRef>;
                    serviceRefs: Rec<string, SchemaForgeDefinitionRef>;
                } = { refs: {}, names: {}, serviceRefs: {} };
                for (const name of definitions) {
                    const ref: SchemaForgeDefinitionRef = `${options.schemaId || ''}#/definitions/${name}`;
                    map.names[name] = ref;
                    map.refs[ref] = name;
                    defs.delete(name);
                }
                for (const name of defs) {
                    map.serviceRefs[`${options.schemaId || ''}#/definitions/${name}`] = name;
                }

                const content = JSON.stringify(map, null, 2);
                await writeFile(options.outputDefinitionsFile, content, {
                    encoding: 'utf8',
                });
            }
        } finally {
            await Promise.all(files.map((fileName) => unlink(fileName).catch(noop)));
        }

        return {
            schema,
            refs,
            generatedFiles: files,
        };
    } finally {
        if (tsconfig && tsconfigGenerated) {
            await unlink(tsconfig).catch(noop);
        }
    }
}

export async function loadJSONSchema(files: string[]): Promise<SchemaObject[]> {
    return Promise.all<SchemaObject>(
        files.map((fn) => readFile(fn, { encoding: 'utf8' }).then(JSON.parse)),
    );
}

export function loadJSONSchemaSync(files: string[]): SchemaObject[] {
    return files.map((fn) => {
        const content = readFileSync(fn, { encoding: 'utf8' });
        return JSON.parse(content) as SchemaObject;
    });
}
