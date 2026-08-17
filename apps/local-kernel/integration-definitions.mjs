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
    // Generic words such as "software" or "código" belong to public
    // research. A private connector is selected only by an explicit GitHub
    // or repository signal.
    pattern: /\b(github|git hub|repository|repositories|repo|repos|pull request|pull requests|issue|issues|commit|commits|ci)\b/u,
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
    pattern: /\b(gmail|e-?mail|correo|correos|inbox|bandeja de entrada)\b/u,
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
    pattern: /\b(google drive|drive de google)\b/u,
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
    pattern: /\b(notion|pagina de notion|notas de notion|notion notes)\b/u,
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
    pattern: /\b(google calendar|calendario de google|mi calendario|my calendar)\b/u,
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
