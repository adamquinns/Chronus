import { describe, expect, it } from 'vitest';
import { branchIdFor, deriveBranchEffects } from '../branches';
import { checkFeasibility, compileDeterministically } from '../compiler';
import { commitEffects } from '../state';
import { runTurn } from '../pipeline';
import { playerVisibleState } from '../projections';
import { createCubanCampaign } from '../scenarios';

const DEMAND = 'I demand that LBJ resigns immediately. I want that resignation letter on my desk in 30 mins.';

describe('durable branches: unresolved confrontations become situations', () => {
  it('opens a live branch owned by the party who must decide', async () => {
    const result = await runTurn(createCubanCampaign(19621027), DEMAND, { persist: false });
    const branch = result.campaign.state.arcs.branch_lyndon_johnson;
    expect(branch).toBeDefined();
    expect(branch.status).toBe('ACTIVE');
    expect(branch.ownerId).toBe('lyndon_johnson');
    expect(branch.participantIds).toContain('kennedy');
    expect(branch.participantIds).toContain('lyndon_johnson');
    expect(branch.progress).toBeGreaterThan(0);
    expect(branch.dueTurn).toBeGreaterThan(result.campaign.state.turn);
    // Created through the normal commit path, so it carries causal provenance.
    expect(result.audit.stateChanges.some((change) =>
      change.targetType === 'ARC' && change.targetId === 'branch_lyndon_johnson' && change.field === 'create')).toBe(true);
    expect(result.audit.validation.some((issue) => issue.code === 'BRANCH_OPENED')).toBe(true);
  });

  it('escalates the same branch when the demand is pressed again, never duplicating it', async () => {
    const first = await runTurn(createCubanCampaign(19621027), DEMAND, { persist: false });
    const opened = first.campaign.state.arcs.branch_lyndon_johnson.progress;
    const second = await runTurn(first.campaign, 'Demand again that LBJ resign, and tell him the cabinet is watching.', { persist: false });
    const branches = Object.keys(second.campaign.state.arcs).filter((id) => id.startsWith('branch_'));
    expect(branches).toEqual(['branch_lyndon_johnson']);
    expect(second.campaign.state.arcs.branch_lyndon_johnson.progress).toBeGreaterThan(opened);
    expect(second.audit.validation.some((issue) => issue.code === 'BRANCH_ESCALATED')).toBe(true);
  });

  it('surfaces the branch to the player alongside the scenario’s own arcs', async () => {
    const result = await runTurn(createCubanCampaign(19621027), DEMAND, { persist: false });
    const visible = playerVisibleState(result.campaign.state, result.campaign.beliefs);
    expect(visible.arcs.map((arc) => arc.id)).toContain('branch_lyndon_johnson');
  });

  it('keeps the target in play on later turns even if the player moves on', async () => {
    const first = await runTurn(createCubanCampaign(19621027), DEMAND, { persist: false });
    const second = await runTurn(first.campaign, 'Contact Khrushchev through the Robert Kennedy backchannel.', { persist: false });
    // The branch outranks ambient arcs, so its owner stays in play.
    expect(second.audit.actorSimulationPackets.map((packet) => packet.actorId)).toContain('lyndon_johnson');
    expect(second.campaign.state.arcs.branch_lyndon_johnson.status).toBe('ACTIVE');
  });

  it('hardens into a lasting breach if it runs its course unresolved', async () => {
    const result = await runTurn(createCubanCampaign(19621027), DEMAND, { persist: false });
    const branch = result.campaign.state.arcs.branch_lyndon_johnson;
    expect(branch.onResolve.length).toBeGreaterThanOrEqual(1);
    const rupture = branch.onResolve[0];
    expect(rupture.targetType).toBe('RELATIONSHIP');
    expect(rupture.direction).toBe('NEGATIVE');

    // Drive it to threshold and confirm the breach actually commits.
    const trustBefore = result.campaign.state.relationships.kennedy_johnson.trust;
    const push = (index: number) => ({
      id: `force_threshold_${index}`,
      mechanismId: 'test',
      targetType: 'ARC' as const,
      targetId: branch.id,
      field: 'progress',
      direction: 'POSITIVE' as const,
      impactClass: 'SYSTEMIC' as const,
      confidence: 'VERY_HIGH' as const,
      engagement: 'ENGAGES_STRONGLY' as const,
      cause: 'test: drive the confrontation to its conclusion',
      dependencies: [],
    });
    const committed = commitEffects(result.campaign.state, Array.from({ length: 4 }, (_, index) => push(index)));
    expect(committed.state.arcs[branch.id].status).toBe('RESOLVED');
    expect(committed.state.relationships.kennedy_johnson.trust).toBeLessThan(trustBefore);
  });

  it('cools when the player engages the other party instead of pressing them', async () => {
    const first = await runTurn(createCubanCampaign(777), DEMAND, { persist: false });
    const opened = first.campaign.state.arcs.branch_lyndon_johnson.progress;
    const engaged = await runTurn(first.campaign, 'Meet Vice President Johnson privately and hear his terms.', { persist: false });
    expect(engaged.campaign.state.arcs.branch_lyndon_johnson.progress).toBeLessThan(opened);
    expect(engaged.audit.validation.some((issue) => issue.code === 'BRANCH_DEESCALATED')).toBe(true);
  });

  it('settles when sustained engagement cools it all the way, repairing standing', async () => {
    let current = (await runTurn(createCubanCampaign(777), DEMAND, { persist: false })).campaign;
    let settled = false;
    for (let turn = 0; turn < 4 && !settled; turn += 1) {
      const next = await runTurn(current, 'Meet Vice President Johnson privately and hear his terms.', { persist: false });
      current = next.campaign;
      settled = next.audit.validation.some((issue) => issue.code === 'BRANCH_SETTLED');
    }
    expect(settled).toBe(true);
    expect(current.state.arcs.branch_lyndon_johnson.status).toBe('RESOLVED');
  });

  it('throws off its own events while the player looks elsewhere', async () => {
    let current = (await runTurn(createCubanCampaign(4242), DEMAND, { persist: false })).campaign;
    const kinds = new Set<string>();
    for (let turn = 0; turn < 8; turn += 1) {
      const next = await runTurn(current, 'Allocate 1 reconnaissance sortie.', { persist: false });
      current = next.campaign;
      next.audit.validation
        .filter((issue) => issue.code.startsWith('BRANCH_INCIDENT_'))
        .forEach((issue) => kinds.add(issue.code));
    }
    // A live confrontation cannot sit inert for eight turns.
    expect(kinds.size).toBeGreaterThanOrEqual(1);
  });

  it('is reproducible: the same seed produces the same branch life', async () => {
    const play = async () => {
      let current = (await runTurn(createCubanCampaign(5150), DEMAND, { persist: false })).campaign;
      const log: string[] = [];
      for (let turn = 0; turn < 5; turn += 1) {
        const next = await runTurn(current, 'Allocate 1 reconnaissance sortie.', { persist: false });
        current = next.campaign;
        log.push(...next.audit.validation.filter((issue) => issue.code.startsWith('BRANCH')).map((issue) => issue.message));
      }
      return log;
    };
    expect(await play()).toEqual(await play());
  });

  it('does not open a branch when the player actually has the power to act', () => {
    const campaign = createCubanCampaign(19621027);
    const graph = compileDeterministically('Allocate 1 reconnaissance sortie.', campaign.state);
    const feasibility = checkFeasibility(graph, campaign.state);
    const branches = deriveBranchEffects(graph, feasibility, [], campaign.state);
    expect(branches.opened).toEqual([]);
    expect(branches.effects).toEqual([]);
  });

  it('keeps a private confrontation private without hiding it from the counterparty', async () => {
    const result = await runTurn(createCubanCampaign(4242), 'I quietly demand that LBJ resigns immediately.', { persist: false });
    const branch = result.campaign.state.arcs.branch_lyndon_johnson;
    expect(branch).toBeDefined();
    expect(branch.visibility.classification).not.toBe('PUBLIC');
    // You cannot secretly demand something OF someone: the target knows.
    expect(result.audit.actorActions.some((action) => action.actorId === 'lyndon_johnson')).toBe(true);
  });

  it('draws third parties in over time', async () => {
    let current = (await runTurn(createCubanCampaign(4242), 'I quietly demand that LBJ resigns immediately.', { persist: false })).campaign;
    const initial = current.state.arcs.branch_lyndon_johnson.participantIds.length;
    for (let turn = 0; turn < 7; turn += 1) {
      current = (await runTurn(current, 'Allocate 1 reconnaissance sortie.', { persist: false })).campaign;
    }
    expect(current.state.arcs.branch_lyndon_johnson.participantIds.length).toBeGreaterThan(initial);
  });

  it('scopes branch identity to the parties involved', () => {
    const state = createCubanCampaign(19621027).state;
    const graph = compileDeterministically('Demand that Khrushchev stand down.', state);
    expect(branchIdFor(graph.mechanisms[0])).toBe('branch_khrushchev');
  });
});
