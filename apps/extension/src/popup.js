import { createGoal, DEFAULT_KERNEL_BASE_URL, getKernelStatus, inspectModelForge, listAgentMissions, listCases, listGoals, listOpportunities, pairKernel, sendOpportunityFeedback, startGoalResearch } from './local-transport.js';
import { presentFind } from './find-presentation.js';
import { buildOpportunityCommandCenter } from './opportunity-command-center.js';
import { buildOpportunityActionPlan, normalizeOpportunityReviewState, updateOpportunityReviewState } from './opportunity-action-workspace.js';
import { normalizePublicOrigin } from './auto-capture-policy.js';
import { forgeActivityForMission, temporaryForgeActivity } from './forge-activity.js';
import { normalizeWorkspaceView, workspaceVisibility } from './workspace-navigation.js';
import { missionJourney, newestMission, onboardingJourney } from './product-journey.js';
import { presentMission } from './mission-presentation.js';
import { createAgentHubRefresher, missionRevision } from './agent-hub-refresh.js';
import { markWatchtowerEventsRead, unreadWatchtowerCount } from './mission-watchtower.js';

const $ = (selector) => document.querySelector(selector);
const select = $('#case-target');
const captureButton = $('#capture');
const status = $('#status');
const tokenInput = $('#kernel-token');
const pairingCodeInput = $('#pairing-code');
const siteRadar = $('#site-radar');
const autoRadarToggle = $('#auto-radar-toggle');
const autoRadarToggleIcon = $('#auto-radar-toggle-icon');
const autoRadarToggleText = $('#auto-radar-toggle-text');
const autoRadarStatusIndicator = $('#auto-radar-status-indicator');
const autoRadarLastDomain = $('#auto-radar-last-domain');
const autoRadarLastResult = $('#auto-radar-last-result');
let currentOrigin;
let agentHubRefresher;
const productState = { connected: false, goalCount: 0, radarEnabled: false, findCount: 0, autoRadarEnabled: false, autoRadarState: 'paused' };

void initialize();
captureButton.addEventListener('click', capture);
$('#save-token').addEventListener('click', saveToken);
$('#pair-kernel').addEventListener('click', pair);
$('#add-goal').addEventListener('click', addGoal);
siteRadar.addEventListener('change', toggleRadar);
autoRadarToggle.addEventListener('click', toggleAutoRadar);
for (const button of document.querySelectorAll('[data-view-target]')) button.addEventListener('click', () => setWorkspaceView(button.dataset.viewTarget));
$('#advanced').addEventListener('click', () => chrome.tabs.create({ url: `${DEFAULT_KERNEL_BASE_URL}/replay-lab` }));
$('#guide-action').addEventListener('click', () => setWorkspaceView(onboardingJourney(productState).next?.view ?? 'finds'));
document.addEventListener('visibilitychange', () => agentHubRefresher?.visibilityChanged());
window.addEventListener('pagehide', () => agentHubRefresher?.stop(), { once: true });

function setWorkspaceView(requestedView) {
  const activeView = normalizeWorkspaceView(requestedView);
  const visibility = workspaceVisibility(activeView);
  for (const view of document.querySelectorAll('[data-workspace-view]')) {
    const active = visibility[view.dataset.workspaceView];
    view.hidden = !active;
    view.classList.toggle('active', active);
  }
  for (const button of document.querySelectorAll('[data-view-target]')) {
    const active = button.dataset.viewTarget === activeView;
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
}

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentOrigin = normalizePublicOrigin(tab?.url);
  $('#site-name').textContent = currentOrigin ? new URL(currentOrigin).hostname : 'Unsupported page';
  siteRadar.disabled = !currentOrigin;
  const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken', 'allowedOrigins', 'radarEnabled', 'autoRadarEnabled', 'autoRadarState', 'lastRadarEvent', 'missionWatchtower', 'pendingWorkspaceView']);
  tokenInput.value = stored.kernelApiToken ?? '';
  const allowed = stored.allowedOrigins ?? [];
  siteRadar.checked = Boolean(stored.radarEnabled && currentOrigin && allowed.includes(currentOrigin));
  productState.connected = Boolean(stored.kernelApiToken);
  productState.radarEnabled = siteRadar.checked;
  productState.autoRadarEnabled = stored.autoRadarEnabled ?? false;
  productState.autoRadarState = stored.autoRadarState ?? 'paused';
  renderGuide();
  updateRadarCopy();
  updateAutoRadarUI(productState.autoRadarState, stored.lastRadarEvent);
  renderWatchtower(stored.missionWatchtower);
  if (stored.pendingWorkspaceView) {
    setWorkspaceView(stored.pendingWorkspaceView);
    await chrome.storage.local.remove('pendingWorkspaceView');
  }
  agentHubRefresher?.stop();
  const results = await Promise.allSettled([loadReadiness(stored), loadCases(stored), loadGoals(stored), loadOpportunities(stored), loadAgentHub(stored), loadModelForge(stored)]);
  const initialMissions = results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : [];
  if (stored.kernelApiToken) startAgentHubRefresh(stored, initialMissions);
  
  // Add storage change listener to keep UI in sync
  let lastAutoRadarState = productState.autoRadarState;
  let lastRadarEvent = null;
  
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const stateChanged = changes.autoRadarState;
      const eventChanged = changes.lastRadarEvent;
      
      if (stateChanged || eventChanged) {
        const autoRadarState = stateChanged ? stateChanged.newValue ?? productState.autoRadarState : productState.autoRadarState;
        const lastRadarEvent = eventChanged ? eventChanged.newValue ?? null : null;
        
        // Skip if state and event haven't actually changed
        if (autoRadarState === lastAutoRadarState && 
            ((lastRadarEvent === null && lastRadarEvent === null) || 
             (lastRadarEvent !== null && lastRadarEvent !== null && 
              lastRadarEvent.status === lastRadarEvent.status && 
              lastRadarEvent.title === lastRadarEvent.title))) {
          return;
        }
        
        lastAutoRadarState = autoRadarState;
        lastRadarEvent = lastRadarEvent;
        
        // Debounce UI updates to prevent flickering
        clearTimeout(autoRadarUIUpdateTimeout);
        autoRadarUIUpdateTimeout = setTimeout(() => {
          updateAutoRadarUI(autoRadarState, lastRadarEvent);
        }, 150); // Increased debounce time
      }
      
      if (changes.autoRadarEnabled) {
        productState.autoRadarEnabled = changes.autoRadarEnabled?.newValue ?? false;
        // Update toggle button text/icon based on enabled state
        const state = productState.autoRadarState ?? 'paused';
        if (state === 'paused') {
          autoRadarToggleIcon.textContent = '▶️';
          autoRadarToggleText.textContent = 'Activar Auto Radar';
        } else {
          autoRadarToggleIcon.textContent = '⏸';
          autoRadarToggleText.textContent = 'Pausar Auto Radar';
        }
      }
    }
  });
}

function renderWatchtower(watchtower) {
  const unread = unreadWatchtowerCount(watchtower);
  $('#watchtower-count').textContent = String(unread);
  $('#watchtower-result').hidden = unread === 0;
  if (unread === 0) return;
  const latest = watchtower.events.find((event) => event.unread);
  $('#watchtower-copy').textContent = latest?.status === 'completed'
    ? `${unread} new forge result${unread === 1 ? '' : 's'} ready to inspect.`
    : `${unread} mission update${unread === 1 ? '' : 's'} needs attention.`;
  $('#watchtower-open').onclick = async () => {
    setWorkspaceView('missions');
    const read = markWatchtowerEventsRead(watchtower);
    await chrome.storage.local.set({ missionWatchtower: read });
    renderWatchtower(read);
  };
}

function startAgentHubRefresh(stored, initialMissions) {
  let observedRevision = missionRevision(initialMissions);
  agentHubRefresher = createAgentHubRefresher({
    isVisible: () => document.visibilityState === 'visible',
    refresh: async () => {
      const missions = await loadAgentHub(stored);
      const nextRevision = missionRevision(missions);
      const latest = newestMission(missions);
      if (nextRevision !== observedRevision && latest?.status === 'completed') await loadOpportunities(stored);
      observedRevision = nextRevision;
      return missions;
    },
  });
  agentHubRefresher.start(initialMissions);
}

async function loadModelForge(stored) {
  if (!stored.kernelApiToken) return;
  const forge = await inspectModelForge({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
  const recommended = forge.models.find((model) => model.id === forge.recommended);
  const ready = forge.runtime === 'available' && Boolean(forge.activeModel);
  setService('model', ready, ready ? 'Local AI ready' : forge.runtime === 'available' ? 'Choose an installed model' : 'Ollama not detected');
  $('#forge-hardware').textContent = `${forge.hardware.ramGiB} GB RAM · ${forge.hardware.cpuCores} CPU cores · ${forge.hardware.tier}`;
  $('#forge-recommendation').textContent = forge.activeModel
    ? `${forge.models.find((model) => model.id === forge.activeModel)?.label ?? forge.activeModel} active`
    : forge.runtime === 'available'
      ? `${recommended?.label ?? forge.recommended} recommended${recommended?.installed ? ' · installed' : ''}`
      : 'Install Ollama to use a free private model';
  const command = $('#forge-command');
  command.textContent = forge.setup.command
    ? `${forge.setup.command}\n${forge.setup.setting}`
    : 'Ollama is not detected. Installation remains a manual user action.';
  command.hidden = false;
  $('#forge-note').textContent = forge.activeModel
    ? 'The active model enriches Evidence; raw Evidence remains authoritative.'
    : 'Model selection never downloads software automatically. Restart the Kernel after configuration.';
}

async function loadAgentHub(stored) {
  if (!stored.kernelApiToken) return [];
  const missions = await listAgentMissions({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
  const latest = newestMission(missions);
  const copy = {
    waiting_for_agent: 'Waiting for Hermes', queued: 'Ready for Hermes', running: 'Hermes is researching',
    completed: `${latest?.resultSummary?.opportunitiesPromoted ?? 0} opportunities found`, failed: 'Research needs attention',
  }[latest?.status] ?? 'No research mission yet';
  $('#mission-state').textContent = latest?.executionPhase === 'verifying' ? 'Efesto is verifying findings' : copy;
  $('#mission-state').dataset.status = latest?.status ?? 'idle';
  renderMissionProgress(latest);
  renderMissionHistory(missions);
  setForgeActivity(forgeActivityForMission(latest));
  return missions;
}

function renderMissionHistory(missions) {
  const list = $('#mission-history-list');
  $('#mission-history-count').textContent = String(missions.length);
  list.replaceChildren();
  if (!missions.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No authorized research activity yet.'; list.append(empty); return; }
  for (const mission of missions.slice(0, 5)) list.append(renderMissionCard(presentMission(mission)));
}

function renderMissionCard(view) {
  const card = document.createElement('article'); card.className = 'mission-card'; card.dataset.status = view.status;
  const heading = document.createElement('div'); heading.className = 'mission-card-heading';
  const copy = document.createElement('span'); const title = document.createElement('b'); title.textContent = view.title;
  const statusLabel = document.createElement('small'); statusLabel.textContent = view.statusLabel; copy.append(title, statusLabel);
  const attempt = document.createElement('em'); attempt.textContent = view.attemptLabel; heading.append(copy, attempt); card.append(heading);
  const detail = document.createElement('p'); detail.textContent = view.statusDetail; card.append(detail);
  if (view.status === 'completed') {
    const results = document.createElement('div'); results.className = 'mission-results';
    for (const [value, label] of [[view.received, 'received'], [view.evidenceCreated, 'Evidence'], [view.opportunitiesPromoted, 'forged']]) {
      const metric = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = String(value);
      const small = document.createElement('small'); small.textContent = label; metric.append(strong, small); results.append(metric);
    }
    card.append(results);
  }
  const ledger = document.createElement('details'); ledger.className = 'mission-ledger';
  const summary = document.createElement('summary'); summary.textContent = `Activity ledger · ${view.timeline.length} recorded`; ledger.append(summary);
  const timeline = document.createElement('ol');
  for (const event of view.timeline) {
    const item = document.createElement('li'); const eventCopy = document.createElement('span'); const label = document.createElement('b'); label.textContent = event.label;
    const eventDetail = document.createElement('small'); eventDetail.textContent = event.detail; const time = document.createElement('time'); time.dateTime = event.at; time.textContent = formatMissionTime(event.at);
    eventCopy.append(label, eventDetail); item.append(eventCopy, time); timeline.append(item);
  }
  ledger.append(timeline);
  if (view.failureDetail) { const failure = document.createElement('p'); failure.className = 'mission-failure'; failure.textContent = `Provider detail: ${view.failureDetail}`; ledger.append(failure); }
  card.append(ledger); return card;
}

function formatMissionTime(value) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

function renderMissionProgress(mission) {
  const list = $('#mission-progress');
  list.replaceChildren();
  for (const stage of missionJourney(mission).stages) {
    const item = document.createElement('li'); item.dataset.state = stage.state;
    const marker = document.createElement('i'); marker.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = stage.label;
    item.append(marker, label); list.append(item);
  }
}

async function loadGoals(stored) {
  if (!stored.kernelApiToken) return;
  const goals = await listGoals({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
  $('#goal-count').textContent = String(goals.length);
  $('#mission-nav-count').textContent = String(goals.length);
  productState.goalCount = goals.length;
  renderGuide();
  const list = $('#goal-list');
  list.replaceChildren();
  if (!goals.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Add a goal to personalize your radar.'; list.append(empty); return; }
  for (const goal of goals.slice(0, 3)) {
    const chip = document.createElement('span'); chip.className = 'goal-chip';
    const copy = document.createElement('span'); copy.className = 'goal-copy';
    const meta = document.createElement('small'); meta.textContent = `${goal.categories?.[0] ?? 'mission'} · priority ${goal.priority ?? 2}`;
    const label = document.createElement('b'); label.textContent = `${goal.priority === 3 ? '🔥 ' : ''}${goal.title}`;
    const location = document.createElement('small'); location.textContent = goal.location ? `◎ ${goal.location}` : 'Private mission';
    copy.append(meta, label, location);
    const research = document.createElement('button'); research.type = 'button'; research.className = 'goal-research'; research.textContent = 'Research';
    research.addEventListener('click', async () => {
      if (!globalThis.confirm('Authorize Hermes to research this Goal once?')) return;
      research.disabled = true;
      try {
        const mission = await startGoalResearch(goal.id, { baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
        setStatus(mission.status === 'queued' ? 'Mission queued for Hermes.' : 'Mission saved. Connect Hermes in Agent Hub to run it.');
        await loadAgentHub(stored);
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to start research', true); }
      finally { research.disabled = false; }
    });
    chip.append(copy, research); list.append(chip);
  }
}

async function addGoal() {
  const button = $('#add-goal');
  button.disabled = true;
  try {
    const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
    await createGoal({ title: $('#goal-title').value, categories: [$('#goal-category').value], location: $('#goal-location').value || undefined, keywords: $('#goal-keywords').value.split(',').map((value) => value.trim()).filter(Boolean), priority: 2 }, { baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
    $('#goal-title').value = ''; $('#goal-location').value = ''; $('#goal-keywords').value = '';
    setStatus('Goal forged privately. Efesto will prioritize matching opportunities.');
    await Promise.all([loadGoals(stored), loadOpportunities(stored)]);
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to forge Goal', true); }
  finally { button.disabled = false; }
}

async function loadOpportunities(stored) {
  const inbox = $('#opportunity-list');
  if (!stored.kernelApiToken) return;
  const opportunities = await listOpportunities({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
  const localReview = await chrome.storage.local.get('opportunityReviewState');
  const reviewState = normalizeOpportunityReviewState(localReview.opportunityReviewState);
  $('#opportunity-count').textContent = String(opportunities.length);
  $('#find-nav-count').textContent = String(opportunities.length);
  productState.findCount = opportunities.length;
  renderGuide();
  renderCommandCenter(opportunities);
  inbox.replaceChildren();
  if (!opportunities.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No strong leads yet. Keep browsing authorized public sites.';
    inbox.append(empty);
    return;
  }
  for (const item of opportunities.slice(0, 3)) inbox.append(renderOpportunity(item, stored, reviewState));
}

function renderCommandCenter(opportunities) {
  const center = buildOpportunityCommandCenter(opportunities);
  const container = $('#command-center-content');
  container.replaceChildren();
  if (!center.lead) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No action queue yet. Efesto needs a provenance-backed Find first.'; container.append(empty); return;
  }

  const lead = document.createElement('article'); lead.className = 'command-lead';
  const flag = document.createElement('span'); flag.className = 'command-flag'; flag.textContent = 'ATTEND FIRST';
  const title = document.createElement('strong'); title.textContent = center.lead.title;
  const trust = document.createElement('small'); trust.textContent = `${center.lead.verificationLabel} · ${center.lead.objectiveRelevance}% Evidence relevance · ${center.lead.personalizedRelevance}% private match`;
  lead.append(flag, title, trust, findSection('Why it is first', center.lead.reasons), findSection('Safe next move', [center.lead.nextAction]));
  const openFind = document.createElement('button'); openFind.type = 'button'; openFind.textContent = 'Inspect full Evidence';
  openFind.addEventListener('click', () => document.querySelector('.opportunity')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  lead.append(openFind); container.append(lead);

  const metrics = document.createElement('div'); metrics.className = 'command-metrics';
  for (const [value, label] of [[center.queue.length, 'in queue'], [center.goalLinkedCount, 'Goal-linked'], [center.deadlineCount, 'dates detected']]) {
    const metric = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = String(value); const small = document.createElement('small'); small.textContent = label; metric.append(strong, small); metrics.append(metric);
  }
  container.append(metrics);
}

function renderOpportunity(item, stored, reviewState) {
  const presentation = presentFind(item);
  const card = document.createElement('article');
  card.className = 'opportunity';
  card.dataset.category = item.category ?? 'lead';
  const top = document.createElement('span');
  top.className = 'opportunity-top';
  const category = document.createElement('b');
  category.textContent = item.categoryLabel ?? item.category ?? 'Lead';
  const score = document.createElement('strong');
  score.textContent = `${presentation.personalizedRelevance}% match`;
  top.append(category, score);
  const title = document.createElement('span');
  title.className = 'opportunity-title';
  title.textContent = item.title ?? 'Untitled opportunity';
  const meta = document.createElement('small');
  const benefit = item.benefitType ? `${item.benefitType} · ` : '';
  meta.textContent = `${benefit}${item.sourceHost ?? 'Public source'}${item.deadlineText ? ` · Deadline: ${item.deadlineText}` : ''}`;
  card.append(top, title, meta);
  const trust = document.createElement('span'); trust.className = 'find-trust'; trust.textContent = `${presentation.verificationLabel} · ${presentation.objectiveRelevance}% evidence relevance`; card.append(trust);
  if (item.goalMatches?.[0]) { const goal = document.createElement('small'); goal.className = 'goal-match'; goal.textContent = `Goal: ${item.goalMatches[0].title}`; card.append(goal); }
  if (item.learnedAdjustment) { const learned = document.createElement('small'); learned.className = 'learned-match'; learned.textContent = `Efesto learned: ${item.learnedAdjustment > 0 ? '+' : ''}${item.learnedAdjustment}`; card.append(learned); }
  const detail = document.createElement('details'); detail.className = 'find-detail';
  const summary = document.createElement('summary'); summary.textContent = 'Why this matters'; detail.append(summary);
  detail.append(findSection('Signals detected', presentation.reasons.length ? presentation.reasons : ['No specific signal retained. Review the Evidence.']));
  if (presentation.goal) detail.append(findSection('Related Goal', [presentation.goal.title, ...presentation.goal.reasons]));
  detail.append(findSection('Provenance', [presentation.sourceHost, presentation.evidenceId ? `Evidence: ${presentation.evidenceId}` : 'Evidence reference unavailable']));
  detail.append(findSection('Risks & limits', presentation.cautions));
  detail.append(findSection('Safe next step', [presentation.nextAction]));
  detail.append(renderActionWorkspace(item, reviewState));
  card.append(detail);
  const actions = document.createElement('span'); actions.className = 'opportunity-actions';
  for (const [signal, label] of [['useful', 'Useful'], ['saved', 'Save'], ['not_interested', 'Not for me']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await sendOpportunityFeedback(item.id, signal, { baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
        setStatus('Preference learned privately. You can reset it at any time.');
        await loadOpportunities(stored);
      } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save feedback', true); }
    });
    actions.append(button);
  }
  if (typeof item.sourceUrl === 'string') { const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open'; open.addEventListener('click', () => chrome.tabs.create({ url: item.sourceUrl })); actions.append(open); }
  card.append(actions);
  return card;
}

function renderActionWorkspace(item, reviewState) {
  const section = document.createElement('section'); section.className = 'action-workspace';
  const heading = document.createElement('span'); heading.className = 'action-workspace-heading';
  const title = document.createElement('b'); title.textContent = 'SAFE ACTION WORKSPACE';
  const progress = document.createElement('small');
  heading.append(title, progress); section.append(heading);
  const list = document.createElement('span'); list.className = 'action-checklist'; section.append(list);

  const render = () => {
    const plan = buildOpportunityActionPlan(item, reviewState[item.id]);
    progress.textContent = `${plan.completedCount}/${plan.totalCount} · ${plan.statusLabel}`;
    list.replaceChildren();
    for (const step of plan.steps) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = step.completed;
      const copy = document.createElement('span'); copy.textContent = step.label;
      input.addEventListener('change', async () => {
        const next = updateOpportunityReviewState(reviewState, item.id, step.id, input.checked);
        Object.keys(reviewState).forEach((key) => delete reviewState[key]); Object.assign(reviewState, next);
        await chrome.storage.local.set({ opportunityReviewState: reviewState });
        render(); setStatus('Private review progress saved locally. The lead remains unverified.');
      });
      label.append(input, copy); list.append(label);
    }
  };
  render(); return section;
}

function findSection(title, lines) {
  const section = document.createElement('section');
  const heading = document.createElement('b'); heading.textContent = title; section.append(heading);
  const list = document.createElement('ul');
  for (const line of lines.filter(Boolean)) { const item = document.createElement('li'); item.textContent = line; list.append(item); }
  section.append(list); return section;
}

async function loadReadiness(stored) {
  try {
    const readiness = await getKernelStatus({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL });
    $('#kernel-state').textContent = 'Kernel ready';
    $('#kernel-state').classList.add('ready');
    setService('model', false, readiness.ollama === 'configured' ? 'Model configured · checking runtime' : 'Choose a free local model');
    setService('memory', readiness.obsidian === 'configured', readiness.obsidian === 'configured' ? 'Private vault connected' : 'Vault not configured');
    setService('agent', readiness.hermes === 'ready', readiness.hermes === 'ready' ? 'Hermes bridge ready' : 'Connect an agent next');
  } catch {
    setStatus('Start your private Efesto Kernel, then pair the extension.', true);
  }
}

async function loadCases(stored) {
  if (!stored.kernelApiToken) return;
  const cases = await listCases({ baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL, apiToken: stored.kernelApiToken });
  select.replaceChildren(new Option('New opportunity case', ''));
  for (const item of cases) select.append(new Option(item.title, item.id));
}

async function toggleRadar() {
  if (!currentOrigin) return;
  const stored = await chrome.storage.local.get('allowedOrigins');
  const allowed = new Set(stored.allowedOrigins ?? []);
  if (siteRadar.checked) allowed.add(currentOrigin); else allowed.delete(currentOrigin);
  await chrome.storage.local.set({ allowedOrigins: [...allowed], radarEnabled: allowed.size > 0 });
  productState.radarEnabled = siteRadar.checked;
  renderGuide();
  updateRadarCopy();
  setStatus(siteRadar.checked ? 'Radar active. Efesto will analyze public pages on this site.' : 'Radar paused for this site.');
}

async function toggleAutoRadar() {
  // Disable the button to prevent multiple clicks
  autoRadarToggle.disabled = true;
  try {
    // Notificar al background script para que toggle el estado
    const response = await chrome.runtime.sendMessage({
      type: 'EFESTO_AUTO_RADAR_TOGGLE'
    });
    
    if (!response || !response.ok) {
      throw new Error('Failed to toggle Auto Radar');
    }
    
    // Actualizar estado basado en la respuesta del background
    productState.autoRadarEnabled = response.enabled;
    
    // Get latest state from storage to be safe
    const stored = await chrome.storage.local.get(['autoRadarState', 'lastRadarEvent']);
    updateAutoRadarUI(stored.autoRadarState ?? 'paused', stored.lastRadarEvent);
    
    setStatus(response.enabled 
      ? 'Auto Radar activado. Efesto analizará automáticamente las páginas públicas.' 
      : 'Auto Radar pausado.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Error al cambiar el estado del Auto Radar', true);
  } finally {
    // Re-enable the button
    autoRadarToggle.disabled = false;
  }
}

function updateRadarCopy() {
  $('#radar-copy').textContent = siteRadar.checked
    ? 'Working in the background. Sensitive paths and form selections stay private.'
    : 'Authorize this public site to let Efesto work quietly while you browse.';
}

function updateAutoRadarUI(state, lastEvent) {
  // Update status indicator
  let statusText = 'Desconocido';
  let statusClass = 'unknown';
  let icon = '❓';
  
  switch (state) {
    case 'paused':
      statusText = 'Pausado';
      statusClass = 'paused';
      icon = '⏸';
      break;
    case 'observing':
      statusText = 'Observando';
      statusClass = 'observing';
      icon = '👁';
      break;
    case 'waiting':
      statusText = 'Esperando estabilización';
      statusClass = 'waiting';
      icon = '⏳';
      break;
    case 'evaluating':
      statusText = 'Evaluando';
      statusClass = 'evaluating';
      icon = '🔍';
      break;
    case 'irrelevant':
      statusText = 'Irrelevante';
      statusClass = 'irrelevant';
      icon = '❌';
      break;
    case 'blocked':
      statusText = 'Bloqueado';
      statusClass = 'blocked';
      icon = '🚫';
      break;
    case 'duplicate':
      statusText = 'Duplicado';
      statusClass = 'duplicate';
      icon = '🔄';
      break;
    case 'submitting':
      statusText = 'Enviando';
      statusClass = 'submitting';
      icon = '📤';
      break;
    case 'admitted':
      statusText = 'Admitido';
      statusClass = 'admitted';
      icon = '✅';
      break;
    case 'rejected':
      statusText = 'Rechazado';
      statusClass = 'rejected';
      icon = '❌';
      break;
    case 'needs_research':
      statusText = 'Necesita investigación';
      statusClass = 'needs-research';
      icon = '🔬';
      break;
    case 'failed':
      statusText = 'Falló';
      statusClass = 'failed';
      icon = '💥';
      break;
  }
  
  autoRadarStatusIndicator.textContent = `${icon} ${statusText}`;
  autoRadarStatusIndicator.className = `status-indicator ${statusClass}`;
  
  // Update toggle button
  if (state === 'paused') {
    autoRadarToggleIcon.textContent = '▶️';
    autoRadarToggleText.textContent = 'Activar Auto Radar';
  } else {
    autoRadarToggleIcon.textContent = '⏸';
    autoRadarToggleText.textContent = 'Pausar Auto Radar';
  }
  
  // Update last domain and result from last event
    if (lastEvent && lastEvent.title) {
      let domainText = 'desconocido';
      if (lastEvent.url && typeof lastEvent.url === 'string' && lastEvent.url.trim().length > 0) {
        try {
          const url = new URL(lastEvent.url);
          domainText = url.hostname || 'desconocido';
        } catch (e) {
          // URL is invalid, keep default
        }
      }
      autoRadarLastDomain.textContent = `Último dominio: ${domainText}`;
   
      let resultText = 'Desconocido';
      switch (lastEvent.status) {
        case 'admitted': resultText = 'Admitido ✅'; break;
        case 'rejected': resultText = 'Rechazado ❌'; break;
        case 'failed': resultText = 'Falló 💥'; break;
        case 'duplicate': resultText = 'Duplicado 🔄'; break;
        case 'blocked': resultText = 'Bloqueado 🚫'; break;
        default: resultText = `${lastEvent.status} ${lastEvent.status === 'captured' ? '📡' : ''}`;
      }
      autoRadarLastResult.textContent = `Último resultado: ${resultText}`;
    } else {
      autoRadarLastDomain.textContent = 'Último dominio: — ';
      autoRadarLastResult.textContent = 'Último resultado: — ';
    }
}

async function renderGuide() {
  const journey = onboardingJourney(productState);
  $('#forge-guide').classList.toggle('complete', journey.complete);
  $('#guide-title').textContent = journey.complete ? 'Your forge is alive' : journey.next.label;
  $('#guide-progress').textContent = `${journey.steps.filter((step) => step.complete).length} of ${journey.steps.length} forge steps complete`;
  $('#guide-action').textContent = journey.complete ? 'Explore Finds' : 'Continue';
}

async function pair() {
  $('#pair-kernel').disabled = true;
  try {
    const stored = await chrome.storage.local.get('kernelBaseUrl');
    const token = await pairKernel(pairingCodeInput.value, { baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL });
    await chrome.storage.local.set({ kernelApiToken: token });
    tokenInput.value = token;
    pairingCodeInput.value = '';
    setStatus('Private Kernel connected securely.');
    await initialize();
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Pairing failed', true); }
  finally { $('#pair-kernel').disabled = false; }
}

async function saveToken() {
  const token = tokenInput.value.trim();
  if (token.length < 32) return setStatus('Kernel token must contain at least 32 characters.', true);
  await chrome.storage.local.set({ kernelApiToken: token });
  setStatus('Local credential saved on this device.');
  await initialize();
}

async function capture() {
  captureButton.disabled = true;
  setForgeActivity(temporaryForgeActivity('capture'));
  setStatus('Efesto is analyzing this page…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active public page');
    const captured = await chrome.tabs.sendMessage(tab.id, { type: 'HEPHAESTUS_CAPTURE_PAGE_CONTEXT' });
    if (!captured?.ok) throw new Error('Unable to read this page');
    const result = await chrome.runtime.sendMessage({ type: 'HEPHAESTUS_SEND_PAGE_CONTEXT', context: captured.context, targetCaseId: select.value || undefined });
    if (!result?.ok) throw new Error(result?.error ?? 'Local Kernel rejected the page');
    setStatus(result.opportunity
      ? `${result.opportunity.categoryLabel} detected — ${result.opportunity.relevance}% relevance. Saved privately.`
      : `Page analyzed. No strong opportunity detected${result.obsidianUpdated ? '; Evidence saved to Obsidian' : ''}.`);
    setForgeActivity(temporaryForgeActivity('capture-success'));
    const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
    await loadOpportunities(stored);
  } catch (error) { setForgeActivity(temporaryForgeActivity('capture-error')); setStatus(error instanceof Error ? error.message : 'Unable to analyze page', true); }
  finally { captureButton.disabled = false; }
}

function setService(id, ready, copy) {
  $(`#${id}-dot`).classList.toggle('ready', ready);
  $(`#${id}-state`).textContent = copy;
}
function setForgeActivity(activity) {
  $('#living-forge').dataset.activity = activity.tone;
  $('#forge-activity-label').textContent = activity.label;
  $('#forge-activity-detail').textContent = activity.detail;
}
function setStatus(message, error = false) { status.textContent = message; status.classList.toggle('error', error); }
