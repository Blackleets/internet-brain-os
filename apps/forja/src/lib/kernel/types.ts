export type GoalStatus =
  | "draft"
  | "researching"
  | "complete"
  | "blocked"
  | "failed";

export type ResearchStage =
  | "understood"
  | "searching"
  | "reading"
  | "verifying"
  | "interpreting"
  | "complete"
  | "blocked"
  | "failed";

export type EvidenceValidation = "retrieved" | "rejected" | "blocked";

export type FindingConfidence = "low" | "medium" | "high";

export type MemoryLifecycle =
  | "proposed"
  | "quarantined"
  | "admitted"
  | "superseded"
  | "revoked"
  | "rejected";

export type MemoryActor = "operator" | "kernel";

export type MemoryPolicy =
  | "kernel-propose"
  | "operator-admission"
  | "operator-quarantine"
  | "operator-revoke"
  | "supersede-tensed"
  | "admission-gate"
  | "learning-offer";

export type DeltaKind = "novel" | "confirmed" | "tension";

export type WatchStatus = "stable" | "changed" | "missing" | "blocked";

export type SealInstrument = "INCORPORAR" | "RELEER" | "REINTERPRETAR" | "NADA";

export type ContradictionKind =
  | "evidence-evidence"
  | "memory-memory"
  | "evidence-memory"
  | "interpretation-interpretation";

export type ContradictionPoleKind = "evidence" | "memory" | "seal";

export interface ContradictionPole {
  kind: ContradictionPoleKind;
  id: string;
  label: string;
  fingerprint?: string;
}

export interface ContradictionDraft {
  kind: ContradictionKind;
  goalId: string;
  left: ContradictionPole;
  right: ContradictionPole;
  note: string;
  findingId?: string;
  sealId?: string;
  open: boolean;
  at?: string;
  closedAt?: string;
}

export interface Contradiction extends ContradictionDraft {
  id: string;
  at: string;
}

export type LearningOriginKind =
  | "finding"
  | "pattern"
  | "contradiction"
  | "evidence-change"
  | "historical-result"
  | "operator-feedback"
  | "kernel-signal";

export type LearningStatus =
  | "open"
  | "blocked"
  | "duplicate"
  | "reinforcement"
  | "ready"
  | "proposed"
  | "admitted"
  | "rejected"
  | "contradicted";

export type LearningRelation =
  | "novel"
  | "duplicate"
  | "reinforcement"
  | "refinement"
  | "contradiction";

export type LearningActor = "kernel" | "operator";

export type LearningPolicy =
  | "kernel-observe"
  | "kernel-validate"
  | "kernel-classify"
  | "authority-offer"
  | "operator-admission"
  | "operator-reject";

export interface LearningOrigin {
  kind: LearningOriginKind;
  note: string;
  goalIds: string[];
  findingIds: string[];
  evidenceIds: string[];
  contradictionIds: string[];
  sealIds: string[];
  memoryIds: string[];
}

export interface LearningCandidate {
  id: string;
  createdAt: string;
  status: LearningStatus;
  relation: LearningRelation;
  title: string;
  proposal: string;
  origin: LearningOrigin;
  evidenceIds: string[];
  findingIds: string[];
  caseIds: string[];
  relatedMemoryIds: string[];
  contradictionIds: string[];
  relatedCandidateId?: string;
  relatedMemoryId?: string;
  memoryId?: string;
  blockedReason?: string;
  closedAt?: string;
}

export interface LearningDecision {
  id: string;
  candidateId: string;
  at: string;
  from: LearningStatus | null;
  to: LearningStatus;
  why: string;
  actor: LearningActor;
  policy: LearningPolicy;
  memoryId?: string;
  findingId?: string;
  evidenceIds?: string[];
}

export type ConfidenceBand = "very-low" | "low" | "medium" | "high" | "very-high";

export type ConfidenceSubjectKind = "finding" | "seal";

export type ConfidenceSignalKind =
  | "independent-evidence"
  | "coverage"
  | "stability"
  | "quality"
  | "concordant-evidence"
  | "incompatible-evidence"
  | "open-evidence-memory"
  | "open-memory-memory"
  | "interpretation-shift"
  | "resolved-contradiction"
  | "live-memory-support"
  | "superseded-memory"
  | "revoked-memory"
  | "incomplete-provenance"
  | "freshness";

export interface ConfidenceWeights {
  base: number;
  independentSource: number;
  independentSourceCap: number;
  coverage: number;
  stability: number;
  quality: number;
  concordant: number;
  openEvidenceEvidence: number;
  openEvidenceMemory: number;
  openMemoryMemory: number;
  interpretationShift: number;
  resolvedContradiction: number;
  resolvedCap: number;
  liveMemorySupport: number;
  incompleteProvenance: number;
}

export interface ConfidenceCaps {
  min: number;
  max: number;
  incompleteProvenanceMax: number;
  openEvidenceContradictionMax: number;
}

export interface ConfidencePolicy {
  id: string;
  version: number;
  algorithm: string;
  label: string;
  weights: ConfidenceWeights;
  caps: ConfidenceCaps;
}

export interface ConfidenceSignal {
  kind: ConfidenceSignalKind;
  note: string;
  delta: number;
  evidenceIds?: string[];
  memoryIds?: string[];
  contradictionIds?: string[];
}

export interface ConfidenceRecord {
  id: string;
  subjectKind: ConfidenceSubjectKind;
  findingId?: string;
  sealId?: string;
  evidenceIds: string[];
  memoryIds: string[];
  contradictionIds: string[];
  learningCandidateId?: string;
  calculatedAt: string;
  policyId: string;
  policyVersion: number;
  algorithm: string;
  version: number;
  score: number;
  band: ConfidenceBand;
  reasons: ConfidenceSignal[];
  inputHash: string;
  previousId?: string;
  changeNote?: string;
}

export interface Lead {
  title: string;
  url: string;
  snippet: string;
  sourceHost: string;
  kind?: string;
  provider?: string;
}

export interface DiscoverySnapshot {
  queries: string[];
  providers: Array<{
    name: string;
    status: "ok" | "empty" | "fail" | "blocked";
    hitCount: number;
    error?: string;
  }>;
  found: number;
  usable: number;
  domains: string[];
  kinds?: Record<string, number>;
  extracted?: number;
  readFailures?: string[];
}

export interface Goal {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  status: GoalStatus;
  stage: ResearchStage;
  blockedReason?: string;
  evidenceIds: string[];
  findingIds: string[];
  leadCount: number;
  leads: Lead[];
  discovery?: DiscoverySnapshot;
  watched: boolean;
  lastWatchAt?: string;
  lastWatchSummary?: string;
  spawnedFromGoalId?: string;
  spawnedFromDossierId?: string;
}

export interface Evidence {
  id: string;
  goalId: string;
  url: string;
  title: string;
  sourceHost: string;
  excerpt: string;
  contentHash: string;
  retrievedAt: string;
  httpStatus: number;
  bytes: number;
  validation: EvidenceValidation;
  /** Same observation already held by the kernel, re-admitted for this case. */
  reused?: boolean;
}

export interface Finding {
  id: string;
  goalId: string;
  title: string;
  answer: string;
  whyItMatters: string;
  confidence: FindingConfidence;
  evidenceIds: string[];
  uncertainties: string[];
  nextAction: string;
  interpretationAvailable: boolean;
  createdAt: string;
  delta?: DeltaKind;
  deltaNote?: string;
  deltaMemoryId?: string;
}

export interface MemoryRecord {
  id: string;
  findingId: string;
  goalId: string;
  title: string;
  why: string;
  evidenceIds: string[];
  proposedAt?: string;
  admittedAt: string;
  closedAt?: string;
  lifecycle: MemoryLifecycle;
  informedGoalIds: string[];
  supersedesId?: string;
  supersededById?: string;
  candidateId?: string;
}

export interface MemoryDecision {
  id: string;
  memoryId: string;
  at: string;
  from: MemoryLifecycle | null;
  to: MemoryLifecycle;
  why: string;
  actor: MemoryActor;
  policy: MemoryPolicy;
  findingId?: string;
  evidenceIds?: string[];
  relatedMemoryId?: string;
  candidateId?: string;
}

/** Frozen consult of memory at seal time. Not evidence. */
export interface KnownMemorySnapshot {
  memoryId: string;
  title: string;
  findingId: string;
  goalId: string;
  admittedAt: string;
  lifecycle: MemoryLifecycle;
  whyHash: string;
  consultedAt: string;
}

export interface Dossier {
  id: string;
  goalId: string;
  sealedAt: string;
  sealHash: string;
  executive: string;
  known: KnownMemorySnapshot[];
  /** Fingerprint of the memory context used at seal time. Not an evidence hash. */
  memoryContextHash: string;
  novel: string[];
  confirmed: string[];
  tensions: string[];
  uncertain: string[];
  next: string;
  findingIds: string[];
  evidenceIds: string[];
  evidenceHashes: string[];
  sourceHosts: string[];
  interpretationAvailable: boolean;
  memoryConsulted: number;
  reusedCount: number;
  /** Previous seal for this case, if this dossier replaced one. */
  supersedesId?: string;
}

export interface WatchObservation {
  url: string;
  sourceHost: string;
  previousHash: string;
  currentHash?: string;
  status: WatchStatus;
  previousEvidenceId: string;
  newEvidenceId?: string;
}

export interface WatchPass {
  id: string;
  goalId: string;
  at: string;
  observations: WatchObservation[];
  stable: number;
  changed: number;
  missing: number;
  blocked: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
}

export type KernelActor = "operator" | "kernel" | "replay";

export type KernelComponent =
  | "investigation"
  | "admission"
  | "authority"
  | "contradiction"
  | "learning"
  | "confidence"
  | "seal"
  | "replay"
  | "watch"
  | "chat"
  | "observability"
  | "ai";

export type ActivityKind =
  | "goal.created"
  | "search.completed"
  | "search.blocked"
  | "evidence.admitted"
  | "evidence.rejected"
  | "finding.admitted"
  | "memory.proposed"
  | "memory.admitted"
  | "memory.forgotten"
  | "memory.revoked"
  | "memory.superseded"
  | "memory.rejected"
  | "memory.quarantined"
  | "memory.consulted"
  | "dossier.sealed"
  | "dossier.replayed"
  | "contradiction.recorded"
  | "contradiction.resolved"
  | "learning.observed"
  | "learning.validated"
  | "learning.blocked"
  | "learning.duplicate"
  | "learning.reinforced"
  | "learning.proposed"
  | "learning.rejected"
  | "confidence.evaluated"
  | "confidence.changed"
  | "watch.completed"
  | "research.blocked"
  | "research.failed"
  | "chat.message"
  | "ai.completed"
  | "ai.failed"
  | "ai.fallback";

export interface ActivityRefs {
  evidenceIds?: string[];
  memoryIds?: string[];
  findingIds?: string[];
  sealIds?: string[];
  hashes?: string[];
}

export interface ActivityCausal {
  causedBy?: string;
  triggeredBy?: string;
  supersedes?: string;
  derivedFrom?: string[];
  previous?: string;
  next?: string;
}

export interface ActivityAI {
  provider: string;
  model: string;
  modelVersion?: string;
  operation: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  fallbackFrom?: { provider: string; model: string };
}

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: KernelActor;
  source: KernelComponent;
  summary: string;
  correlationId: string;
  goalId?: string;
  evidenceId?: string;
  findingId?: string;
  dossierId?: string;
  memoryId?: string;
  contradictionId?: string;
  learningCandidateId?: string;
  confidenceId?: string;
  provenance?: ActivityRefs;
  causal?: ActivityCausal;
  policy?: string;
  ai?: ActivityAI;
}

export interface KernelState {
  goals: Goal[];
  evidence: Evidence[];
  findings: Finding[];
  memory: MemoryRecord[];
  memoryDecisions: MemoryDecision[];
  dossiers: Dossier[];
  watchPasses: WatchPass[];
  contradictions: Contradiction[];
  learning: LearningCandidate[];
  learningDecisions: LearningDecision[];
  confidence: ConfidenceRecord[];
  activity: ActivityEvent[];
  chat: ChatMessage[];
}
