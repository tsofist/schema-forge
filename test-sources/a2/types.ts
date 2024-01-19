import { NonEmptyArray, NonEmptyString } from '@tsofist/stem';
import { Int } from '@tsofist/stem/lib/number/types';
import { StringPhoneNumber } from '@tsofist/stem/lib/phone-number/types';

export type UserID = Int;

export interface User {
    id: UserID;
    name: NonEmptyString;
    email: NonEmptyArray<NonEmptyString>;
    phone?: StringPhoneNumber;
}
