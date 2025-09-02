import type { PRec } from '@tsofist/stem';

export type SGEnumAnnotationOptions = PRec<
    [
        //
        /** 0 */ value: string | number,
        /** 1 */ note?: string,
        /** 2 */ comment?: string,
    ]
>;

export type SGEnumMemberOptions = {
    /** Enum name */
    enum: string;
    /** Title (Key) */
    title: string;
    note?: string;
    comment?: string;
};
