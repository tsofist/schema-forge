import { NonEmptyString } from '@tsofist/stem';
import { Int, PositiveInt } from '@tsofist/stem/lib/number/types';
import { StringPhoneNumber } from '@tsofist/stem/lib/phone-number/types';

type List = readonly StringPhoneNumber[];

/**
 * @public
 * @description API description
 */
export interface API {
    propertyA: string;
    propertyB: unknown[];
    propertyC: any[];
    propertyD?: undefined;

    /** @description Method */
    methodA(arg1: string): void;
    methodB(arg1: number, arg2: string): Promise<number>;
    /** @deprecated */
    methodC(arg1: List): Promise<Int>;
    /** @private */
    methodD(): Promise<void>;
    methodE1(): Promise<undefined>;
    methodE2(): Promise<null>;
    methodF(): Promise<null | number>;
}

export interface IndoorInterface {
    a1: AdditionalType;
    a2: AdditionalType2;
}

/**
 * Indoor unit
 * And non-exported type
 *
 * @public
 * @description Additional type
 */
type AdditionalType = PositiveInt | NonEmptyString;

/**
 * @private
 */
type AdditionalType2 = AdditionalType;
