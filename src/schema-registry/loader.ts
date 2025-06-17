import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { JSONSchema7 } from 'json-schema';

/**
 * Load JSON schema files
 */
export async function loadJSONSchema(files: string[]): Promise<JSONSchema7[]> {
    return Promise.all(
        files.map(async (fn) => {
            const raw = await readFile(fn, { encoding: 'utf8' });
            return JSON.parse(raw) as JSONSchema7;
        }),
    );
}

/**
 * Load JSON schema files synchronously
 */
export function loadJSONSchemaSync(files: string[]): JSONSchema7[] {
    return files.map((fn) => {
        const raw = readFileSync(fn, { encoding: 'utf8' });
        return JSON.parse(raw) as JSONSchema7;
    });
}
