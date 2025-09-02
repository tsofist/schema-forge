/* eslint-disable */

/**
 * Desc: EnumA
 * @public
 */
export enum EnumA {
    A = 'A',
    B = 'B',
}

/**
 * Desc: EnumB
 * @public
 */
export enum EnumB {
    C = 99,
    D = 66,
}

/**
 * Desc: EnumC
 * @public
 */
export enum EnumC {
    E,
    F,
}

/**
 * Description for EnumD
 * @public
 */
export enum EnumD {
    /** Description for EnumD.G */
    G = 'g-001',
    /** Description for EnumD.H */
    H = 123,
    /** Description for EnumD.Y */
    Y = 1100 & 2,
}

/**
 * Desc: LiteralEnumA
 * @public
 */
export type LiteralEnumA =
    /** Desc: LiteralEnumA.A */
    | 'A'
    /** Desc: LiteralEnumA.B */
    | 'B'
    /** Desc: LiteralEnumA.C */
    | 'C';

/**
 * Desc: LiteralEnumB
 * @public
 */
export type LiteralEnumB = 99 | 66 | 77;

/**
 * Desc: LiteralEnumC
 *
 * @see https://example.com Some reference link
 * @see https://example2.com Some reference link 2
 *
 * @public
 */
export type LiteralEnumC =
    /** Literal: D */
    | 'D'
    /** Literal: E */
    | 'E'
    /** Literal: 11 */
    | 11
    /** Literal: 22 */
    | 22;
