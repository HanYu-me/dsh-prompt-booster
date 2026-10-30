// @vitest-environment jsdom
/**
 * Tests of the right-click direction menu on the composer button: opening,
 * picking (the chosen id reaches the request and the panel header), keyboard
 * close, custom rows, the configured default, long press, and retry keeping
 * the chosen direction.
 * @module tests/direction-menu
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { EnhanceButton } from '../src/client/EnhanceButton'
import { requestEnhance } from '../src/client/enhance-client'
import { zh } from '../src/client/locales'
import * as ui from '../src/client/ui-state'
import { DEFAULT_CLIENT_SETTINGS, setClientSettings } from '../src/client/settings'

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
}))

const t = ((key: string, params?: Record<string, unknown>): string => {
  let s = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) s = s.split(`{${name}}`).join(String(value))
  return s
}) as TranslateNS<'prompt-boost'>

/** Minimal synchronous fake of the composer input store. */
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
  }
}

function renderButton(draft = '帮我写个脚本'): void {
  const input = makeFakeInput(draft)
  const props = { t, sessionId: 's1', useInput: input.useInput, inputActions: { setDraft: vi.fn() } }
  render(<EnhanceButton {...(props as never)} />)
}

const button = (): HTMLElement => document.querySelector('.dsh-pe-btn') as HTMLElement

beforeEach(() => {
  setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, quickApply: false })
  vi.mocked(requestEnhance).mockReset()
  vi.mocked(requestEnhance).mockResolvedValue({ text: '改写后的文本', provider: 'p', model: 'm', elapsedMs: 3 })
})

afterEach(() => {
  cleanup()
  ui.closePanel()
})

describe('direction menu', () => {
  it('opens on right-click and lists the built-in directions with the default tagged', () => {
    renderButton()
    fireEvent.contextMenu(button())
    const menu = screen.getByRole('menu')
    expect(menu).toBeTruthy()
    const items = screen.getAllByRole('menuitem')
    // 8 directions + the add row + the model row.
    expect(items.length).toBe(10)
    expect(items[0]?.textContent).toContain('初步提升')
    expect(items[0]?.textContent).toContain(zh['menu.default'])
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('sends the picked direction and shows it in the panel header', async () => {
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(screen.getByRole('menuitem', { name: /精简/ }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(await screen.findByText('改写后的文本')).toBeTruthy()
    expect(requestEnhance).toHaveBeenCalledWith({ sessionId: 's1', text: '帮我写个脚本', direction: 'concise' }, expect.anything())
    expect(screen.getByText('方向：精简')).toBeTruthy()
  })

  it('closes on Escape without starting a request', () => {
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('moves with the arrow keys and picks with Enter-click', () => {
    renderButton()
    fireEvent.contextMenu(button())
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toContain('精简')
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('提升模型')
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('添加模式')
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement?.textContent).toContain('改写为英文')
  })

  it('closes on an outside pointer press', () => {
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('lists custom directions and sends their id', async () => {
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, customDirections: 'mail | 邮件 | 写成正式邮件' })
    renderButton()
    fireEvent.contextMenu(button())
    const mail = screen.getByRole('menuitem', { name: /邮件/ })
    expect(mail.textContent).toContain('写成正式邮件')
    fireEvent.click(mail)
    await screen.findByText('改写后的文本')
    expect(vi.mocked(requestEnhance).mock.calls[0]?.[0]).toMatchObject({ direction: 'mail' })
  })

  it('uses the configured default direction for a plain click and in the tooltip', async () => {
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, defaultDirection: 'coding' })
    renderButton()
    expect(button().getAttribute('title')).toContain('编程任务')
    fireEvent.click(button())
    await screen.findByText('改写后的文本')
    expect(vi.mocked(requestEnhance).mock.calls[0]?.[0]).toMatchObject({ direction: 'coding' })
  })

  it('opens the menu on a touch long press and swallows the trailing click', () => {
    vi.useFakeTimers()
    try {
      renderButton()
      fireEvent.pointerDown(button(), { pointerType: 'touch' })
      act(() => { vi.advanceTimersByTime(600) })
      expect(screen.getByRole('menu')).toBeTruthy()
      fireEvent.pointerUp(button(), { pointerType: 'touch' })
      fireEvent.click(button())
      expect(requestEnhance).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries with the same direction after an error', async () => {
    vi.mocked(requestEnhance).mockRejectedValueOnce(new Error('boom'))
    renderButton()
    fireEvent.contextMenu(button())
    fireEvent.click(screen.getByRole('menuitem', { name: /英文/ }))
    const retry = await screen.findByRole('button', { name: zh['panel.retry'] })
    fireEvent.click(retry)
    await screen.findByText('改写后的文本')
    expect(vi.mocked(requestEnhance).mock.calls.map((call) => (call[0] as { direction?: string }).direction)).toEqual(['english', 'english'])
  })
})
