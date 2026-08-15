import { z } from 'zod';
/**
 * The gateway's own vocabulary. These lived in the state-graph domain module
 * the ledger rewrite replaced; they describe model transport, not the world,
 * so they belong here.
 */
export interface ModelCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ModelCallResult<T> {
  value: T;
  model: string;
  usage: ModelCallUsage;
  rawText: string;
}

export interface ModelMessageSnapshot {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelCallTrace {
  id: string;
  role: string;
  model: string;
  schemaName: string;
  startedAt: string;
  completedAt: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CACHED';
  messages: ModelMessageSnapshot[];
  rawText?: string;
  usage?: ModelCallUsage;
  error?: string;
}

export type ModelRole =
  | 'strategy_compiler'
  | 'critic'
  | 'actor_standard'
  | 'actor_deep'
  | 'adjudicator'
  | 'deep_second_opinion'
  | 'narrator'
  | 'validator'
  | 'scenario_architect'
  | 'scenario_researcher'
  | 'option_generator'
  | 'world_grounder';

export interface ModelRoute {
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
}

export type ModelRoutes = Record<ModelRole, ModelRoute>;

export const DEFAULT_MODEL_ROUTES: ModelRoutes = {
  strategy_compiler: { model: 'openai/gpt-5.6-luna', temperature: 0.1, maxTokens: 2400, timeoutMs: 45_000 },
  critic: { model: 'anthropic/claude-sonnet-5', temperature: 0.15, maxTokens: 2600, timeoutMs: 60_000 },
  actor_standard: { model: 'openai/gpt-5.6-luna', temperature: 0.2, maxTokens: 1800, timeoutMs: 45_000 },
  actor_deep: { model: 'anthropic/claude-sonnet-5', temperature: 0.2, maxTokens: 2400, timeoutMs: 60_000 },
  adjudicator: { model: 'openai/gpt-5.6-terra', temperature: 0.1, maxTokens: 6000, timeoutMs: 90_000 },
  deep_second_opinion: { model: 'anthropic/claude-fable-5', temperature: 0.1, maxTokens: 6000, timeoutMs: 75_000 },
  narrator: { model: 'anthropic/claude-sonnet-5', temperature: 0.5, maxTokens: 3200, timeoutMs: 75_000 },
  validator: { model: 'openai/gpt-5.6-luna', temperature: 0, maxTokens: 1600, timeoutMs: 45_000 },
  scenario_architect: { model: 'openai/gpt-5.6-terra', temperature: 0.15, maxTokens: 9000, timeoutMs: 120_000 },
  scenario_researcher: { model: 'anthropic/claude-sonnet-5', temperature: 0.1, maxTokens: 5000, timeoutMs: 90_000 },
  option_generator: { model: 'openai/gpt-5.6-luna', temperature: 0.4, maxTokens: 1200, timeoutMs: 45_000 },
  world_grounder: { model: 'openai/gpt-5.6-luna', temperature: 0.1, maxTokens: 2400, timeoutMs: 45_000 },
};

export type ModelPresetName = 'economy' | 'standard' | 'cinematic';

/** Named routing presets. Principle: spend on the adjudicator, starve
 * extraction/persona roles. `standard` is the default routing; `economy`
 * moves worker roles to a haiku-class model; `cinematic` upgrades the
 * narrator and critic one tier. Model choice remains eval-gated: run
 * `npm run eval:live -- --preset <name>` before trusting a preset. */
export const MODEL_PRESETS: Record<ModelPresetName, ModelRoutes> = {
  standard: DEFAULT_MODEL_ROUTES,
  economy: {
    ...DEFAULT_MODEL_ROUTES,
    strategy_compiler: { model: 'anthropic/claude-haiku-4.5', temperature: 0.1, maxTokens: 2400, timeoutMs: 45_000 },
    validator: { model: 'anthropic/claude-haiku-4.5', temperature: 0, maxTokens: 1600, timeoutMs: 45_000 },
    actor_standard: { model: 'anthropic/claude-haiku-4.5', temperature: 0.2, maxTokens: 1800, timeoutMs: 45_000 },
    option_generator: { model: 'anthropic/claude-haiku-4.5', temperature: 0.4, maxTokens: 1200, timeoutMs: 45_000 },
    world_grounder: { model: 'anthropic/claude-haiku-4.5', temperature: 0.1, maxTokens: 2400, timeoutMs: 45_000 },
    actor_deep: { model: 'openai/gpt-5.6-luna', temperature: 0.2, maxTokens: 2400, timeoutMs: 60_000 },
    critic: { model: 'openai/gpt-5.6-luna', temperature: 0.15, maxTokens: 2600, timeoutMs: 60_000 },
    adjudicator: { model: 'openai/gpt-5.6-luna', temperature: 0.1, maxTokens: 5000, timeoutMs: 90_000 },
    narrator: { model: 'openai/gpt-5.6-luna', temperature: 0.5, maxTokens: 2400, timeoutMs: 60_000 },
  },
  cinematic: {
    ...DEFAULT_MODEL_ROUTES,
    critic: { model: 'openai/gpt-5.6-terra', temperature: 0.15, maxTokens: 3200, timeoutMs: 90_000 },
    narrator: { model: 'anthropic/claude-fable-5', temperature: 0.6, maxTokens: 4000, timeoutMs: 90_000 },
  },
};

export interface BudgetPolicy {
  maxUsd: number;
  maxRequests: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface BudgetSnapshot {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export class ModelBudget {
  private usage: BudgetSnapshot = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

  constructor(readonly policy: BudgetPolicy) {}

  assertAvailable() {
    if (this.usage.requests >= this.policy.maxRequests) throw new Error('Model request budget exhausted.');
    if (this.usage.inputTokens >= this.policy.maxInputTokens) throw new Error('Model input-token budget exhausted.');
    if (this.usage.outputTokens >= this.policy.maxOutputTokens) throw new Error('Model output-token budget exhausted.');
    if (this.usage.costUsd >= this.policy.maxUsd) throw new Error('Model dollar budget exhausted.');
  }

  record(inputTokens: number, outputTokens: number, costUsd: number) {
    this.usage.requests += 1;
    this.usage.inputTokens += Math.max(0, inputTokens);
    this.usage.outputTokens += Math.max(0, outputTokens);
    this.usage.costUsd += Math.max(0, costUsd);
  }

  snapshot(): BudgetSnapshot {
    return { ...this.usage };
  }
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelGateway {
  readonly routes: ModelRoutes;
  readonly budget: ModelBudget;
  traceCount(): number;
  tracesSince(index: number): ModelCallTrace[];
  callJson<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>>;
}

const extractJson = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!candidate) throw new Error('Model returned no JSON object.');
  return JSON.parse(candidate);
};

type JsonSchemaNode = Record<string, unknown>;

export const providerStrictJsonSchema = (schema: JsonSchemaNode): JsonSchemaNode => {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const node = Object.fromEntries(Object.entries(value as JsonSchemaNode).map(([key, child]) => [key, visit(child)])) as JsonSchemaNode;
    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
      const properties = node.properties as Record<string, JsonSchemaNode>;
      const originallyRequired = new Set(Array.isArray(node.required) ? node.required as string[] : []);
      for (const [key, property] of Object.entries(properties)) {
        if (!originallyRequired.has(key)) properties[key] = { anyOf: [property, { type: 'null' }] };
      }
      node.required = Object.keys(properties);
    }
    return node;
  };
  return visit(structuredClone(schema)) as JsonSchemaNode;
};

const stripNullObjectFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripNullObjectFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== null)
    .map(([key, child]) => [key, stripNullObjectFields(child)]));
};

export class OpenRouterGateway implements ModelGateway {
  readonly budget: ModelBudget;
  private readonly responseCache = new Map<string, Promise<ModelCallResult<unknown>>>();
  private readonly traces: ModelCallTrace[] = [];

  readonly routes: ModelRoutes;

  constructor(
    private readonly apiKey: string,
    routes: ModelRoutes | ModelPresetName = DEFAULT_MODEL_ROUTES,
    policy: BudgetPolicy | ModelBudget = { maxUsd: 1, maxRequests: 12, maxInputTokens: 60_000, maxOutputTokens: 20_000 },
  ) {
    if (!apiKey) throw new Error('OpenRouter API key is required.');
    this.routes = typeof routes === 'string' ? MODEL_PRESETS[routes] : (routes ?? DEFAULT_MODEL_ROUTES);
    this.budget = policy instanceof ModelBudget ? policy : new ModelBudget(policy);
  }

  async callJson<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    const startedAt = new Date().toISOString();
    const traceId = `model_${this.traces.length + 1}_${role}_${name}`;
    const cacheKey = JSON.stringify({ role, name, route: this.routes[role], messages });
    const cached = this.responseCache.get(cacheKey);
    if (cached) {
      try {
        const result = await cached as ModelCallResult<T>;
        this.traces.push({ id: traceId, role, model: this.routes[role].model, schemaName: name, startedAt, completedAt: new Date().toISOString(), status: 'CACHED', messages: structuredClone(messages), rawText: result.rawText, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } });
        return result;
      } catch (error) {
        this.traces.push({ id: traceId, role, model: this.routes[role].model, schemaName: name, startedAt, completedAt: new Date().toISOString(), status: 'FAILED', messages: structuredClone(messages), error: error instanceof Error ? error.message : 'Unknown cached model error' });
        throw error;
      }
    }
    const pending = this.performCall(role, messages, schema, name);
    this.responseCache.set(cacheKey, pending as Promise<ModelCallResult<unknown>>);
    try {
      const result = await pending;
      this.traces.push({ id: traceId, role, model: this.routes[role].model, schemaName: name, startedAt, completedAt: new Date().toISOString(), status: 'SUCCEEDED', messages: structuredClone(messages), rawText: result.rawText, usage: result.usage });
      return result;
    } catch (error) {
      this.responseCache.delete(cacheKey);
      this.traces.push({ id: traceId, role, model: this.routes[role].model, schemaName: name, startedAt, completedAt: new Date().toISOString(), status: 'FAILED', messages: structuredClone(messages), error: error instanceof Error ? error.message : 'Unknown model error' });
      throw error;
    }
  }

  traceCount() { return this.traces.length; }

  tracesSince(index: number) { return structuredClone(this.traces.slice(index)); }

  private async performCall<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    const route = this.routes[role];
    let repairMessages = [...messages];
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      this.budget.assertAvailable();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(route.timeoutMs ?? 90_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://github.com/adamquinns/Chronus',
          'X-Title': 'Chronus Divergence Engine',
        },
        body: JSON.stringify({
          model: route.model,
          temperature: route.temperature,
          max_tokens: route.maxTokens,
          seed: route.model.startsWith('openai/') ? 19621027 : undefined,
          messages: [
            // Anthropic routes get an explicit prompt-cache breakpoint on the
            // large context block so within-turn re-calls (repairs, retries)
            // and stable prefixes are billed at cached-input rates.
            ...(route.model.startsWith('anthropic/')
              ? repairMessages.map((message, index) => index === Math.min(1, repairMessages.length - 1)
                ? { role: message.role, content: [{ type: 'text', text: message.content, cache_control: { type: 'ephemeral' } }] }
                : message)
              : repairMessages),
            { role: 'system', content: `Return exactly one valid JSON object for schema ${name}. Do not include markdown or commentary.` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
              strict: true,
              schema: providerStrictJsonSchema(z.toJSONSchema(schema) as JsonSchemaNode),
            },
          },
          usage: { include: true },
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1600);
        throw new Error(`OpenRouter request failed for ${role}/${route.model}/${name}: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`);
      }
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      };
      const rawText = payload.choices?.[0]?.message?.content ?? '';
      const inputTokens = payload.usage?.prompt_tokens ?? 0;
      const outputTokens = payload.usage?.completion_tokens ?? 0;
      const costUsd = payload.usage?.cost ?? 0;
      this.budget.record(inputTokens, outputTokens, costUsd);
      try {
        const value = schema.parse(stripNullObjectFields(extractJson(rawText)));
        return { value, model: route.model, usage: { inputTokens, outputTokens, costUsd }, rawText };
      } catch (error) {
        lastError = error;
        // A length overflow is the one failure the model must fix by rewriting
        // content: telling it to preserve the text verbatim guarantees a loop.
        const detail = error instanceof Error ? error.message.slice(0, 1200) : 'unknown error';
        const tooLong = /too_big|too long|at most \d+ character/i.test(detail);
        repairMessages = [
          ...messages,
          { role: 'assistant', content: rawText },
          {
            role: 'user',
            content: tooLong
              ? `The JSON exceeded a length limit. Shorten the offending fields to fit, keeping the same events, names and judgment — cut wording, never substance. Validation: ${detail}`
              : `The JSON failed schema validation. Repair structure and enum values only; do not change substantive judgment. Validation: ${detail}`,
          },
        ];
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Model output failed ${name} validation.`);
  }
}

export class StubGateway implements ModelGateway {
  readonly budget = new ModelBudget({ maxUsd: 0, maxRequests: 0, maxInputTokens: 0, maxOutputTokens: 0 });
  constructor(readonly routes: ModelRoutes = DEFAULT_MODEL_ROUTES) {}
  traceCount() { return 0; }
  tracesSince() { return []; }
  async callJson<T>(): Promise<ModelCallResult<T>> {
    throw new Error('No model gateway configured.');
  }
}
