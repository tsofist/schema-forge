import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { asArray } from '@tsofist/stem/lib/as-array';
import { raise } from '@tsofist/stem/lib/error';
import { noop } from '@tsofist/stem/lib/noop';
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

        const refs = definitions.map((item) => buildSchemaDefinitionRef(item, options.schemaId));

        const schema: ForgedSchema = {
            ...(await generateSchemaByDraftTypes({
                ...options,
                compilerOptions,
                sourceFileCache,
                drafts,
                definitions,
                sourcesTypesGeneratorConfig,
            })),
            ...(options.schemaMetadata ?? {}),
            hash: undefined,
        };

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
            const content = JSON.stringify(
                options.shallowDeref ? shallowDereferenceSchema(schema) : schema,
                null,
                2,
            );
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
                const ref = buildSchemaDefinitionRef(name, options.schemaId);
                metadata.names[name] = ref;
                metadata.refs[ref] = name;
                defs.delete(name);
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
