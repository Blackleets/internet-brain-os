// Efesto message catalog. English is the source and the fallback; every other locale may be partial
// and falls back key-by-key to English. Keys are stable ids, never sentences.
export const LOCALES = ['en', 'es', 'pt', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch' };

const en = {
  'nav.home': 'Home', 'nav.goals': 'Goals', 'nav.finds': 'Finds', 'nav.evidence': 'Evidence', 'nav.memory': 'Memory', 'nav.activity': 'Activity',
  'nav.models': 'Models', 'nav.agents': 'Agents', 'nav.settings': 'Settings',
  'sidebar.create': 'Create', 'sidebar.workspace': 'Workspace', 'sidebar.activeGoals': 'Active goals', 'sidebar.system': 'System',
  'sidebar.newGoal': 'New Goal', 'sidebar.newChat': 'New chat', 'sidebar.newChatTitle': 'New conversation', 'sidebar.kernel': 'Local Kernel',
  'sidebar.areas': 'Efesto areas', 'sidebar.closeMenu': 'Close menu',
  'top.localFirst': 'Local first', 'top.private': 'Private by design', 'top.refresh': 'Refresh status', 'top.toggleNav': 'Toggle navigation',
  'chip.disconnected': 'Disconnected', 'chip.connecting': 'Connecting', 'chip.connected': 'Connected', 'chip.noResponse': 'No response', 'chip.port': 'port {port}',
  'home.lede': 'Describe what you want to achieve. Efesto researches, verifies the sources and brings you findings backed by evidence.',
  'home.placeholderGoal': 'Describe your Goal…', 'home.placeholderChat': 'Ask anything…', 'home.placeholderNoModel': 'Pick a model in “Local models” to chat…',
  'home.modeVerified': 'verified', 'home.chipFinds': 'Finds', 'home.chipModels': 'Local models',
  'settings.title': 'Settings', 'settings.eyebrow': 'Owner control', 'settings.copy': 'Local connection, status and recovery. Secrets are never shown.',
  'settings.device': 'This device', 'settings.connected': 'Connected', 'settings.connectKernel': 'Connect Kernel', 'settings.autoConnect': 'Connect automatically',
  'settings.connecting': 'Connecting…', 'settings.autoHelp': 'Efesto connects only to your local Kernel (on this computer). No code to copy.',
  'settings.advanced': 'Advanced', 'settings.checkNow': 'Check now', 'settings.disconnect': 'Disconnect', 'settings.realStatus': 'Real status',
  'settings.extensionOptional': 'Extension (optional)', 'settings.language': 'Language',
  'status.ready': 'ready', 'status.online': 'online', 'status.offline': 'offline', 'status.connected': 'connected', 'status.needs_setup': 'needs setup',
  'status.degraded': 'partial', 'status.partial': 'partial', 'status.missing': 'not installed', 'status.unavailable': 'unavailable', 'status.paired': 'paired',
  'status.unused': 'not used', 'status.blocked': 'blocked', 'status.unconfigured': 'not configured', 'status.error': 'error',
} as const;
export type MessageKey = keyof typeof en;
type Catalog = Partial<Record<MessageKey, string>>;

const es: Catalog = {
  'nav.home': 'Inicio', 'nav.goals': 'Objetivos', 'nav.finds': 'Hallazgos', 'nav.evidence': 'Evidencia', 'nav.memory': 'Memoria', 'nav.activity': 'Actividad',
  'nav.models': 'Modelos', 'nav.agents': 'Agentes', 'nav.settings': 'Ajustes',
  'sidebar.create': 'Crear', 'sidebar.workspace': 'Espacio de trabajo', 'sidebar.activeGoals': 'Objetivos activos', 'sidebar.system': 'Sistema',
  'sidebar.newGoal': 'Nuevo Goal', 'sidebar.newChat': 'Nuevo chat', 'sidebar.newChatTitle': 'Nueva conversación', 'sidebar.kernel': 'Kernel local',
  'sidebar.areas': 'Áreas de Efesto', 'sidebar.closeMenu': 'Cerrar menú',
  'top.localFirst': 'Primero local', 'top.private': 'Privado por diseño', 'top.refresh': 'Actualizar estado', 'top.toggleNav': 'Alternar navegación',
  'chip.disconnected': 'Sin conexión', 'chip.connecting': 'Conectando', 'chip.connected': 'Conectado', 'chip.noResponse': 'Sin respuesta', 'chip.port': 'puerto {port}',
  'home.lede': 'Describe lo que quieres lograr. Efesto investiga, verifica las fuentes y te trae hallazgos con evidencia.',
  'home.placeholderGoal': 'Describe tu Goal…', 'home.placeholderChat': 'Pregunta lo que quieras…', 'home.placeholderNoModel': 'Elige un modelo en «Modelos locales» para chatear…',
  'home.modeVerified': 'con verificación', 'home.chipFinds': 'Hallazgos', 'home.chipModels': 'Modelos locales',
  'settings.title': 'Ajustes', 'settings.eyebrow': 'Control del propietario', 'settings.copy': 'Conexión local, estado y recuperación. Los secretos nunca se muestran.',
  'settings.device': 'Dispositivo actual', 'settings.connected': 'Conectado', 'settings.connectKernel': 'Conectar Kernel', 'settings.autoConnect': 'Conectar automáticamente',
  'settings.connecting': 'Conectando…', 'settings.autoHelp': 'Efesto se conecta solo a tu Kernel local (en este equipo). No hace falta copiar ningún código.',
  'settings.advanced': 'Avanzado', 'settings.checkNow': 'Comprobar ahora', 'settings.disconnect': 'Desconectar', 'settings.realStatus': 'Estado real',
  'settings.extensionOptional': 'Extensión (opcional)', 'settings.language': 'Idioma',
  'status.ready': 'listo', 'status.online': 'en línea', 'status.offline': 'sin conexión', 'status.connected': 'conectado', 'status.needs_setup': 'falta configurar algo',
  'status.degraded': 'parcial', 'status.partial': 'parcial', 'status.missing': 'no instalado', 'status.unavailable': 'no disponible', 'status.paired': 'emparejada',
  'status.unused': 'no usada', 'status.blocked': 'bloqueado', 'status.unconfigured': 'sin configurar', 'status.error': 'error',
};

const pt: Catalog = {
  'nav.home': 'Início', 'nav.goals': 'Objetivos', 'nav.finds': 'Descobertas', 'nav.evidence': 'Evidências', 'nav.memory': 'Memória', 'nav.activity': 'Atividade',
  'nav.models': 'Modelos', 'nav.agents': 'Agentes', 'nav.settings': 'Configurações',
  'sidebar.create': 'Criar', 'sidebar.workspace': 'Área de trabalho', 'sidebar.activeGoals': 'Objetivos ativos', 'sidebar.system': 'Sistema',
  'sidebar.newGoal': 'Novo Goal', 'sidebar.newChat': 'Novo chat', 'sidebar.kernel': 'Kernel local',
  'top.localFirst': 'Local primeiro', 'top.private': 'Privado por design',
  'chip.disconnected': 'Desconectado', 'chip.connecting': 'Conectando', 'chip.connected': 'Conectado', 'chip.noResponse': 'Sem resposta', 'chip.port': 'porta {port}',
  'home.lede': 'Descreva o que você quer alcançar. O Efesto pesquisa, verifica as fontes e traz descobertas com evidências.',
  'home.placeholderGoal': 'Descreva seu Goal…', 'home.modeVerified': 'verificado', 'home.chipFinds': 'Descobertas', 'home.chipModels': 'Modelos locais',
  'settings.title': 'Configurações', 'settings.connected': 'Conectado', 'settings.autoConnect': 'Conectar automaticamente', 'settings.advanced': 'Avançado',
  'settings.checkNow': 'Verificar agora', 'settings.disconnect': 'Desconectar', 'settings.language': 'Idioma',
};

const fr: Catalog = {
  'nav.home': 'Accueil', 'nav.goals': 'Objectifs', 'nav.finds': 'Trouvailles', 'nav.evidence': 'Preuves', 'nav.memory': 'Mémoire', 'nav.activity': 'Activité',
  'nav.models': 'Modèles', 'nav.agents': 'Agents', 'nav.settings': 'Réglages',
  'sidebar.create': 'Créer', 'sidebar.workspace': 'Espace de travail', 'sidebar.activeGoals': 'Objectifs actifs', 'sidebar.system': 'Système',
  'sidebar.newGoal': 'Nouveau Goal', 'sidebar.newChat': 'Nouvelle discussion', 'sidebar.kernel': 'Kernel local',
  'top.localFirst': 'Local d’abord', 'top.private': 'Privé par conception',
  'chip.disconnected': 'Déconnecté', 'chip.connecting': 'Connexion', 'chip.connected': 'Connecté', 'chip.noResponse': 'Pas de réponse', 'chip.port': 'port {port}',
  'home.lede': 'Décrivez ce que vous voulez accomplir. Efesto recherche, vérifie les sources et vous apporte des trouvailles étayées.',
  'home.placeholderGoal': 'Décrivez votre Goal…', 'home.modeVerified': 'vérifié', 'home.chipFinds': 'Trouvailles', 'home.chipModels': 'Modèles locaux',
  'settings.title': 'Réglages', 'settings.connected': 'Connecté', 'settings.autoConnect': 'Connexion automatique', 'settings.advanced': 'Avancé',
  'settings.checkNow': 'Vérifier', 'settings.disconnect': 'Déconnecter', 'settings.language': 'Langue',
};

const de: Catalog = {
  'nav.home': 'Start', 'nav.goals': 'Ziele', 'nav.finds': 'Funde', 'nav.evidence': 'Belege', 'nav.memory': 'Gedächtnis', 'nav.activity': 'Aktivität',
  'nav.models': 'Modelle', 'nav.agents': 'Agenten', 'nav.settings': 'Einstellungen',
  'sidebar.create': 'Erstellen', 'sidebar.workspace': 'Arbeitsbereich', 'sidebar.activeGoals': 'Aktive Ziele', 'sidebar.system': 'System',
  'sidebar.newGoal': 'Neues Goal', 'sidebar.newChat': 'Neuer Chat', 'sidebar.kernel': 'Lokaler Kernel',
  'top.localFirst': 'Lokal zuerst', 'top.private': 'Privat by Design',
  'chip.disconnected': 'Getrennt', 'chip.connecting': 'Verbinde', 'chip.connected': 'Verbunden', 'chip.noResponse': 'Keine Antwort', 'chip.port': 'Port {port}',
  'home.lede': 'Beschreibe, was du erreichen willst. Efesto recherchiert, prüft die Quellen und liefert belegte Funde.',
  'home.placeholderGoal': 'Beschreibe dein Goal…', 'home.modeVerified': 'geprüft', 'home.chipFinds': 'Funde', 'home.chipModels': 'Lokale Modelle',
  'settings.title': 'Einstellungen', 'settings.connected': 'Verbunden', 'settings.autoConnect': 'Automatisch verbinden', 'settings.advanced': 'Erweitert',
  'settings.checkNow': 'Jetzt prüfen', 'settings.disconnect': 'Trennen', 'settings.language': 'Sprache',
};

export const CATALOGS: Record<Locale, Catalog> = { en, es, pt, fr, de };
export const EN: Record<MessageKey, string> = en;
