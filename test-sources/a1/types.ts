/**
 * @public
 *
 * @description Important type
 */
export type SomeType1 = 123;

/**
 * @private
 */
export type SomeType2 = 456;

/**
 * @public
 * @faker { 'faker.lorem.words': [{ min: 5, max: 10 }] }
 */
export type SomeName = string;

export type NonPublicType = boolean;
