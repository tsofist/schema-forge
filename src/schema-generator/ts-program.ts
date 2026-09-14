import { resolve as resolvePath } from 'node:path';
import { cwd } from 'node:process';
import { raise } from '@tsofist/stem/lib/error';
import { BuildError } from 'ts-json-schema-generator';
import {
    type CompilerHost,
    type CompilerOptions,
    type CreateSourceFileOptions,
    type Diagnostic,
    type Program,
    type ScriptTarget,
    type SourceFile,
    createCompilerHost,
    createProgram,
    getPreEmitDiagnostics,
    parseJsonConfigFileContent,
    readConfigFile,
    sys,
} from 'typescript';
import { TMP_FILES_SUFFIX } from './types';

/**
 * In-memory TypeScript sources: canonical file name -> source text.
 * These files never exist on disk; they are served by the overlay compiler host.
 *
 * @internal
 */
export type VirtualSources = ReadonlyMap<string, string>;

/**
 * Compiler options resolved from a tsconfig file, plus the `exclude` patterns
 * declared by it (needed to reproduce tsconfig `include` semantics for root files).
 *
 * @internal
 */
/**
 * Parsed source files shared between the passes of a single `forgeSchema` run,
 * so that `lib.*.d.ts` and every `node_modules` declaration is read and parsed once.
 *
 * Sound only while every program of the run is built from the same compiler options
 * (`forge.ts` passes one object to both passes); the language version and module format
 * a file was parsed with are part of the key anyway.
 *
 * @internal
 */
export type SourceFileCache = Map<string, SourceFile>;

/**
 * @internal
 */
export function createSourceFileCache(): SourceFileCache {
    return new Map();
}

export type ForgeCompilerConfig = {
    options: CompilerOptions;
    /** `exclude` specs of the tsconfig, resolved to absolute paths */
    exclude: string[];
};

/**
 * Reads a tsconfig file (JSONC-safe), resolves its `extends` chain and applies
 * the overrides the forge pipeline relies on.
 *
 * Unlike the tsconfig `ts-json-schema-generator` loads internally, nothing is written
 * to disk: `baseUrl`/`paths`/`extends` are resolved against the directory of the
 * tsconfig itself.
 *
 * @internal
 */
export function loadForgeCompilerConfig(tsconfigFileName: string): ForgeCompilerConfig {
    const fileName = resolvePath(tsconfigFileName);
    const { config, error } = readConfigFile(fileName, (path) => sys.readFile(path));

    if (error) throw new BuildError(error);
    if (!config) raise(`Invalid tsconfig file: ${tsconfigFileName}`);

    const basePath = resolvePath(fileName, '..');
    const parsed = parseJsonConfigFileContent(config, sys, basePath, undefined, fileName);

    {
        // `include` is driven by sourcesFilesPattern, so "no inputs" diagnostics are expected here
        const errors = parsed.errors.filter(({ code }) => code !== 18002 && code !== 18003);
        if (errors.length) throw new BuildError(errors[0]);
    }

    const options: CompilerOptions = {
        ...parsed.options,
        noEmit: true,
        // Draft sources carry over every import of the original file, most of which
        // are unused in the synthesized part — unused-checks must not fail the build.
        noUnusedLocals: false,
        noUnusedParameters: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    delete options.out;
    delete options.outDir;
    delete options.outFile;
    delete options.declaration;
    delete options.declarationDir;
    delete options.declarationMap;

    // `parsed.raw` carries the `exclude` merged through the `extends` chain, already rewritten
    // relative to this tsconfig — resolve it to absolute so it stays correct when applied
    // against a different base path.
    const rawExclude: unknown = (parsed.raw as { exclude?: unknown } | undefined)?.exclude;
    const exclude = Array.isArray(rawExclude)
        ? (rawExclude as string[]).map((spec) => resolvePath(basePath, spec))
        : [];

    return { options, exclude };
}

/**
 * Expands source file patterns using tsconfig `include` semantics, relative to the cwd.
 * Draft artefacts are always excluded, so leftovers of an interrupted run are never picked up.
 *
 * @internal
 */
export function resolveSourceFileNames(patterns: string[], exclude: readonly string[]): string[] {
    const { fileNames } = parseJsonConfigFileContent(
        {
            include: patterns.flatMap(expandBracePatterns),
            exclude: [...exclude, `**/*${TMP_FILES_SUFFIX}.ts`],
        },
        sys,
        cwd(),
    );
    return fileNames;
}

/**
 * tsconfig `include` supports only `*`, `?` and `**`, but brace alternatives are part of the
 * documented `sourcesDirectoryPattern`/`sourcesFilesPattern` surface — so expand them here.
 *
 * @example
 *   src/*.{api,api-types}.ts -> [src/*.api.ts, src/*.api-types.ts]
 */
function expandBracePatterns(pattern: string): string[] {
    const open = pattern.indexOf('{');
    if (open === -1) return [pattern];

    const alternatives: string[] = [];
    let depth = 0;
    let start = open + 1;
    let close = -1;

    for (let i = open; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                alternatives.push(pattern.slice(start, i));
                close = i;
                break;
            }
        } else if (char === ',' && depth === 1) {
            alternatives.push(pattern.slice(start, i));
            start = i + 1;
        }
    }

    // Unbalanced braces: leave the pattern untouched rather than mangling it
    if (close === -1) return [pattern];

    const prefix = pattern.slice(0, open);
    const suffix = pattern.slice(close + 1);

    return alternatives.flatMap((alternative) =>
        expandBracePatterns(`${prefix}${alternative}${suffix}`),
    );
}

/**
 * Drop-in replacement for `createProgram` of ts-json-schema-generator:
 * root files are passed explicitly (no globbing) and in-memory sources are served
 * by an overlay compiler host (nothing is read from or written to disk for them).
 *
 * @internal
 */
export function createForgeProgram(options: {
    rootNames: readonly string[];
    compilerOptions: CompilerOptions;
    virtualSources?: VirtualSources;
    skipTypeCheck: boolean;
    sourceFileCache?: SourceFileCache;
}): { program: Program; host: CompilerHost } {
    if (!options.rootNames.length) {
        throw new BuildError({ messageText: 'No input files' } as Diagnostic);
    }

    const host = createOverlayCompilerHost(
        options.compilerOptions,
        options.virtualSources,
        options.sourceFileCache,
    );
    const program = createProgram(Array.from(options.rootNames), options.compilerOptions, host);

    if (!options.skipTypeCheck) {
        const diagnostics = getPreEmitDiagnostics(program);
        if (diagnostics.length) {
            throw new BuildError({
                messageText: 'Type check error',
                relatedInformation: [...diagnostics],
            } as Diagnostic);
        }
    }

    return { program, host };
}

/**
 * Canonical key for the virtual sources map.
 * File names reach the compiler host in whatever shape module resolution produced them,
 * so both sides of the lookup have to go through this.
 */
function canonicalFileName(fileName: string): string {
    const result = resolvePath(fileName);
    return sys.useCaseSensitiveFileNames ? result : result.toLowerCase();
}

function createOverlayCompilerHost(
    compilerOptions: CompilerOptions,
    virtualSources: VirtualSources = new Map(),
    sourceFileCache?: SourceFileCache,
): CompilerHost {
    const host = createCompilerHost(compilerOptions, true);

    const overlay = new Map<string, string>();
    for (const [fileName, source] of virtualSources) {
        overlay.set(canonicalFileName(fileName), source);
    }

    if (sourceFileCache) {
        const getSourceFile = host.getSourceFile.bind(host);

        host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
            // Virtual sources are specific to one pass and must never be shared
            if (overlay.has(canonicalFileName(fileName))) {
                return getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate);
            }

            const key = sourceFileCacheKey(fileName, languageVersionOrOptions);
            let source = sourceFileCache.get(key);
            if (!source) {
                source = getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate);
                if (source) sourceFileCache.set(key, source);
            }
            return source;
        };
    }

    if (!overlay.size) return host;

    // `createCompilerHost` builds `getSourceFile` on top of `host.readFile`, calling it
    // through the host object — so overriding `readFile` is enough to serve virtual sources.
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const realpath = host.realpath?.bind(host);

    host.readFile = (fileName) => {
        return overlay.get(canonicalFileName(fileName)) ?? readFile(fileName);
    };
    host.fileExists = (fileName) => {
        return overlay.has(canonicalFileName(fileName)) || fileExists(fileName);
    };
    if (realpath) {
        host.realpath = (fileName) => {
            return overlay.has(canonicalFileName(fileName)) ? fileName : realpath(fileName);
        };
    }

    return host;
}

function sourceFileCacheKey(
    fileName: string,
    languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions,
): string {
    const variant =
        typeof languageVersionOrOptions === 'object'
            ? [
                  languageVersionOrOptions.languageVersion,
                  languageVersionOrOptions.impliedNodeFormat,
                  languageVersionOrOptions.jsDocParsingMode,
              ].join(':')
            : String(languageVersionOrOptions);

    return `${canonicalFileName(fileName)}|${variant}`;
}
