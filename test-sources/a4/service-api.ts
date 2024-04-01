import { NonEmptyString } from '@tsofist/stem';

export { Some2 } from '../a3/service-api';

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
