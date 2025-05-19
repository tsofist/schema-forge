import { env } from 'node:process';

const raw = env['SF_ARTEFACTS_POLICY'];

export const KEEP_SPEC_ARTEFACTS = raw === 'all' || raw === 'spec';
export const KEEP_GEN_ARTEFACTS = raw === 'all' || raw === 'generator';
