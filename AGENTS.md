# AGENTS.md / CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                                      # jest (needs the --experimental-vm-modules flag the script adds)
npm test -- src/schema-generator/forge.spec.ts   # single spec file
npm test -- -t 'validator for a9'             # single describe/it by name
npm test -- -u                                # update snapshots
npm run test:cov                              # coverage -> .coverage/
npm run build                                 # rm -rf lib && tsc -p tsconfig.build.json
npm run lint                                  # eslint, cached in .cache/
npm run format                                # eslint --fix
```

`.husky/pre-commit` runs `build`, `lint` and `test` — all three must pass before a commit lands.

`SF_ARTEFACTS_POLICY` is a debugging aid: `generator` dumps the otherwise in-memory
`*.schema-forge.temporary-generated.tmp.ts` draft sources to disk (next to their originals),
`spec` keeps the `*.tmp.json` schemas specs emit into the cwd, `all` does both.
See `src/artefacts-policy.ts`. The dump is inspection-only — generation always reads the drafts
from memory, so deleting or editing the dumped files changes nothing.

There is no barrel `index.ts`. `main`/`types` point at `lib/types`, and consumers deep-import
(`@tsofist/schema-forge/lib/schema-generator/forge`). New public API means a new deep path, not an export
added to an index.

## Architecture

The library has two halves: a **build-time generator** (TypeScript source → JSON Schema) and a
**runtime registry** (JSON Schema → validation, fakes, DBML). They are coupled by a set of custom
JSDoc-derived keywords.

### Generation is a two-pass pipeline

`forgeSchema()` (`src/schema-generator/forge.ts`) is the only entry point. It orchestrates:

1. **Draft pass** — `generate-drafts.ts` builds a `ts.Program` over every matched source file and walks
   its AST. Plain enums/type aliases/interfaces are just *registered* by name. Interfaces tagged `@api`
   get **synthesized TypeScript appended to a copy of the original source**: a readonly tuple type per
   method's arguments, a type alias per method's result, and a flattened interface listing every member.
   This is the core trick — API signatures become ordinary types so the downstream generator can
   schema-ize them.
2. **Schema pass** — `generate-schema.ts` runs a second `ts.Program` over the draft sources only, with
   several subclassed parsers/formatters (named-tuple descriptions, `typeof` of imported JSON,
   array-literal identifiers, enum member annotations, optional suppression of `MultipleDefinitionsError`),
   then shrinks definition names, sorts contents, and validates the result with Ajv in strict mode.
3. `forge.ts` then merges `schemaMetadata`, computes the content hash, optionally shallow-dereferences,
   and — only if the corresponding option is set — writes `outputSchemaFile` and
   `outputSchemaMetadataFile` (the name↔ref maps, split into user `refs`/`names` and
   generator-introduced `serviceRefs`/`serviceNames`). Both paths are optional; the schema and the
   metadata are always returned from `forgeSchema()`.

### Nothing intermediate touches the disk

`src/schema-generator/ts-program.ts` is the only module aware of TypeScript's filesystem layer, and it is
what makes the pipeline in-memory. `ts-json-schema-generator`'s own `createProgram` globs the disk, reads
the tsconfig through `ts.sys` and calls `ts.createProgram` **without a host**, so it is not used at all.
Instead:

- `loadForgeCompilerConfig()` reads the tsconfig with `ts.readConfigFile` (JSONC-safe, resolves `extends`,
  `baseUrl` and `paths` against the tsconfig's own directory) and forces
  `noEmit`/`noUnusedLocals`/`noUnusedParameters`. `tsconfig` and `tsconfigFrom` are now equivalent aliases.
- `resolveSourceFileNames()` expands `sourcesDirectoryPattern`/`sourcesFilesPattern` using tsconfig
  `include` semantics relative to the cwd, always excluding draft artefacts. `include` understands only
  `*`/`?`/`**`, so `expandBracePatterns()` pre-expands the `{a,b}` alternatives the option docs promise.
- `createForgeProgram()` takes explicit root names plus a `VirtualSources` map and builds the program with
  an overlay `ts.CompilerHost`. Only `readFile`/`fileExists`/`realpath` are overridden — `ts.createCompilerHost`
  implements `getSourceFile` on top of `host.readFile`, calling it through the host object, so virtual
  content flows through automatically.
- A `SourceFileCache` is created once per `forgeSchema()` call and shared by both passes, so `lib.*.d.ts`
  and the `node_modules` declarations are parsed once instead of twice (roughly a third off a run).
  This is sound only because `forge.ts` hands both passes the same `compilerOptions` object; virtual
  drafts are never cached, and the language version and module format are part of the cache key.

Draft sources keep the file **name** they used to be written under (same directory, `TMP_FILES_SUFFIX`),
because their text is a verbatim copy of the original and every relative import must resolve from the
original's directory. They just never exist on disk. Both passes need separate programs: putting the
originals and their draft copies into one program would duplicate every type name.

### Constraints the draft pass imposes on source files

Files matched by `sourcesDirectoryPattern` + `sourcesFilesPattern` may only contain imports, variable
statements, enums, type aliases, interfaces and re-export declarations — anything else `raise()`s with
"Unsupported statement kind". Re-exports must be the inline form `export { Type } from './module'`.
Rest parameters in `@api` methods are not supported.

Visibility: with `explicitPublic` (default `true`) only statements tagged `@public` are picked up;
otherwise everything except `@private`/`@internal` is. Interface *members* are always filtered by
`@private`/`@internal`.

### Definition naming is a protocol

`src/definition-info/` owns the round-trip between generated definition names and structured info.
Suffixes (`types.ts`): `__APIInterface`, `__APIMember`, `__APIMethodArgs`, `__APIMethodResult` —
`api-signature.ts` builds them, `parser.ts` parses them back into a `SchemaDefinitionInfo` discriminated by
`SchemaDefinitionInfoKind`, `guards.ts` narrows, `ref.ts` builds `SchemaId#/definitions/Name` refs.
The deprecated `legacyDefinitions` option swaps in the older `_InterfaceDeclaration`/`_Args`/`_Result`
suffixes; keep both paths working when touching this area.

### Custom keywords must be declared in two places

`SFG_EXTRA_TAGS` (`src/schema-generator/types.ts`) lists the JSDoc tags the generator carries into the
schema (`dbEntity`, `dbColumn`, `dbFK`, `dbIndex`, `dbEnum`, `enumAnnotation`, `enumMember`, `see`, `spec`,
`faker`, `discriminateBy`, the `api*` family, …). The registry registers matching Ajv keyword definitions
in `src/schema-registry/kw-common.ts`, `kw-api.ts`, `kw-dbml.ts`. Adding a tag to only one side breaks
validation, because the registry runs Ajv with `strict: true`. Consumers can also pass ad-hoc tags via the
`extraTags` option and register them as Ajv `keywords` themselves (see the `a11` spec).

### Runtime side

`createSchemaForgeRegistry()` (`src/schema-registry/registry.ts`) wraps an Ajv instance and is the hub for
everything downstream. Beyond validation it exposes `listDefinitions(predicate)`, which hands the predicate
both the parsed `SchemaDefinitionInfo` and a map of the extra keywords present on that definition — that is
how `dbml-generator` selects `dbEntity` definitions and how consumers discover API definitions. Async
(`$async`) schemas are explicitly rejected.

Built on top of the registry: `src/dbml-generator/` (definitions carrying `db*` keywords → DBML text),
`src/fake-generator/` (json-schema-faker + `@faker-js/faker`, honouring the `@faker` tag), and
`src/schema-dereference/` (full deref with a shared cache, plus the shallow variant used by the
`shallowDeref` option).

Errors use the `ErrorFamily` pattern from `@tsofist/stem` — see `src/efc.ts` for `EC_SF_*` codes and their
typed contexts.

## Tests

Specs are end-to-end: they call the real `forgeSchema()` against fixture directories in `test-sources/aN`
with `tsconfigFrom: './tsconfig.build-test.json'`, load the emitted schema into a registry, and assert with
Jest snapshots. Artefacts are written into the repo root as `*.tmp.json` (gitignored) and removed in
`afterAll` unless `SF_ARTEFACTS_POLICY` is set.

To cover new generator behaviour, add a fixture directory under `test-sources/` and a matching `describe`
block rather than unit-testing the internals. Jest `roots` are `src` and `test-sources`; `testRegex` is
`.*\.spec\.ts$`.

A regression guard worth keeping in mind: no spec may leave a `*.schema-forge.temporary-generated.tmp.ts`
behind, so `git status --porcelain` must stay clean after `npm test`.

`tsconfig.build.json` (used by `npm run build`) enables `noUnusedLocals`/`noUnusedParameters`;
`tsconfig.build-test.json` relaxes them and includes `test-sources`. Code that only compiles under the test
config will fail the pre-commit build.

## Style

TypeScript is formatted at 4-space indent (`.editorconfig`); JSON/YAML/Markdown at 2. ESLint and Prettier
configs come from `@tsofist/web-buddy` with `WEB_BUDDY_STRICT=true`. Commits follow Conventional Commits —
`semantic-release` drives versioning and publishing.
