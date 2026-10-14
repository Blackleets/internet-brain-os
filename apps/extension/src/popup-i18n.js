// Popup message catalog. English is the default and the key-by-key fallback.
export const POPUP_LOCALES = ['en', 'es', 'pt', 'fr', 'de'];
export const POPUP_LOCALE_NAMES = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch' };
export const POPUP_LOCALE_KEY = 'popupLocale';

const en = {
  connected: 'Connected', connecting: 'Connecting…', offline: 'Efesto is not running',
  analyze: 'Analyze this page', analyzing: 'Analyzing…', pageHelp: 'Save it as private evidence. Efesto verifies sources before calling anything a Find.',
  saved: 'Saved as private evidence. It is not a Find until the Kernel verifies it.', notPublic: 'This page can’t be analyzed (only public http/https pages).', failed: 'Efesto could not save this page.',
  goal: 'Or describe a Goal…', goalSaved: 'Goal saved. Confirm it in Efesto to start the research.', goalFailed: 'The Goal could not be saved.', sendGoal: 'Save Goal',
  open: 'Open Efesto', advanced: 'Advanced', manual: 'Pair manually with a code (only if auto-connect fails)', code: '8-character code', pair: 'Pair', pairing: 'Pairing…',
  paired: 'Connected to your Efesto.', pairFailed: 'That code was rejected or expired.', language: 'Language',
  first: 'Connecting to Efesto on this computer', firstSub: 'No codes to copy. Efesto must be running (desktop shortcut “Efesto”).',
  firstFailed: 'Could not reach Efesto on this computer. Open it with the “Efesto” shortcut and try again.', retry: 'Try again', disconnect: 'Disconnect',
};
const es = {
  connected: 'Conectado', connecting: 'Conectando…', offline: 'Efesto no está abierto',
  analyze: 'Analizar esta página', analyzing: 'Analizando…', pageHelp: 'Guárdala como evidencia privada. Efesto verifica las fuentes antes de llamar hallazgo a algo.',
  saved: 'Guardada como evidencia privada. No es un hallazgo hasta que el Kernel la verifique.', notPublic: 'Esta página no se puede analizar (solo páginas públicas http/https).', failed: 'Efesto no pudo guardar esta página.',
  goal: 'O describe un Goal…', goalSaved: 'Goal guardado. Confírmalo en Efesto para empezar la investigación.', goalFailed: 'No se pudo guardar el Goal.', sendGoal: 'Guardar Goal',
  open: 'Abrir Efesto', advanced: 'Avanzado', manual: 'Emparejar a mano con un código (solo si la conexión automática falla)', code: 'código de 8 caracteres', pair: 'Emparejar', pairing: 'Emparejando…',
  paired: 'Conectado a tu Efesto.', pairFailed: 'El código fue rechazado o caducó.', language: 'Idioma',
  first: 'Conectando con Efesto en este equipo', firstSub: 'Sin códigos que copiar. Efesto debe estar abierto (acceso directo «Efesto»).',
  firstFailed: 'No se encontró Efesto en este equipo. Ábrelo con el acceso directo «Efesto» y vuelve a intentarlo.', retry: 'Reintentar', disconnect: 'Desconectar',
};
const pt = {
  connected: 'Conectado', connecting: 'Conectando…', analyze: 'Analisar esta página', goal: 'Ou descreva um Goal…', open: 'Abrir Efesto', advanced: 'Avançado',
  code: 'código de 8 caracteres', pair: 'Parear', language: 'Idioma', first: 'Conectando ao Efesto neste computador', retry: 'Tentar de novo',
  pageHelp: 'Salve como evidência privada. O Efesto verifica as fontes antes de chamar algo de descoberta.',
  firstSub: 'Sem códigos para copiar. O Efesto precisa estar aberto (atalho “Efesto”).',
};
const fr = {
  connected: 'Connecté', connecting: 'Connexion…', analyze: 'Analyser cette page', goal: 'Ou décrivez un Goal…', open: 'Ouvrir Efesto', advanced: 'Avancé',
  code: 'code à 8 caractères', pair: 'Associer', language: 'Langue', first: 'Connexion à Efesto sur cet ordinateur', retry: 'Réessayer',
  pageHelp: 'Enregistrez-la comme preuve privée. Efesto vérifie les sources avant de parler de trouvaille.',
  firstSub: 'Aucun code à copier. Efesto doit être lancé (raccourci « Efesto »).',
};
const de = {
  connected: 'Verbunden', connecting: 'Verbinde…', analyze: 'Diese Seite analysieren', goal: 'Oder beschreibe ein Goal…', open: 'Efesto öffnen', advanced: 'Erweitert',
  code: '8-stelliger Code', pair: 'Koppeln', language: 'Sprache', first: 'Verbinde mit Efesto auf diesem Computer', retry: 'Erneut versuchen',
  pageHelp: 'Als privaten Beleg speichern. Efesto prüft die Quellen, bevor etwas als Fund gilt.',
  firstSub: 'Keine Codes zum Kopieren. Efesto muss laufen (Verknüpfung „Efesto“).',
};
export const POPUP_CATALOGS = { en, es, pt, fr, de };

export function detectPopupLocale(languages) {
  for (const tag of languages ?? []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (POPUP_LOCALES.includes(base)) return base;
  }
  return 'en';
}

export function popupT(locale, key) {
  return POPUP_CATALOGS[locale]?.[key] ?? en[key] ?? key;
}
