import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
const popupHtml = readFileSync(new URL('./popup.html', import.meta.url), 'utf8');

describe('popup Watchtower Find copy contract', () => {
  it('fail-closes opportunities-found copy to kernelSupportedFindsForMission', () => {
    expect(popup).toContain('kernelSupportedFindsForMission(opportunities, latest)');
    expect(popup).toContain('presentWatchtowerBanner(unread, latest)');
    expect(popup).toContain('forgeActivityForMission(latest, opportunities)');
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
