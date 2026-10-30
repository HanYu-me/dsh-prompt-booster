// @vitest-environment jsdom
/**
 * Tests of the quick boost: the general direction replaces the draft directly
 * (no preview panel), shows progress and errors in the strip above the
 * composer, stays undoable, cancels on a second click, and never overwrites
 * edits made while it was running.
 * @module tests/quick-boost
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { EnhanceButton } from '../src/client/EnhanceButton'
import { UndoBar } from '../src/client/UndoBar'
import { EnhanceClientError, requestEnhance, requestEnhanceStream } from '../src/client/enhance-client'
import { zh } from '../src/client/locales'
import * as ui from '../src/client/ui-state'
import { DEFAULT_CLIENT_SETTINGS, setClientSettings } from '../src/client/settings'
import { resetModelChoiceForTests } from '../src/client/model-choice'
import type { EnhanceResult } from '../src/shared/protocol'

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

function makeFakeInput(draft: string) {
  let state = { draft, phase: 'plain', occurrences: [] as unknown[], attachmentIds: [] as unknown[] }
  const listeners = new Set<() => void>()
  return {
    useInput<S>(selector: (s: typeof state) => S): S {
      return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => selector(state))
    },
    set(next: Partial<typeof state>): void {
      state = { ...state, ...next }
      for (const l of listeners) l()
    },
    get draft(): string { return state.draft },
  }
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function renderComposer(draft = '帮我写个脚本') {
  const input = makeFakeInput(draft)
  const setDraft = vi.fn((text: string) => input.set({ draft: text }))
  const props = { t, sessionId: 's1', useInput: input.useInput, inputActions: { setDraft } }
  render(
    <>
      <UndoBar {...(props as never)} />
      <EnhanceButton {...(props as never)} />
    </>,
  )
  return { input, setDraft }
}

const button = (): HTMLElement => document.querySelector('.dsh-pe-btn') as HTMLElement
const RESULT: EnhanceResult = { text: '帮我写一个 Python 脚本，批量压缩文件夹里的图片。', provider: 'p', model: 'm', elapsedMs: 3 }

beforeEach(() => {
  localStorage.clear()
  resetModelChoiceForTests()
  setClientSettings({ ...DEFAULT_CLIENT_SETTINGS })
  vi.mocked(requestEnhance).mockReset()
  vi.mocked(requestEnhanceStream).mockReset()
  vi.mocked(requestEnhanceStream).mockResolvedValue(RESULT)
})

afterEach(() => {
  cleanup()
  ui.closePanel()
  const quick = ui.getQuick()
  if (quick !== undefined) ui.endQuick(quick.sessionId)
  ui.setNotice('s1', undefined)
  while (ui.peekUndo('s1') !== undefined) ui.popUndo('s1')
})

describe('quick boost (left click / 初步提升)', () => {
  it('replaces the draft directly, with no panel, and offers undo', async () => {
    const call = deferred<EnhanceResult>()
    vi.mocked(requestEnhance).mockReturnValue(call.promise)
    const { input, setDraft } = renderComposer()
    fireEvent.click(button())
    // Running: a status strip, no dialog, the one-shot route (never the stream).
    expect(screen.getByText(zh['quick.running'])).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requestEnhanceStream).not.toHaveBeenCalled()
    expect(vi.mocked(requestEnhance).mock.calls[0]?.[0]).toMatchObject({ direction: 'general', text: '帮我写个脚本' })
    await act(async () => { call.resolve(RESULT) })
    expect(setDraft).toHaveBeenCalledWith(RESULT.text)
    expect(input.draft).toBe(RESULT.text)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(zh['undo.applied'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(input.draft).toBe('帮我写个脚本')
  })

  it('shows a guard message above the composer instead of a popup', () => {
    renderComposer('   ')
    fireEvent.click(button())
    expect(screen.getByRole('alert').textContent).toContain(zh['error.empty'])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('shows a failure above the composer and leaves the draft alone', async () => {
    vi.mocked(requestEnhance).mockRejectedValue(new (EnhanceClientError as unknown as new (d: unknown) => Error)({ code: 'timeout', params: { seconds: 60 } }))
    const { setDraft } = renderComposer()
    fireEvent.click(button())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('增强超时（60 秒）')
    expect(setDraft).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Dismissable.
    fireEvent.click(screen.getByRole('button', { name: zh['undo.dismiss'] }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('never overwrites edits made while it ran: the result goes to the preview instead', async () => {
    const call = deferred<EnhanceResult>()
    vi.mocked(requestEnhance).mockReturnValue(call.promise)
    const { input, setDraft } = renderComposer()
    fireEvent.click(button())
    act(() => { input.set({ draft: '帮我写个脚本，还要支持 PNG' }) })
    await act(async () => { call.resolve(RESULT) })
    expect(setDraft).not.toHaveBeenCalled()
    expect(input.draft).toBe('帮我写个脚本，还要支持 PNG')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(RESULT.text)).toBeTruthy()
    expect(screen.getByText(/草稿在增强期间有改动/)).toBeTruthy()
  })

  it('cancels on a second click without a message', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(requestEnhance).mockImplementation((_body, s) => {
      signal = s
      return new Promise((_resolve, reject) => {
        s?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })
    const { setDraft } = renderComposer()
    fireEvent.click(button())
    expect(button().getAttribute('title')).toBe(zh['button.quickBusy'])
    await act(async () => { fireEvent.click(button()) })
    expect(signal?.aborted).toBe(true)
    expect(setDraft).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(zh['quick.running'])).toBeNull()
  })

  it('also applies directly when 初步提升 is picked from the menu, while other directions preview', async () => {
    vi.mocked(requestEnhance).mockResolvedValue(RESULT)
    const { setDraft } = renderComposer()
    fireEvent.contextMenu(button())
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /初步提升/ })) })
    expect(setDraft).toHaveBeenCalledWith(RESULT.text)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.contextMenu(button())
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /精简/ })) })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('previews like the other directions when quickApply is off', async () => {
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, quickApply: false })
    vi.mocked(requestEnhance).mockResolvedValue(RESULT)
    const { setDraft } = renderComposer()
    fireEvent.click(button())
    expect(await screen.findByText(RESULT.text)).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(setDraft).not.toHaveBeenCalled()
  })
})
