import { NumN } from './types';

/**
 * @public
 */
type DomainValue = `v:${string}`;

// todo Unsupported statement kind: 243 (FirstStatement)
const DomainValues = ['v:1', 'v:2', 'v:3'] satisfies DomainValue[];

/**
 * @public
 */
type DomainValuesType = (typeof DomainValues)[number];

// todo Unsupported statement kind: 243 (FirstStatement)
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
}
