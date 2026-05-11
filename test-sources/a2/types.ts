import { NonEmptyArray, NonEmptyString } from '@tsofist/stem';
import { Int } from '@tsofist/stem/lib/number/integer/types';
import { StringPhoneNumber } from '@tsofist/stem/lib/phone-number/types';

/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type UserID = Int;

export interface User {
    id: UserID;
    name: NonEmptyString;
    email: NonEmptyArray<NonEmptyString>;
    phone?: StringPhoneNumber;
}
