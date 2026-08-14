import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('../apps/dashboard/app/page.tsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../apps/dashboard/components/efesto-product-shell.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../apps/dashboard/components/overview/product-value-scorecard.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../apps/dashboard/lib/efesto-i18n.tsx', import.meta.url), 'utf8');
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
    expect(panelSource).toContain("t('scorecard.repeatGoals')");
    expect(i18nSource).toContain("'scorecard.repeatGoals': 'Repetición de Goals'");
    expect(panelSource).toContain('installationToFirstGoalActivationRate');
  });

  it('preserves the local-only truth boundary and truthful unavailable copy', () => {
    expect(parserSource).toContain("sourceOfTruth, `${path}.sourceOfTruth`, 'local_kernel'");
    expect(parserSource).toContain("externalTelemetry, `${path}.privacy.externalTelemetry`, false");
    expect(panelSource).toContain("t('scorecard.noData')");
    expect(i18nSource).toContain("'scorecard.noData': 'Sin datos'");
    expect(i18nSource).toContain("'scorecard.privacy': 'Solo local · sin telemetría externa'");
    expect(i18nSource).toContain("'scorecard.unavailableCopy': 'Efesto conserva el resto de datos verificados. No mostramos ceros inventados.'");
  });
});
