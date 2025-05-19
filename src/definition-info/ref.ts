import type { SchemaForgeDefinitionRef } from '../types';

export function buildSchemaDefinitionRef(
    definitionName: string,
    schemaId: string | undefined,
): SchemaForgeDefinitionRef {
    return `${schemaId || ''}#/definitions/${definitionName}`;
}
