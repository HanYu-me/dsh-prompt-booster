/**
 * The composer enhance button (conversation.input.right): reads the live
 * draft through the session standard kit, applies every local guard
 * (empty / over-length / images-only / command-or-reference chips / busy),
 * then calls the host route and shows the preview panel. Applying the
 * result remembers the original on the undo stack before setDraft, so one
 * click restores it. The button never blocks the composer: on any failure
 * the draft stays exactly as the user typed it.
 * @module dsh-prompt-boost/client/EnhanceButton
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { EnhanceError } from '../shared/protocol'
import { checkInputText } from '../shared/validate'
import { EnhanceClientError, createDirection, deleteDirection, fetchModelCatalog, requestEnhance, requestEnhanceStream, saveDirection } from './enhance-client'
import { getDirectionList, refreshDirectionList, setDirectionList, subscribeDirectionList } from './directions-store'
import type { DirectionInput, DirectionList } from '../shared/protocol'
import { getModelChoice, routeLabel, setModelChoice, subscribeModelChoice } from './model-choice'
import { ResultPanel, localizedErrorMessage } from './ResultPanel'
import * as ui from './ui-state'
import { getClientSettings, subscribeClientSettings } from './settings'
import { useSessionKey, serverSessionId } from './session-key'
import { DirectionMenu, type MenuTranslate } from './DirectionMenu'
import { SparkleIcon, SpinnerIcon } from './icons'
import { GENERAL_DIRECTION_ID, defaultDirectionOf, findDirection, resolveDirections, type Direction } from '../shared/directions'

/**
 * One-line text of a failure for the notice above the composer.
 * @param t - the namespace translator.
 * @param error - the structured failure.
 * @returns the localized line, with the host detail appended when present.
 */
function errorText(t: EnhanceButtonProps['t'], error: EnhanceError): string {
  if (error.localized !== undefined) return error.localized
  const primary = localizedErrorMessage(t, error.code, error.params)
  return error.message !== undefined && error.message !== '' ? `${primary}（${error.message}）` : primary
}

/** How long a touch must be held on the button to open the direction menu. */
const LONG_PRESS_MS = 500

/** Props of the input.right entry: the InputZone owner share + session kit + locale seat. */
export type EnhanceButtonProps = PropsRuntime<'conversation.input.right'> & PropsLocale<'prompt-boost'>

/**
 * Read the length of an optional array-shaped field out of the host's input
 * state.
 *
 * Attachment ids are part of the conversation input snapshot in the dsh lines
 * this plugin targets, but the field was RENAMED between generations
 * (`imageIds` on the 0.1.x line, `attachmentIds` from 0.2.0 on) and a slot host
 * is not obliged to expose either. Reading `.length` off a missing field throws
 * *during render* — which React answers by unmounting the whole slot entry
 * behind its error boundary, so the composer loses the button and the console
 * fills with a stack trace instead of a usable feature. Reading defensively
 * turns an absent or malformed field into "no such count", which only disables
 * the corresponding advisory guard; the enhancement itself still runs.
 * @param value - the untrusted field.
 * @returns the array length, or 0 when the field is absent/not an array.
 */
function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/**
 * Read a field that downstream code requires to be a string. `draft` drives
 * `checkInputText`, which iterates the text — an absent field would throw on
 * click instead of on render, but it is the same class of brittleness against
 * an unknown host state shape.
 * @param value - the untrusted field.
 * @returns the string, or `''` when the field is absent/not a string.
 */
function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** One composer's enhance trigger. */
export function EnhanceButton(props: EnhanceButtonProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const wireId = serverSessionId(sessionId)
  const draft = useInput((state: InputState) => stringOf((state as { draft?: unknown }).draft))
  const phase = useInput((state: InputState) => (state as { phase?: unknown }).phase)
  const occurrenceCount = useInput((state: InputState) => countOf((state as { occurrences?: unknown }).occurrences))
  // `attachmentIds` is the 0.2.x field; `imageIds` is its 0.1.x predecessor.
  // Both are read defensively so one binary serves both generations.
  const attachmentCount = useInput((state: InputState) => {
    const record = state as { attachmentIds?: unknown; imageIds?: unknown }
    return countOf(record.attachmentIds) + countOf(record.imageIds)
  })
  const settings = useSyncExternalStore(subscribeClientSettings, getClientSettings)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const quick = useSyncExternalStore(ui.subscribe, ui.getQuick)
  const quickBusy = quick !== undefined && quick.sessionId === uiKey
  const busy = quickBusy || (panel !== undefined && panel.sessionId === uiKey && panel.phase === 'loading')
  // The latest draft, read after an async quick boost settles: if the user
  // typed meanwhile, the result must not overwrite those edits.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  })
  const lang: 'zh' | 'en' = t('meta.lang') === 'en' ? 'en' : 'zh'
  // The host's list (built-in + settings + modes saved from the editor);
  // until it answers, the list the settings mirror can build locally.
  const hostList = useSyncExternalStore(subscribeDirectionList, getDirectionList)
  const localDirections = useMemo(() => resolveDirections(settings.customDirections), [settings.customDirections])
  const directions = hostList?.directions ?? localDirections
  const defaultDirection = defaultDirectionOf(directions, settings.defaultDirection)
  useEffect(() => {
    if (getDirectionList() === undefined) void refreshDirectionList()
  }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const chosenModel = useSyncExternalStore(subscribeModelChoice, getModelChoice)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Set when a long press opened the menu, so the click that ends the touch
  // does not also start a default boost.
  const suppressClick = useRef(false)
  // The preview panel is a single shared slot, so the UI admits exactly ONE
  // in-flight enhancement at a time across all sessions: `anyBusy` disables
  // every other composer's button while one request is loading. This is
  // deliberately stricter than the host `maxConcurrent` cap (default 2) —
  // that cap protects the /enhance command plane and multi-client callers,
  // while the single-panel UI cannot show two loading states anyway.
  const anyBusy = quick !== undefined || (panel !== undefined && panel.phase === 'loading')
  // The OTHER composer is the one loading. See the button render below: a
  // cross-session busy state used to disable this button with no explanation,
  // which reads as "broken" in a multi-session layout.
  const otherBusy = anyBusy && !busy

  /** Guard chain + fetch + panel transition for this session.
   * @param directionId - the chosen direction; absent means the default one. */
  const start = useCallback((directionId?: string): void => {
    if (anyBusy) return
    const chosen: Direction = findDirection(directions, directionId) ?? defaultDirection
    const panelDirection: ui.PanelDirection = { id: chosen.id, label: chosen.label[lang] }
    // The quick boost skips the preview panel: the result replaces the draft
    // and every message (guard or failure) goes to the notice above the
    // composer instead of a popup.
    const quickMode = settings.quickApply && chosen.id === GENERAL_DIRECTION_ID
    ui.setNotice(uiKey, undefined)
    const reject = (localized: string): void => {
      if (quickMode) ui.setNotice(uiKey, { text: localized, draft })
      else ui.openError(uiKey, draft, { code: 'rejected', localized }, panelDirection)
    }
    if (!settings.enabled) {
      const disabled = t('error.disabled')
      reject(disabled)
      return
    }
    if (attachmentCount > 0 && draft.trim() === '') {
      const attachmentsOnly = t('error.attachmentsOnly')
      reject(attachmentsOnly)
      return
    }
    const check = checkInputText(draft, settings.maxInputChars)
    if (!check.ok) {
      const message = check.code === 'empty'
        ? t('error.empty')
        : t('error.tooLong', { count: check.count, max: check.max })
      reject(message)
      return
    }
    if (occurrenceCount > 0) {
      const occurrences = t('error.occurrences')
      reject(occurrences)
      return
    }
    if (phase !== 'plain') {
      const busyPhase = t('error.phase')
      reject(busyPhase)
      return
    }
    const controller = new AbortController()
    const body = {
      sessionId: wireId,
      text: draft,
      direction: chosen.id,
      ...(chosenModel !== undefined ? { provider: chosenModel.provider, model: chosenModel.model } : {}),
    }
    if (quickMode) {
      const original = draft
      ui.startQuick({ sessionId: uiKey, abort: () => controller.abort() })
      requestEnhance(body, controller.signal).then((result) => {
        ui.endQuick(uiKey)
        if (draftRef.current !== original) {
          // Edited while waiting: never overwrite. Show the result for review
          // instead (the panel flags it stale and Apply stays undoable).
          ui.openLoading({ sessionId: uiKey, original, direction: panelDirection })
          ui.settleResult(uiKey, result)
          return
        }
        ui.pushUndo(uiKey, { original, applied: result.text })
        inputActions.setDraft(result.text)
      }, (error: unknown) => {
        ui.endQuick(uiKey)
        // A cancel is the user's own doing: nothing to report.
        if (controller.signal.aborted) return
        const detail: EnhanceError = error instanceof EnhanceClientError
          ? error.detail
          : { code: 'internal', message: error instanceof Error ? error.message : String(error) }
        ui.setNotice(uiKey, { text: errorText(t, detail), draft: draftRef.current })
      })
      return
    }
    ui.openLoading({ sessionId: uiKey, original: draft, abort: () => controller.abort(), direction: panelDirection })
    const settle = (result: Parameters<typeof ui.settleResult>[1]): void => ui.settleResult(uiKey, result)
    const fail = (error: unknown): void => {
      const detail: EnhanceError = error instanceof EnhanceClientError
        ? error.detail
        : { code: 'internal', message: error instanceof Error ? error.message : String(error) }
      ui.settleError(uiKey, detail)
    }
    // Progressive display when enabled: the panel fills in as the model
    // writes, and degrades to the one-shot call on its own when the host or
    // the transport cannot stream.
    if (settings.streaming) {
      requestEnhanceStream(body, {
        signal: controller.signal,
        onDelta: (delta: string): void => ui.appendDelta(uiKey, delta),
      }).then(settle, fail)
      return
    }
    requestEnhance(body, controller.signal).then(settle, fail)
  }, [anyBusy, draft, attachmentCount, occurrenceCount, phase, settings, uiKey, wireId, t, directions, defaultDirection, lang, chosenModel, inputActions])

  const loadModels = useCallback(() => fetchModelCatalog(wireId), [wireId])

  /** Editor save: create (no id) or edit, then publish the fresh list to every composer. */
  const onSaveDirection = useCallback(async (id: string | undefined, input: DirectionInput): Promise<DirectionList> => {
    try {
      const list = id === undefined ? await createDirection(input) : await saveDirection(id, input)
      setDirectionList(list)
      return list
    } catch (error) {
      throw new Error(error instanceof EnhanceClientError ? errorText(t, error.detail) : String(error))
    }
  }, [t])
  const onDeleteDirection = useCallback(async (id: string): Promise<DirectionList> => {
    try {
      const list = await deleteDirection(id)
      setDirectionList(list)
      return list
    } catch (error) {
      throw new Error(error instanceof EnhanceClientError ? errorText(t, error.detail) : String(error))
    }
  }, [t])

  /** Right-click (or the keyboard context-menu key): open the direction menu. */
  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (anyBusy) return
    void refreshDirectionList()
    setMenuOpen(true)
  }, [anyBusy])

  /** Touch screens have no right click: a long press opens the menu instead. */
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    suppressClick.current = false
    if (event.pointerType !== 'touch' || anyBusy) return
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }, [anyBusy])
  const cancelLongPress = useCallback((): void => {
    clearTimeout(longPressTimer.current)
  }, [])
  useEffect(() => () => clearTimeout(longPressTimer.current), [])

  const onClick = useCallback((): void => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    // Clicking while this composer's quick boost runs cancels it.
    if (quickBusy) {
      quick?.abort()
      return
    }
    start()
  }, [start, quickBusy, quick])

  const closeMenu = useCallback((): void => setMenuOpen(false), [])
  const pick = useCallback((direction: Direction): void => {
    setMenuOpen(false)
    start(direction.id)
  }, [start])

  // The session registry holds a stable identity; run always dispatches to
  // the latest start callback. The refresh rides an effect (never the render
  // phase, which is unsafe under React 18 concurrent rendering).
  const runRef = useRef(start)
  useEffect(() => {
    runRef.current = start
  })
  useEffect(() => {
    const entry: ui.SessionEntry = {
      root: rootRef.current,
      run: () => runRef.current(),
    }
    return ui.registerSession(uiKey, entry)
  }, [uiKey])

  // Draft changed after the request started → flag (or clear) the result
  // panel's stale marker so the user knows the result is based on the
  // pre-enhance text.
  useEffect(() => {
    if (panel !== undefined && panel.sessionId === uiKey && panel.phase === 'result') {
      ui.setStale(uiKey, draft !== panel.original)
    }
  }, [draft, panel, uiKey])

  /** Apply the enhanced result: remember the CURRENT draft (pre-apply, so
   * undo restores exactly this state even if the user typed during the
   * request), then fill the enhanced text back. */
  const apply = useCallback((): void => {
    if (panel === undefined || panel.phase !== 'result' || panel.result === undefined) return
    ui.pushUndo(uiKey, { original: draft, applied: panel.result.text })
    inputActions.setDraft(panel.result.text)
    ui.closePanel()
  }, [draft, inputActions, panel, uiKey])

  if (!settings.enabled) return null

  const owned = panel !== undefined && panel.sessionId === uiKey ? panel : undefined
  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className={`dsh-pe-btn${busy ? ' is-busy' : ''}`}
        title={quickBusy ? t('button.quickBusy') : busy ? t('button.busy') : otherBusy ? t('button.otherBusy') : t('button.title', { label: defaultDirection.label[lang], model: chosenModel === undefined ? t('menu.follow') : routeLabel(chosenModel) })}
        aria-label={otherBusy ? t('button.otherBusy') : t('button.title', { label: defaultDirection.label[lang], model: chosenModel === undefined ? t('menu.follow') : routeLabel(chosenModel) })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        // `aria-disabled` instead of `disabled`: a disabled button is skipped by
        // the keyboard and by screen readers, so the reason this composer is
        // inert (another session's enhancement occupies the single preview
        // panel) would be unreachable exactly for the users who need it. The
        // click is a no-op either way (`start` returns early on `anyBusy`).
        aria-disabled={otherBusy || undefined}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
      >
        <span className="dsh-pe-btn-icon" aria-hidden>{busy ? <SpinnerIcon size={16} className="dsh-pe-spinning" /> : <SparkleIcon size={16} />}</span>
      </button>
      {owned !== undefined && (
        createPortal(
          <ResultPanel
            state={owned}
            t={t}
            onApply={apply}
            onCancel={() => ui.closePanel()}
            onRetry={owned.phase === 'error' ? () => start(owned.direction?.id) : undefined}
          />,
          document.body,
        )
      )}
      {menuOpen && rootRef.current !== null && (
        createPortal(
          <DirectionMenu
            anchor={rootRef.current}
            directions={directions}
            defaultId={defaultDirection.id}
            lang={lang}
            t={t as unknown as MenuTranslate}
            chosenModel={chosenModel}
            loadModels={loadModels}
            onPickModel={setModelChoice}
            onSaveDirection={onSaveDirection}
            onDeleteDirection={onDeleteDirection}
            onPick={pick}
            onClose={closeMenu}
          />,
          document.body,
        )
      )}
    </>
  )
}
