import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  ContradictionEngine,
  evidenceSupportsGoal,
  gateMemoryRetrieval,
  KnowledgeAdmissionGate,
} from '../src';
import type {
  ClaimProposalId,
  ContradictionAssessmentResult,
  ValidatedClaimCandidate,
} from '../src';

const jwtIoPage = {
  title: 'JSON Web Tokens - jwt.io',
  excerpt: 'Decode, verify and generate JSON Web Tokens. Debugger and docs for JWS, JWE and JWKS.',
  url: 'https://jwt.io/introduction',
  text: 'AWS Cognito JWT examples. noindex documentation. This page does not mention the Goal token.',
};

const teslaListingPage = {
  title: 'Tesla is listed on NASDAQ',
  excerpt: 'Tesla remains cotizada en bolsa after its IPO.',
  url: 'https://sec.example/filings/tesla-listing',
  text: 'Tesla is listed on the NASDAQ stock exchange. La empresa sigue cotizada en bolsa.',
};

const bitcoinNegativePage = {
  title: 'El Salvador ends bitcoin legal tender',
  excerpt: 'Bitcoin is no longer curso legal moneda.',
  url: 'https://news.example/el-salvador-bitcoin-tender',
  text: 'El Salvador announced that bitcoin (BTC) is no longer legal tender. El curso legal de la moneda BTC ended.',
};

const openaiNegativePage = {
  title: 'OpenAI is not listed',
  excerpt: 'OpenAI remains private and is not listed on any bolsa.',
  url: 'https://markets.example/openai-listing-status',
  text: 'OpenAI is not listed. The company has no IPO and is not cotizada en bolsa.',
};

describe('evidenceSupportsGoal Kernel SUPPORT gate', () => {
  test('case 1: nonexistent Goal plus HTTP 200 off-topic pages is not supported', () => {
    const result = evidenceSupportsGoal(
      { title: 'Locate record xyz-nonexist-token-9f3a', keywords: ['xyz-nonexist-token-9f3a'] },
      jwtIoPage,
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('unique_id_missing');
  });

  test('case 2: real Goal plus on-topic evidence is supported', () => {
    const result = evidenceSupportsGoal(
      { title: 'Is Tesla listed on the stock bolsa', keywords: ['tesla', 'listed'] },
      teslaListingPage,
    );
    expect(result).toEqual({ supported: true, reason: 'supported' });
  });

  test('case 3: on-topic negative conclusion may support', () => {
    expect(evidenceSupportsGoal(
      { title: 'Is bitcoin still legal tender moneda', keywords: ['bitcoin'] },
      bitcoinNegativePage,
    ).supported).toBe(true);
    expect(evidenceSupportsGoal(
      { title: 'Is OpenAI listed on bolsa', keywords: ['openai', 'listed'] },
      openaiNegativePage,
    ).supported).toBe(true);
  });

  test('case 4: unique Goal ID absent from excerpts is not supported', () => {
    const result = evidenceSupportsGoal(
      { title: 'Is Tesla listed xyz-nonexist-token-9f3a', keywords: ['tesla', 'listed'] },
      teslaListingPage,
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('unique_id_missing');
  });

  test('case 5: homepage alone does not support a seal', () => {
    const result = evidenceSupportsGoal(
      { title: 'Is Tesla listed on the stock bolsa', keywords: ['tesla', 'listed'] },
      { title: 'Tesla', excerpt: 'Electric vehicles', url: 'https://www.tesla.com/', text: 'Welcome to Tesla.' },
    );
    expect(result.supported).toBe(false);
    expect(result.reason).toBe('homepage_insufficient_coverage');
  });

  test('case 6: only truly admitted memory is reusable; chat is not memory', () => {
    const gated = gateMemoryRetrieval(
      [{ memoryId: 'chat:hermes-reply', value: 'Hermes said Completado and the Goal is done' }],
      { status: 'complete', entries: [] },
    );
    expect(gated.admitted).toEqual([]);
    expect(gated.excludedMemoryIds).toContain('chat:hermes-reply');
    expect(evidenceSupportsGoal(
      { title: 'Find a drill offer', keywords: ['drill'] },
      { title: 'chat', excerpt: 'Hermes said Completado', text: 'The assistant marked the Goal done.' },
    ).supported).toBe(false);
  });

  test('case 7: Hermes/MCP/OpenAPI/Grok text does not mark Kernel support', () => {
    const result = evidenceSupportsGoal(
      { title: 'Find a drill offer', keywords: ['drill'] },
      {
        title: 'MCP tool result',
        excerpt: 'Grok via OpenAPI reported success',
        url: 'https://api.example/mcp/run',
        text: 'Hermes finished. MCP marked done. OpenAPI Grok claimed Completado without page evidence.',
      },
    );
    expect(result.supported).toBe(false);
  });

  test('case 8: contradiction between sources is not hidden before admission', () => {
    const now = '2026-08-30T14:00:00.000Z' as IsoDateTime;
    const candidate: ValidatedClaimCandidate = {
      id: 'candidate-1',
      proposalId: 'proposal-1' as ClaimProposalId,
      statement: 'Bitcoin is legal tender.',
      confidence: 0.9,
      evidenceIds: ['evidence-1' as EvidenceId],
      contradictsClaimIds: [],
      status: 'candidate',
      createdAt: now,
    };
    const contradiction = new ContradictionEngine().evaluate({
      candidate,
      existingClaims: [{
        id: 'claim-1',
        statement: 'Bitcoin is no longer legal tender.',
        confidence: 0.88,
        verificationStatus: 'verified',
        updatedAt: now,
      }],
      comparisons: [{
        existingClaimId: 'claim-1',
        kind: 'material',
        confidence: 0.95,
        rationale: 'Sources disagree on legal tender status.',
      }],
      evaluatedAt: now,
    });
    expect(contradiction.action).toBe('block');
    expect(contradiction.contradictsClaimIds).toEqual(['claim-1']);
    expect(contradiction.reasons.some((reason) => reason.code.includes('conflict'))).toBe(true);

    const admission = new KnowledgeAdmissionGate().admit({
      candidate,
      contradiction: contradiction as ContradictionAssessmentResult,
      admittedAt: now,
    });
    expect(admission.decision).toBe('blocked');
    expect(admission.claim).toBeUndefined();
  });

  test('case 9: no URLs or empty pages never invent support', () => {
    const goal = { title: 'Find a drill offer', keywords: ['drill'] };
    expect(evidenceSupportsGoal(goal, {}).supported).toBe(false);
    expect(evidenceSupportsGoal(goal, { title: '', excerpt: '', text: '', url: undefined }).reason).toBe('no_evidence');
  });

  test('on-topic drill offer evidence still supports the live verifier fixture', () => {
    expect(evidenceSupportsGoal(
      { title: 'Find a drill offer', keywords: ['drill'] },
      {
        title: 'Quality drill 24.99 EUR',
        excerpt: 'Limited offer',
        url: 'https://shop.example/drill',
        text: 'Limited offer. Discount deal. Quality cordless drill with warranty for 24.99 EUR.',
      },
    ).supported).toBe(true);
  });
});
