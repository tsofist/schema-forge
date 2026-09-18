import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { asArray } from '@tsofist/stem/lib/as-array';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
import { BuildError } from 'ts-json-schema-generator';
import { KEEP_GEN_ARTEFACTS } from '../artefacts-policy';
import { buildSchemaDefinitionRef } from '../definition-info/ref';
import { inlineSingleUseDefinitions } from '../schema-dereference/inline-single-use';
import type {
    ForgedSchema,
    ForgeSchemaOptions,
    ForgeSchemaResult,
    SchemaForgeMetadata,
} from '../types';
import { formatForgeSchemaError } from './format-error';
import { generateDraftTypeFiles } from './generate-drafts';
import { generateSchemaByDraftTypes } from './generate-schema';
import {
    createSourceFileCache,
    loadForgeCompilerConfig,
    resolveSourceFileNames,
} from './ts-program';

export async function forgeSchema(options: ForgeSchemaOptions): Promise<ForgeSchemaResult> {
    const sourcesPattern = asArray(options.sourcesFilesPattern).map(
        (filesPattern) => `${options.sourcesDirectoryPattern}/${filesPattern}`,
    );

    const tsconfigFileName =
        options.tsconfig ?? options.tsconfigFrom ?? raise('tsconfig is not specified');

    let drafts: ReadonlyMap<string, string> = new Map();

    try {
        const { options: compilerOptions, exclude } = loadForgeCompilerConfig(tsconfigFileName);
        const rootNames = resolveSourceFileNames(sourcesPattern, exclude);
        // Both passes are built from the very same compiler options, so parsed declarations
        // (lib.*.d.ts above all) can be shared between them.
        const sourceFileCache = createSourceFileCache();

        const { sourcesTypesGeneratorConfig, definitions, namesBySourceFile, ...draftsResult } =
            generateDraftTypeFiles({ ...options, compilerOptions, rootNames, sourceFileCache });

        drafts = draftsResult.drafts;

        const { schema: generatedSchema, shrunkNames } = await generateSchemaByDraftTypes({
            ...options,
            compilerOptions,
            sourceFileCache,
            drafts,
            definitions,
            sourcesTypesGeneratorConfig,
        });

        // `definitions` holds the names the draft pass registered, which `shrinkDefinitionNames`
        //   may have renamed on the way into the schema. Everything addressing the schema has
        //   to go through the name it actually ended up under.
        const definitionNameOf = (name: string) => shrunkNames.get(name) ?? name;

        const refs = definitions.map((item) =>
            buildSchemaDefinitionRef(definitionNameOf(item), options.schemaId),
        );

        let schema: ForgedSchema = {
            ...generatedSchema,
            ...(options.schemaMetadata ?? {}),
            hash: undefined,
        };

        if (options.inlineSingleUseDefs) {
            // `definitions` is the draft-pass root list: every type that passed the
            //   visibility gate, i.e. exactly the `@public` ones under the default
            //   `explicitPublic`. Those must survive untouched.
            const keep = new Set(definitions.map(definitionNameOf));
            schema = inlineSingleUseDefinitions(schema, { keep }) as ForgedSchema;
        }

        {
            const algorithm =
                options.schemaMetadata?.hash == null || options.schemaMetadata?.hash === true
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

        if (options.outputSchemaFile) {
            const content = JSON.stringify(schema, null, 2);
            await writeFile(options.outputSchemaFile, content, { encoding: 'utf8' });
        }

        const metadata: SchemaForgeMetadata = {
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

        {
            const defs = new Set(Object.keys(schema.definitions ?? {}));
            for (const name of definitions) {
                // Keyed by the source type name, pointing at the definition as it is
                //   actually named in the schema, so the ref always resolves.
                const definitionName = definitionNameOf(name);
                const ref = buildSchemaDefinitionRef(definitionName, options.schemaId);
                metadata.names[name] = ref;
                metadata.refs[ref] = name;
                defs.delete(definitionName);
            }
            for (const name of defs) {
                const ref = buildSchemaDefinitionRef(name, options.schemaId);
                metadata.serviceNames[name] = ref;
                metadata.serviceRefs[ref] = name;
            }
        }

        if (options.outputSchemaMetadataFile) {
            const content = JSON.stringify(metadata, null, 2);
            await writeFile(options.outputSchemaMetadataFile, content, { encoding: 'utf8' });
        }

        return {
            schema,
            metadata,
            refs,
            generatedDrafts: drafts,
            generatedNamesBySourceFile: namesBySourceFile,
        };
    } catch (e) {
        if (e instanceof BuildError) {
            console.error('[forgeSchema: build error]\n', formatForgeSchemaError(e));
        }
        throw e;
    } finally {
        if (KEEP_GEN_ARTEFACTS) {
            await Promise.all(
                Array.from(drafts, ([fileName, content]) =>
                    writeFile(fileName, content, { encoding: 'utf8' }).catch(noop),
                ),
            );
        }
    }
}
