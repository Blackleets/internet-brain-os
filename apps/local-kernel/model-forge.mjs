import { cpus, totalmem } from 'node:os';

const CATALOG = Object.freeze([
  { id: 'qwen3:1.7b', label: 'Qwen 3 1.7B', minRamGiB: 4, tier: 'light', uses: ['summarization', 'classification'], multilingual: true },
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', minRamGiB: 6, tier: 'balanced', uses: ['summarization', 'research'], multilingual: true },
  { id: 'qwen3:4b', label: 'Qwen 3 4B', minRamGiB: 8, tier: 'balanced', uses: ['summarization', 'research', 'reasoning'], multilingual: true },
  { id: 'gemma3:4b', label: 'Gemma 3 4B', minRamGiB: 8, tier: 'balanced', uses: ['summarization', 'vision', 'reasoning'], multilingual: true },
  { id: 'qwen3:8b', label: 'Qwen 3 8B', minRamGiB: 16, tier: 'powerful', uses: ['research', 'reasoning'], multilingual: true },
]);

export class ModelForge {
  constructor(options = {}) {
    this.baseUrl = normalizeLoopbackUrl(options.baseUrl ?? 'http://127.0.0.1:11434');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 2_000;
    this.ramGiB = options.ramGiB ?? Math.max(1, Math.round(totalmem() / 1024 ** 3));
    this.cpuCores = options.cpuCores ?? cpus().length;
    this.activeModel = options.activeModel?.trim() || undefined;
  }

  async inspect() {
    const runtime = await this.#probeOllama();
    const installed = new Set(runtime.models);
    const models = CATALOG.map((model) => ({
      ...model,
      compatible: this.ramGiB >= model.minRamGiB,
      installed: installed.has(model.id) || installed.has(model.id.replace(/:latest$/, '')),
      active: this.activeModel === model.id,
    }));
    const active = models.find((model) => model.id === this.activeModel && model.compatible);
    const recommended = active?.id ?? models.findLast((model) => model.compatible)?.id ?? models[0].id;
    return {
      runtime: runtime.available ? 'available' : 'not_detected',
      hardware: { ramGiB: this.ramGiB, cpuCores: this.cpuCores, tier: hardwareTier(this.ramGiB) },
      activeModel: this.activeModel ?? null,
      recommended,
      models,
      setup: runtime.available
        ? {
          action: installed.has(recommended) ? 'configure' : 'pull',
          command: `ollama pull ${recommended}`,
          setting: `HEPHAESTUS_OLLAMA_MODEL=${recommended}`,
          restartRequired: true,
        }
        : { action: 'install_ollama', command: null, setting: null, restartRequired: true },
    };
  }

  async #probeOllama() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      if (!response.ok) return { available: false, models: [] };
      const payload = await response.json();
      const models = Array.isArray(payload?.models)
        ? payload.models.map((model) => model?.name).filter((name) => typeof name === 'string' && name.length <= 200)
        : [];
      return { available: true, models };
    } catch {
      return { available: false, models: [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

function hardwareTier(ramGiB) {
  if (ramGiB >= 16) return 'powerful';
  if (ramGiB >= 8) return 'balanced';
  return 'light';
}

function normalizeLoopbackUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Ollama URL must use HTTP on a loopback host');
  }
  return url.href.replace(/\/$/, '');
}
