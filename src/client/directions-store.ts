/**
 * The host's effective mode list, shared by every composer. Until the first
 * answer arrives (or when the host route is missing) the button falls back to
 * the list it can build locally from the settings mirror.
 * @module dsh-prompt-boost/client/directions-store
 */

import type { DirectionList } from '../shared/protocol'
import { fetchDirections } from './enhance-client'

const listeners = new Set<() => void>()
let current: DirectionList | undefined
let inflight: Promise<void> | undefined

/** The last list the host answered, if any. */
export function getDirectionList(): DirectionList | undefined {
  return current
}

/**
 * Replace the list (after a load or an editor save) and notify subscribers.
 * @param list - the fresh list.
 */
export function setDirectionList(list: DirectionList | undefined): void {
  current = list
  for (const listener of listeners) listener()
}

/**
 * Subscribe to list changes.
 * @param listener - notified after each change.
 * @returns the unsubscribe function.
 */
export function subscribeDirectionList(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Reload from the host, sharing one in-flight request. Failures keep the
 * previous list (or the local fallback): the menu must still open.
 * @returns settles when the load is done.
 */
export function refreshDirectionList(): Promise<void> {
  if (inflight !== undefined) return inflight
  inflight = fetchDirections().then(
    (list) => setDirectionList(list),
    (error: unknown) => {
      console.warn('[prompt-boost] could not load modes from the host; using the local list.', error)
    },
  ).finally(() => {
    inflight = undefined
  })
  return inflight
}

/** Test hook: forget the cached list. */
export function resetDirectionListForTests(): void {
  current = undefined
  inflight = undefined
}
