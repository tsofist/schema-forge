import { NonEmptyString } from '@tsofist/stem';
import { Int, PositiveInt } from '@tsofist/stem/lib/number/types';
import { StringPhoneNumber } from '@tsofist/stem/lib/phone-number/types';

type List = readonly StringPhoneNumber[];

/**
 * @public
 * @api
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

/**
 * @public
 * @api
 * @description BAPI descriptions
 */
export interface BAPI extends API {
    methodY(arg1: string): Promise<void>;
}

interface IndoorInterface {
    a1: AdditionalType;
    a2: AdditionalType2;
}

/**
 * Indoor unit
 * And non-exported type
 *
 * @public
 * @api
 * @description Additional type
 */
type AdditionalType = PositiveInt | NonEmptyString;

/**
 * @private
 */
type AdditionalType2 = AdditionalType;

/**
 * @public
 * @api
 */
export interface InterfaceWithGeneric<T extends NonEmptyString = NonEmptyString> {
    propWithGeneric: T;
    // fn<X>(): X; todo supports for member generics
}

/**
 * @public
 * @api
 */
export interface Some {
    prop1: string;
    prop2: string;
    prop3?: string;
    prop4?: Some2;
}

export interface Some2 {
    a: number;
    b?: number;
}
