/**
 * Wire contract shared by the host route and the browser half: one enhance
 * POST and its typed responses. Pure types and constants only, safe to
 * bundle into both halves.
 * @module dsh-prompt-boost/shared/protocol
 */

/** Host route path the browser half POSTs the draft to. */
export const ENHANCE_ENDPOINT = '/prompt-boost/enhance'

/**
 * Mount prefix of the plugin's host routes. The webserver registration uses it
 * verbatim; it used to be derived from {@link ENHANCE_ENDPOINT} with a
 * `replace(/\/enhance$/, '')`, which would silently mount the WRONG path the
 * day the endpoint constant is renamed.
 */
export const ENHANCE_PREFIX = '/prompt-boost'

/**
 * Host route path of the incremental variant: same request body, but the
 * response is an SSE stream of {@link EnhanceStreamEvent} frames so the panel
 * can show the rewrite while it is being written.
 */
export const ENHANCE_STREAM_ENDPOINT = '/prompt-boost/enhance-stream'

/**
 * Host route (GET) listing the models a boost may use: the same live catalog
 * DSH's own model picker shows. Optional `?sessionId=` names the session whose
 * route the "follow" choice would use, so the menu can show it.
 */
export const MODELS_ENDPOINT = '/prompt-boost/models'

/**
 * Host routes of the mode editor: `GET` lists the effective modes, `POST`
 * creates one, and `PUT` / `DELETE` on `…/directions/<id>` save or remove
 * (restore) one. Every success answers the fresh {@link DirectionList}.
 */
export const DIRECTIONS_ENDPOINT = '/prompt-boost/directions'

/** Response value of the mode routes. */
export interface DirectionList {
  directions: import('./directions').Direction[]
  /** The configured default mode id (already falls back to `general`). */
  defaultId: string
  /** On create: the new mode's id. */
  createdId?: string
}

/** Request body of a mode create / save. */
export interface DirectionInput {
  label: string
  instruction: string
}

/** One provider/model route, optionally with display names. */
export interface ModelRoute {
  provider: string
  model: string
  /** Model display name, when the catalog knows it. */
  name?: string
  /** Provider display name, when the catalog knows it. */
  providerName?: string
}

/** One advertised model. */
export interface ModelCatalogModel {
  id: string
  name: string
  description?: string
}

/** One provider and its advertised models. */
export interface ModelCatalogGroup {
  id: string
  name: string
  models: ModelCatalogModel[]
}

/** Response value of {@link MODELS_ENDPOINT}. */
export interface ModelCatalog {
  groups: ModelCatalogGroup[]
  /** Providers whose listing failed (skipped, not fatal). */
  failures: Array<{ id: string; name: string; message: string }>
  /** The route a boost uses when no model is chosen in the menu. */
  fallback?: ModelRoute
}

/**
 * Profile entry ids the plugin's settings section may be served under.
 *
 * The bare package name is what {@link PROMPT_ENHANCE_NAMESPACE} inserts, but
 * an aggregate bundle renames child rows (`prompt-boost` becomes
 * `web-ui-prompt-boost`), and the dsh 0.2.x settings service addresses rows
 * by that id rather than by namespace. Both halves probe the same list in the
 * same order, so the host section and the browser mirror can never resolve to
 * two different documents.
 */
export const PROMPT_ENHANCE_ROW_IDS: readonly string[] = [
  'prompt-boost',
  'dsh-prompt-booster',
  'dsh-prompt-boost',
  'web-ui-prompt-boost',
]

/** Request body of one enhance call. */
export interface EnhanceRequestBody {
  /** Session whose model route should serve the call; absent forces settings/defaults. */
  sessionId?: string
  /** The raw draft text to rewrite. */
  text: string
  /** Boost direction id; absent means the configured default direction. */
  direction?: string
  /**
   * Model chosen in the menu, as a pair (both or neither). Must be in the live
   * catalog; it takes precedence over the settings pair and the session route.
   */
  provider?: string
  model?: string
}

/** One successful enhancement. */
export interface EnhanceResult {
  /** The rewritten prompt body (already normalized: no fences, trimmed). */
  text: string
  /** Provider route that served the call. */
  provider: string
  /** Model id that served the call. */
  model: string
  /** Wall-clock duration of the model call in milliseconds. */
  elapsedMs: number
}

/**
 * Stable error codes the browser half maps to localized copy. The two
 * admission rejections are separate codes because their recovery conditions
 * differ: the per-minute rate cap clears on a known schedule (the route sends
 * a `Retry-After` in seconds with it), while the concurrency cap clears as
 * soon as an in-flight call finishes — no predictable delay to advertise.
 */
export type EnhanceErrorCode =
  | 'rejected'
  | 'rate-limit'
  | 'concurrency-limit'
  | 'cooldown'
  | 'timeout'
  | 'upstream'
  | 'unconfigured'
  | 'internal'

/** Structured failure carried on every non-2xx / ok:false response. */
export interface EnhanceError {
  code: EnhanceErrorCode
  /**
   * Optional diagnostic detail, passed through verbatim: the provider's raw
   * failure message, a config error, or an unknown-error description. The
   * client renders its localized primary line from `code`/`params` and shows
   * this beneath it when present — host-side text is a detail, never the
   * primary line (which used to leak Chinese copy into non-Chinese UIs).
   */
  message?: string
  /**
   * Structured parameters the localized primary line interpolates:
   * - rate-limit: { limit, retryAfterSeconds }
   * - concurrency-limit: { max }
   * - cooldown: { retryAfterSeconds, failures } — the failure breaker tripped
   * - timeout: { seconds }
   * - rejected with { count, max }: the over-length input message
   * - upstream: optional { reason } selecting a fix hint (auth, quota, …)
   */
  params?: Record<string, string | number>
  /**
   * Optional pre-localized message the client already rendered in the user's
   * language (set by client-side guards). When present the client shows it
   * alone; otherwise it localizes by `code`/`params` and shows `message` as
   * detail.
   */
  localized?: string
}

/** Response envelope of the enhance route. */
export type EnhanceResponse =
  | { ok: true; value: EnhanceResult }
  | { ok: false; error: EnhanceError }

/**
 * One SSE frame of the incremental route. `delta` carries newly displayable
 * text (already safe to show: leading/trailing fences are withheld), `done`
 * carries the authoritative result — the SAME normalized body the one-shot
 * route returns — and `error` carries the structured failure.
 */
export type EnhanceStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; value: EnhanceResult }
  | { type: 'error'; error: EnhanceError }
