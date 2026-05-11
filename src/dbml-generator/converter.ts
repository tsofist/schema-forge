import { Parser, exporter, ExportFormat } from '@dbml/core';

export function convertDBMLToDatabaseModel(dbmlStringSpec: string) {
    return Parser.parse(dbmlStringSpec, 'dbmlv2');
}

export function convertDBMLToSQL(source: string, format: ExportFormat = 'postgres') {
    return exporter.export(source, format);
}
