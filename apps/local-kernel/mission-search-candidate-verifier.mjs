import { createHash } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';
import { classifyOpportunity } from './opportunity-classifier.mjs';

const READ_CAPABILITY = 'web.read';

export class MissionSearchCandidateVerifier {
  constructor(store, opportunityProjector, options = {}) {
    this.store = store;
    this.opportunityProjector = opportunityProjector;
    this.now = options.now ?? (() => new Date());
    this.kernel = options.kernel;
    this.connectors = options.connectors;
    this.reader = options.reader;
    this.loadKernel = options.loadKernel ?? loadBuiltKernel;
    this.loadConnectors = options.loadConnectors ?? loadBuiltConnectors;
  }

  async verify(missionId) {
    const initial = await this.store.read();
    const initialMission = findMission(initial, missionId);
    if (initialMission.status === 'completed' && initialMission.verificationDigest) {
      return { mission: initialMission, evidence: [], idempotent: true };
    }
    requireVerifying(initialMission);
    const initialGoal = findGoal(initial, initialMission.goalId);
    const kernel = await this.#kernel();
    const firstDecision = authorizeRead(kernel, initialGoal, initialMission);
    if (!firstDecision.allowed) return this.#recordBlock(missionId, initialMission, firstDecision.reason);

    const adapter = new kernel.PublicWebReadExecutionAdapter(await this.#reader());
    const outcomes = [];
    for (const candidate of initialMission.searchCandidates) {
      try {
        const document = await adapter.execute({
          executionId: deterministicExecutionId(initialMission.id, candidate.id),
          idempotencyKey: `verify:${initialMission.id}:${candidate.id}`,
          payload: { url: candidate.url },
        });
        if (!Number.isInteger(document.status) || document.status < 200 || document.status >= 300) {
          throw new Error(`web.read returned HTTP ${document.status}`);
        }
        if (typeof document.text !== 'string' || !document.text.trim()) throw new Error('web.read returned empty content');
        outcomes.push({ candidate, ok: true, document });
      } catch (error) {
        outcomes.push({ candidate, ok: false, reason: safeMessage(error) });
      }
    }

    const fresh = await this.store.read();
    const freshMission = findMission(fresh, missionId);
    if (freshMission.status === 'completed' && freshMission.verificationDigest) {
      return { mission: freshMission, evidence: [], idempotent: true };
    }
    requireSameCandidateBatch(initialMission, freshMission);
    const freshGoal = findGoal(fresh, freshMission.goalId);
    const finalDecision = authorizeRead(kernel, freshGoal, freshMission);
    if (!finalDecision.allowed) return this.#recordBlock(missionId, freshMission, finalDecision.reason);

    const verified = outcomes.filter((item) => item.ok);
    if (!verified.length) return this.#recordFailures(missionId, freshMission, outcomes);
    return this.#projectVerified(missionId, freshMission, outcomes);
  }

  async #projectVerified(missionId, expectedMission, outcomes) {
    const now = this.now().toISOString();
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      if (current?.status === 'completed' && current.verificationDigest) {
        return { changed: false, data, result: { mission: current, evidence: [], idempotent: true } };
      }
      requireSameCandidateBatch(expectedMission, current);
      let nextData = data;
      const evidenceResults = [];
      const verificationResults = [];
      let promoted = 0;

      for (const outcome of outcomes) {
        if (!outcome.ok) {
          verificationResults.push({ candidateId: outcome.candidate.id, status: 'verification_failed', reason: outcome.reason });
          continue;
        }
        const projected = projectVerifiedDocument(nextData, current, outcome.candidate, outcome.document, this.opportunityProjector);
        nextData = projected.data;
        evidenceResults.push(projected.result);
        if (projected.result.opportunity?.status === 'opportunity') promoted += 1;
        verificationResults.push({
          candidateId: outcome.candidate.id,
          status: 'verified',
          sourceUrl: projected.result.sourceUrl,
          evidenceId: projected.result.evidenceId,
        });
      }

      const digest = createHash('sha256')
        .update(`${current.searchCandidateDigest ?? ''}\n${verificationResults.map((item) => `${item.candidateId}:${item.status}:${item.evidenceId ?? ''}`).join('\n')}`)
        .digest('hex');
      const completed = {
        ...current,
        status: 'completed',
        executionPhase: 'forged',
        completedAt: now,
        forgedAt: now,
        verificationResults,
        verificationDigest: digest,
        searchCandidates: current.searchCandidates.map((candidate) => {
          const result = verificationResults.find((item) => item.candidateId === candidate.id);
          return result ? { ...candidate, ...result } : candidate;
        }),
        limitation: 'Kernel web.read verification completed; only fetched page content became Evidence',
        resultSummary: {
          received: current.searchCandidates.length,
          evidenceCreated: evidenceResults.filter((item) => !item.duplicate).length,
          opportunitiesPromoted: promoted,
        },
      };
      delete completed.verificationBlock;
      const updated = [...missions];
      updated[index] = completed;
      return {
        changed: true,
        data: { ...nextData, agentMissions: updated },
        result: { mission: completed, evidence: evidenceResults, idempotent: false },
      };
    });
  }

  async #recordFailures(missionId, expectedMission, outcomes) {
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      requireSameCandidateBatch(expectedMission, current);
      const verificationResults = outcomes.map((item) => ({ candidateId: item.candidate.id, status: 'verification_failed', reason: item.reason }));
      const next = {
        ...current,
        verificationResults,
        limitation: 'Kernel web.read verification failed for all candidates; retry remains safe',
        resultSummary: { received: current.searchCandidates.length, evidenceCreated: 0, opportunitiesPromoted: 0 },
      };
      const updated = [...missions];
      updated[index] = next;
      return { changed: true, data: { ...data, agentMissions: updated }, result: { mission: next, evidence: [], idempotent: false } };
    });
  }

  async #recordBlock(missionId, expectedMission, reason) {
    return this.store.project(async (data) => {
      const missions = data.agentMissions ?? [];
      const index = missions.findIndex((item) => item.id === missionId);
      const current = missions[index];
      requireSameCandidateBatch(expectedMission, current);
      const block = { reason };
      if (current.verificationBlock?.reason === reason) return { changed: false, data, result: { mission: current, evidence: [], blocked: true } };
      const next = { ...current, verificationBlock: block, limitation: `Kernel web.read verification blocked: ${reason}` };
      const updated = [...missions];
      updated[index] = next;
      return { changed: true, data: { ...data, agentMissions: updated }, result: { mission: next, evidence: [], blocked: true } };
    });
  }

  async #kernel() {
    if (!this.kernel) this.kernel = unwrapModule(await this.loadKernel());
    requireKernel(this.kernel);
    return this.kernel;
  }

  async #reader() {
    if (this.reader) return this.reader;
    if (!this.connectors) this.connectors = unwrapModule(await this.loadConnectors());
    if (typeof this.connectors.WebPageFetcher !== 'function') throw new InboxError('CONNECTORS_RUNTIME_INVALID', 'Trusted connectors runtime does not expose WebPageFetcher', 503);
    this.reader = new this.connectors.WebPageFetcher();
    return this.reader;
  }
}

function authorizeRead(kernel, goal, mission) {
  const context = capabilityContext(goal);
  if (!context) return { allowed: false, reason: 'invalid_goal' };
  const registry = new kernel.CapabilityRegistry([kernel.PUBLIC_WEB_READ_CAPABILITY]);
  let capability;
  try {
    capability = registry.authorize(
      { capabilityId: READ_CAPABILITY, version: '1' },
      {
        planId: mission.id,
        goalAllowedCapabilities: context.allowedCapabilities,
        goalForbiddenCapabilities: context.forbiddenCapabilities,
        goalAllowedDataScopes: context.allowedDataScopes,
        goalForbiddenDataScopes: context.forbiddenDataScopes,
      },
    );
  } catch {
    return { allowed: false, reason: `capability_denied:${READ_CAPABILITY}` };
  }
  return kernel.evaluateAutomaticReadOnlyContinuation({
    goal: { id: goal.id, revision: context.revision, status: goal.status, approvalPolicy: context.approvalPolicy },
    authorization: mission.authorization,
    capability,
  });
}

function capabilityContext(goal) {
  if (goal?.contractVersion === 2) {
    const revision = Number(goal.currentRevision?.revision);
    if (!Number.isInteger(revision) || revision < 1 || typeof goal.approvalConfig?.policy !== 'string') return undefined;
    return {
      revision,
      approvalPolicy: goal.approvalConfig.policy,
      allowedCapabilities: conservativeAllowed(goal.allowedCapabilities, goal.constraints?.allowedCapabilities),
      forbiddenCapabilities: union(goal.forbiddenCapabilities, goal.constraints?.forbiddenCapabilities),
      allowedDataScopes: conservativeAllowed(goal.allowedDataScopes, goal.constraints?.allowedDataScopes),
      forbiddenDataScopes: union(goal.forbiddenDataScopes, goal.constraints?.forbiddenDataScopes),
    };
  }
  if (!goal || !Array.isArray(goal.categories)) return undefined;
  return { revision: 1, approvalPolicy: 'legacy_none', allowedCapabilities: [READ_CAPABILITY], forbiddenCapabilities: [], allowedDataScopes: ['public_web'], forbiddenDataScopes: [] };
}

function projectVerifiedDocument(data, mission, candidate, document, opportunityProjector) {
  const suffix = createHash('sha256').update(`${mission.id}\n${candidate.id}`).digest('hex');
  const caseId = `case:verified:${suffix}`;
  const evidenceId = `evidence:verified:${suffix}`;
  const sourceUrl = String(document.sourceUrl ?? candidate.url);
  const capturedAt = String(document.fetchedAt ?? new Date().toISOString());
  const title = String(document.title ?? candidate.title).slice(0, 240) || candidate.title;
  const text = String(document.text ?? '').trim();
  const context = {
    schemaVersion: 'hephaestus.page-context.v1',
    url: sourceUrl,
    canonicalUrl: sourceUrl,
    title,
    visibleText: text,
    description: candidate.summary,
    capturedAt,
  };
  const existing = (data.evidence ?? []).find((item) => item.id === evidenceId);
  let nextData = data;
  let duplicate = true;
  if (!existing) {
    duplicate = false;
    const caseRecord = {
      id: caseId,
      title,
      objective: `Verify a public finding returned for Goal: ${mission.goalTitle}`,
      description: candidate.summary,
      status: 'draft',
      tags: ['kernel-verified', 'web.read'],
      createdAt: capturedAt,
      updatedAt: capturedAt,
    };
    const evidenceRecord = {
      id: evidenceId,
      caseId,
      sourceReceiptId: `web-read:${suffix}`,
      sourceUrl,
      contentType: 'webpage',
      mimeType: String(document.contentType ?? 'text/plain').slice(0, 160),
      contentHash: createHash('sha256').update(text).digest('hex'),
      rawText: text,
      summary: candidate.summary ?? title,
      capturedAt,
      extractionMethod: 'kernel-web-read-v1',
      confidence: 0.9,
      tags: ['kernel-verified', 'web.read'],
      entityIds: [],
      relationshipIds: [],
      missionId: mission.id,
      candidateId: candidate.id,
    };
    nextData = { ...data, cases: [...(data.cases ?? []), caseRecord], evidence: [...(data.evidence ?? []), evidenceRecord] };
  }
  const references = { caseId, evidenceId };
  const classified = classifyOpportunity(context, references);
  let opportunity;
  if (!(classified.status === 'opportunity' && mission.scope?.categories?.length && !mission.scope.categories.includes(classified.opportunity.category))) {
    const projected = opportunityProjector.projectInto(nextData, context, references);
    nextData = projected.data;
    opportunity = projected.result;
  }
  return { data: nextData, result: { caseId, evidenceId, duplicate, sourceUrl, opportunity } };
}

function findMission(data, missionId) {
  const mission = (data.agentMissions ?? []).find((item) => item?.id === missionId);
  if (!mission) throw new InboxError('AGENT_MISSION_NOT_FOUND', 'Agent mission was not found', 404);
  return mission;
}
function findGoal(data, goalId) {
  const goal = (data.goals ?? []).find((item) => item?.id === goalId);
  if (!goal) throw new InboxError('GOAL_NOT_FOUND', 'Goal was not found', 404);
  return goal;
}
function requireVerifying(mission) {
  if (mission.status !== 'running' || mission.executionPhase !== 'verifying' || !Array.isArray(mission.searchCandidates) || !mission.searchCandidates.length) {
    throw new InboxError('MISSION_NOT_VERIFYING', 'Mission has no pending search candidates to verify', 409);
  }
}
function requireSameCandidateBatch(expected, current) {
  requireVerifying(current);
  if (current.authorization?.id !== expected.authorization?.id || current.searchCandidateDigest !== expected.searchCandidateDigest) {
    throw new InboxError('MISSION_VERIFICATION_STALE', 'Mission authorization or candidate batch changed during verification', 409);
  }
}
function deterministicExecutionId(missionId, candidateId) {
  return `exec:web-read:${createHash('sha256').update(`${missionId}\n${candidateId}`).digest('hex')}`;
}
function requireKernel(kernel) {
  if (!kernel || typeof kernel.CapabilityRegistry !== 'function' || !kernel.PUBLIC_WEB_READ_CAPABILITY
    || typeof kernel.PublicWebReadExecutionAdapter !== 'function' || typeof kernel.evaluateAutomaticReadOnlyContinuation !== 'function') {
    throw new InboxError('KERNEL_RUNTIME_INVALID', 'Trusted Kernel runtime does not expose web.read verification contracts', 503);
  }
}
function unwrapModule(value) { return value?.default && typeof value.default === 'object' ? { ...value.default, ...value } : value; }
async function loadBuiltKernel() { try { return await import('../../packages/kernel/dist/index.js'); } catch { throw new InboxError('KERNEL_RUNTIME_UNAVAILABLE', 'Trusted Kernel runtime must be built before candidate verification', 503); } }
async function loadBuiltConnectors() { try { return await import('../../packages/connectors/dist/index.js'); } catch { throw new InboxError('CONNECTORS_RUNTIME_UNAVAILABLE', 'Trusted connectors runtime must be built before candidate verification', 503); } }
function conservativeAllowed(...sets) {
  const populated = sets.filter((values) => Array.isArray(values) && values.length > 0).map((values) => new Set(values));
  if (!populated.length) return [];
  return [...populated[0]].filter((value) => populated.every((set) => set.has(value)));
}
function union(...sets) { return [...new Set(sets.flatMap((values) => Array.isArray(values) ? values : []))]; }
function safeMessage(error) { return String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240); }
