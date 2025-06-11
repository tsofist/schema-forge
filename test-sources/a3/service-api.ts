import { NonEmptyString } from '@tsofist/stem';
import { Int, PositiveInt } from '@tsofist/stem/lib/number/integer/types';
import { StringPhoneNumber } from '@tsofist/stem/lib/phone-number/types';

/* eslint-disable @typescript-eslint/method-signature-style */

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
    methodG0(arg0?: boolean): Promise<never>;
    methodG1(arg0?: boolean, arg1?: boolean): Promise<never>;
    methodG2(arg0: boolean, arg1?: boolean): Promise<never>;
    // todo supports for rest args
    // methodG3(...args: boolean[]): Promise<never>;
    // methodG4(arg0: string, ...args: boolean[]): Promise<never>;
    // methodG5( todo array with jsdoc
}

/**
 * @public
 * @api
 * @description BAPI descriptions
 */
export interface BAPI extends API {
    methodY(arg1: string): Promise<void>;
    // methodG(arg0: boolean): Promise<never>; // todo supports for method override
}

// todo supports for extends with omitted methods
// /**
//  * @public
//  * @api
//  * @description BAPI descriptions
//  */
// export interface BAPIOmit extends Omit<API, 'methodG0' | 'methodG1' | 'methodG2'> {
//     methodY(arg1: string): Promise<void>;
// }

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
    // fn: <X>() => X; // todo supports for member generics
}

// todo ts-json-schema-generator@v2.4
//   this.config?.expose === "all" || (this.isExportType(node) && !this.isGenericType(node))  // old

// /**
//  * @public
//  * @api
//  */
// export interface MyGeneric<T> {
//     field: T;
// }
//
// /**
//  * @public
//  */
// export interface MyGeneric2<T> {
//     field: T;
// }
//
// /**
//  * @public
//  */
// export interface MyObject {
//     // value: MyGeneric<number>;
//     value2: MyGeneric2<number>;
// }

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
