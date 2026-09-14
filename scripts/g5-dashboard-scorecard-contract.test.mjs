import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('../apps/dashboard/app/page.tsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../apps/dashboard/components/efesto-product-shell.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../apps/dashboard/components/overview/product-value-scorecard.tsx', import.meta.url), 'utf8');
const overviewSource = readFileSync(new URL('../apps/dashboard/lib/kernel/overview.ts', import.meta.url), 'utf8');
const parserSource = readFileSync(new URL('../apps/dashboard/lib/kernel/product-scorecard.ts', import.meta.url), 'utf8');

describe('G5.2 active dashboard product-scorecard contract', () => {
  it('mounts the scorecard on the product shell that page.tsx actually serves', () => {
    expect(pageSource).toContain('EfestoProductShell');
    expect(shellSource).toContain("import { ProductValueScorecardPanel } from './overview/product-value-scorecard';");
    expect(shellSource).toContain('scorecard={snapshot?.productScorecard}');
  });

  it('uses the overview snapshot as the only dashboard scorecard input', () => {
    expect(overviewSource).toContain("client.get('/api/preferences', parseProductScorecardPreferences, signal)");
    expect(panelSource).not.toContain('fetch(');
    expect(panelSource).not.toContain('KernelClient');
    expect(panelSource).not.toContain('buildProductValueScorecard');
    expect(shellSource).not.toContain('buildProductValueScorecard');
    expect(panelSource).toContain('Repetición de Goals');
    expect(panelSource).toContain('installationToFirstGoalActivationRate');
  });

  it('preserves the local-only truth boundary and truthful unavailable copy', () => {
    expect(parserSource).toContain("sourceOfTruth, `${path}.sourceOfTruth`, 'local_kernel'");
    expect(parserSource).toContain("externalTelemetry, `${path}.privacy.externalTelemetry`, false");
    expect(panelSource).toContain('Sin datos');
    expect(panelSource).toContain('sin telemetría externa');
    expect(panelSource).toContain('No mostramos ceros inventados');
  });

  it('missionCompletionRate label is forged-only and never bare completadas', () => {
    // missionCompletionRate is isKernelForgedMission-only; bare completed ≠ Completado/forged.
    expect(panelSource).toContain('Misiones forjadas');
    expect(panelSource).toContain('missionCompletionRate');
    expect(panelSource).not.toMatch(/Misiones completadas/i);
    expect(panelSource).not.toMatch(/no_completed_goals:\s*'Aún no hay Goals completados\.'/);
    expect(panelSource).toMatch(/no_completed_goals:\s*'Aún no hay Goals con misión forjada por el Kernel\.'/);
  });

  it('goalLinked / useful Find labels name Kernel SUPPORT and never bare Find útil alone', () => {
    // goalLinkedFinds and usefulSavedFindShare are isKernelSupportedOpportunity-only.
    expect(panelSource).toContain('Goals con Find SUPPORT útil');
    expect(panelSource).toContain('Tiempo al primer Find SUPPORT útil');
    expect(panelSource).toContain('Finds SUPPORT útiles');
    expect(panelSource).toContain('Finds SUPPORT con Goal');
    expect(panelSource).toContain('goalUsefulFindRate');
    expect(panelSource).toContain('usefulSavedFindShare');
    expect(panelSource).toContain('goalLinkedFinds');
    expect(panelSource).not.toContain('label="Goals con Find útil"');
    expect(panelSource).not.toContain('label="Tiempo al primer Find útil"');
    expect(panelSource).not.toContain('>Finds útiles <');
    expect(panelSource).not.toContain('>Finds con Goal <');
    expect(panelSource).not.toMatch(/no_goal_linked_finds:\s*'Aún no hay Finds ligados a un Goal verificado\.'/);
    expect(panelSource).toMatch(/no_goal_linked_finds:\s*'Aún no hay Finds con Kernel SUPPORT ligados a un Goal\.'/);
    expect(panelSource).toMatch(/no_useful_or_saved_find_feedback:\s*'Aún no hay Finds con Kernel SUPPORT marcados como útiles o guardados\.'/);
  });
});