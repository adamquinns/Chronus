import { Campaign, TurnResult } from './domain';
import { ModelGateway } from './model';
import { runTurn, RunTurnOptions } from './pipeline';
import { assertValidScenario, validateScenario } from './scenario';
import { consultAdvisors } from './advisors';

export interface CampaignStore {
  save(campaign: Campaign): Promise<void>;
}

export interface SimulationEngineServices {
  models?: ModelGateway;
  storage?: CampaignStore;
}

export class ChronusSimulationEngine {
  constructor(private readonly services: SimulationEngineServices = {}) {}

  validate(campaign: Campaign) {
    return validateScenario(campaign);
  }

  async resolveTurn(
    campaign: Campaign,
    directive: string,
    callbacks: Pick<RunTurnOptions, 'onProgress' | 'onPreview'> = {},
  ): Promise<TurnResult> {
    assertValidScenario(campaign);
    return runTurn(campaign, directive, {
      ...callbacks,
      gateway: this.services.models,
      storage: this.services.storage,
      persist: Boolean(this.services.storage),
    });
  }

  async consult(campaign: Campaign, question: string) {
    assertValidScenario(campaign);
    return consultAdvisors(campaign, question, this.services.models);
  }
}
