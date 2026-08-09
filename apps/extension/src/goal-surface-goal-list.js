import { presentGoalSurfaces } from './goal-surface-presentation.js';

export function renderGoalSurfaceList(options) {
  const doc = options.document ?? globalThis.document;
  const list = options.list;
  const presentation = presentGoalSurfaces(options.surfaces);
  list.replaceChildren();

  if (!presentation.goals.length) {
    const empty = doc.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Add a Goal to personalize your radar.';
    list.append(empty);
    return presentation;
  }

  for (const goal of presentation.goals) {
    const chip = doc.createElement('span');
    chip.className = 'goal-chip';
    chip.dataset.goalId = goal.id;
    chip.dataset.goalSource = 'shared-truth';

    const copy = doc.createElement('span');
    copy.className = 'goal-copy';
    const meta = doc.createElement('small');
    meta.textContent = `${goal.compatibilityLabel} · ${goal.autonomyLabel}`;
    const label = doc.createElement('b');
    label.textContent = goal.title;
    const state = doc.createElement('small');
    state.textContent = `${goal.workLabel} · ${goal.approvalLabel}`;
    copy.append(meta, label, state);

    const research = doc.createElement('button');
    research.type = 'button';
    research.className = 'goal-research';
    research.dataset.workState = goal.workState;
    research.dataset.researchAllowed = String(goal.canResearch);
    applyInitialResearchState(research, goal);
    research.addEventListener('click', () => options.onResearch?.(goal, research));

    chip.append(copy, research);
    list.append(chip);
  }

  return presentation;
}

function applyInitialResearchState(button, goal) {
  const active = ['waiting_for_agent', 'queued', 'running', 'investigating', 'verifying'].includes(goal.workState);
  button.disabled = active || !goal.canResearch;
  button.textContent = active
    ? 'Researching…'
    : !goal.canResearch
      ? 'Unavailable'
      : goal.workState === 'failed'
        ? 'Retry safely'
        : 'Authorize research';
  button.setAttribute('aria-busy', active ? 'true' : 'false');
}
