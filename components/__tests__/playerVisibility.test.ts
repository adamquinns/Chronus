import { describe, expect, it } from 'vitest';
import { createCubanCampaign } from '../../engine/scenarios';
import { runTurn } from '../../engine/pipeline';
import { isDeveloperAuditEnabled, projectPlayerVisibleChanges } from '../playerVisibility';

describe('player and developer visibility boundaries', () => {
  it('requires both development mode and an explicit audit flag', () => {
    expect(isDeveloperAuditEnabled(true, undefined)).toBe(false);
    expect(isDeveloperAuditEnabled(true, 'false')).toBe(false);
    expect(isDeveloperAuditEnabled(false, 'true')).toBe(false);
    expect(isDeveloperAuditEnabled(true, 'true')).toBe(true);
  });

  it('projects only accessible changes without raw audit causes', async () => {
    const campaign = createCubanCampaign(12345);
    const { campaign: nextCampaign, audit } = await runTurn(
      campaign,
      'Use the Robert Kennedy backchannel to offer a public non-invasion pledge.',
      { persist: false },
    );
    audit.stateChanges.push({
      id: 'hidden_arc_change',
      targetType: 'ARC',
      targetId: 'submarine_contact',
      field: 'progress',
      before: 72,
      after: 99,
      cause: 'B-59 secretly carries a nuclear torpedo.',
      sourceEffectId: 'hidden_effect',
      impactClass: 'MAJOR',
      confidence: 'VERY_HIGH',
    });

    const projected = projectPlayerVisibleChanges(nextCampaign, audit);
    const serialized = JSON.stringify(projected);

    expect(projected.length).toBeGreaterThan(0);
    expect(projected.some((change) => change.label === 'Submarine Contact')).toBe(true);
    expect(serialized).not.toContain('submarine_contact');
    expect(serialized).not.toContain('nuclear torpedo');
    expect(serialized).not.toContain('randomDraw');
    expect(serialized).not.toContain('actorActions');
  });
});
