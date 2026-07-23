// Auto Radar - Automatic browsing analysis for Efesto Opportunity Radar
// Implements automatic page analysis based on navigation events

const DEFAULT_KERNEL_BASE_URL = 'http://127.0.0.1:3737';

// Estados del Auto Radar
export const AUTO_RADAR_STATES = {
  PAUSED: 'paused',
  OBSERVING: 'observing',
  WAITING: 'waiting',
  EVALUATING: 'evaluating',
  IRRELEVANT: 'irrelevant',
  BLOCKED: 'blocked',
  DUPLICATE: 'duplicate',
  SUBMITTING: 'submitting',
  ADMITTED: 'admitted',
  REJECTED: 'rejected',
  NEEDS_RESEARCH: 'needs_research',
  FAILED: 'failed'
};

// Configuración por defecto
const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 horas
const DEFAULT_CONTENT_HASH_LENGTH = 12;
// Queue persistence key
const AUTO_RADAR_QUEUE_STORAGE_KEY = 'autoRadarQueue';
// Maximum retry attempts for a queued URL
const MAX_QUEUE_RETRY = 3;

export class AutoRadar {
  constructor() {
    this.state = AUTO_RADAR_STATES.PAUSED;
    this.lastUrl = null;
    this.lastAnalysisTime = 0;
    this.debounceTimer = null;
    this.pendingAnalysis = null;
    this.analysisHistory = new Map(); // Para deduplicación
    this.enabled = false;
    this.allowedOrigins = [];
    this.kernelBaseUrl = DEFAULT_KERNEL_BASE_URL;
    this.kernelApiToken = null;
    this.queue = []; // Queue of failed analyses to retry: [{url, timestamp, retryCount}]

    // Cargar estado almacenado
    this.loadState();
  }

  async loadState() {
    try {
      const stored = await chrome.storage.local.get([
        'autoRadarEnabled',
        'autoRadarState',
        'allowedOrigins',
        'kernelBaseUrl',
        'kernelApiToken',
        'debounceMs',
        'maxAgeMs',
        AUTO_RADAR_QUEUE_STORAGE_KEY
      ]);

      this.enabled = stored.autoRadarEnabled ?? false;
      this.state = stored.autoRadarState ?? AUTO_RADAR_STATES.PAUSED;
      this.allowedOrigins = stored.allowedOrigins ?? [];
      this.kernelBaseUrl = stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL;
      this.kernelApiToken = stored.kernelApiToken ?? null;

      // Restaurar historial de análisis (limitado)
      if (stored.analysisHistory) {
        this.analysisHistory = new Map(Object.entries(stored.analysisHistory));
      }

      // Restaurar cola
      if (stored[AUTO_RADAR_QUEUE_STORAGE_KEY]) {
        this.queue = stored[AUTO_RADAR_QUEUE_STORAGE_KEY];
      }
    } catch (error) {
      console.error('Error loading Auto Radar state:', error);
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        autoRadarEnabled: this.enabled,
        autoRadarState: this.state,
        allowedOrigins: this.allowedOrigins,
        kernelBaseUrl: this.kernelBaseUrl,
        kernelApiToken: this.kernelApiToken,
        debounceMs: DEFAULT_DEBOUNCE_MS,
        maxAgeMs: DEFAULT_MAX_AGE_MS,
        analysisHistory: Object.fromEntries(this.analysisHistory),
        [AUTO_RADAR_QUEUE_STORAGE_KEY]: this.queue
      });
    } catch (error) {
      console.error('Error saving Auto Radar state:', error);
    }
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    await this.saveState();
    await this.updateUI();
  }

  async setState(newState) {
    this.state = newState;
    await this.saveState();
    await this.updateUI();
  }

  async updateUI() {
    try {
      // Actualizar badge y tooltip del action
      let badgeText = '';
      let badgeColor = [0, 0, 0, 0]; // transparent
      let title = 'Efesto Opportunity Radar';

      switch (this.state) {
        case AUTO_RADAR_STATES.PAUSED:
          badgeText = '⏸';
          badgeColor = [128, 128, 128, 230]; // gris
          title += ' - Pausado';
          break;
        case AUTO_RADAR_STATES.OBSERVING:
          badgeText = '👁';
          badgeColor = [0, 150, 255, 230]; // azul
          title += ' - Observando';
          break;
        case AUTO_RADAR_STATES.WAITING:
          badgeText = '⏳';
          badgeColor = [255, 165, 0, 230]; // naranja
          title += ' - Esperando estabilización';
          break;
        case AUTO_RADAR_STATES.EVALUATING:
          badgeText = '🔍';
          badgeColor = [255, 255, 0, 230]; // amarillo
          title += ' - Evaluando';
          break;
        case AUTO_RADAR_STATES.IRRELEVANT:
          badgeText = '❌';
          badgeColor = [128, 128, 128, 230]; // gris
          title += ' - Irrelevante';
          break;
        case AUTO_RADAR_STATES.BLOCKED:
          badgeText = '🚫';
          badgeColor = [255, 0, 0, 230]; // rojo
          title += ' - Bloqueado';
          break;
        case AUTO_RADAR_STATES.DUPLICATE:
          badgeText = '🔄';
          badgeColor = [128, 0, 128, 230]; // púrpura
          title += ' - Duplicado';
          break;
        case AUTO_RADAR_STATES.SUBMITTING:
          badgeText = '📤';
          badgeColor = [0, 255, 0, 230]; // verde
          title += ' - Enviando';
          break;
        case AUTO_RADAR_STATES.ADMITTED:
          badgeText = '✅';
          badgeColor = [0, 200, 0, 230]; // verde oscuro
          title += ' - Admitido';
          break;
        case AUTO_RADAR_STATES.REJECTED:
          badgeText = '❌';
          badgeColor = [255, 0, 0, 230]; // rojo
          title += ' - Rechazado';
          break;
        case AUTO_RADAR_STATES.NEEDS_RESEARCH:
          badgeText = '🔬';
          badgeColor = [0, 150, 255, 230]; // azul
          title += ' - Necesita investigación';
          break;
        case AUTO_RADAR_STATES.FAILED:
          badgeText = '💥';
          badgeColor = [255, 69, 0, 230]; // rojo-naranja
          title += ' - Falló';
          break;
      }

      await chrome.action.setBadge({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
      await chrome.action.setTitle({ title });
    } catch (error) {
      console.error('Error updating Auto Radar UI:', error);
    }
  }

  isUrlAllowed(url) {
    try {
      const urlObj = new URL(url);

      // Solo http/https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { allowed: false, reason: 'unsupported_scheme' };
      }

      // Bloquear esquemas sensibles
      if ['chrome:', 'chrome-extension:', 'file:'].includes(urlObj.protocol)) {
        return { allowed: false, reason: 'blocked_scheme' };
      }

      // Bloquear localhost por defecto (configurable)
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === '::1') {
        return { allowed: false, reason: 'localhost_blocked' };
      }

      // Verificar si el origen está en la lista autorizada
      if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(urlObj.origin)) {
        return { allowed: false, reason: 'site_not_authorized' };
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, reason: 'invalid_url' };
    }
  }

  generateContentHash(context) {
    // Crear un hash mínimo basado en título y texto visible
    const text = `${context.title || ''}${context.visibleText || ''}`;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, DEFAULT_CONTENT_HASH_LENGTH);
  }

  isDuplicate(context) {
    const now = Date.now();
    const maxAge = DEFAULT_MAX_AGE_MS;

    // Limpiar entradas antiguas del historial
    for (const [key, timestamp] of this.analysisHistory.entries()) {
      if (now - timestamp > maxAge) {
        this.analysisHistory.delete(key);
      }
    }

    // Generar claves para deduplicación
    try {
      const urlObj = new URL(context.url);
      const urlCanonicalKey = `url:${urlObj.origin}${urlObj.pathname}`; // URL canónica (sin query params ni hash)
      const contentHash = this.generateContentHash(context);
      const contentHashKey = `hash:${contentHash}`;
      const domainTitleKey = `domain-title:${urlObj.hostname}:${context.title || ''}`;

      // Verificar si alguna clave existe en el historial
      const keys = [urlCanonicalKey, contentHashKey, domainTitleKey];
      for (const key of keys) {
        if (this.analysisHistory.has(key)) {
          return { duplicate: true, reason: key.split(':')[0] };
        }
      }

      // Agregar al historial
      const expiry = now + maxAge;
      this.analysisHistory.set(urlCanonicalKey, expiry);
      this.analysisHistory.set(contentHashKey, expiry);
      this.analysisHistory.set(domainTitleKey, expiry);

      return { duplicate: false };
    } catch (error) {
      return { duplicate: false, error: error.message };
    }
  }

  async analyzePage(tab) {
    if (!this.enabled || this.state === AUTO_RADAR_STATES.PAUSED) {
      return;
    }

    if (!tab?.id || !tab.url) {
      return;
    }

    // Cancelar cualquier análisis pendiente si cambia la URL
    if (this.lastUrl !== tab.url) {
      this.lastUrl = tab.url;
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.pendingAnalysis = null;
    }

    // Establecer estado a observando
    await this.setState(AUTO_RADAR_STATES.OBSERVING);

    // Esperar estabilización con debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      await this.evaluatePage(tab);
    }, DEFAULT_DEBOUNCE_MS);
  }

  async evaluatePage(tab) {
    try {
      // Estado a evaluando
      await this.setState(AUTO_RADAR_STATES.EVALUATING);

      // Capturar contexto de la página
      const captured = await chrome.tabs.sendMessage(tab.id, { type: 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT' });
      if (!captured?.ok) {
        await this.setState(AUTO_RADAR_STATES.FAILED);
        return;
      }

      const context = captured.context;

      // Verificar si la URL está permitida
      const urlCheck = this.isUrlAllowed(context.url);
      if (!urlCheck.allowed) {
        await this.setState(AUTO_RADAR_STATES.BLOCKED);
        // Esperar un momento antes de volver a observar
        setTimeout(() => this.setState(AUTO_RADAR_STATES.OBSERVING), 2000);
        return;
      }

      // Verificar si es duplicado
      const duplicateCheck = this.isDuplicate(context);
      if (duplicateCheck.duplicate) {
        await this.setState(AUTO_RADAR_STATES.DUPLICATE);
        // Esperar un momento antes de volver a observar
        setTimeout(() => this.setState(AUTO_RADAR_STATES.OBSERVING), 2000);
        return;
      }

      // TODO: Implementar Goal matching obteniendo Goals activos del Kernel
      // Por ahora, asumimos que siempre es relevante para probar el flujo
      // En el futuro, aquí llamaremos al endpoint del Kernel para obtener Goals y puntuar relevancia

      // Estado a enviando
      await this.setState(AUTO_RADAR_STATES.SUBMITTING);

      // Enviar al Kernel
      try {
        await sendPageContext(context, {
          baseUrl: this.kernelBaseUrl,
          apiToken: this.kernelApiToken,
        });

        // Estado admitido (asumimos que el Kernel lo admite por ahora)
        await this.setState(AUTO_RADAR_STATES.ADMITTED);

        // Guardar evento en storage
        await chrome.storage.local.set({
          lastRadarEvent: { status: 'admitted', title: context.title, at: Date.now() }
        });

        // Después de un breve momento, volver a observar
        setTimeout(() => this.setState(AUTO_RADAR_STATES.OBSERVING), 3000);
      } catch (error) {
        console.error('Error sending page context to Kernel:', error);
        await this.setState(AUTO_RADAR_STATES.REJECTED);

        // Guardar evento en storage
        await chrome.storage.local.set({
          lastRadarEvent: { status: 'rejected', at: Date.now() }
        });

        // Enqueue for retry if we haven't exceeded max retries
        await this.enqueueForRetry(context.url, context.title);

        // Después de un breve momento, volver a observar
        setTimeout(() => this.setState(AUTO_RADAR_STATES.OBSERVING), 3000);
      }
    } catch (error) {
      console.error('Error in Auto Radar evaluation:', error);
      await this.setState(AUTO_RADAR_STATES.FAILED);

      // Guardar evento en storage
      await chrome.storage.local.set({
        lastRadarEvent: { status: 'failed', at: Date.now() }
      });

      // Enqueue for retry if we haven't exceeded max retries
      await this.enqueueForRetry(tab.url, tab.title?.toString() ?? '');

      // Después de un breve momento, volver a observar
      setTimeout(() => this.setState(AUTO_RADAR_STATES.OBSERVING), 3000);
    }
  }

  /**
   * Enqueue a URL for retry when the Kernel is temporarily unavailable
   * @param {string} url - The URL that failed
   * @param {string} title - The page title (for logging/display)
   */
  async enqueueForRetry(url, title) {
    try {
      // Check if we already have this URL in the queue
      const existingIndex = this.queue.findIndex(item => item.url === url);
      if (existingIndex !== -1) {
        // Increment retry count if under max
        if (this.queue[existingIndex].retryCount < MAX_QUEUE_RETRY) {
          this.queue[existingIndex].retryCount++;
          this.queue[existingIndex].timestamp = Date.now();
        }
        // If at max, we keep it but don't increment (will be removed eventually by maxAge cleanup)
      } else {
        // Add new entry
        this.queue.push({
          url: url,
          title: title,
          timestamp: Date.now(),
          retryCount: 1
        });
      }

      // Save the updated queue
      await this.saveState();
    } catch (error) {
      console.error('Error enqueuing URL for retry:', error);
    }
  }

  /**
   * Process the queue of failed URLs, retrying those that are ready
   * @returns {Promise<void>}
   */
  async processQueue() {
    if (!this.enabled || this.state === AUTO_RADAR_STATES.PAUSED || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    const maxAge = DEFAULT_MAX_AGE_MS; // Same as analysis history max age

    // Process each queue entry
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];
      const age = now - item.timestamp;

      // Remove if too old (older than maxAge)
      if (age > maxAge) {
        this.queue.splice(i, 1);
        continue;
      }

      // We could implement a backoff strategy here, but for simplicity we'll just try
      // Note: We don't have the tab ID, so we cannot re-capture the page context.
      // This is a limitation: we can only retry if we have the page open in a tab.
      // For now, we'll skip the actual retry and just rely on the tab-based retry when the user revisits.
      // In the future, we might want to store the minimal context (title, visibleText) but that's risky for privacy.
      // Given the privacy-first approach, we will not store page content for retry.
      // Instead, we will rely on the user revisiting the page to trigger a new analysis.
      // So, we will simply remove old queue entries and keep the queue for now as a placeholder.
      // Actually, we can't do much without the tab context. We'll just clean old entries.
    }

    // Save the cleaned queue
    await this.saveState();
  }
}