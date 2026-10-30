// @vitest-environment jsdom
/**
 * Tests of the boost model choice: the models page of the right-click menu,
 * remembering the pick in localStorage, and sending it with the request.
 * @module tests/model-choice
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { EnhanceButton } from '../src/client/EnhanceButton'
import { fetchModelCatalog, requestEnhance } from '../src/client/enhance-client'
import { zh } from '../src/client/locales'
import * as ui from '../src/client/ui-state'
import { DEFAULT_CLIENT_SETTINGS, setClientSettings } from '../src/client/settings'
import { MODEL_CHOICE_KEY, getModelChoice, resetModelChoiceForTests, setModelChoice } from '../src/client/model-choice'
import type { ModelCatalog } from '../src/shared/protocol'

vi.mock('../src/client/enhance-client', () => ({
  EnhanceClientError: class extends Error {
    constructor(public detail: unknown) { super('x') }
  },
  requestEnhance: vi.fn(),
  requestEnhanceStream: vi.fn(),
  fetchDirections: vi.fn(() => new Promise(() => {})),
  createDirection: vi.fn(),
  saveDirection: vi.fn(),
  deleteDirection: vi.fn(),
  fetchModelCatalog: vi.fn(),
}))

const t = ((key: string, params?: Record<string, unknown>): string => {
  let s = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) s = s.split(`{${name}}`).join(String(value))
  return s
}) as TranslateNS<'prompt-boost'>

const CATALOG: ModelCatalog = {
  groups: [
    { id: 'claude-code', name: 'Claude Code', models: [{ id: 'opus', name: 'Opus' }, { id: 'sonnet', name: 'Sonnet', description: '均衡' }] },
    { id: 'opencode-go', name: 'OpenCode Go', models: [{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }] },
  ],
  failures: [{ id: 'broken', name: 'Broken Provider', message: 'no key' }],
  fallback: { provider: 'claude-code', model: 'opus', name: 'Opus' },
}

function makeFakeInput(draft: string) {
  const state = { draft, phase: 'plain', occurrences: [] as unknown[], attachmentIds: [] as unknown[] }
  return {
    useInput<S>(selector: (s: typeof state) => S): S {
      return useSyncExternalStore(() => () => {}, () => selector(state))
    },
  }
}

function renderButton(): void {
  const input = makeFakeInput('帮我写个脚本')
  render(<EnhanceButton {...({ t, sessionId: 's1', useInput: input.useInput, inputActions: { setDraft: vi.fn() } } as never)} />)
}

const button = (): HTMLElement => document.querySelector('.dsh-pe-btn') as HTMLElement
const modelRow = (): HTMLElement => screen.getByRole('menuitem', { name: /提升模型/ })

beforeEach(() => {
  localStorage.clear()
  resetModelChoiceForTests()
  setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, quickApply: false })
  vi.mocked(requestEnhance).mockReset()
  vi.mocked(requestEnhance).mockResolvedValue({ text: '改写后的文本', provider: 'p', model: 'm', elapsedMs: 3 })
  vi.mocked(fetchModelCatalog).mockReset()
  vi.mocked(fetchModelCatalog).mockResolvedValue(CATALOG)
})

afterEach(() => {
  cleanup()
  ui.closePanel()
})

describe('model choice in the right-click menu', () => {
  it('shows "follow default" on the first page and lists the live catalog on the models page', async () => {
    renderButton()
    fireEvent.contextMenu(button())
    expect(modelRow().textContent).toContain('提升模型：跟随默认')
    fireEvent.click(modelRow())
    expect(await screen.findByText('Opus')).toBeTruthy()
    expect(fetchModelCatalog).toHaveBeenCalledWith('s1')
    expect(screen.getByText('当前会用：Opus')).toBeTruthy()
    expect(screen.getByText('Claude Code')).toBeTruthy()
    expect(screen.getByText('DeepSeek V4.1 Flash')).toBeTruthy()
    expect(screen.getByText('Broken Provider：读取模型失败')).toBeTruthy()
    const follow = screen.getByRole('menuitemradio', { name: /跟随默认/ })
    expect(follow.getAttribute('aria-checked')).toBe('true')
  })

  it('remembers a picked model, returns to the first page, and sends it with the boost', async () => {
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(modelRow())
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /DeepSeek V4.1 Flash/ }))
    // Back on the directions page, menu still open, no boost started.
    expect(modelRow().textContent).toContain('提升模型：DeepSeek V4.1 Flash')
    expect(requestEnhance).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(MODEL_CHOICE_KEY) ?? '{}')).toMatchObject({ provider: 'opencode-go', model: 'deepseek-v4.1-flash' })
    fireEvent.click(screen.getByRole('menuitem', { name: /精简/ }))
    await screen.findByText('改写后的文本')
    expect(requestEnhance).toHaveBeenCalledWith(
      { sessionId: 's1', text: '帮我写个脚本', direction: 'concise', provider: 'opencode-go', model: 'deepseek-v4.1-flash' },
      expect.anything(),
    )
  })

  it('uses the remembered model for a plain click and names it in the tooltip', async () => {
    setModelChoice({ provider: 'claude-code', model: 'sonnet', name: 'Sonnet' })
    renderButton()
    expect(button().getAttribute('title')).toContain('模型：Sonnet')
    fireEvent.click(button())
    await screen.findByText('改写后的文本')
    expect(vi.mocked(requestEnhance).mock.calls[0]?.[0]).toMatchObject({ provider: 'claude-code', model: 'sonnet' })
  })

  it('switches back to following the default', async () => {
    setModelChoice({ provider: 'claude-code', model: 'sonnet', name: 'Sonnet' })
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(modelRow())
    await screen.findByText('Opus')
    expect(screen.getByRole('menuitemradio', { name: /Sonnet/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: /跟随默认/ }))
    expect(getModelChoice()).toBeUndefined()
    expect(localStorage.getItem(MODEL_CHOICE_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: /初步提升/ }))
    await screen.findByText('改写后的文本')
    const body = vi.mocked(requestEnhance).mock.calls[0]?.[0] as Record<string, unknown>
    expect(body.provider).toBeUndefined()
    expect(body.model).toBeUndefined()
  })

  it('goes back a page on Escape instead of closing', async () => {
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(modelRow())
    await screen.findByText('Opus')
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(document.activeElement?.textContent).toContain('提升模型')
  })

  it('shows a load failure without breaking the menu', async () => {
    vi.mocked(fetchModelCatalog).mockRejectedValueOnce(new Error('offline'))
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(modelRow())
    expect(await screen.findByText('读取模型列表失败：offline')).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /跟随默认/ })).toBeTruthy()
  })

  it('warns when the remembered model is no longer listed', async () => {
    setModelChoice({ provider: 'gone', model: 'old-model', name: 'Old Model' })
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(modelRow())
    expect(await screen.findByText(/之前选的「Old Model」已不在可用列表中/)).toBeTruthy()
  })

  it('ignores a malformed stored choice', () => {
    localStorage.setItem(MODEL_CHOICE_KEY, '{"provider":"x"}')
    resetModelChoiceForTests()
    expect(getModelChoice()).toBeUndefined()
    localStorage.setItem(MODEL_CHOICE_KEY, 'not json')
    resetModelChoiceForTests()
    expect(getModelChoice()).toBeUndefined()
  })
})
