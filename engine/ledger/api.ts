import { z } from 'zod';
import { TurnData } from '../../types';
import { ModelGateway } from '../model';
import { LedgerGateway } from './cassette';
import { createLedger } from './ledger';
import { getScenario } from './scenarios';
import { runTurn as runLedgerTurn } from './turn';
import { buildHistory, buildTurnData } from './view';
import { Campaign, saveCampaign } from './persistence';
import { Ledger, ScenarioDefinition, TurnRecord } from './types';
import { playerView } from './ledger';

/**
 * The surface the Situation Console talks to. Everything the UI needs, backed
 * by the ledger rather than a state graph.
 */

export type { Campaign } from './persistence';
export { DirectiveRevisionNeeded } from './types';

export const startCampaign = (scenarioId: string, seed = Date.now() % 100_000_000): Campaign => ({
  ledger: createLedger(getScenario(scenarioId), seed),
  records: [],
});

export interface TurnProgressEvent { stage: string; label: string; done: boolean }

export const advanceTurn = async (
  campaign: Campaign,
  directive: string,
  gateway: LedgerGateway,
  onProgress?: (event: TurnProgressEvent) => void,
): Promise<Campaign> => {
  const scenario = getScenario(campaign.ledger.scenarioId);
  const result = await runLedgerTurn(scenario, campaign.ledger, directive, {
    gateway,
    onProgress: (stage, label, done) => onProgress?.({ stage, label, done }),
  });
  return { ledger: result.ledger, records: [...campaign.records, result.record] };
};

export const consoleModel = (
  campaign: Campaign,
  suggestions: Array<{ id: string; label: string; directive: string; rationale: string }> = [],
): TurnData => buildTurnData(
  getScenario(campaign.ledger.scenarioId),
  campaign.ledger,
  campaign.records.at(-1),
  suggestions,
);

export const historyModel = (campaign: Campaign) =>
  buildHistory(getScenario(campaign.ledger.scenarioId), campaign.records);

// ── Suggested directives ───────────────────────────────────────────────

const optionsSchema = z.object({
  options: z.array(z.object({
    label: z.string().max(80),
    directive: z.string().max(400),
    rationale: z.string().max(300),
    tradeoff: z.string().max(300),
  })).min(3).max(4),
});

const OPTIONS = `Offer the player three or four things they could do now.

Each must be a distinct APPROACH, not a variation in wording: they should differ in what they use — a channel, force, an institution, time, publicity. Each should be something a person in this role could actually order today.

Write each directive as the player would say it, in the first person. Say plainly what it trades away. Never promise an outcome; the world decides that.`;

export const suggestDirectives = async (campaign: Campaign, gateway: LedgerGateway) => {
  const scenario = getScenario(campaign.ledger.scenarioId);
  const value = await gateway.ask('option_generator', [
    { role: 'system', content: OPTIONS },
    {
      role: 'user',
      content: JSON.stringify({
        role: scenario.playerRole,
        authority: scenario.authority,
        world: playerView(campaign.ledger),
        opening: campaign.records.length ? undefined : scenario.openingScene,
      }),
    },
  ], optionsSchema, 'Options');
  return value.options.map((option, index) => ({ id: `opt_${index}`, ...option }));
};

// ── Advisors ───────────────────────────────────────────────────────────

const advisorSchema = z.object({
  answers: z.array(z.object({
    name: z.string().max(80),
    answer: z.string().max(900),
    biasDisclosure: z.string().max(200),
  })).max(4),
});

const ADVISE = `Answer as these advisors, each in their own voice and from their own view of the situation.

They know only what the player knows. They may be wrong, may disagree with one another, and should. Each answer ends with what that advisor is inclined to under-weigh, stated plainly.

Consulting costs the player nothing and changes nothing in the world: this is counsel, not action.`;

export const consultAdvisors = async (
  campaign: Campaign,
  question: string,
  gateway: LedgerGateway,
) => {
  const scenario = getScenario(campaign.ledger.scenarioId);
  const value = await gateway.ask('narrator', [
    { role: 'system', content: ADVISE },
    {
      role: 'user',
      content: JSON.stringify({
        advisors: scenario.advisors,
        world: playerView(campaign.ledger),
        question,
      }),
    },
  ], advisorSchema, 'AdvisorAnswers');
  return value.answers;
};

// ── Forecast and calibration, carried over ─────────────────────────────

export type ForecastOutcome = 'SETBACK' | 'MIXED' | 'SUCCESS' | 'STRONG_SUCCESS';

export interface PlayerForecast {
  outcome: ForecastOutcome;
  /** The player's read on each actor. Recorded, but only the outcome is scored. */
  actorPredictions?: Array<{ actorId: string; stance: string }>;
  freeText?: string;
}

export interface ForecastScore {
  predicted: ForecastOutcome;
  actual: ForecastOutcome;
  result: 'HIT' | 'ADJACENT' | 'MISS';
  freeText?: string;
}

const ORDER: ForecastOutcome[] = ['SETBACK', 'MIXED', 'SUCCESS', 'STRONG_SUCCESS'];

/**
 * Where the drawn outcome sat among those enumerated, by how favourably the
 * readings moved. Mechanical: no model call, and applied only after the turn
 * has resolved so the forecast can never influence it.
 */
export const scoreForecast = (record: TurnRecord, forecast: PlayerForecast): ForecastScore => {
  const net = record.readings.reduce((sum, reading) => {
    const worseWhenHigher = /tension|risk|pressure|consolidation|exposure/i.test(reading.label);
    return sum + (worseWhenHigher ? -reading.delta : reading.delta);
  }, 0);
  const actual: ForecastOutcome = net <= -12 ? 'SETBACK' : net < 4 ? 'MIXED' : net < 14 ? 'SUCCESS' : 'STRONG_SUCCESS';
  const distance = Math.abs(ORDER.indexOf(forecast.outcome) - ORDER.indexOf(actual));
  return {
    predicted: forecast.outcome,
    actual,
    result: distance === 0 ? 'HIT' : distance === 1 ? 'ADJACENT' : 'MISS',
    freeText: forecast.freeText,
  };
};

export const persist = saveCampaign;
export type { Ledger, ScenarioDefinition, TurnRecord, ModelGateway };
