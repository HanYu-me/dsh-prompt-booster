/**
 * The right-click menu of the composer button. Two pages in one popover:
 *
 * - **Directions** (the first page): every boost direction, plus a row showing
 *   which model boosts use. Picking a direction starts a boost right away.
 * - **Models**: "follow the default" plus the live model catalog, grouped by
 *   provider (the same list as DSH's own model picker). Picking a model only
 *   remembers it and returns to the first page.
 *
 * Opened above the button (the composer sits at the bottom of the window).
 * Keyboard: arrows / Home / End move, Enter or Space picks, Esc goes back a
 * page or closes and returns focus to the button. Clicking outside, resizing,
 * or leaving the window closes it.
 * @module dsh-prompt-boost/client/DirectionMenu
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { INSTRUCTION_MAX_CHARS, LABEL_MAX_CHARS, checkSavedInput, type Direction } from '../shared/directions'
import type { DirectionInput, DirectionList, ModelCatalog, ModelRoute } from '../shared/protocol'
import { routeLabel } from './model-choice'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CpuIcon, ModeIcon, PencilIcon, PlusIcon } from './icons'

/** Width of the menu in CSS pixels (the editor page is wider). */
const MENU_WIDTH = 280
const EDITOR_WIDTH = 420
/** Gap between the button and the menu, and the minimum viewport margin. */
const GAP = 6
/** Selector of the focusable rows of the current page. */
const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]'

/** Loose translator: the caller passes the namespace-bound `t`. */
export type MenuTranslate = (key: string, params?: Record<string, string | number>) => string

/** Props of the menu. */
export interface DirectionMenuProps {
  /** The element the menu is attached to (the composer button). */
  anchor: HTMLElement
  /** The directions to list, in order. */
  directions: readonly Direction[]
  /** Id of the direction a plain click uses (tagged "default"). */
  defaultId: string
  /** UI language, from the locale dictionary. */
  lang: 'zh' | 'en'
  /** Translator bound to the plugin namespace. */
  t: MenuTranslate
  /** The remembered model choice; undefined follows the default. */
  chosenModel: ModelRoute | undefined
  /** Loads the model catalog (called when the models page opens). */
  loadModels: () => Promise<ModelCatalog>
  /** Called with the chosen direction. */
  onPick: (direction: Direction) => void
  /** Called with the chosen model (undefined = follow the default). */
  onPickModel: (route: ModelRoute | undefined) => void
  /** Called when the menu closes without a choice. */
  onClose: () => void
  /** Create (id undefined) or save a mode; resolves with the fresh list. */
  onSaveDirection: (id: string | undefined, input: DirectionInput) => Promise<DirectionList>
  /** Delete a saved mode or restore a built-in / settings one. */
  onDeleteDirection: (id: string) => Promise<DirectionList>
}

/** The mode open in the editor page; `direction` undefined means "add". */
interface EditorState {
  direction?: Direction
  label: string
  instruction: string
  busy: boolean
  error?: string
  /** Delete needs a second click. */
  confirmDelete: boolean
}

/** Fixed-position coordinates of the menu. */
interface Position {
  left: number
  bottom?: number
  top?: number
  maxHeight: number
}

/** Load state of the models page. */
type CatalogState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; catalog: ModelCatalog }
  | { status: 'error'; message: string }

/**
 * Place the menu above the anchor when there is room, else below it, and keep
 * it inside the viewport horizontally.
 * @param anchor - the button element.
 * @returns the fixed-position coordinates.
 */
function positionOf(anchor: HTMLElement, width: number = MENU_WIDTH): Position {
  const rect = anchor.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const left = Math.max(GAP, Math.min(rect.right - width, viewportWidth - width - GAP))
  const spaceAbove = rect.top - GAP * 2
  const spaceBelow = viewportHeight - rect.bottom - GAP * 2
  if (spaceAbove >= 240 || spaceAbove >= spaceBelow) {
    return { left, bottom: viewportHeight - rect.top + GAP, maxHeight: Math.max(160, spaceAbove) }
  }
  return { left, top: rect.bottom + GAP, maxHeight: Math.max(160, spaceBelow) }
}

/**
 * Cut a string to at most `max` code points, with an ellipsis.
 * @param text - the text.
 * @param max - the code-point budget.
 * @returns the clipped text.
 */
function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`
}

/** The popover. Rendered by the caller through a portal. */
export function DirectionMenu(props: DirectionMenuProps): ReactNode {
  const { anchor, directions, defaultId, lang, t, chosenModel, loadModels, onPick, onPickModel, onClose, onSaveDirection, onDeleteDirection } = props
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [page, setPage] = useState<'directions' | 'models' | 'edit'>('directions')
  const width = page === 'edit' ? EDITOR_WIDTH : MENU_WIDTH
  const [position, setPosition] = useState<Position>(() => positionOf(anchor))
  const [editor, setEditor] = useState<EditorState | undefined>(undefined)
  // The editor is wider: re-place the popover whenever the page changes.
  useLayoutEffect(() => {
    setPosition(positionOf(anchor, width))
  }, [anchor, width])
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'idle' })
  // Which row to focus after a page switch: a CSS selector inside the menu.
  const focusTarget = useRef<string>('[data-default="true"]')

  // Focus the requested row whenever the page changes (and on open).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const target = page === 'edit'
      ? root.querySelector<HTMLElement>('.dsh-pe-editor-label')
      : root.querySelector<HTMLElement>(focusTarget.current) ?? root.querySelector<HTMLElement>(ITEM_SELECTOR)
    target?.focus()
  }, [page, catalog.status])

  // Close on outside pointer, resize, window blur; reposition on scroll.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target !== null && (rootRef.current?.contains(target) === true || anchor.contains(target))) return
      onClose()
    }
    const onResize = (): void => onClose()
    const onScroll = (event: Event): void => {
      // Scrolling the menu's own list must not move it.
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return
      setPosition(positionOf(anchor, width))
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, onClose, width])

  const openModels = useCallback((): void => {
    focusTarget.current = '[aria-checked="true"]'
    setPage('models')
    setCatalog({ status: 'loading' })
    loadModels().then(
      (value) => setCatalog({ status: 'ready', catalog: value }),
      (error: unknown) => setCatalog({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    )
  }, [loadModels])

  const backToDirections = useCallback((): void => {
    focusTarget.current = '[data-model-row="true"]'
    setPage('directions')
  }, [])

  /** Open the editor on one mode, or empty for a new one. */
  const openEditor = useCallback((direction: Direction | undefined): void => {
    setEditor({
      ...(direction !== undefined ? { direction } : {}),
      label: direction === undefined ? '' : direction.label[lang],
      instruction: direction?.instruction ?? '',
      busy: false,
      confirmDelete: false,
    })
    setPage('edit')
  }, [lang])

  const closeEditor = useCallback((focusId?: string): void => {
    focusTarget.current = focusId !== undefined
      ? `[data-direction-id="${focusId}"]`
      : editor?.direction !== undefined ? `[data-direction-id="${editor.direction.id}"]` : '[data-add-row="true"]'
    setEditor(undefined)
    setPage('directions')
  }, [editor])

  const submitEditor = useCallback((): void => {
    if (editor === undefined || editor.busy) return
    const problem = checkSavedInput(editor.label, editor.instruction)
    if (problem !== undefined) {
      setEditor({ ...editor, error: problem })
      return
    }
    setEditor({ ...editor, busy: true, error: undefined })
    const input: DirectionInput = { label: editor.label.trim(), instruction: editor.instruction.trim() }
    onSaveDirection(editor.direction?.id, input).then(
      (list) => closeEditor(list.createdId ?? editor.direction?.id),
      (error: unknown) => setEditor((current) => current === undefined ? current : {
        ...current,
        busy: false,
        error: t('editor.failed', { message: error instanceof Error ? error.message : String(error) }),
      }),
    )
  }, [editor, onSaveDirection, closeEditor, t])

  /** Delete a new mode (after a confirming second click) or restore an edited one. */
  const removeEditor = useCallback((): void => {
    const direction = editor?.direction
    if (editor === undefined || direction === undefined || editor.busy) return
    const restoring = direction.replaces !== undefined
    if (!restoring && !editor.confirmDelete) {
      setEditor({ ...editor, confirmDelete: true })
      return
    }
    setEditor({ ...editor, busy: true, error: undefined })
    onDeleteDirection(direction.id).then(
      () => closeEditor(restoring ? direction.id : undefined),
      (error: unknown) => setEditor((current) => current === undefined ? current : {
        ...current,
        busy: false,
        error: t('editor.failed', { message: error instanceof Error ? error.message : String(error) }),
      }),
    )
  }, [editor, onDeleteDirection, closeEditor, t])

  const pickModel = useCallback((route: ModelRoute | undefined): void => {
    onPickModel(route)
    backToDirections()
  }, [onPickModel, backToDirections])

  /** Move focus among the rows of the current page. */
  const move = (delta: number | 'first' | 'last'): void => {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = delta === 'first' ? 0
      : delta === 'last' ? items.length - 1
        : ((current < 0 ? 0 : current + delta) + items.length) % items.length
    items[next]?.focus()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (page === 'edit') {
      // Typing stays in the fields: keep it from DSH's global shortcuts too.
      event.stopPropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        closeEditor()
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        submitEditor()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown': move(1); break
      case 'ArrowUp': move(-1); break
      case 'Home': move('first'); break
      case 'End': move('last'); break
      case 'ArrowLeft':
        if (page !== 'models') return
        backToDirections()
        break
      case 'ArrowRight': {
        // On a mode row: open its editor.
        const id = (document.activeElement as HTMLElement | null)?.dataset.directionId
        const direction = id === undefined ? undefined : directions.find((row) => row.id === id)
        if (page !== 'directions' || direction === undefined) return
        openEditor(direction)
        break
      }
      case 'Escape':
        if (page === 'models') {
          backToDirections()
          break
        }
        onClose()
        anchor.focus()
        break
      case 'Tab':
        onClose()
        return
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const style: Record<string, string | number> = { left: position.left, width, maxHeight: position.maxHeight }
  if (position.bottom !== undefined) style.bottom = position.bottom
  if (position.top !== undefined) style.top = position.top

  const modelLabel = chosenModel === undefined ? t('menu.follow') : routeLabel(chosenModel)
  /** Focus a row on hover so the mouse and the keyboard share one highlight. */
  const hoverFocus = (event: { currentTarget: HTMLElement }): void => event.currentTarget.focus()

  const pageLabel = page === 'directions' ? t('menu.title')
    : page === 'models' ? t('menu.modelsTitle')
      : editor?.direction !== undefined ? t('editor.titleEdit') : t('editor.titleAdd')

  return (
    <div
      ref={rootRef}
      className={`dsh-pe-menu is-${page}`}
      role="menu"
      aria-label={pageLabel}
      style={style}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {page === 'directions' && (
        <>
          <div className="dsh-pe-menu-title" aria-hidden>{t('menu.title')}</div>
          <div className="dsh-pe-menu-scroll">
            {directions.length === 0 && <div className="dsh-pe-menu-empty">{t('menu.empty')}</div>}
            {directions.map((direction) => {
              // Custom rows have no hint of their own: show the start of the instruction.
              const hint = direction.hint[lang] !== ''
                ? direction.hint[lang]
                : direction.custom ? clip(direction.instruction, 36) : ''
              const isDefault = direction.id === defaultId
              return (
                <div key={direction.id} className="dsh-pe-menu-line">
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-default={isDefault ? 'true' : undefined}
                    data-direction-id={direction.id}
                    className="dsh-pe-menu-item"
                    onMouseEnter={hoverFocus}
                    onClick={() => onPick(direction)}
                  >
                    <span className={`dsh-pe-menu-icon${isDefault ? ' is-default' : ''}`}><ModeIcon id={direction.id} size={14} /></span>
                    <span className="dsh-pe-menu-copy">
                      <span className="dsh-pe-menu-label">
                        <span className="dsh-pe-menu-name">{direction.label[lang]}</span>
                        {isDefault && <span className="dsh-pe-menu-tag">{t('menu.default')}</span>}
                        {direction.source === 'saved' && (
                          <span className="dsh-pe-menu-tag is-mine">{direction.replaces !== undefined ? t('menu.edited') : t('menu.mine')}</span>
                        )}
                      </span>
                      {hint !== '' && <span className="dsh-pe-menu-hint">{hint}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="dsh-pe-menu-edit"
                    title={t('menu.edit', { label: direction.label[lang] })}
                    aria-label={t('menu.edit', { label: direction.label[lang] })}
                    onClick={(event) => {
                      event.stopPropagation()
                      openEditor(direction)
                    }}
                  >
                    <PencilIcon size={13} />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-add-row="true"
              className="dsh-pe-menu-item dsh-pe-menu-add"
              onMouseEnter={hoverFocus}
              onClick={() => openEditor(undefined)}
            >
              <span className="dsh-pe-menu-icon"><PlusIcon size={14} /></span>
              <span className="dsh-pe-menu-name">{t('menu.add')}</span>
            </button>
          </div>
          <div className="dsh-pe-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-haspopup="menu"
            data-model-row="true"
            title={t('menu.modelHint')}
            className="dsh-pe-menu-item dsh-pe-menu-cell"
            onMouseEnter={hoverFocus}
            onClick={openModels}
          >
            <span className="dsh-pe-menu-icon"><CpuIcon size={14} /></span>
            {/* The accessible name keeps the "提升模型：…" wording in one string. */}
            <span className="dsh-pe-visually-hidden">{t('menu.model', { label: modelLabel })}</span>
            <span className="dsh-pe-menu-name" aria-hidden>{t('menu.modelShort')}</span>
            <span className="dsh-pe-menu-value" aria-hidden>{modelLabel}</span>
            <ChevronRightIcon size={12} className="dsh-pe-menu-chevron" />
          </button>
        </>
      )}
      {page === 'models' && (
        <>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="dsh-pe-menu-back"
            onMouseEnter={hoverFocus}
            onClick={backToDirections}
          >
            <ChevronLeftIcon size={14} />
            <span>{t('menu.modelsTitle')}</span>
          </button>
          <div className="dsh-pe-menu-scroll">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={chosenModel === undefined}
              tabIndex={-1}
              className="dsh-pe-menu-item"
              onMouseEnter={hoverFocus}
              onClick={() => pickModel(undefined)}
            >
              <span className="dsh-pe-menu-check">{chosenModel === undefined && <CheckIcon size={14} />}</span>
              <span className="dsh-pe-menu-copy">
                <span className="dsh-pe-menu-name">{t('menu.follow')}</span>
                <span className="dsh-pe-menu-hint">
                  {catalog.status === 'ready' && catalog.catalog.fallback !== undefined
                    ? t('menu.followHint', { label: routeLabel(catalog.catalog.fallback) })
                    : t('menu.followHintUnknown')}
                </span>
              </span>
            </button>
            {catalog.status === 'loading' && <div className="dsh-pe-menu-empty">{t('menu.loading')}</div>}
            {catalog.status === 'error' && <div className="dsh-pe-menu-note is-error">{t('menu.loadFailed', { message: catalog.message })}</div>}
            {catalog.status === 'ready' && catalog.catalog.groups.length === 0 && (
              <div className="dsh-pe-menu-empty">{t('menu.noModels')}</div>
            )}
            {catalog.status === 'ready' && chosenModel !== undefined && !catalog.catalog.groups.some((group) => group.id === chosenModel.provider && group.models.some((model) => model.id === chosenModel.model)) && (
              <div className="dsh-pe-menu-note is-warn">{t('menu.chosenUnavailable', { label: routeLabel(chosenModel) })}</div>
            )}
            {catalog.status === 'ready' && catalog.catalog.groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.name}>
                <div className="dsh-pe-menu-group" aria-hidden>{group.name}</div>
                {group.models.map((model) => {
                  const checked = chosenModel?.provider === group.id && chosenModel.model === model.id
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      tabIndex={-1}
                      title={`${group.id} / ${model.id}`}
                      className="dsh-pe-menu-item"
                      onMouseEnter={hoverFocus}
                      onClick={() => pickModel({ provider: group.id, model: model.id, name: model.name, providerName: group.name })}
                    >
                      <span className="dsh-pe-menu-check">{checked && <CheckIcon size={14} />}</span>
                      <span className="dsh-pe-menu-copy">
                        <span className="dsh-pe-menu-name">{model.name}</span>
                        {model.description !== undefined && <span className="dsh-pe-menu-hint">{clip(model.description, 60)}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            {catalog.status === 'ready' && catalog.catalog.failures.map((failure) => (
              <div key={failure.id} className="dsh-pe-menu-note is-error" title={failure.message}>
                {t('menu.providerFailed', { name: failure.name })}
              </div>
            ))}
          </div>
        </>
      )}
      {page === 'edit' && editor !== undefined && (
        <form
          className="dsh-pe-editor"
          onSubmit={(event) => {
            event.preventDefault()
            submitEditor()
          }}
        >
          <div className="dsh-pe-editor-head">
            <button type="button" className="dsh-pe-menu-back is-inline" aria-label={t('menu.back')} onClick={() => closeEditor()}>
              <ChevronLeftIcon size={14} />
            </button>
            <span className="dsh-pe-editor-badge"><ModeIcon id={editor.direction?.id ?? ''} size={14} /></span>
            <span className="dsh-pe-editor-title">{editor.direction !== undefined ? t('editor.titleEdit') : t('editor.titleAdd')}</span>
          </div>
          {editor.direction?.source === 'builtin' && <div className="dsh-pe-editor-note">{t('editor.noteBuiltin')}</div>}
          {editor.direction?.source === 'settings' && <div className="dsh-pe-editor-note">{t('editor.noteSettings')}</div>}
          <label className="dsh-pe-editor-field">
            <span className="dsh-pe-editor-caption">{t('editor.label')}</span>
            <input
              className="dsh-pe-editor-label"
              value={editor.label}
              maxLength={LABEL_MAX_CHARS}
              placeholder={t('editor.labelPlaceholder')}
              disabled={editor.busy}
              onChange={(event) => setEditor({ ...editor, label: event.target.value, error: undefined, confirmDelete: false })}
            />
          </label>
          <label className="dsh-pe-editor-field">
            <span className="dsh-pe-editor-caption">
              {t('editor.template')}
              <span className="dsh-pe-editor-count">{Array.from(editor.instruction).length} / {INSTRUCTION_MAX_CHARS}</span>
            </span>
            <textarea
              className="dsh-pe-editor-template"
              value={editor.instruction}
              rows={8}
              placeholder={t('editor.templatePlaceholder')}
              disabled={editor.busy}
              onChange={(event) => setEditor({ ...editor, instruction: event.target.value, error: undefined, confirmDelete: false })}
            />
          </label>
          <div className="dsh-pe-editor-help">{t('editor.help')}</div>
          {editor.error !== undefined && <div className="dsh-pe-menu-note is-error" role="alert">{editor.error}</div>}
          <div className="dsh-pe-editor-actions">
            {editor.direction?.source === 'saved' && (
              <button
                type="button"
                className={`dsh-pe-action ${editor.direction.replaces === undefined ? 'danger' : 'ghost'}${editor.confirmDelete ? ' is-armed' : ''}`}
                disabled={editor.busy}
                onClick={removeEditor}
              >
                {editor.direction.replaces !== undefined
                  ? t('editor.restore')
                  : editor.confirmDelete ? t('editor.confirmDelete') : t('editor.delete')}
              </button>
            )}
            <span className="dsh-pe-grow" />
            <button type="button" className="dsh-pe-action ghost" disabled={editor.busy} onClick={() => closeEditor()}>{t('editor.cancel')}</button>
            <button type="submit" className="dsh-pe-action primary" disabled={editor.busy}>
              {editor.busy ? t('editor.saving') : t('editor.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
