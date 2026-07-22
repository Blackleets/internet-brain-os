const ACTIVE_MISSION_STATUSES = new Set(['waiting_for_agent', 'queued', 'running']);
const missionState = document.querySelector('#mission-state');
const goals = document.querySelector('#goal-list');

function syncResearchActions() {
  const active = ACTIVE_MISSION_STATUSES.has(missionState?.dataset.status);
  for (const button of document.querySelectorAll('.goal-research')) {
    button.disabled = active;
    button.textContent = active ? 'Researching…' : 'Research';
    button.setAttribute('aria-busy', active ? 'true' : 'false');
  }
}

const observer = new MutationObserver(syncResearchActions);
if (missionState) observer.observe(missionState, { attributes: true, childList: true, characterData: true, subtree: true });
if (goals) observer.observe(goals, { childList: true, subtree: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncResearchActions();
});

syncResearchActions();
