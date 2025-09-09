import { createHash } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { asArray } from '@tsofist/stem/lib/as-array';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { randomString } from '@tsofist/stem/lib/string/random';
import { BuildError } from 'ts-json-schema-generator';
import { KEEP_GEN_ARTEFACTS } from '../artefacts-policy';
import { buildSchemaDefinitionRef } from '../definition-info/ref';
import { shallowDereferenceSchema } from '../schema-dereference/dereference-shallow';
import type {
    ForgedSchema,
    ForgeSchemaOptions,
    ForgeSchemaResult,
    SchemaForgeMetadata,
} from '../types';
import { formatForgeSchemaError } from './format-error';
import { generateDraftTypeFiles } from './generate-drafts';
import { generateSchemaByDraftTypes } from './generate-schema';

export async function forgeSchema(options: ForgeSchemaOptions): Promise<ForgeSchemaResult> {
    const sourcesPattern = asArray(options.sourcesFilesPattern).map(
        (filesPattern) => `${options.sourcesDirectoryPattern}/${filesPattern}`,
    );

    let tsconfig = options.tsconfig;
    let tsconfigGenerated = false;

    try {
        if (options.tsconfigFrom) {
            const source = await readFile(options.tsconfigFrom, { encoding: 'utf8' });
            const config = JSON.parse(source) as object & {
                include: string[];
                compilerOptions: { noUnusedLocals: boolean };
            };

            config.include = sourcesPattern;
            config.compilerOptions.noUnusedLocals = false;

            tsconfig = `./tsconfig.schema-forge-generated.${randomString(5)}.tmp.json`;
            await writeFile(tsconfig, JSON.stringify(config, null, 2), { encoding: 'utf8' });

            tsconfigGenerated = true;
        }

        if (!tsconfig) raise('tsconfig is not specified');

        const { sourcesTypesGeneratorConfig, files, definitions, namesBySourceFile } =
            await generateDraftTypeFiles({
                ...options,
                tsconfig,
                sourcesPattern,
            });

        const refs = definitions.map((item) => buildSchemaDefinitionRef(item, options.schemaId));

        let schema: ForgedSchema | undefined;

        try {
            {
                schema = {
                    ...(await generateSchemaByDraftTypes({
                        tsconfig,
                        definitions,
                        sourcesTypesGeneratorConfig,
                        ...options,
                    })),
                    ...(options.schemaMetadata || {}),
                    hash: undefined,
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

                const content = JSON.stringify(
                    options.shallowDeref ? shallowDereferenceSchema(schema) : schema,
                    null,
                    2,
                );
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

                const defs = new Set(Object.keys(schema.definitions || {}));
                for (const name of definitions) {
                    const ref = buildSchemaDefinitionRef(name, options.schemaId);
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
        } catch (e) {
            if (e instanceof BuildError) {
                console.error('[forgeSchema: build error]\n', formatForgeSchemaError(e as Error));
            }
            throw e;
        } finally {
            if (!KEEP_GEN_ARTEFACTS) {
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
