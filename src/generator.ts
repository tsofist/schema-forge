import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { URec } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { randomString } from '@tsofist/stem/lib/string/random';
import { SchemaObject } from 'ajv';
import { generateSchemaByDraftTypes } from './generator/schema-generator';
import { generateDraftTypeFiles } from './generator/types-generator';
import { SchemaForgeMetadata, SchemaForgeOptions, SchemaForgeResult } from './types';
import { buildSchemaDefinitionRef } from './index';

const KEEP_ARTEFACTS = false;

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

        const refs = definitions.map((item) => buildSchemaDefinitionRef(item, options.schemaId));

        let schema: SchemaObject | undefined;

        try {
            {
                schema = {
                    ...(await generateSchemaByDraftTypes({
                        schemaId,
                        tsconfig,
                        definitions,
                        sourcesDirectoryPattern,
                        outputSchemaFile,
                        sourcesTypesGeneratorConfig,
                        expose: options.expose,
                        openapiCompatible: options.openapiCompatible,
                        sortObjectProperties: options.sortObjectProperties,
                        allowUseFallbackDescription: options.allowUseFallbackDescription,
                        shrinkDefinitionNames: options.shrinkDefinitionNames,
                    })),
                    ...(options.schemaMetadata || {}),
                };

                {
                    const algorithm =
                        options.schemaMetadata?.hash == null ||
                        options.schemaMetadata?.hash === true
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
                    schemaHash: schema.hash,
                    title: options.schemaMetadata?.title,
                    description: options.schemaMetadata?.description,
                    version: options.schemaMetadata?.version,
                    $comment: options.schemaMetadata?.$comment,
                    refs: {},
                    names: {},
                    serviceRefs: {},
                    serviceNames: {},
                };

                const defs = new Set(Object.keys((schema.definitions || {}) as URec));
                for (const name of definitions) {
                    const ref = buildSchemaDefinitionRef(name, schemaId);
                    map.names[name] = ref;
                    map.refs[ref] = name;
                    defs.delete(name);
                }
                for (const name of defs) {
                    const ref = buildSchemaDefinitionRef(name, options.schemaId);
                    map.serviceNames[name] = ref;
                    map.serviceRefs[ref] = name;
                }

                const content = JSON.stringify(map, null, 2);
                await writeFile(options.outputSchemaMetadataFile, content, {
                    encoding: 'utf8',
                });
            }
        } finally {
            if (!KEEP_ARTEFACTS) {
                await Promise.all(files.map((fileName) => unlink(fileName).catch(noop)));
            }
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
