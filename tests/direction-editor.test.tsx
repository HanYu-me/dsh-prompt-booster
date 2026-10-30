// @vitest-environment jsdom
/**
 * Tests of the mode editor inside the right-click menu: the ✎ button on each
 * mode, editing and saving a template, adding a mode, restore / delete, and
 * the keyboard paths (→ opens the editor, Esc goes back, ⌘/Ctrl+Enter saves).
 * @module tests/direction-editor
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { EnhanceButton } from '../src/client/EnhanceButton'
import { EnhanceClientError, createDirection, deleteDirection, fetchDirections, requestEnhance, saveDirection } from '../src/client/enhance-client'
import { zh } from '../src/client/locales'
import * as ui from '../src/client/ui-state'
import { DEFAULT_CLIENT_SETTINGS, setClientSettings } from '../src/client/settings'
import { resetDirectionListForTests, setDirectionList } from '../src/client/directions-store'
import { resolveDirections, type SavedDirection } from '../src/shared/directions'
import type { DirectionList } from '../src/shared/protocol'

vi.mock('../src/client/enhance-client', () => ({
  EnhanceClientError: class extends Error {
    constructor(public detail: unknown) { super('x') }
  },
  requestEnhance: vi.fn(),
  requestEnhanceStream: vi.fn(),
  fetchModelCatalog: vi.fn(),
  fetchDirections: vi.fn(),
  createDirection: vi.fn(),
  saveDirection: vi.fn(),
  deleteDirection: vi.fn(),
}))

const t = ((key: string, params?: Record<string, unknown>): string => {
  let s = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) s = s.split(`{${name}}`).join(String(value))
  return s
}) as TranslateNS<'prompt-boost'>

/** A host answer built from saved rows, exactly like the real route. */
function listOf(saved: SavedDirection[], createdId?: string): DirectionList {
  return { directions: resolveDirections('', saved), defaultId: 'general', ...(createdId !== undefined ? { createdId } : {}) }
}

function renderButton(): void {
  const state = { draft: '帮我写个脚本', phase: 'plain', occurrences: [] as unknown[], attachmentIds: [] as unknown[] }
  const useInput = <S,>(selector: (s: typeof state) => S): S => useSyncExternalStore(() => () => {}, () => selector(state))
  render(<EnhanceButton {...({ t, sessionId: 's1', useInput, inputActions: { setDraft: vi.fn() } } as never)} />)
}

const button = (): HTMLElement => document.querySelector('.dsh-pe-btn') as HTMLElement
const openMenu = (): void => { fireEvent.contextMenu(button()) }
const editButton = (label: string): HTMLElement => screen.getByRole('button', { name: `编辑「${label}」的模板` })
const nameField = (): HTMLInputElement => document.querySelector('.dsh-pe-editor-label') as HTMLInputElement
const templateField = (): HTMLTextAreaElement => document.querySelector('.dsh-pe-editor-template') as HTMLTextAreaElement

beforeEach(() => {
  resetDirectionListForTests()
  setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, quickApply: false })
  for (const fn of [requestEnhance, fetchDirections, createDirection, saveDirection, deleteDirection]) vi.mocked(fn).mockReset()
  vi.mocked(fetchDirections).mockResolvedValue(listOf([]))
  vi.mocked(requestEnhance).mockResolvedValue({ text: '改写后的文本', provider: 'p', model: 'm', elapsedMs: 3 })
})

afterEach(() => {
  cleanup()
  ui.closePanel()
})

describe('mode editor', () => {
  it('puts an edit button on every mode and an add row at the end', () => {
    renderButton()
    openMenu()
    for (const label of ['初步提升', '精简', '结构化', '补充细节', '编程任务', '调研分析', '学术写作', '改写为英文']) {
      expect(editButton(label)).toBeTruthy()
    }
    expect(screen.getByRole('menuitem', { name: /添加模式/ })).toBeTruthy()
  })

  it('opens the editor prefilled, saves the edit, and shows the new name in the list', async () => {
    vi.mocked(saveDirection).mockResolvedValue(listOf([{ id: 'concise', label: '超短', instruction: '只留一句话' }]))
    renderButton()
    openMenu()
    fireEvent.click(editButton('精简'))
    // The editor: prefilled, menu still open, no boost started.
    expect(nameField().value).toBe('精简')
    expect(templateField().value).toContain('Make the prompt concise')
    expect(screen.getByText(zh['editor.noteBuiltin'])).toBeTruthy()
    expect(document.activeElement).toBe(nameField())
    fireEvent.change(nameField(), { target: { value: '超短' } })
    fireEvent.change(templateField(), { target: { value: '只留一句话' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: zh['editor.save'] })) })
    expect(saveDirection).toHaveBeenCalledWith('concise', { label: '超短', instruction: '只留一句话' })
    // Back on the list, the row renamed and tagged as edited, and focused.
    expect(nameField()).toBeNull()
    const row = screen.getByRole('menuitem', { name: /超短/ })
    expect(row.textContent).toContain(zh['menu.edited'])
    expect(document.activeElement).toBe(row)
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('adds a mode, which then appears and can be used', async () => {
    vi.mocked(createDirection).mockResolvedValue(listOf([{ id: 'm-abc', label: '产品需求', instruction: '写成 PRD' }], 'm-abc'))
    renderButton()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /添加模式/ }))
    expect(screen.getByText(zh['editor.titleAdd'], { selector: '.dsh-pe-editor-title' })).toBeTruthy()
    expect(nameField().value).toBe('')
    fireEvent.change(nameField(), { target: { value: '产品需求' } })
    fireEvent.change(templateField(), { target: { value: '写成 PRD' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: zh['editor.save'] })) })
    expect(createDirection).toHaveBeenCalledWith({ label: '产品需求', instruction: '写成 PRD' })
    const row = screen.getByRole('menuitem', { name: /产品需求/ })
    expect(row.textContent).toContain(zh['menu.mine'])
    fireEvent.click(row)
    await screen.findByText('改写后的文本')
    expect(vi.mocked(requestEnhance).mock.calls[0]?.[0]).toMatchObject({ direction: 'm-abc' })
  })

  it('refuses an empty name without calling the host', () => {
    renderButton()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /添加模式/ }))
    fireEvent.click(screen.getByRole('button', { name: zh['editor.save'] }))
    expect(screen.getByRole('alert').textContent).toContain('名称不能为空')
    expect(createDirection).not.toHaveBeenCalled()
  })

  it('shows a host failure and keeps the typed text', async () => {
    vi.mocked(saveDirection).mockRejectedValue(new (EnhanceClientError as unknown as new (d: unknown) => Error)({ code: 'internal', message: '磁盘已满' }))
    renderButton()
    openMenu()
    fireEvent.click(editButton('精简'))
    fireEvent.change(templateField(), { target: { value: '新模板' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: zh['editor.save'] })) })
    expect(screen.getByRole('alert').textContent).toContain('磁盘已满')
    expect(templateField().value).toBe('新模板')
  })

  it('restores an edited built-in', async () => {
    setDirectionList(listOf([{ id: 'concise', label: '超短', instruction: '一句话' }]))
    vi.mocked(fetchDirections).mockReturnValue(new Promise(() => {}))
    vi.mocked(deleteDirection).mockResolvedValue(listOf([]))
    renderButton()
    openMenu()
    fireEvent.click(editButton('超短'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: zh['editor.restore'] })) })
    expect(deleteDirection).toHaveBeenCalledWith('concise')
    expect(screen.getByRole('menuitem', { name: /精简/ })).toBeTruthy()
  })

  it('deletes a custom mode only after a confirming second click', async () => {
    setDirectionList(listOf([{ id: 'm-x', label: '临时', instruction: 'x' }]))
    vi.mocked(fetchDirections).mockReturnValue(new Promise(() => {}))
    vi.mocked(deleteDirection).mockResolvedValue(listOf([]))
    renderButton()
    openMenu()
    fireEvent.click(editButton('临时'))
    fireEvent.click(screen.getByRole('button', { name: zh['editor.delete'] }))
    expect(deleteDirection).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: zh['editor.confirmDelete'] })) })
    expect(deleteDirection).toHaveBeenCalledWith('m-x')
    expect(screen.queryByRole('menuitem', { name: /临时/ })).toBeNull()
  })

  it('built-ins offer no delete button', () => {
    renderButton()
    openMenu()
    fireEvent.click(editButton('精简'))
    expect(screen.queryByRole('button', { name: zh['editor.delete'] })).toBeNull()
    expect(screen.queryByRole('button', { name: zh['editor.restore'] })).toBeNull()
  })

  it('keyboard: → opens the editor, Esc goes back without saving, Ctrl+Enter saves', async () => {
    vi.mocked(saveDirection).mockResolvedValue(listOf([]))
    renderButton()
    openMenu()
    const menu = screen.getByRole('menu')
    // Focus starts on the default (初步提升).
    fireEvent.keyDown(menu, { key: 'ArrowRight' })
    expect(nameField().value).toBe('初步提升')
    // Typing keys (arrows, Tab) stay in the editor and do not close the menu.
    fireEvent.keyDown(nameField(), { key: 'Tab' })
    fireEvent.keyDown(nameField(), { key: 'ArrowDown' })
    expect(nameField()).toBeTruthy()
    fireEvent.keyDown(nameField(), { key: 'Escape' })
    expect(nameField()).toBeNull()
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(saveDirection).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' })
    await act(async () => { fireEvent.keyDown(templateField(), { key: 'Enter', ctrlKey: true }) })
    expect(saveDirection).toHaveBeenCalledWith('general', expect.objectContaining({ label: '初步提升' }))
  })

  it('refreshes the list from the host when the menu opens', async () => {
    vi.mocked(fetchDirections).mockResolvedValue(listOf([{ id: 'm-remote', label: '别处添加的', instruction: 'x' }]))
    renderButton()
    await act(async () => { openMenu() })
    expect(await screen.findByRole('menuitem', { name: /别处添加的/ })).toBeTruthy()
  })
})
