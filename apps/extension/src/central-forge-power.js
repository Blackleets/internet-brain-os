import './unsupported-page-guard.js';
import { createForgePowerController } from './central-forge-power-controller.js';

const powerButton = document.querySelector('#forge-power');
const powerLabel = document.querySelector('#forge-power-label');
const powerDetail = document.querySelector('#forge-power-detail');
const livingForge = document.querySelector('#living-forge');
const orbMeta = document.querySelector('#forge-orb-meta');
const orbSummary = document.querySelector('#forge-orb-summary');
const obsidianReceipt = document.querySelector('#forge-obsidian-receipt');
const controller = createForgePowerController({
  elements: { powerButton, powerLabel, powerDetail, livingForge, orbMeta, orbSummary, obsidianReceipt },
});

controller.attach();
void controller.initialize();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void controller.runCycle();
});

window.addEventListener('pagehide', () => controller.stop(), { once: true });
