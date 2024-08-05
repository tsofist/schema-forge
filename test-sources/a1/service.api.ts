import { PositiveInt } from '@tsofist/stem/lib/number/types';

/**
 * Description for Service
 */
interface NonExportedInterfaceA {
    propertyA: string;
    /** @private */
    propertyB: string;
}

/**
 * @public
 * @api
 */
interface NonExportedInterfaceB {}

/**
 * @private
 */
interface NonExportedInterfaceC {}

/**
 * D-interface
 * @public
 * @api
 */
interface NonExportedInterfaceD {
    methodA(argA: PositiveInt): Promise<PositiveInt>;
}

/**
 */
export interface ExportedInterfaceA {
    propertyA: string;
    /** @private */
    propertyB: string;
}

/**
 * COMMENT: Description for ExportedInterfaceB
 * @public
 * @api
 * @deprecated OK-I
 * @description TAG: Description for ExportedInterfaceB
 */
export interface ExportedInterfaceB {
    /**
     * @description Description for propertyA
     * @deprecated OK-M
     */
    propertyA: string;
    /** @private */
    propertyB: string;

    /** Description for methodA */
    methodA(argA: PositiveInt): void;

    /** @description Description for methodB */
    methodB(argA: number, argB: true): Promise<void>;
}

/**
 * @private
 */
export interface ExportedInterfaceC {
    propertyA: string;
    /** @private */
    propertyB: string;
}
