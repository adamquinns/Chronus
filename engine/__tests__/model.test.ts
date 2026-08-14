import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenRouterGateway } from '../model';

afterEach(() => vi.unstubAllGlobals());

describe('content-addressed model cache', () => {
  it('shares identical in-flight structured calls', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ kind: 'DIPLOMACY' }) } }],
      usage: { prompt_tokens: 20, completion_tokens: 5, cost: 0.001 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const gateway = new OpenRouterGateway('sk-or-v1-test-key-that-is-long-enough-for-tests');
    const schema = z.object({ kind: z.literal('DIPLOMACY') });
    const messages = [{ role: 'user' as const, content: 'identical dry strategy' }];
    const [first, second] = await Promise.all([
      gateway.callJson('strategy_compiler', messages, schema, 'CacheTest'),
      gateway.callJson('strategy_compiler', messages, schema, 'CacheTest'),
    ]);
    expect(first.value).toEqual(second.value);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(gateway.budget.snapshot().requests).toBe(1);
    expect(gateway.tracesSince(0)).toHaveLength(2);
    expect(gateway.tracesSince(0).map((trace) => trace.status).sort()).toEqual(['CACHED', 'SUCCEEDED']);
    expect(gateway.tracesSince(0).every((trace) => trace.messages[0].content === 'identical dry strategy')).toBe(true);
  });
});
