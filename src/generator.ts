import { readFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { asArray } from '@tsofist/stem/lib/as-array';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { keysOf } from '@tsofist/stem/lib/object/keys';
import { randomString } from '@tsofist/stem/lib/string/random';
import { SchemaObject } from 'ajv';
import { generateSchemaByDraftTypes } from './generator/schema-generator';
import { generateDraftTypeFiles } from './generator/types-generator';
import {
    SchemaForgeDefinitionRef,
    SchemaForgeMetadata,
    SchemaForgeOptions,
    SchemaForgeResult,
} from './types';

export async function forgeSchema(options: SchemaForgeOptions): Promise<SchemaForgeResult> {
    const { schemaId, sourcesDirectoryPattern, outputSchemaFile } = options;
    const sourcesPattern = asArray(options.sourcesFilesPattern).map(
        (filesPattern) => `${sourcesDirectoryPattern}/${filesPattern}`,
    );

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

            config.include = sourcesPattern;
            config.compilerOptions.noUnusedLocals = false;

            tsconfig = `./tsconfig.schema-forge-generated.${randomString(5)}.tmp.json`;
            await writeFile(tsconfig, JSON.stringify(config, null, 2), { encoding: 'utf8' });
        }

        if (!tsconfig) raise('tsconfig is not specified');

        const { sourcesTypesGeneratorConfig, files, definitions, namesBySourceFile } =
            await generateDraftTypeFiles({
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
                    openAPI: options.openapiCompatible,
                });
                if (options.schemaMetadata) {
                    for (const key of keysOf(options.schemaMetadata)) {
                        schema[key] = options.schemaMetadata[key];
                    }
                }
                {
                    const algorithm =
                        options.schemaMetadata?.hash == null
                            ? 'md5'
                            : options.schemaMetadata?.hash === true
                              ? 'md5'
                              : options.schemaMetadata.hash;
                    if (algorithm) {
                        schema.hash = createHash(algorithm, {})
                            .update(JSON.stringify(schema))
                            .digest('hex');
                    } else {
                        delete schema.hash;
                    }
                }
                const content = JSON.stringify(schema, null, 2);
                await writeFile(options.outputSchemaFile, content, { encoding: 'utf8' });
            }

            if (options.outputSchemaMetadataFile) {
                const map: SchemaForgeMetadata = {
                    $id: options.schemaId || '',
                    version: options.schemaMetadata?.version,
                    title: options.schemaMetadata?.title,
                    description: options.schemaMetadata?.description,
                    $comment: options.schemaMetadata?.$comment,
                    schemaHash: schema.hash,
                    refs: {},
                    names: {},
                    serviceRefs: {},
                    serviceNames: {},
                };

                const defs = new Set(Object.keys(schema.definitions));
                for (const name of definitions) {
                    const ref: SchemaForgeDefinitionRef = `${options.schemaId || ''}#/definitions/${name}`;
                    map.names[name] = ref;
                    map.refs[ref] = name;
                    defs.delete(name);
                }
                for (const name of defs) {
                    map.serviceNames[name] = `${options.schemaId || ''}#/definitions/${name}`;
                    map.serviceRefs[`${options.schemaId || ''}#/definitions/${name}`] = name;
                }

                const content = JSON.stringify(map, null, 2);
                await writeFile(options.outputSchemaMetadataFile, content, {
                    encoding: 'utf8',
                });
            }
        } finally {
            await Promise.all(files.map((fileName) => unlink(fileName).catch(noop)));
        }

        return {
            schema,
            refs,
            generatedTemporaryFiles: files,
            generatedNamesBySourceFile: namesBySourceFile,
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
