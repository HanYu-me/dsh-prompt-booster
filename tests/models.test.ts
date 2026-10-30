/**
 * Tests of the host side of the boost model choice: the catalog builder, the
 * availability check, GET /prompt-boost/models, and a chosen provider/model
 * on the enhance POST (used when listed, refused otherwise).
 * @module tests/models
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { buildModelCatalog, catalogFaceOf, isModelAvailable, type LlmCatalogFace } from '../src/models'
import { apply } from '../src/index'
import { DEFAULT_CONFIG } from '../src/config'

/** A fake registry: two working providers, one empty, one failing. */
const registry: LlmCatalogFace = {
  listProviders: () => [
    { id: 'claude-code', name: 'Claude Code' },
    { id: 'opencode-go' },
    { id: 'empty', name: 'Empty' },
    { id: 'broken', name: 'Broken' },
  ],
  listModels: async (provider: string) => {
    if (provider === 'claude-code') return [{ id: 'opus', name: 'Opus' }, { id: 'sonnet', name: 'Sonnet', description: '均衡' }]
    if (provider === 'opencode-go') return [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }]
    if (provider === 'empty') return []
    throw new Error('no key')
  },
}

describe('buildModelCatalog', () => {
  it('groups models by provider, drops empty providers, isolates failures, names the fallback', async () => {
    const catalog = await buildModelCatalog(registry, { provider: 'claude-code', model: 'opus' })
    expect(catalog.groups.map((group) => group.id)).toEqual(['claude-code', 'opencode-go'])
    expect(catalog.groups[1]?.name).toBe('opencode-go')
    expect(catalog.groups[0]?.models[1]).toEqual({ id: 'sonnet', name: 'Sonnet', description: '均衡' })
    expect(catalog.failures).toEqual([{ id: 'broken', name: 'Broken', message: 'no key' }])
    expect(catalog.fallback).toEqual({ provider: 'claude-code', model: 'opus', name: 'Opus', providerName: 'Claude Code' })
  })

  it('omits the fallback when no route resolves', async () => {
    const catalog = await buildModelCatalog(registry, undefined)
    expect(catalog.fallback).toBeUndefined()
  })
})

describe('isModelAvailable / catalogFaceOf', () => {
  it('accepts only listed pairs', async () => {
    expect(await isModelAvailable(registry, 'claude-code', 'opus')).toBe(true)
    expect(await isModelAvailable(registry, 'claude-code', 'gpt-x')).toBe(false)
    expect(await isModelAvailable(registry, 'nope', 'opus')).toBe(false)
    expect(await isModelAvailable(registry, 'broken', 'anything')).toBe(false)
  })

  it('rejects a registry without the listing methods', () => {
    expect(catalogFaceOf(undefined)).toBeUndefined()
    expect(catalogFaceOf({ stream: () => {} })).toBeUndefined()
    expect(catalogFaceOf(registry)).toBe(registry)
  })
})

// ---- routes --------------------------------------------------------------

interface CapturedRoute {
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>
}

function answer(text: string): AsyncIterable<StreamChunk> {
  const chunks: StreamChunk[] = [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
  return (async function* (): AsyncGenerator<StreamChunk> {
    for (const chunk of chunks) yield chunk
  })()
}

describe('model routes (real http)', () => {
  const calls: Array<{ provider: string; model: string }> = []
  let server: Server

  beforeAll(async () => {
    const captured: CapturedRoute[] = []
    const llm = {
      ...registry,
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        calls.push({ provider: options.provider, model: options.model })
        return answer('结果')
      },
    }
    const ctx: Record<string, unknown> = {
      effect(fn: () => unknown): () => void { fn(); return () => {} },
      get(key: string): unknown {
        if (key === 'webServer') return { register: (route: CapturedRoute) => { captured.push(route); return () => {} } }
        if (key === 'llm') return llm
        if (key === 'sessions') return { get: (): undefined => undefined }
        return undefined
      },
      inject(_deps: string[], callback: (child: unknown) => void): void { callback(ctx) },
      emit(): void {},
      on(): () => void { return () => {} },
    }
    // The settings pair stands in for "the default" so the fallback is known.
    apply(ctx as never, { ...DEFAULT_CONFIG, provider: 'claude-code', model: 'opus' })
    const route = captured[0]
    if (route === undefined) throw new Error('route was not registered')
    server = createServer((req, res) => { void route.handler(req, res) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  const url = (path: string): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`
  const post = async (body: unknown): Promise<{ status: number; json: { ok: boolean; value?: { provider: string; model: string }; error?: { message?: string } } }> => {
    const response = await fetch(url('/prompt-boost/enhance'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, json: (await response.json()) as never }
  }

  it('GET /prompt-boost/models returns the live catalog and the fallback', async () => {
    const response = await fetch(url('/prompt-boost/models?sessionId=s1'))
    expect(response.status).toBe(200)
    const json = await response.json() as { ok: boolean; value: { groups: Array<{ id: string }>; fallback?: { name?: string } } }
    expect(json.ok).toBe(true)
    expect(json.value.groups.map((group) => group.id)).toEqual(['claude-code', 'opencode-go'])
    expect(json.value.fallback?.name).toBe('Opus')
  })

  it('refuses a non-GET on the models endpoint', async () => {
    const response = await fetch(url('/prompt-boost/models'), { method: 'POST' })
    expect(response.status).toBe(405)
  })

  it('routes the boost to a chosen, listed model (overriding the settings pair)', async () => {
    calls.length = 0
    const { status, json } = await post({ text: '写个总结', provider: 'opencode-go', model: 'deepseek-v4.1-flash' })
    expect(status).toBe(200)
    expect(calls).toEqual([{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }])
    expect(json.value).toMatchObject({ provider: 'opencode-go', model: 'deepseek-v4.1-flash' })
  })

  it('falls back to the settings pair without a choice', async () => {
    calls.length = 0
    await post({ text: '写个总结' })
    expect(calls).toEqual([{ provider: 'claude-code', model: 'opus' }])
  })

  it('refuses an unlisted model without calling it', async () => {
    calls.length = 0
    const { status, json } = await post({ text: '写个总结', provider: 'evil', model: 'x' })
    expect(status).toBe(422)
    expect(json.error?.message).toContain('当前不可用')
    expect(calls).toEqual([])
  })

  it('refuses half a pair', async () => {
    calls.length = 0
    expect((await post({ text: '写个总结', provider: 'claude-code' })).status).toBe(422)
    expect((await post({ text: '写个总结', model: 'opus' })).status).toBe(422)
    expect((await post({ text: '写个总结', provider: 'claude-code', model: 5 })).status).toBe(422)
    expect(calls).toEqual([])
  })
})

describe('boost calls stay out of the conversation', () => {
  it('never stamps the session id onto the model call', async () => {
    const seen: GenerateOptions[] = []
    const captured: CapturedRoute[] = []
    const llm = {
      ...registry,
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        seen.push(options)
        return answer('结果')
      },
    }
    const ctx: Record<string, unknown> = {
      effect(fn: () => unknown): () => void { fn(); return () => {} },
      get(key: string): unknown {
        if (key === 'webServer') return { register: (route: CapturedRoute) => { captured.push(route); return () => {} } }
        if (key === 'llm') return llm
        if (key === 'sessions') return { get: (): undefined => undefined }
        return undefined
      },
      inject(_deps: string[], callback: (child: unknown) => void): void { callback(ctx) },
      emit(): void {},
      on(): () => void { return () => {} },
    }
    apply(ctx as never, { ...DEFAULT_CONFIG, provider: 'claude-code', model: 'opus' })
    const route = captured[0]
    if (route === undefined) throw new Error('route was not registered')
    const server = createServer((req, res) => { void route.handler(req, res) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/prompt-boost/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '写个总结', sessionId: 'session-abc' }),
      })
      expect(response.status).toBe(200)
      expect(seen).toHaveLength(1)
      expect(seen[0]).not.toHaveProperty('sessionId')
      expect(seen[0]?.purpose).toBeUndefined()
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
