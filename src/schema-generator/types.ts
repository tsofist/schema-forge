import type { Config } from 'ts-json-schema-generator';

export const TMP_FILES_SUFFIX = '.schema-forge.temporary-generated.tmp';

export const SFG_EXTRA_TAGS = [
    //
    'apiInterface',
    'apiProperty',
    'apiMethod',
    'apiMember',
    //
    'dbFK',
    'dbEntity',
    'dbColumn',
    'dbIndex',
    'dbEnum',
    //
    'enumAnnotation',
    'enumMember',
    // 'see',
    'spec',
    //
    'faker',
    //
    'version',
    'hash',
    'repository',
    'package',
] as const;

export const SFG_CONFIG_DEFAULTS = {
    additionalProperties: false,
    discriminatorType: undefined,
    encodeRefs: false,
    expose: 'export',
    extraTags: Array.from(SFG_EXTRA_TAGS),
    functions: 'hide',
    markdownDescription: false,
    skipTypeCheck: false,
    sortProps: true,
    strictTuples: true,
} as const satisfies Config;

export type SF_EXTRA_JSS_TAG_NAME = (typeof SFG_CONFIG_DEFAULTS)['extraTags'][number];

export const SFG_CONFIG_MANDATORY = {
    jsDoc: 'extended',
    topRef: true,
} as const satisfies Config;
