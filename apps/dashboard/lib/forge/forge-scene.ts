import type { ForgeModel, ForgeSource } from './forge-model';

/**
 * Pure mapping from the Forge model (real Kernel data) to the visual elements the canvas draws.
 *
 * One visual element per real Kernel record, never more:
 * - spark  = a real search candidate URL of the mission (Hermes result, not Evidence);
 * - thread = a real Evidence record the Kernel stored after web.read (molten thread);
 * - gold   = a real Kernel SUPPORT verdict (thread tempers to gold steel, hammer strike, one ingot);
 * - ash    = a real rejection with its Kernel reason (no SUPPORT, or the page could not be read).
 * Atmosphere (glow, smoke, rising embers, the strike burst) carries no data and never counts.
 * With no candidates there are no sparks: queued/searching only breathe.
 */

export type ForgeSceneMood = 'off' | 'connecting' | 'idle' | 'waiting' | 'searching' | 'verifying' | 'gold' | 'ash' | 'alert';
/** live = the agent/Kernel is working; breathing = honest idle glow; still = no motion at all. */
export type ForgeSceneMotion = 'live' | 'breathing' | 'still';
export type ForgeElementKind = 'spark' | 'thread' | 'gold' | 'ash';

export type ForgeSceneElement = {
  id: string;
  host: string;
  url: string;
  /** Furthest visual stage this real record has reached. */
  kind: ForgeElementKind;
  /** Kernel reason for ash (no SUPPORT or failed read). */
  reason?: string;
  /** Ash from a failed web.read never had Evidence, so it never draws a molten thread. */
  readFailed?: boolean;
  evidenceId?: string;
};

export type ForgeScene = {
  mood: ForgeSceneMood;
  motion: ForgeSceneMotion;
  elements: ForgeSceneElement[];
  counts: { sparks: number; threads: number; gold: number; ash: number };
  /** Search pulse around the anvil while Hermes searches and no candidate URL exists yet. */
  searchPulse: boolean;
};

export function buildForgeScene(model: ForgeModel): ForgeScene {
  if (model.kind === 'offline') {
    return empty(model.reason === 'connecting' ? 'connecting' : 'off', model.reason === 'connecting' ? 'breathing' : 'still');
  }
  if (model.kind === 'empty') return empty('idle', 'breathing');
  const elements = model.sources.map(elementFor);
  const counts = {
    sparks: elements.length,
    threads: elements.filter((item) => item.kind === 'thread' || item.kind === 'gold' || (item.kind === 'ash' && !item.readFailed)).length,
    gold: elements.filter((item) => item.kind === 'gold').length,
    ash: elements.filter((item) => item.kind === 'ash').length,
  };
  const mood = moodFor(model.phase, counts.gold);
  const motion: ForgeSceneMotion = model.motion === 'active' && (model.phase === 'searching' || model.phase === 'verifying')
    ? 'live'
    : model.phase === 'failed' || model.phase === 'blocked' ? 'still' : 'breathing';
  return { mood, motion, elements, counts, searchPulse: model.phase === 'searching' && elements.length === 0 };
}

function empty(mood: ForgeSceneMood, motion: ForgeSceneMotion): ForgeScene {
  return { mood, motion, elements: [], counts: { sparks: 0, threads: 0, gold: 0, ash: 0 }, searchPulse: false };
}

function elementFor(source: ForgeSource): ForgeSceneElement {
  const base = { id: source.id, host: source.host, url: source.url };
  switch (source.state) {
    case 'candidate': return { ...base, kind: 'spark' };
    case 'evidence': return { ...base, kind: 'thread', ...(source.evidenceId ? { evidenceId: source.evidenceId } : {}) };
    case 'supported': return { ...base, kind: 'gold', ...(source.evidenceId ? { evidenceId: source.evidenceId } : {}) };
    case 'unsupported': return { ...base, kind: 'ash', reason: source.reason ?? 'Sin Kernel SUPPORT', ...(source.evidenceId ? { evidenceId: source.evidenceId } : {}) };
    case 'read_failed': return { ...base, kind: 'ash', readFailed: true, reason: source.reason ?? 'El Kernel no pudo leer la página' };
  }
}

function moodFor(phase: Extract<ForgeModel, { kind: 'mission' }>['phase'], gold: number): ForgeSceneMood {
  switch (phase) {
    case 'waiting_agent':
    case 'queued': return 'waiting';
    case 'searching': return 'searching';
    case 'verifying': return 'verifying';
    case 'forged': return 'gold';
    case 'failed':
    case 'blocked': return 'alert';
    default: return gold > 0 ? 'gold' : 'ash';
  }
}
