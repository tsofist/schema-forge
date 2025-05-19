import { BaseError } from 'ts-json-schema-generator';
import { formatDiagnostics } from 'typescript';

export function formatForgeSchemaError(error: Error, dir = '') {
    if (error instanceof BaseError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
        return formatDiagnostics(error.diagnostic.relatedInformation || [], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => dir,
            getNewLine: () => '\n',
        });
    }
    return error.message || String(error);
}
