import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { statePillLabel, statePillTone } from './state-pill-label.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const views = readFileSync(join(here, '../../components/efesto-product-views.tsx'), 'utf8');
const viewTests = readFileSync(join(here, '../../components/efesto-product-views.test.tsx'), 'utf8');

test('SUPPORT forged names Kernel SUPPORT, never bare forged Completado', () => {
  assert.equal(statePillLabel('forged'), 'Find SUPPORT forjado');
  assert.equal(statePillTone('forged'), 'good');
  assert.notEqual(statePillLabel('forged'), 'forged');
  assert.doesNotMatch(statePillLabel('forged'), /^forged$/i);
});

test('zero-SUPPORT research_completed is Investigación terminada, not green forged', () => {
  assert.equal(statePillLabel('research_completed'), 'Investigación terminada');
  assert.equal(statePillTone('research_completed'), 'neutral');
  assert.doesNotMatch(statePillLabel('research_completed'), /Find SUPPORT|forged|Completado/i);
});

test('completed-without-Evidence is Terminada sin Evidence, not Completado', () => {
  assert.equal(statePillLabel('completed_without_forge'), 'Terminada sin Evidence');
  assert.equal(statePillTone('completed_without_forge'), 'neutral');
  assert.doesNotMatch(statePillLabel('completed_without_forge'), /Completado|Find SUPPORT|^completed$/i);
});

test('page.tsx → EfestoProductShell StatePill mounts the helper', () => {
  assert.match(views, /from ['"]\.\.\/lib\/ui\/state-pill-label\.mjs['"]/);
  assert.match(views, /statePillLabel\(/);
  assert.match(views, /statePillTone\(/);
  assert.doesNotMatch(views, /state\.replaceAll\('_', ' '\)/);
});

test('Goals/Actividad tests lock SUPPORT-named StatePill copy', () => {
  assert.match(viewTests, /Find SUPPORT forjado/i);
  assert.match(viewTests, /Investigación terminada/i);
  assert.match(viewTests, /Terminada sin Evidence/i);
  assert.match(viewTests, /ActivityView mission StatePill SUPPORT honesty/);
});
