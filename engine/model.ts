import { z } from 'zod';
import { ModelCallResult } from './domain';

export type ModelRole =
  | 'strategy_compiler'
  | 'critic'
  | 'actor_standard'
  | 'actor_deep'
  | 'adjudicator'
  | 'deep_second_opinion'
  | 'narrator'
  | 'validator';

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
  narrator: { model: 'openai/gpt-5.6-luna', temperature: 0.4, maxTokens: 1800, timeoutMs: 45_000 },
  validator: { model: 'openai/gpt-5.6-luna', temperature: 0, maxTokens: 1600, timeoutMs: 45_000 },
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
  callJson<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>>;
}

const extractJson = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!candidate) throw new Error('Model returned no JSON object.');
  return JSON.parse(candidate);
};

export class OpenRouterGateway implements ModelGateway {
  readonly budget: ModelBudget;
  private readonly responseCache = new Map<string, Promise<ModelCallResult<unknown>>>();

  constructor(
    private readonly apiKey: string,
    readonly routes: ModelRoutes = DEFAULT_MODEL_ROUTES,
    policy: BudgetPolicy = { maxUsd: 1, maxRequests: 12, maxInputTokens: 60_000, maxOutputTokens: 20_000 },
  ) {
    if (!apiKey) throw new Error('OpenRouter API key is required.');
    this.budget = new ModelBudget(policy);
  }

  async callJson<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    const cacheKey = JSON.stringify({ role, name, route: this.routes[role], messages });
    const cached = this.responseCache.get(cacheKey);
    if (cached) return cached as Promise<ModelCallResult<T>>;
    const pending = this.performCall(role, messages, schema, name);
    this.responseCache.set(cacheKey, pending as Promise<ModelCallResult<unknown>>);
    try {
      return await pending;
    } catch (error) {
      this.responseCache.delete(cacheKey);
      throw error;
    }
  }

  private async performCall<T>(role: ModelRole, messages: ModelMessage[], schema: z.ZodType<T>, name: string): Promise<ModelCallResult<T>> {
    const route = this.routes[role];
    let repairMessages = [...messages];
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
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
            ...repairMessages,
            { role: 'system', content: `Return exactly one valid JSON object for schema ${name}. Do not include markdown or commentary.` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
              strict: true,
              schema: z.toJSONSchema(schema),
            },
          },
          usage: { include: true },
        }),
      });
      if (!response.ok) throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
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
        const value = schema.parse(extractJson(rawText));
        return { value, model: route.model, usage: { inputTokens, outputTokens, costUsd }, rawText };
      } catch (error) {
        lastError = error;
        repairMessages = [
          ...messages,
          { role: 'assistant', content: rawText },
          { role: 'user', content: `The JSON failed schema validation. Repair structure and enum values only; do not change substantive judgment. Validation: ${error instanceof Error ? error.message.slice(0, 1200) : 'unknown error'}` },
        ];
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Model output failed ${name} validation.`);
  }
}

export class StubGateway implements ModelGateway {
  readonly budget = new ModelBudget({ maxUsd: 0, maxRequests: 0, maxInputTokens: 0, maxOutputTokens: 0 });
  constructor(readonly routes: ModelRoutes = DEFAULT_MODEL_ROUTES) {}
  async callJson<T>(): Promise<ModelCallResult<T>> {
    throw new Error('No model gateway configured.');
  }
}
