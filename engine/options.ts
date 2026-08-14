import { Campaign, TurnOption } from './domain';
import { ModelGateway } from './model';
import { playerVisibleState } from './projections';
import { turnOptionsSchema } from './schemas';

const fallback: Record<string, TurnOption[]> = {
  cuban_missile_crisis_black_saturday: [
    { id: 'cmc_a', label: 'Open the backchannel', directiveText: 'Contact Khrushchev through Robert Kennedy and Dobrynin; test a private non-invasion and Turkey trade while preserving public ambiguity.', rationale: 'Creates a face-saving diplomatic channel.', tradeoff: 'Secrecy and delay may deepen military mistrust.' },
    { id: 'cmc_b', label: 'Hold and verify', directiveText: 'Allocate 1 reconnaissance sortie while ordering the quarantine line to avoid escalatory contact and preparing a measured public statement.', rationale: 'Improves information before an irreversible decision.', tradeoff: 'Another aircraft or naval incident could collapse control.' },
    { id: 'cmc_c', label: 'Prepare limited force', directiveText: 'Order the Joint Chiefs to prepare a limited strike on the responsible SAM site without executing it, and privately signal the preparation to Moscow.', rationale: 'Adds credible coercive leverage.', tradeoff: 'Readiness itself may be interpreted as the opening of war.' },
  ],
  american_twilight: [
    { id: 'twilight_a', label: 'Build the state compact', directiveText: 'Privately recruit governors and state attorneys general into a coordinated legal and administrative defense of election authority.', rationale: 'Builds institutional resistance before confrontation.', tradeoff: 'Discovery could trigger retaliation before the coalition is ready.' },
    { id: 'twilight_b', label: 'Litigate narrowly', directiveText: 'Prepare a narrowly tailored injunction using credible plaintiffs and state election-law claims.', rationale: 'Uses established institutions and preserves legitimacy.', tradeoff: 'Courts may move too slowly or narrow the dispute.' },
    { id: 'twilight_c', label: 'Make the public case', directiveText: 'Coordinate election officials, civic groups, and conservative rule-of-law voices for a public defense of lawful administration.', rationale: 'Broadens legitimacy beyond one faction.', tradeoff: 'Public exposure hardens opposition and strains the coalition.' },
  ],
};

export const buildOptionPrompt = (campaign: Campaign) => ({
  visibleWorld: playerVisibleState(campaign.state, campaign.beliefs),
  latestNarrative: campaign.audits.at(-1)?.narrative,
  goal: campaign.state.goal,
});

export const generateTurnOptions = async (campaign: Campaign, gateway?: ModelGateway): Promise<TurnOption[]> => {
  const defaults = fallback[campaign.state.manifest.id] ?? fallback.cuban_missile_crisis_black_saturday;
  if (!gateway) return structuredClone(defaults);
  try {
    const result = await gateway.callJson('option_generator', [
      { role: 'system', content: 'Generate 3–5 materially different strategic directives available to the player. Span distinct causal mechanism kinds. Use only supplied player-visible information. Do not use or imply hidden facts. Options receive no gameplay privilege and must be concrete enough for the normal strategy compiler.' },
      { role: 'user', content: JSON.stringify(buildOptionPrompt(campaign)) },
    ], turnOptionsSchema, 'TurnOptions');
    return result.value.options;
  } catch {
    return structuredClone(defaults);
  }
};
