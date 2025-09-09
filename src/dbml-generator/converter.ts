import { Parser, exporter } from '@dbml/core';
import type { ExportFormatOption } from '@dbml/core/types/export/ModelExporter';

export function convertDBMLToDatabaseModel(dbmlStringSpec: string) {
    return Parser.parse(dbmlStringSpec, 'dbmlv2');
}

export function convertDBMLToSQL(source: string, format: ExportFormatOption = 'postgres') {
    return exporter.export(source, format);
}
