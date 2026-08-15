import { describe, expect, it } from 'vitest';
import { checkFeasibility, compileDeterministically } from '../compiler';
import { assessJeopardy, catastropheProbability, escalateWithRefusal, jeopardyIsGrave } from '../jeopardy';
import { runTurn } from '../pipeline';
import { createCubanCampaign } from '../scenarios';

const RECKLESS = 'Take me directly to Cuba via Air Force One right now. I will not take no for an answer. No military escort. Order the Joint Chiefs to stay out of it.';

const assess = (directive: string) => {
  const state = createCubanCampaign(19621027).state;
  const graph = compileDeterministically(directive, state);
  return assessJeopardy(graph, checkFeasibility(graph, state), state);
};

describe('jeopardy: what the player is putting at risk', () => {
  it('stays silent for directives that risk nothing of the player’s own', () => {
    for (const directive of [
      'Contact Khrushchev through the Robert Kennedy backchannel.',
      'Allocate 1 reconnaissance sortie.',
      'Announce publicly that the quarantine line holds.',
    ]) {
      const jeopardy = assess(directive);
      expect(jeopardy.physical).toBe(0);
      expect(jeopardyIsGrave(jeopardy)).toBe(false);
    }
  });

  it('recognises the player putting their own person into hostile space', () => {
    const jeopardy = assess(RECKLESS);
    expect(jeopardy.physical).toBeGreaterThanOrEqual(60);
    expect(jeopardyIsGrave(jeopardy)).toBe(true);
    expect(jeopardy.reasons.join(' ')).toMatch(/own person/i);
    expect(jeopardy.reasons.join(' ')).toMatch(/protection .* shed|means and the motive/i);
    expect(catastropheProbability(jeopardy)).toBeGreaterThan(0);
  });

  it('treats a lawful order as lawful, and a refusal as the thing that makes it a crisis', () => {
    // Ordering the Joint Chiefs is within authority: grumbling, not crisis.
    const lawful = assess('Order the Joint Chiefs to stand down the air-strike planning immediately, whatever it takes. I will not take no for an answer.');
    expect(jeopardyIsGrave(lawful)).toBe(false);
    // Until the people asked actually balk.
    const escalated = escalateWithRefusal(
      lawful,
      [{
        actorId: 'joint_chiefs',
        objective: 'Preserve deterrent posture',
        action: 'The Joint Chiefs decline to carry out the order and advise against it.',
        mechanisms: [],
        perceivedPlayerMechanismIds: lawful.refusableMechanismIds,
        beliefKeysUsed: [],
        capabilityIdsUsed: [],
        confidence: 'HIGH',
      }],
      createCubanCampaign(1).state,
    );
    expect(escalated.institutional).toBeGreaterThan(lawful.institutional);
    expect(escalated.reasons.join(' ')).toMatch(/authority behind it is now in question/i);
  });

  it('makes catastrophe reachable but never certain', async () => {
    const outcomes = new Map<string, number>();
    for (let seed = 1; seed <= 30; seed += 1) {
      const result = await runTurn(createCubanCampaign(seed), RECKLESS, { persist: false });
      const id = result.audit.selectedOutcome.id;
      outcomes.set(id, (outcomes.get(id) ?? 0) + 1);
    }
    const catastrophic = outcomes.get('jeopardy_catastrophe') ?? 0;
    expect(catastrophic).toBeGreaterThan(0);
    expect(catastrophic).toBeLessThan(30);
    // Other answers remain available: the world is not railroaded into killing him.
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('ends the campaign when the exposure proves fatal', async () => {
    let fatal: Awaited<ReturnType<typeof runTurn>> | undefined;
    for (let seed = 1; seed <= 30 && !fatal; seed += 1) {
      const result = await runTurn(createCubanCampaign(seed), RECKLESS, { persist: false });
      if (result.audit.selectedOutcome.id === 'jeopardy_catastrophe'
        && result.audit.stateChanges.some((change) => change.targetId === 'kennedy' && change.field === 'status')) {
        fatal = result;
      }
    }
    expect(fatal).toBeDefined();
    expect(fatal!.campaign.state.entities.kennedy.status).toBe('DESTROYED');
    expect(fatal!.campaign.state.gameOver).toBe(true);
    expect(fatal!.campaign.state.goal.outcomeClass).toBe('CATASTROPHIC_DEFEAT');
    // The loss is attributed, not asserted.
    const loss = fatal!.audit.stateChanges.find((change) => change.targetId === 'kennedy' && change.field === 'status');
    expect(loss!.cause).toMatch(/exposed their own person/i);
  });

  it('lets subordinates refuse to be the instrument of the player’s own exposure', async () => {
    const result = await runTurn(createCubanCampaign(1), RECKLESS, { persist: false });
    const refusals = result.audit.actorActions.filter((action) => /declines to arrange it/i.test(action.action));
    expect(refusals.length).toBeGreaterThanOrEqual(1);
    expect(result.audit.jeopardy!.institutional).toBeGreaterThanOrEqual(60);
  });

  it('records the assessment in the audit and reproduces exactly on the same seed', async () => {
    const once = await runTurn(createCubanCampaign(7), RECKLESS, { persist: false });
    const twice = await runTurn(createCubanCampaign(7), RECKLESS, { persist: false });
    expect(once.audit.jeopardy).toEqual(twice.audit.jeopardy);
    expect(once.audit.selectedOutcome.id).toBe(twice.audit.selectedOutcome.id);
    expect(once.audit.validation.some((issue) => issue.code === 'JEOPARDY_CATASTROPHE_BAND')).toBe(true);
  });
});
