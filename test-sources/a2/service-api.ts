import { NonEmptyString } from '@tsofist/stem';
import { UUID } from '@tsofist/stem/lib/crypto/uuid/types';
import { User, UserID } from './types';

/* eslint-disable @typescript-eslint/method-signature-style */

/**
 * By default, if you declare this interface as public,
 *   it will still get into the schema even if it is not exported from the target module
 *
 * This is a private interface description, because by default the description for the schema will be taken from the JSDoc tag "description"
 *
 * By default, only public interfaces get into the schema
 * BUT if other members of the schema refer to the interface, it will still be included in the result
 *
 * @private
 *
 * @description User access information (this is public description)
 */
interface UserAccess {
    /**
     * Administrative roles will not be included (this is private description)
     * @description Actual list of roles (this is public description)
     */
    roles: NonEmptyString[];
    /** @description Actual list of privileges */
    privileges: NonEmptyString[];
    /** @private */
    providerId: UUID;
    /** @deprecated */
    legacyId: UserID;
}

/**
 * This description is hidden for schema
 * @public
 * @api
 *
 * @description User Main API
 */
export interface API {
    /** @description Get user */
    get(id: UserID): Promise<User>;
    /** @description Delete user */
    delete(id: UserID): Promise<void>;
    /** @description Get user access information */
    getAccess(id: UserID): UserAccess;
    /**
     * @description Disable user
     * @private
     */
    disable(id: UserID): Promise<void>;
}
