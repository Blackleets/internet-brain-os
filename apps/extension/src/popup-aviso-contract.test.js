import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');

describe('popup Watchtower Find copy contract', () => {
  it('fail-closes opportunities-found copy to kernelSupportedFindsForMission', () => {
    expect(popup).toContain('kernelSupportedFindsForMission(opportunities, latest)');
    expect(popup).toContain('presentWatchtowerBanner(unread, latest)');
    expect(popup).toContain('forgeActivityForMission(latest, opportunities)');
    expect(popup).not.toContain('opportunitiesPromoted ?? 0} opportunities found');
  });
});
