import { createHash } from 'node:crypto';
import { NonEmptyString } from '@tsofist/stem';

/**
 * Shrink definition name by removing generic type parameters
 *   and appending a digest of the removed part.
 */
export function shrinkDefinitionName(
    definitionName: string,
    suffixLength = 8,
): NonEmptyString | undefined {
    const gPos = definitionName.indexOf('<');

    if (gPos >= 0) {
        const prefix = definitionName.substring(0, gPos);
        const hashSource = definitionName.substring(gPos);
        const digest = createHash('sha512')
            .update(hashSource)
            .digest('hex')
            .substring(0, suffixLength);
        return `${prefix}_H${digest}`;
    }

    return undefined;
}
