/* eslint-disable */

import { ReintroduceExact } from '@tsofist/stem';

/**
 * @public
 */
export type ComplexTypeA = {
    id: string;
    name: string;
    values: number[];
    /**
     * @discriminateBy status
     */
    details: ComplexTypeDetailsP | ComplexTypeDetailsA | ComplexTypeDetailsIA;
    isActive: boolean;
};

/**
 * @public
 */
export type ComplexTypeB = ReintroduceExact<
    ComplexTypeA,
    {
        /**
         * @discriminateBy status
         */
        details:
            | ComplexTypeDetailsP
            | ComplexTypeDetailsA
            | ComplexTypeDetailsIA
            | ComplexTypeDetailsWrong;
    }
>;

/**
 * @public
 */
enum ComplexTypeAStatus {
    Pending = 'pending',
    Active = 'active',
    Inactive = 'inactive',
}

/**
 * @public
 */
export type ComplexTypeDetailsP = {
    status: ComplexTypeAStatus.Pending;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        tags: string[];
    };
    payload: {
        data: {
            key: string;
            value: any;
        };
        checksum: string;
    };
};

/**
 * @public
 */
export type ComplexTypeDetailsA = {
    status: ComplexTypeAStatus.Active;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        tags: string[];
    };
    payload: {
        data: {
            key: string;
            value: any;
        };
        checksum: string;
    };
};

/**
 * @public
 */
export type ComplexTypeDetailsIA = {
    status: ComplexTypeAStatus.Inactive;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        tags: string[];
    };
    payload: {
        data: {
            key: string;
            value: any;
        };
        checksum: string;
    };
    someForInactiveOnly: boolean;
};

/**
 * @public
 */
export type ComplexTypeDetailsWrong = Omit<ComplexTypeDetailsA, 'status'>;
