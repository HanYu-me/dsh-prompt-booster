/**
 * The undo bar (conversation.input.dock): after an enhanced result was
 * applied, one quiet row above the composer card offers a single-click
 * restore of the original draft. It hides itself once the draft diverges
 * from the applied text (the user kept typing) — the entry is dropped, so
 * the bar can never restore stale text over newer edits.
 * @module dsh-prompt-boost/client/UndoBar
 */

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import * as ui from './ui-state'
import { AlertIcon, CheckIcon, CloseIcon, SpinnerIcon, UndoIcon } from './icons'
import { useSessionKey } from './session-key'

/** Props of the input.dock entry: the InputZone owner share + session kit + locale seat. */
export type UndoBarProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'prompt-boost'>

/** One session's undo affordance. */
export function UndoBar(props: UndoBarProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  // Defensive like the button: a host that omits `draft` must not make the
  // applied/current comparison read `undefined` as "the user kept typing" and
  // silently drop an undo entry.
  const draft = useInput((state) => {
    const value = (state as { draft?: unknown }).draft
    return typeof value === 'string' ? value : ''
  })
  useSyncExternalStore(ui.subscribe, ui.getVersion)
  const entry = ui.peekUndo(uiKey)
  const notice = ui.getNotice(uiKey)
  const quickBusy = ui.getQuick()?.sessionId === uiKey

  // A notice belongs to the draft it was raised on: editing retires it.
  useEffect(() => {
    if (notice !== undefined && notice.draft !== draft) ui.setNotice(uiKey, undefined)
  }, [draft, notice, uiKey])

  // The draft moved on (user edited after applying): drop the stale entry.
  useEffect(() => {
    if (entry !== undefined && entry.applied !== draft) ui.popUndo(uiKey)
  }, [draft, entry, uiKey])

  if (quickBusy) {
    return (
      <div className="dsh-pe-strip is-running" role="status">
        <SpinnerIcon size={14} className="dsh-pe-spinning dsh-pe-strip-icon" />
        <span className="dsh-pe-strip-text">{t('quick.running')}</span>
      </div>
    )
  }

  if (notice !== undefined && notice.draft === draft) {
    return (
      <div className="dsh-pe-strip is-warn" role="alert">
        <AlertIcon size={14} className="dsh-pe-strip-icon" />
        <span className="dsh-pe-strip-text">{notice.text}</span>
        <button type="button" className="dsh-pe-icon-btn small" aria-label={t('undo.dismiss')} onClick={() => ui.setNotice(uiKey, undefined)}><CloseIcon size={12} /></button>
      </div>
    )
  }

  if (entry === undefined || entry.applied !== draft) return null

  const undo = (): void => {
    inputActions.setDraft(entry.original)
    ui.popUndo(uiKey)
  }
  const dismiss = (): void => {
    ui.popUndo(uiKey)
  }

  return (
    <div className="dsh-pe-strip is-done">
      <CheckIcon size={14} className="dsh-pe-strip-icon" />
      <span className="dsh-pe-strip-text">{t('undo.applied')}</span>
      <button type="button" className="dsh-pe-strip-action" onClick={undo}><UndoIcon size={12} />{t('undo.undo')}</button>
      <button type="button" className="dsh-pe-icon-btn small" aria-label={t('undo.dismiss')} onClick={dismiss}><CloseIcon size={12} /></button>
    </div>
  )
}
