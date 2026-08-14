import { Campaign, StateChange, TurnAudit } from '../engine/domain';
import { projectChangesForViewer } from '../engine/visibility';

export interface PlayerVisibleChange extends Pick<StateChange, 'id' | 'before' | 'after'> {
  label: string;
  explanation: string;
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
