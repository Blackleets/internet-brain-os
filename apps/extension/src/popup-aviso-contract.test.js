import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
const popupHtml = readFileSync(new URL('./popup.html', import.meta.url), 'utf8');

describe('popup Watchtower Find copy contract', () => {
  it('fail-closes mission-state Find copy to Kernel SUPPORT, not bare opportunities', () => {
    expect(popup).toContain('kernelSupportedFindsForMission(opportunities, latest)');
    expect(popup).toContain('presentWatchtowerBanner(unread, latest)');
    expect(popup).toContain('forgeActivityForMission(latest, opportunities)');
    expect(popup).toContain("Find' : 'Finds'} passed Kernel SUPPORT");
    expect(popup).not.toContain('opportunities found');
    expect(popup).not.toContain('opportunitiesPromoted ?? 0} opportunities found');
  });
});

describe('popup capture Find copy contract', () => {
  it('fail-closes capture detected copy to isKernelSupportedFind', () => {
    expect(popup).toContain('isKernelSupportedFind(result.opportunity)');
    expect(popup).not.toContain('setStatus(result.opportunity');
  });
});

describe('popup AutoRadar Evidence-only capture copy', () => {
  it('does not label page-context capture as Admitido or Find', () => {
    expect(popup).toContain('autoRadarLastResultLabel');
    expect(popup).toContain('autoRadarStatusCopy');
    expect(popup).toContain('Evidence no es un Find');
    expect(popup).not.toMatch(/Admitido/);
    expect(popupHtml).not.toMatch(/admisión|Admitido/i);
    expect(popupHtml).toContain('Ver Evidence del Case');
  });
});

describe('popup mission-history Find metric label', () => {
  it('labels SUPPORT Find count as Finds, not forged', () => {
    expect(popup).toContain("view.opportunitiesPromoted, 'Finds'");
    expect(popup).not.toContain("view.opportunitiesPromoted, 'forged'");
  });
});

describe('popup Finds workspace chrome contract', () => {
  it('does not brand Kernel SUPPORT Finds as forged or claim Finds when empty', () => {
    expect(popupHtml).not.toContain('FINDS FORJADOS');
    expect(popupHtml).not.toContain('Hallazgos fuertes encontrados para ti');
    expect(popupHtml).not.toContain('BANDEJA DE OPORTUNIDADES');
    expect(popupHtml).toContain('HALLAZGOS · KERNEL SUPPORT');
    expect(popupHtml).toContain('BANDEJA DE HALLAZGOS');
    expect(popupHtml).toContain('Hallazgos con Kernel SUPPORT');
    expect(popupHtml).toContain('cargar hallazgos con Kernel SUPPORT');
    expect(popupHtml).not.toContain('cargar oportunidades.');
    expect(popup).toContain('No Kernel SUPPORT Finds yet');
    expect(popup).not.toContain('No strong leads yet');
  });
});

describe('popup mission-card statusDetail SUPPORT honesty', () => {
  it('names Kernel SUPPORT Finds on forged mission cards — never bare findings passed through', () => {
    const presentation = readFileSync(new URL('./mission-presentation.js', import.meta.url), 'utf8');
    expect(presentation).toContain('Find passed Kernel SUPPORT');
    expect(presentation).toContain('Finds passed Kernel SUPPORT');
    expect(presentation).not.toContain('its findings passed through the local Kernel');
  });
});

describe('popup Goal Surface workLabel SUPPORT honesty', () => {
  it('names Kernel SUPPORT Finds on #mission-state via Goal Surface workLabel — never bare Evidence-backed findings', () => {
    const presentation = readFileSync(new URL('./goal-surface-presentation.js', import.meta.url), 'utf8');
    expect(presentation).toContain('Find passed Kernel SUPPORT');
    expect(presentation).toContain('Finds passed Kernel SUPPORT');
    expect(presentation).not.toContain('Evidence-backed findings forged');
  });
});
