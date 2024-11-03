import { PositiveInt } from '@tsofist/stem/lib/number/types';

/**
 * System User
 * @public
 */
export interface User {
    /** Name */
    firstName: string;
    /** Last name */
    lastName: string;
    /** Age */
    age: PositiveInt;
}

/**
 * API for performing operations with users
 * @public
 * @api
 */
export interface SomeAPI {
    /**
     * Do something with user
     * @param user Target user
     * @param checkActive Check user activity
     * @param useLogger Use logger when performing operation
     */
    doSomeWithUser(
        /** @description Target user */
        user: User,
        checkActive: boolean,
        useLogger?: boolean,
    ): Promise<void>;

    do2(): Promise<[]>;
}
