import { BaseError } from 'ts-json-schema-generator';
import { formatDiagnostics } from 'typescript';

export function formatSchemaForgeError(error: Error, dir = '') {
    if (error instanceof BaseError) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        return formatDiagnostics(error.diagnostic.relatedInformation || [], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => dir,
            getNewLine: () => '\n',
        });
    }
    return error.message || String(error);
}
