import { Rec } from '@tsofist/stem';
import {
    LocalISODateString,
    LocalISODateTimeString,
    ZuluISODateString,
    ZuluISODateTimeString,
} from '@tsofist/stem/lib/cldr/date-time/types';
import { UUID } from '@tsofist/stem/lib/crypto/uuid/types';
import { PositiveSafeFloat, SafeFloat } from '@tsofist/stem/lib/number/float/safe.types';
import { Float, PositiveFloat } from '@tsofist/stem/lib/number/float/types';
import {
    CBigInt,
    CInt,
    CNonNegativeBigInt,
    CSInt,
    CSNegativeInt,
} from '@tsofist/stem/lib/number/integer/compat.types';
import { Int, PositiveInt } from '@tsofist/stem/lib/number/integer/types';
import { SafeMoney } from '@tsofist/stem/lib/number/money/safe.types';

type ComplexType = Rec<string>;

/**
 * @description
 *   Description for Some Database Entity Type
 *   **Important**: This is a multi-line description for Some Database Entity Type
 *   This description may use **Markdown** syntax
 *
 * @comment
 *   This is a comment
 *   Important: This is a multi-line comment
 *
 * @dbEntity some_schema.some_entity_1
 *
 * @public
 */
export interface Primitive1Basic {
    number: number;
    numberArray: number[];
    bigint: bigint;
    bigintArray: bigint[];
    bool: boolean;
    boolArray: boolean[];
    string: string;
    stringArray: string[];
    date: Date;
    dateArray: Date[];
}

/**
 * @description
 *   Description for Some Database Entity Type
 *   **Important**: This is a multi-line description for Some Database Entity Type
 *   This description may use **Markdown** syntax
 *
 * @comment
 *   This is a comment
 *   Important: This is a multi-line comment
 *
 * @dbEntity {
 *     'name': 'some_schema.some_entity_2'
 * }
 *
 * @public
 */
export interface CustomTypes1Basic extends RefField {
    extraRef: RefCol;
    uuid: UUID;
    int: Int;
    intArray: Int[];
    float: Float;
    floatArray: Float[];
    complex: ComplexType;
    complexArray: ComplexType[];
}

/**
 * Some reference.
 *
 * @dbColumn { type: 'uuid', pk: true }
 * @dbIndex { unique: true }
 */
type RefCol = RefId;

/**
 * Some Reference Field Container
 */
type RefField = {
    ref: RefCol;
};

enum RefId {
    One = '00000000-0000-0000-0000-100000000001',
    Two = '00000000-0000-0000-0000-100000000002',
}

/**
 * @dbEntity some_schema.some_entity_3
 *
 * @public
 */
export interface CustomTypes2Basic {
    int: CInt;
    bigint: CBigInt;
    smallint: CSInt;
    float: SafeFloat;
    money: SafeMoney;
}

/**
 * @dbEntity some_schema.some_entity_5
 *
 * @public
 */
export interface CustomTypes3Basic {
    uid: UUID;
    zdt: ZuluISODateTimeString;
    ldt: LocalISODateTimeString;
    ld: LocalISODateString;
    zd: ZuluISODateString;
    pi: PositiveInt;
    pf: PositiveFloat;
    psf: PositiveSafeFloat;
    ci: CInt;
    cnnbi: CNonNegativeBigInt;
    csni: CSNegativeInt;
}

/**
 * @description Single line description via '@description' tag
 *
 * @dbEntity some_schema.some_entity_6
 *
 * @public
 */
export interface Case1TableMeta {
    stub: string;
}

/**
 * Inline description
 *
 * @dbEntity some_schema.some_entity_7
 *
 * @public
 */
export interface Case2TableMeta {
    stub: string;
}

/**
 * @description
 *   Multi-line description via @description tag
 *   Description for Some Database Entity Type
 *   **Important**: This is a multi-line description for Some Database Entity Type
 *   This description may use **Markdown** syntax
 *
 * @dbEntity some_schema.some_entity_8
 *
 * @public
 */
export interface Case3TableMeta {
    stub: string;
}

/**
 * Inline Multi-line description.
 * Description for Some Database Entity Type
 * **Important**: This is a multi-line description for Some Database Entity Type
 * This description may use **Markdown** syntax
 *
 * @dbEntity some_schema.some_entity_9
 *
 * @public
 */
export interface Case4TableMeta {
    stub: string;
}

/**
 * @comment
 *   This is a comment
 *   Important: This is a ***multi-line comment***
 *
 * @dbEntity some_schema.some_entity_10
 *
 * @public
 */
export interface Case5TableMeta {
    stub: string;
}

/**
 * @comment This is a single-comment
 *
 * @dbEntity some_schema.some_entity_11
 *
 * @public
 */
export interface Case6TableMeta {
    stub: string;
}

/**
 * @comment This is a multi-comment
 *   This is a different kind of multi-line comment
 *
 * @dbEntity some_schema.some_entity_12
 *
 * @public
 */
export interface Case7TableMeta {
    stub: string;
}

/**
 * @description V2
 *   Description for Some Database Entity Type
 *   **Important**: This is a multi-line description for Some Database Entity Type
 *   This description may use **Markdown** syntax
 *
 * @comment V2
 *   This is a comment
 *   Important: This is a multi-line comment
 *
 * Outlined description
 *
 * @dbEntity some_schema.some_entity_13
 *
 * @public
 */
export interface Case0TableMeta {
    stub: string;
}

/**
 * @dbEntity some_schema.ix_01
 * @public
 */
export interface Case0IndexMeta {
    /**
     * @dbIndex true
     */
    index00: number;
    /**
     * @dbIndex {
     *     note: 'This is a single-line note for Index'
     * }
     */
    indexed01: number;
    /**
     * @dbIndex {
     *   note: "\
     *      This is a multiline-line note for Index\n\
     *      Yep, this is true\
     *   "
     * }
     */
    indexed02: number;
}

///
// /**
//  * @description
//  *   Description for Some Database Entity Type
//  *   **Important**: This is a multi-line description for Some Database Entity Type
//  *   This description may use **Markdown** syntax
//  *
//  * @comment
//  *   This is a comment
//  *   Important: This is a multi-line comment
//  *
//  * @dbEntity some_schema.some_entity_6
//  *
//  * @public
//  */
// export interface Case0TableMeta {}

//
// col: boolean;
// /**
//  * Description for col01
//  * @comment COMMENT: Description for col01
//  */
// col01?: string;
// col02: number;
// col03: boolean;
// col04: string[];
// col05: ComplexType;
// col06: 100;
// col07: 'Hello';
// /**
//  * @dbColumn { type: 'text' }
//  */
// col08: boolean;
// col09: Date;
// /**
//  * Date and time in ISO 8601 format
//  *
//  *
//  * @default `now()`
//  */
// col10: ZuluISODateTimeString;
// /**
//  * @description
//  * This is a description for col10
//  * This description is an ***multi-line*** string
//  *
//  * @dbColumn { type: 'timestamptz' }
//  */
// col11: ZuluISODateTimeString;
// /**
//  * @dbColumn { type: 'timestamp' }
//  */
// col12: LocalISODateTimeString;
// /**
//  * @dbColumn { type: 'text' }
//  */
// col13: LocalISODateString;
// /**
//  * @dbColumn { type: 'timestamptz' }
//  */
// col14: ZuluISODateString;
// col15: PositiveInt;
// col16: PositiveFloat;
// col17: PositiveSafeFloat;
// col18: CInt;
// /**
//  * @dbColumn { type: 'bigint' }
//  */
// col19: CBigInt;
// /**
//  * @dbColumn { pk: true }
//  */
// col20: UUID;
// /**
//  * @dbIndex { pk: true }
//  */
// col21: string;
// //
// /**
//  * @dbIndex { name: 'ix_cc1' }
//  */
// complexCol1: Int;
// /**
//  * @dbIndex { name: 'ix_cc1' }
//  */
// complexCol2: Int;
// /**
//  * @dbIndex { name: 'ix_cc2', unique: true }
//  */
// complexCol1_1: Int;
// /**
//  * @dbIndex { name: 'ix_cc2' }
//  */
// complexCol2_1: Int;
