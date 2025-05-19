import { Parser, exporter } from '@dbml/core';
import type { ExportFormatOption } from '@dbml/core/types/export/ModelExporter';

export function convertDBMLToDatabaseModel(source: string) {
    return Parser.parse(source, 'json');
}

export function convertDBMLToJSON(source: string) {
    return Parser.parseDBMLToJSONv2(source);
}

export function convertDBMLToSQL(source: string, format: ExportFormatOption = 'postgres') {
    return exporter.export(source, format);
}
