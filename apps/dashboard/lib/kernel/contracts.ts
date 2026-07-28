export type KernelUnknownFields = Record<string, unknown>;

export type KernelHealth = KernelUnknownFields & {
  ok: true;
  service: 'hephaestus-local-kernel';
  hermes: boolean;
  replayLab: boolean;
};

export type KernelStatus = KernelUnknownFields & {
  ok: true;
  service: 'hephaestus-local-kernel';
  kernel: 'ready';
  hermes: 'ready' | 'disabled';
  replayLab: 'ready' | 'disabled';
  ollama: 'configured' | 'not_configured';
  obsidian: 'configured' | 'not_configured';
};

export type BootstrapStatus = KernelUnknownFields & {
  schemaVersion: 'efesto.bootstrap-status.v1';
  ok: boolean;
  kernel: 'ready' | 'offline' | 'stale' | 'port_conflict' | 'failed';
  hermes: 'ready' | 'missing' | 'invalid' | 'failed';
  obsidian: 'ready' | 'not_configured' | 'unwritable' | 'failed';
  pairing: 'paired' | 'required' | 'invalid';
  overall: 'ready' | 'needs_setup' | 'failed';
  message: string;
  diagnostics: KernelUnknownFields;
  actions: Array<KernelUnknownFields & { id: string; label: string; recoverable: boolean }>;
};

export type CaseSummary = KernelUnknownFields & {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
};

export type GoalSummary = KernelUnknownFields & {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  status: 'active';
  createdAt: string;
};

export type MissionSummary = KernelUnknownFields & {
  id: string;
  goalId: string;
  status: 'waiting_for_agent' | 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  executionPhase?: 'queued' | 'investigating' | 'verifying' | 'forged' | 'failed';
  attempt?: number;
};

export type OpportunitySummary = KernelUnknownFields & {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  benefitType: string;
  sourceHost: string;
  relevance: number;
  nextAction: string;
  status: 'new' | 'dismissed';
  detectedAt: string;
};

export type ModelForgeSummary = KernelUnknownFields & {
  runtime: 'available' | 'not_detected';
  hardware: KernelUnknownFields & { ramGiB: number; cpuCores: number; tier: 'light' | 'balanced' | 'powerful' };
  activeModel: string | null;
  recommended: string;
  models: Array<KernelUnknownFields & {
    id: string;
    label: string;
    minRamGiB: number;
    tier: 'light' | 'balanced' | 'powerful';
    uses: string[];
    multilingual: boolean;
    compatible: boolean;
    installed: boolean;
    active: boolean;
  }>;
  setup: KernelUnknownFields & { action: 'configure' | 'pull' | 'install_ollama'; command: string | null; setting: string | null; restartRequired: boolean };
};
