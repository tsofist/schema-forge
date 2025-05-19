import type { KeywordDefinition } from 'ajv';

const NP_API_INTERFACE = '^[A-Z][a-zA-Z0-9]+$';
const NP_API_PROP = '^[a-z][a-zA-Z0-9]+$';
const NP_API_METHOD = NP_API_PROP;
const NP_API_MEMBER = `${NP_API_INTERFACE.substring(0, NP_API_INTERFACE.length - 1)}#${NP_API_PROP.substring(1)}`;

export const SFRAPIDefinitionKeywords: readonly KeywordDefinition[] = [
    {
        keyword: ['interface', 'apiInterface'],
        metaSchema: { type: 'string', pattern: NP_API_INTERFACE },
    },
    {
        keyword: ['property', 'apiProperty'],
        metaSchema: { type: 'string', pattern: NP_API_PROP },
    },
    {
        keyword: ['method', 'apiMethod'],
        metaSchema: { type: 'string', pattern: NP_API_METHOD },
    },
    {
        keyword: ['member', 'apiMember'],
        metaSchema: { type: 'string', pattern: NP_API_MEMBER },
    },
] as const;
