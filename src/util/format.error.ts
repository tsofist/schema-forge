import { BaseError } from 'ts-json-schema-generator';
import { formatDiagnostics } from 'typescript';

export function formatSchemaForgeError(error: Error, dir = '') {
    if (error instanceof BaseError) {
        return formatDiagnostics(error.diagnostic.relatedInformation || [], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => dir,
            getNewLine: () => '\n',
        });
    }
    return error.message || error + '';
}
