export const WORKSPACE_VIEWS = Object.freeze(['forge', 'missions', 'finds', 'models']);

export function normalizeWorkspaceView(value) {
  return WORKSPACE_VIEWS.includes(value) ? value : 'forge';
}

export function workspaceVisibility(activeView) {
  const normalized = normalizeWorkspaceView(activeView);
  return Object.fromEntries(WORKSPACE_VIEWS.map((view) => [view, view === normalized]));
}
