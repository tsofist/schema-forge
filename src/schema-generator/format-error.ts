import { BaseError } from 'ts-json-schema-generator';
import { formatDiagnostics } from 'typescript';
import { TMP_FILES_SUFFIX } from './types';

export function formatForgeSchemaError(error: Error, dir = '') {
    if (error instanceof BaseError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const text = formatDiagnostics(error.diagnostic.relatedInformation || [], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => dir,
            getNewLine: () => '\n',
        });

        // Not every BuildError carries diagnostics (e.g. "No input files")
        if (!text) return error.message || String(error);

        // Diagnostics may point at generated draft sources, which are compiled from memory
        // and have no on-disk counterpart to open.
        return text.includes(TMP_FILES_SUFFIX)
            ? `${text}\nHint: set SF_ARTEFACTS_POLICY=generator to dump the generated sources to disk.\n`
            : text;
    }
    return error.message || String(error);
}
