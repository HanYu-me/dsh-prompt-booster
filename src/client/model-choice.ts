/**
 * The model the user picked for boosting, remembered in this browser
 * (localStorage) and shared by every composer through a tiny external store.
 * Absent means "follow the default" (settings pair → session → harness
 * default). Storage failures (private mode, blocked site data) degrade to an
 * in-memory choice for this page only.
 * @module dsh-prompt-boost/client/model-choice
 */

import type { ModelRoute } from '../shared/protocol'

/** localStorage key of the remembered choice. */
export const MODEL_CHOICE_KEY = 'dsh-prompt-boost:model'

const listeners = new Set<() => void>()
let loaded = false
let current: ModelRoute | undefined

/**
 * Narrow a stored value to a route.
 * @param value - parsed JSON (untrusted).
 * @returns the route, or undefined when malformed.
 */
function routeOf(value: unknown): ModelRoute | undefined {
  const record = value as Partial<ModelRoute> | null
  if (record === null || typeof record !== 'object') return undefined
  if (typeof record.provider !== 'string' || record.provider === '') return undefined
  if (typeof record.model !== 'string' || record.model === '') return undefined
  return {
    provider: record.provider,
    model: record.model,
    ...(typeof record.name === 'string' && record.name !== '' ? { name: record.name } : {}),
    ...(typeof record.providerName === 'string' && record.providerName !== '' ? { providerName: record.providerName } : {}),
  }
}

/** Load the stored choice once. */
function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  try {
    const raw = globalThis.localStorage?.getItem(MODEL_CHOICE_KEY)
    current = raw === null || raw === undefined ? undefined : routeOf(JSON.parse(raw))
  } catch {
    current = undefined
  }
}

/** The chosen model, or undefined to follow the default. */
export function getModelChoice(): ModelRoute | undefined {
  ensureLoaded()
  return current
}

/**
 * Remember a choice (undefined = follow the default) and notify subscribers.
 * @param route - the chosen route.
 */
export function setModelChoice(route: ModelRoute | undefined): void {
  ensureLoaded()
  current = route === undefined ? undefined : routeOf(route)
  try {
    if (current === undefined) globalThis.localStorage?.removeItem(MODEL_CHOICE_KEY)
    else globalThis.localStorage?.setItem(MODEL_CHOICE_KEY, JSON.stringify(current))
  } catch {
    // Storage unavailable: the choice still holds for this page.
  }
  for (const listener of listeners) listener()
}

/**
 * Subscribe to choice changes.
 * @param listener - notified after each change.
 * @returns the unsubscribe function.
 */
export function subscribeModelChoice(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Short display label of a route.
 * @param route - the route.
 * @returns the model name, else the model id.
 */
export function routeLabel(route: ModelRoute): string {
  return route.name !== undefined && route.name !== '' ? route.name : route.model
}

/** Test hook: forget the cached choice so the next read re-loads storage. */
export function resetModelChoiceForTests(): void {
  loaded = false
  current = undefined
}
