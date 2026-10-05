import { describe, expect, it } from 'vitest';
import { verifyLiveModelIdentity } from './hermes-live-model-identity.mjs';

const model = 'qwen3.5:2b-q8_0';
const digest = '0689d44085e06d165161a8a9a1731344278cfb5aade63a3c3dbdb48ab54b130a';
const row = { name: model, digest };
const show = { capabilities: ['completion', 'tools'] };
const verify = (models = [row], metadata = show, expected = digest) =>
  verifyLiveModelIdentity({ models }, metadata, model, expected);

describe('Hermes live model provisioning identity', () => {
  it('accepts only the exact named full digest with tools', () => {
    expect(verify([{ name: 'other', digest: 'a'.repeat(64) }, row])).toEqual({ model, digest, tools: true });
  });
  it('rejects a different artifact even with the same 12-character prefix', () => {
    expect(() => verify([{ ...row, digest: digest.slice(0, 12) + 'a'.repeat(52) }])).toThrow('identity mismatch');
  });
  it.each([{ models: [] }, { models: [row, row] }, { models: [{ ...row, name: 'qwen3.5:2b' }] }])('rejects missing or ambiguous model rows %j', ({ models }) => {
    expect(() => verify(models)).toThrow('exactly one');
  });
  it.each([undefined, '324d162be6ca', 'sha256:' + digest, 'z'.repeat(64)])('rejects invalid returned digests %s', (actual) => {
    expect(() => verify([{ ...row, digest: actual }])).toThrow('invalid SHA-256');
  });
  it('rejects short pins and missing tool capabilities', () => {
    expect(() => verify([row], show, digest.slice(0, 12))).toThrow('full SHA-256');
    expect(() => verify([row], { capabilities: ['completion'] })).toThrow('tool capability');
    expect(() => verify([row], {})).toThrow('tool capability');
  });
});
