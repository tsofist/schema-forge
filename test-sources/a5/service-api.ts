import { UUID } from '@tsofist/stem/lib/crypto/uuid/types';
import { NumN } from './types';

/**
 * @public
 */
type DomainValue = `v:${string}`;

const DomainValues = ['v:1', 'v:2', 'v:3'] satisfies DomainValue[];

/**
 * @public
 */
type DomainValuesType = (typeof DomainValues)[number];

const Name1 = 'v:name1' satisfies DomainValue;
const Name2 = 'v:name2' satisfies DomainValue;
const Name3 = 'abnormal' as DomainValue;

const names = [Name1, Name2] satisfies DomainValue[];
type NamesType = (typeof names)[number];

const abnormalNames = [Name1, Name2, Name3] satisfies DomainValue[];
type NamesTypeAbnormal = (typeof abnormalNames)[number];

/**
 * @public
 */
type DomainNum = 1 | 2 | 3 | 133;
const Num1 = 1 satisfies DomainNum;
const Num2 = 2 satisfies DomainNum;
const nums = [Num1, Num2, NumN] satisfies DomainNum[];
/**
 * @public
 */
type Nums = (typeof nums)[number];

type Variadic = [typeof Num1, typeof Name1];
type Variadic1 = [typeof Num1, typeof Name1][number];
type VariadicList = [Nums, NamesType];
type VariadicList1 = [Nums, NamesType][number];

/**
 * @public
 * @dbEntity cmn.some
 */
export interface Some {
    vals: DomainValuesType;
    name0: NamesType;
    name1: typeof Name1;
    num0: Nums;
    num1: typeof Num1;
    variadic: Variadic;
    variadic1: Variadic1;
    variadicList: VariadicList;
    variadicList1: VariadicList1;
    //
    abnormalNames: NamesTypeAbnormal;
    /**
     * @dbFK
     * @dbIndex ix_some_indexed_field
     */
    indexedField1: number;
    /**
     * @dbFK false
     * @dbIndex
     */
    indexedField2: number;
    /**
     * @dbIndex { type: "gin", unique: true, name: "ix_some_indexed_field3WithExtra" }
     */
    indexedField3: number;
    /**
     * @dbIndex [
     *      { type: "gin", unique: true, name: "ix_some_indexed_field4" },
     *      { type: "btree" },
     *      "ix_some_indexed_field4_1",
     *      true,
     * ]
     */
    indexedField4: number;
    /**
     * Inline Foreign Key
     * @dbFK
     */
    ref0: UUID;
    ref1: FKColumn;
    /**
     * Inline Foreign Key (2)
     */
    ref2: FKColumn;
}

/**
 * Foreign Key Column Type.
 * @dbFK
 */
export type FKColumn = UUID;
