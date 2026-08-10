export const healthResponse = {
  ok: true,
  service: 'hephaestus-local-kernel',
  hermes: false,
  replayLab: false,
};

export const statusResponse = {
  ok: true,
  service: 'hephaestus-local-kernel',
  kernel: 'ready',
  hermes: 'disabled',
  replayLab: 'disabled',
  ollama: 'not_configured',
  obsidian: 'not_configured',
};

export const bootstrapResponse = {
  schemaVersion: 'efesto.bootstrap-status.v1',
  ok: true,
  kernel: 'ready',
  hermes: 'ready',
  obsidian: 'ready',
  pairing: 'paired',
  overall: 'ready',
  message: 'Efesto is ready. Open the extension and press the central orb.',
  diagnostics: {
    kernel: { reachable: true, ok: true, service: 'hephaestus-local-kernel', port: 4000 },
    hermes: { found: true, valid: true },
    obsidian: { configured: true, writable: true, vaultRelativePath: 'configured vault' },
    pairing: { credentialPresent: true, paired: true, registryPresent: true },
  },
  actions: [{ id: 'open_efesto', label: 'Open Efesto', recoverable: false }],
};

export const casesResponse = {
  ok: true,
  cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }],
};

export const goalsResponse = {
  ok: true,
  goals: [{ id: 'goal-1', title: 'Find AI clients', priority: 3, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' }],
};

export const missionsResponse = {
  ok: true,
  missions: [{
    id: 'mission-1',
    goalId: 'goal-1',
    goalTitle: 'Find AI clients',
    agent: 'hermes',
    cadence: 'manual',
    status: 'running',
    executionPhase: 'investigating',
    attempt: 1,
    createdAt: '2026-07-26T10:00:00.000Z',
    investigatingAt: '2026-07-26T10:01:00.000Z',
  }],
};

export const opportunitiesResponse = {
  ok: true,
  opportunities: [{
    id: 'opportunity-1',
    evidenceId: 'evidence-1',
    caseId: 'case-1',
    category: 'client',
    categoryLabel: 'Potential client',
    benefitType: 'income',
    title: 'AI automation project',
    sourceUrl: 'https://clients.example/projects/ai-automation',
    sourceHost: 'clients.example',
    relevance: 72,
    reasons: ['seeking', 'budget'],
    nextAction: 'Qualify the need before contacting',
    status: 'new',
    detectedAt: '2026-07-26T10:00:00.000Z',
    goalMatches: [{ goalId: 'goal-1', title: 'Find AI clients', score: 80, reasons: ['Keywords: AI'] }],
    learnedAdjustment: 0,
    personalizedRelevance: 92,
  }],
};

export const modelForgeResponse = {
  ok: true,
  forge: {
    runtime: 'available',
    hardware: { ramGiB: 8, cpuCores: 4, tier: 'balanced' },
    activeModel: 'qwen3:4b',
    recommended: 'qwen3:4b',
    models: [
      { id: 'qwen3:1.7b', label: 'Qwen 3 1.7B', minRamGiB: 4, tier: 'light', uses: ['summarization', 'classification'], multilingual: true, compatible: true, installed: false, active: false },
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B', minRamGiB: 6, tier: 'balanced', uses: ['summarization', 'research'], multilingual: true, compatible: true, installed: false, active: false },
      { id: 'qwen3:4b', label: 'Qwen 3 4B', minRamGiB: 8, tier: 'balanced', uses: ['summarization', 'research', 'reasoning'], multilingual: true, compatible: true, installed: true, active: true },
      { id: 'gemma3:4b', label: 'Gemma 3 4B', minRamGiB: 8, tier: 'balanced', uses: ['summarization', 'vision', 'reasoning'], multilingual: true, compatible: true, installed: false, active: false },
      { id: 'qwen3:8b', label: 'Qwen 3 8B', minRamGiB: 16, tier: 'powerful', uses: ['research', 'reasoning'], multilingual: true, compatible: false, installed: false, active: false },
    ],
    setup: { action: 'pull', command: 'ollama pull qwen3:4b', setting: 'HEPHAESTUS_OLLAMA_MODEL=qwen3:4b', restartRequired: true },
  },
};

export const preferencesResponse = {
  ok: true,
  profile: {
    categories: {},
    benefitTypes: {},
    sources: {},
    eventCount: 2,
    productScorecard: {
      schemaVersion: 'efesto.product-scorecard.v1',
      sourceOfTruth: 'local_kernel',
      observedAt: '2026-08-10T16:00:00.000Z',
      privacy: { mode: 'local_only', externalTelemetry: false },
      primary: {
        goalUsefulFindRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
        timeToFirstUsefulFind: { status: 'measured', unit: 'milliseconds', value: 300000, reason: null, sampleCount: 1 },
        repeatGoalUsage: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'user_cohort_identity_unavailable', localExecutedGoalCount: 2, localRepeatGoalObserved: true },
      },
      drivers: {
        missionCompletionRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
        findsPerCompletedGoal: { status: 'measured', unit: 'count_per_goal', value: 1, reason: null, numerator: 1, denominator: 1 },
        usefulSavedFindShare: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
        installationToFirstGoalActivationRate: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'installation_cohort_not_recorded' },
        goalToNotificationDeliveryRate: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'notification_delivery_ledger_unavailable' },
      },
      guardrails: {
        missionFailureRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
        findDismissalNotInterestedRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
        alteredReplayAcceptance: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_event_ledger_unavailable', target: 0 },
        unauthorizedMemoryAdmission: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_event_ledger_unavailable', target: 0 },
        credentialPrivacyLeakageIncidents: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_incident_ledger_unavailable', target: 0 },
        packagedInstallRepairSuccess: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'release_ci_evidence_not_in_local_store', target: 1 },
      },
      coverage: { executedGoals: 2, completedGoals: 1, goalLinkedFinds: 2, feedbackEvents: 2, orphanFeedbackEvents: 0, invalidTimestampEvents: 0 },
    },
  },
};
