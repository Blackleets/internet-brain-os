const ACTIVE_MISSION_STATUSES = new Set(['waiting_for_agent', 'queued', 'running']);
const missionState = document.querySelector('#mission-state');
const goals = document.querySelector('#goal-list');

export function applyResearchButtonState(button, active) {
  const nextText = active ? 'Researching…' : 'Research';
  const nextBusy = active ? 'true' : 'false';
  if (button.disabled !== active) button.disabled = active;
  if (button.textContent !== nextText) button.textContent = nextText;
  if (button.getAttribute('aria-busy') !== nextBusy) button.setAttribute('aria-busy', nextBusy);
}

function syncResearchActions() {
  const active = ACTIVE_MISSION_STATUSES.has(missionState?.dataset.status);
  for (const button of document.querySelectorAll('.goal-research')) applyResearchButtonState(button, active);
}

const stateObserver = new MutationObserver(syncResearchActions);
if (missionState) stateObserver.observe(missionState, { attributes: true, attributeFilter: ['data-status'] });

const goalObserver = new MutationObserver(syncResearchActions);
if (goals) goalObserver.observe(goals, { childList: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncResearchActions();
});

syncResearchActions();
