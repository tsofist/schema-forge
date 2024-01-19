import { Config } from 'ts-json-schema-generator';

export const TMP_FILES_SUFFIX = '.schema-forge.temporary-generated.tmp';

export const SG_CONFIG_MANDATORY: Config = {
    jsDoc: 'extended',
    topRef: true,
    skipTypeCheck: false,
};

export const SG_CONFIG_DEFAULTS: Config = {
    sortProps: true,
    additionalProperties: false,
    expose: 'all',
    strictTuples: true,
    encodeRefs: false,
    markdownDescription: false,
};

export interface SchemaForgeBaseOptions {
    /**
     * Generate schema definitions for public types only
     * This option can help to protect leaked internal types
     * @default true
     */
    readonly explicitPublic?: boolean;
    /**
     * By default, generator use description jsdoc-tag
     * If this option is true, then generator will use fallback description from type comment
     */
    readonly allowUseFallbackDescription?: boolean;

    /**
     * Filter for definitions
     * Important: dependencies will not be filtered
     */
    definitionsFilter?(name: string): boolean;
}
