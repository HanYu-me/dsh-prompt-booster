/**
 * Tests of the mode editor's host side: the three-layer list (built-in →
 * settings → saved), the JSON file store, and the /prompt-boost/directions
 * routes (list, create, save, delete/restore, validation), including that an
 * edited template is what the next boost actually sends.
 * @module tests/direction-store
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { BUILTIN_DIRECTIONS, findDirection, resolveDirections } from '../src/shared/directions'
import { createFileStore, createMemoryStore, rowsOf, type DirectionStore } from '../src/direction-store'
import { registerEnhanceRoute } from '../src/enhance-routes'
import { DEFAULT_CONFIG, type Config } from '../src/config'
import type { DirectionList } from '../src/shared/protocol'

describe('resolveDirections layers', () => {
  it('lets saved rows replace built-ins and settings rows in place, remembering what they replaced', () => {
    const list = resolveDirections('mail | 邮件 | 写成邮件', [
      { id: 'concise', label: '超短', instruction: '一句话' },
      { id: 'mail', label: '正式邮件', instruction: '写成正式邮件' },
      { id: 'm-new', label: '新模式', instruction: '新的' },
    ])
    const concise = findDirection(list, 'concise')
    expect(concise).toMatchObject({ label: { zh: '超短' }, instruction: '一句话', source: 'saved', replaces: 'builtin' })
    expect(findDirection(list, 'mail')).toMatchObject({ instruction: '写成正式邮件', source: 'saved', replaces: 'settings' })
    expect(findDirection(list, 'm-new')).toMatchObject({ source: 'saved' })
    expect(findDirection(list, 'm-new')?.replaces).toBeUndefined()
    expect(list.map((d) => d.id)).toEqual([...BUILTIN_DIRECTIONS.map((d) => d.id), 'mail', 'm-new'])
    expect(findDirection(list, 'general')?.source).toBe('builtin')
  })

  it('skips malformed saved rows', () => {
    const list = resolveDirections('', [
      { id: 'BAD ID', label: 'x', instruction: 'y' },
      { id: 'blank', label: '  ', instruction: 'y' },
    ])
    expect(list.map((d) => d.id)).toEqual(BUILTIN_DIRECTIONS.map((d) => d.id))
  })
})

describe('file store', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pb-store-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads nothing when the file is missing, and round-trips what it writes', () => {
    const path = join(dir, 'nested', 'directions.json')
    const store = createFileStore(path)
    expect(store.read()).toEqual([])
    store.write([{ id: 'm-a', label: '甲', instruction: '指令' }])
    expect(store.read()).toEqual([{ id: 'm-a', label: '甲', instruction: '指令' }])
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ version: 1 })
  })

  it('treats a corrupt file as empty instead of throwing', () => {
    const path = join(dir, 'directions.json')
    writeFileSync(path, '{ not json')
    expect(createFileStore(path).read()).toEqual([])
  })

  it('drops malformed and duplicate rows', () => {
    expect(rowsOf({ directions: [
      { id: 'ok', label: ' 好 ', instruction: 'x' },
      { id: 'ok', label: 'dup', instruction: 'x' },
      { id: 'Bad!', label: 'x', instruction: 'x' },
      { id: 'n', label: 'x' },
      null,
    ] })).toEqual([{ id: 'ok', label: '好', instruction: 'x' }])
    expect(rowsOf(null)).toEqual([])
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

describe('/prompt-boost/directions routes (real http)', () => {
  const systems: string[] = []
  let store: DirectionStore
  let server: Server
  const config: Config = { ...DEFAULT_CONFIG, provider: 'p', model: 'm', customDirections: 'mail | 邮件 | 写成邮件' }

  beforeAll(async () => {
    store = createMemoryStore()
    const captured: CapturedRoute[] = []
    const llm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        systems.push(String(options.system))
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
    }
    registerEnhanceRoute(ctx as never, () => config, store)
    const route = captured[0]
    if (route === undefined) throw new Error('route was not registered')
    server = createServer((req, res) => { void route.handler(req, res) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  beforeEach(() => {
    store.write([])
  })

  const call = async (method: string, path: string, body?: unknown): Promise<{ status: number; ok: boolean; value?: DirectionList; message?: string }> => {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method,
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const json = await response.json() as { ok: boolean; value?: DirectionList; error?: { message?: string } }
    return { status: response.status, ok: json.ok, ...(json.value !== undefined ? { value: json.value } : {}), ...(json.error?.message !== undefined ? { message: json.error.message } : {}) }
  }

  it('lists built-in + settings modes with the default id', async () => {
    const { status, value } = await call('GET', '/prompt-boost/directions')
    expect(status).toBe(200)
    expect(value?.directions.map((d) => d.id)).toEqual([...BUILTIN_DIRECTIONS.map((d) => d.id), 'mail'])
    expect(value?.defaultId).toBe('general')
  })

  it('creates a mode that the next boost uses', async () => {
    const created = await call('POST', '/prompt-boost/directions', { label: ' 产品需求 ', instruction: 'WRITE-AS-PRD' })
    expect(created.status).toBe(200)
    const id = created.value?.createdId ?? ''
    expect(id).toMatch(/^m-[a-z0-9]+$/)
    expect(findDirection(created.value?.directions ?? [], id)).toMatchObject({ label: { zh: '产品需求' }, source: 'saved' })
    expect(store.read()).toEqual([{ id, label: '产品需求', instruction: 'WRITE-AS-PRD' }])
    systems.length = 0
    const boost = await call('POST', '/prompt-boost/enhance', { text: '写个总结', direction: id })
    expect(boost.status).toBe(200)
    expect(systems[0]).toContain('WRITE-AS-PRD')
  })

  it('edits a built-in in place and restores it with DELETE', async () => {
    const saved = await call('PUT', '/prompt-boost/directions/concise', { label: '超短', instruction: 'ONE-LINE-ONLY' })
    expect(saved.status).toBe(200)
    expect(findDirection(saved.value?.directions ?? [], 'concise')).toMatchObject({ label: { zh: '超短' }, replaces: 'builtin' })
    systems.length = 0
    await call('POST', '/prompt-boost/enhance', { text: '写个总结', direction: 'concise' })
    expect(systems[0]).toContain('ONE-LINE-ONLY')

    const restored = await call('DELETE', '/prompt-boost/directions/concise')
    expect(restored.status).toBe(200)
    expect(findDirection(restored.value?.directions ?? [], 'concise')).toMatchObject({ label: { zh: '精简' }, source: 'builtin' })
    expect(store.read()).toEqual([])
  })

  it('edits the quick boost (general) too', async () => {
    await call('PUT', '/prompt-boost/directions/general', { label: '初步提升', instruction: 'MY-LIGHT-TOUCH' })
    systems.length = 0
    await call('POST', '/prompt-boost/enhance', { text: '写个总结' })
    expect(systems[0]).toContain('MY-LIGHT-TOUCH')
  })

  it('deletes a created mode', async () => {
    const id = (await call('POST', '/prompt-boost/directions', { label: '临时', instruction: 'x' })).value?.createdId ?? ''
    const removed = await call('DELETE', `/prompt-boost/directions/${id}`)
    expect(removed.status).toBe(200)
    expect(findDirection(removed.value?.directions ?? [], id)).toBeUndefined()
  })

  it('refuses to delete a mode that only exists as a built-in or in settings', async () => {
    expect((await call('DELETE', '/prompt-boost/directions/concise')).status).toBe(422)
    expect((await call('DELETE', '/prompt-boost/directions/mail')).status).toBe(422)
    expect((await call('DELETE', '/prompt-boost/directions/nope')).status).toBe(404)
  })

  it('refuses PUT on an unknown id (ids are minted by POST only)', async () => {
    expect((await call('PUT', '/prompt-boost/directions/made-up', { label: 'x', instruction: 'y' })).status).toBe(404)
    expect(store.read()).toEqual([])
  })

  it('validates the name and template', async () => {
    const empty = await call('POST', '/prompt-boost/directions', { label: '  ', instruction: 'x' })
    expect(empty.status).toBe(422)
    expect(empty.message).toContain('名称不能为空')
    expect((await call('POST', '/prompt-boost/directions', { label: '一二三四五六七八九十一二三四五六七八九十一', instruction: 'x' })).status).toBe(422)
    expect((await call('POST', '/prompt-boost/directions', { label: 'x', instruction: 'y'.repeat(4001) })).status).toBe(422)
    expect((await call('POST', '/prompt-boost/directions', { label: 'x', instruction: 5 })).status).toBe(422)
    expect(store.read()).toEqual([])
  })

  it('answers 405 for the wrong method', async () => {
    expect((await call('PUT', '/prompt-boost/directions', { label: 'x', instruction: 'y' })).status).toBe(405)
    expect((await call('GET', '/prompt-boost/directions/concise')).status).toBe(405)
  })

  it('caps the number of saved modes', async () => {
    store.write(Array.from({ length: 30 }, (_, index) => ({ id: `m-${index}`, label: `模式${index}`, instruction: 'x' })))
    const over = await call('POST', '/prompt-boost/directions', { label: '再来一个', instruction: 'x' })
    expect(over.status).toBe(422)
    expect(over.message).toContain('上限')
  })
})
