/**
 * Decides whether a chrome.storage change should re-render the popup Auto Radar status.
 * Returns the { autoRadarState, lastRadarEvent } to render, or null when nothing visible changed.
 * A state-only change keeps showing the last known radar event instead of wiping it.
 */
export function createAutoRadarUiSync(initialState, initialEvent = null) {
  let previousState = initialState;
  let previousEvent = initialEvent ?? null;
  return function nextUpdate(changes, currentState) {
    const stateChange = changes?.autoRadarState;
    const eventChange = changes?.lastRadarEvent;
    if (!stateChange && !eventChange) return null;
    const nextState = stateChange ? stateChange.newValue ?? currentState : currentState;
    const nextEvent = eventChange ? eventChange.newValue ?? null : previousEvent;
    if (nextState === previousState && sameRadarEvent(nextEvent, previousEvent)) return null;
    previousState = nextState;
    previousEvent = nextEvent;
    return { autoRadarState: nextState, lastRadarEvent: nextEvent };
  };
}

function sameRadarEvent(a, b) {
  if (a === null || b === null) return a === b;
  return a.status === b.status && a.title === b.title && a.url === b.url && a.at === b.at;
}
