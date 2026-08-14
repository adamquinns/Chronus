import { Campaign, StateChange, TurnAudit } from '../engine/domain';
import { projectChangesForViewer } from '../engine/visibility';

export interface PlayerVisibleChange extends Pick<StateChange, 'id' | 'before' | 'after'> {
  label: string;
  explanation: string;
}

export interface PlayerWhy {
  summary: string;
  mechanismAssessments: string[];
  observableChanges: PlayerVisibleChange[];
}

export const isDeveloperAuditEnabled = (isDevelopment: boolean, flag?: string): boolean =>
  isDevelopment && flag === 'true';

export const projectPlayerVisibleChanges = (
  campaign: Campaign,
  audit: TurnAudit,
): PlayerVisibleChange[] => projectChangesForViewer(
  campaign.state,
  campaign.state.manifest.playerId,
  audit.stateChanges,
  audit.dryStrategy,
).map(({ id, label, before, after, explanation }) => ({ id, label, before, after, explanation }));

export const buildPlayerWhy = (campaign: Campaign, audit: TurnAudit): PlayerWhy => {
  const viable = audit.feasibility.filter((finding) => finding.feasible).length;
  const impossible = audit.feasibility.filter((finding) => finding.classification === 'IMPOSSIBLE').length;
  const selectedProbability = audit.selectedOutcome.probability;
  const uncertainty = audit.randomDraw === undefined
    ? 'No residual uncertainty draw was needed.'
    : `Residual uncertainty selected “${audit.selectedOutcome.label}” from a ${Math.round(selectedProbability * 100)}% adjudicated outcome band.`;
  return {
    summary: impossible === audit.feasibility.length
      ? `The package had no feasible causal mechanism. ${uncertainty}`
      : `${viable} of ${audit.feasibility.length} mechanisms were feasible enough to attempt. ${uncertainty}`,
    mechanismAssessments: audit.dryStrategy.mechanisms.map((mechanism) => {
      const feasibility = audit.feasibility.find((finding) => finding.mechanismId === mechanism.id);
      const finding = audit.adjudication.mechanismFindings.find((candidate) => candidate.mechanismId === mechanism.id);
      const engagement = finding?.engagement.toLowerCase().replaceAll('_', ' ') ?? 'not resolved';
      return `${mechanism.objective}: ${feasibility?.classification.toLowerCase() ?? 'unknown feasibility'}; ${engagement}.`;
    }),
    observableChanges: projectPlayerVisibleChanges(campaign, audit),
  };
};
