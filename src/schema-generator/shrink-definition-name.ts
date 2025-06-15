import { createHash } from 'node:crypto';
import type { NonEmptyString } from '@tsofist/stem';

/**
 * Shrink definition name by removing generic type parameters
 *   and appending a digest of the removed part.
 */
export function shrinkDefinitionName(
    definitionName: string,
    suffixLength = 8,
): NonEmptyString | undefined {
    const startPos = definitionName.indexOf('<');

    if (startPos >= 0) {
        const hashSource = definitionName.substring(startPos);
        const prefix = definitionName.substring(0, startPos);
        const digest = createHash('sha256')
            .update(hashSource)
            .digest('hex')
            .substring(0, suffixLength);
        return `${prefix}_H${digest}`;
    }

    return undefined;
}
