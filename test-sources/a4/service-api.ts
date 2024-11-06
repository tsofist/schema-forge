import { NonEmptyString } from '@tsofist/stem';

export { FormatMode } from 'ajv-formats/dist/formats';
export { Some2 } from '../a3/service-api';

/* eslint-disable @typescript-eslint/method-signature-style */

/**
 * @public
 */
export interface API {
    methodA(arg1: NonEmptyString): Promise<void>;
    methodB(arg1: Some): Promise<void>;
}

/**
 * @public
 */
type Some<T extends number = number> = {
    a: null;
    b: number;
    // c(): boolean;
    d: T;
};

/**
 * @public
 */
enum Enum {
    A = 'a',
    B = 'b',
    C = 'c',
    D = 'd',
}
