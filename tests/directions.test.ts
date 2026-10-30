/**
 * Tests of boost directions: the custom-row parser, the merged list, the
 * system-prompt composition, the `/boost @id` token, and the route's handling
 * of the `direction` field (default, explicit, unknown, malformed).
 * @module tests/directions
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import {
  BUILTIN_DIRECTIONS,
  LIGHT_TOUCH_INSTRUCTION,
  defaultDirectionOf,
  findDirection,
  parseCustomDirections,
  resolveDirections,
  withDirection,
} from '../src/shared/directions'
import { DEFAULT_SYSTEM_PROMPT } from '../src/prompts'
import { splitDirectionToken } from '../src/enhance-command'
import { apply } from '../src/index'
import { DEFAULT_CONFIG, resolveConfig } from '../src/config'

describe('parseCustomDirections', () => {
  it('parses rows, skips comments and blank lines', () => {
    const { directions, issues } = parseCustomDirections([
      '# 注释',
      '',
      'marketing | 营销文案 | 改写成营销需求',
      '  Email | 邮件 | 写成正式邮件 | 带竖线也保留  ',
    ].join('\n'))
    expect(issues).toEqual([])
    expect(directions.map((d) => d.id)).toEqual(['marketing', 'email'])
    expect(directions[1]?.instruction).toBe('写成正式邮件 | 带竖线也保留')
    expect(directions[0]?.label).toEqual({ zh: '营销文案', en: '营销文案' })
    expect(directions.every((d) => d.custom)).toBe(true)
  })

  it('reports malformed rows instead of throwing', () => {
    const { directions, issues } = parseCustomDirections([
      'no pipes here',
      'bad id! | 名称 | 指令',
      'ok | | 指令',
      'ok2 | 名称 |',
      'dup | A | a',
      'dup | B | b',
    ].join('\n'))
    expect(directions.map((d) => d.id)).toEqual(['dup'])
    expect(issues.map((i) => i.line)).toEqual([1, 2, 3, 4, 6])
  })

  it('treats a non-string source as empty', () => {
    expect(parseCustomDirections(undefined)).toEqual({ directions: [], issues: [] })
    expect(parseCustomDirections(42)).toEqual({ directions: [], issues: [] })
  })
})

describe('resolveDirections', () => {
  it('returns the built-ins, general first, when nothing is customized', () => {
    const list = resolveDirections('')
    expect(list.map((d) => d.id)).toEqual(BUILTIN_DIRECTIONS.map((d) => d.id))
    expect(list[0]?.id).toBe('general')
  })

  it('lets a custom row override a built-in in place and appends new ones', () => {
    const list = resolveDirections('concise | 极简 | 只留一句话\nmail | 邮件 | 写成邮件')
    expect(list.map((d) => d.id)).toEqual([...BUILTIN_DIRECTIONS.map((d) => d.id), 'mail'])
    expect(findDirection(list, 'concise')?.instruction).toBe('只留一句话')
    expect(findDirection(list, 'concise')?.label.zh).toBe('极简')
  })

  it('falls back to general for an unknown default', () => {
    const list = resolveDirections('')
    expect(defaultDirectionOf(list, 'nope').id).toBe('general')
    expect(defaultDirectionOf(list, 'coding').id).toBe('coding')
  })
})

describe('withDirection', () => {
  it('makes the quick boost a light touch that overrides the structuring guidance', () => {
    const general = findDirection(resolveDirections(''), 'general')
    const system = withDirection(DEFAULT_SYSTEM_PROMPT, general)
    expect(system.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true)
    expect(system).toContain(LIGHT_TOUCH_INSTRUCTION)
    expect(LIGHT_TOUCH_INSTRUCTION).toContain('Do NOT add a role line, headings, numbered steps')
    expect(LIGHT_TOUCH_INSTRUCTION).toContain('1.5x')
    expect(withDirection(DEFAULT_SYSTEM_PROMPT, undefined)).toBe(DEFAULT_SYSTEM_PROMPT)
  })

  it('appends the instruction after the strategy and restates the hard rules', () => {
    const concise = findDirection(resolveDirections(''), 'concise')
    const system = withDirection(DEFAULT_SYSTEM_PROMPT, concise)
    expect(system.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true)
    expect(system).toContain(concise?.instruction ?? '!')
    expect(system).toContain('never fabricating')
  })
})

describe('splitDirectionToken', () => {
  it('splits a leading @id', () => {
    expect(splitDirectionToken('@Coding 修一下登录')).toEqual({ id: 'coding', text: '修一下登录' })
    expect(splitDirectionToken('@english')).toEqual({ id: 'english', text: '' })
  })
  it('leaves text without a token alone', () => {
    expect(splitDirectionToken('写个脚本 @coding')).toEqual({ text: '写个脚本 @coding' })
    expect(splitDirectionToken('email@example.com 帮我回信')).toEqual({ text: 'email@example.com 帮我回信' })
  })
})

describe('resolveConfig direction fields', () => {
  it('normalizes the default id and tolerates absent fields', () => {
    expect(resolveConfig({ ...DEFAULT_CONFIG, defaultDirection: ' Coding ' }).defaultDirection).toBe('coding')
    const partial = { ...DEFAULT_CONFIG } as Partial<typeof DEFAULT_CONFIG>
    delete partial.defaultDirection
    delete partial.customDirections
    const resolved = resolveConfig(partial as typeof DEFAULT_CONFIG)
    expect(resolved.defaultDirection).toBe('general')
    expect(resolved.customDirections).toBe('')
  })
})

// ---- route ---------------------------------------------------------------

interface CapturedRoute {
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>
}

/** One text answer, then a terminal finish. */
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

describe('POST /prompt-boost/enhance direction field', () => {
  const systems: string[] = []
  let server: Server

  beforeAll(async () => {
    const captured: CapturedRoute[] = []
    const llm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        systems.push(String((options as { system?: unknown }).system))
        return answer('提升后的提示词')
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
    apply(ctx as never, {
      ...DEFAULT_CONFIG,
      provider: 'p',
      model: 'm',
      defaultDirection: 'concise',
      customDirections: 'mail | 邮件 | WRITE-AS-EMAIL',
    })
    const route = captured[0]
    if (route === undefined) throw new Error('route was not registered')
    server = createServer((req, res) => { void route.handler(req, res) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  const post = async (body: unknown): Promise<{ status: number; json: { ok: boolean; error?: { message?: string } } }> => {
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/prompt-boost/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, json: (await response.json()) as never }
  }

  it('uses the configured default direction when none is sent', async () => {
    systems.length = 0
    const { status } = await post({ text: '写个总结' })
    expect(status).toBe(200)
    expect(systems[0]).toContain(findDirection(BUILTIN_DIRECTIONS, 'concise')?.instruction ?? '!')
  })

  it('uses an explicit custom direction', async () => {
    systems.length = 0
    const { status } = await post({ text: '写个总结', direction: 'mail' })
    expect(status).toBe(200)
    expect(systems[0]).toContain('WRITE-AS-EMAIL')
  })

  it('sends the light-touch strategy for the general direction', async () => {
    systems.length = 0
    const { status } = await post({ text: '写个总结', direction: 'general' })
    expect(status).toBe(200)
    expect(systems[0]).toContain(LIGHT_TOUCH_INSTRUCTION)
  })

  it('refuses an unknown direction without calling the model', async () => {
    systems.length = 0
    const { status, json } = await post({ text: '写个总结', direction: 'nope' })
    expect(status).toBe(422)
    expect(json.error?.message).toContain('nope')
    expect(systems).toEqual([])
  })

  it('refuses a non-string direction', async () => {
    const { status } = await post({ text: '写个总结', direction: 3 })
    expect(status).toBe(422)
  })
})
