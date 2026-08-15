/**
 * Provider-neutral definitions shared by the Kernel catalog and Goal plan.
 * These definitions describe the contract, not a connected account. A
 * provider becomes ready only when its adapter reports verified state.
 */
export const EXTERNAL_INTEGRATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'github',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(github|git hub|repository|repositories|repo|repos|pull request|pull requests|issue|issues|commit|commits|ci|open source|codigo|código|software)\b/u,
    scopes: Object.freeze(['github.read']),
    capabilities: Object.freeze([
      'github.repository.read',
      'github.issue.read',
      'github.pull_request.read',
      'github.checks.read',
    ]),
    readOnly: true,
    requiresExplicitConsent: true,
    action: 'settings',
  }),
  Object.freeze({
    id: 'gmail',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(gmail|email|emails|e-mail|correo|correos|inbox|bandeja|mensaje|mensajes)\b/u,
    scopes: Object.freeze(['gmail.read']),
    capabilities: Object.freeze(['gmail.message.read', 'gmail.thread.read']),
    readOnly: true,
    requiresExplicitConsent: true,
    action: 'settings',
  }),
  Object.freeze({
    id: 'google-drive',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google drive|drive|documento|documentos|document|documents|hoja|hojas|sheet|sheets)\b/u,
    scopes: Object.freeze(['drive.read']),
    capabilities: Object.freeze(['drive.file.read', 'drive.search']),
    readOnly: true,
    requiresExplicitConsent: true,
    action: 'settings',
  }),
  Object.freeze({
    id: 'notion',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(notion|pagina de notion|página de notion|notas|note|notes|wiki|base de conocimiento|knowledge base)\b/u,
    scopes: Object.freeze(['notion.read']),
    capabilities: Object.freeze(['notion.page.read', 'notion.search']),
    readOnly: true,
    requiresExplicitConsent: true,
    action: 'settings',
  }),
  Object.freeze({
    id: 'google-calendar',
    adapter: 'mcp',
    reason: 'goal_signal',
    pattern: /\b(google calendar|calendar|calendario|evento|eventos|event|events|reunion|reunión|reuniones|meeting|meetings|agenda|disponibilidad|availability)\b/u,
    scopes: Object.freeze(['calendar.read']),
    capabilities: Object.freeze(['calendar.event.read', 'calendar.search']),
    readOnly: true,
    requiresExplicitConsent: true,
    action: 'settings',
  }),
]);

export function externalIntegrationDefinition(id) {
  return EXTERNAL_INTEGRATION_DEFINITIONS.find((definition) => definition.id === id);
}
