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
 *
 * @see LiteralEnumC
 * @public
 */
export type LiteralEnumB = 99 | 66 | 77;

/**
 * Desc: LiteralEnumC
 *
 * @see https://example.com Some reference link
 * @see https://example2.com Some reference link 2
 * @see LiteralEnumB
 * @see {@link LiteralEnumB}
 * @see {@link LiteralEnumB} Extra
 * @see {@link https://example3.com}
 * @see Documentation for EnumD
 *
 * @see Multiline reference link
 *   To some documentation for EnumD
 *
 * @see
 *   Other multiline reference link
 *   To some other documentation for EnumD
 *   Details: https://example4.com
 *   Let's try 🚀 (with emoji)
 *   Line #5
 *
 * @see [Warning]
 *   1 A-1
 *   2 A-2
 *
 * @see AA
 *   100 H-01
 *   200 H-02
 *
 * @see Warning:
 *   1 Do-1
 *   2 Do-2
 *     2.1 Do-2.1
 *     2.2 Do-2.2
 *       * Mark-1
 *       * Mark-2
 *     2.3 Do-2.3
 *       - Mark-3
 *       - Mark-4
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
