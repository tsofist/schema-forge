import type { Config } from 'ts-json-schema-generator';

export const TMP_FILES_SUFFIX = '.schema-forge.temporary-generated.tmp';

export const SFG_CONFIG_DEFAULTS = {
    sortProps: true,
    additionalProperties: false,
    expose: 'export',
    strictTuples: true,
    extraTags: [
        //
        'apiMember',
        'apiMethod',
        'apiInterface',
        'apiProperty',
        //
        'dbColumn',
        'dbIndex',
        'dbEntity',
        //
        'faker',
    ],
    encodeRefs: false,
    markdownDescription: false,
    discriminatorType: undefined,
    functions: 'hide',
} as const satisfies Config;

export const SFG_CONFIG_MANDATORY = {
    jsDoc: 'extended',
    topRef: true,
    skipTypeCheck: false,
} as const satisfies Config;
