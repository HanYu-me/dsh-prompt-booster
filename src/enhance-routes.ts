/**
 * The POST /prompt-boost/enhance host route: the browser half's single
 * seam. Loopback-fenced, body-capped, per-request config re-read (settings
 * changes land on the very next call), route resolved by precedence
 * (settings pair → session request header → harness default model).
 * @module dsh-prompt-boost/enhance-routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { DIRECTIONS_ENDPOINT, ENHANCE_ENDPOINT, ENHANCE_PREFIX, ENHANCE_STREAM_ENDPOINT, MODELS_ENDPOINT, type DirectionList } from './shared/protocol'
import { createMemoryStore, type DirectionStore } from './direction-store'
import { resolveRoute, type RoutePair } from './enhancer'
import { buildModelCatalog, catalogFaceOf, isModelAvailable } from './models'
import { createStreamNormalizer } from './shared/stream-text'
import { createSseWriter } from './sse'
import { checkInputText } from './shared/validate'
import { type Config } from './config'
import { MAX_DIRECTIONS, MAX_SAVED_DIRECTIONS, checkSavedInput, defaultDirectionOf, findDirection, newDirectionId, resolveDirections } from './shared/directions'
import { toEnhanceError } from './enhancer'
import { defaultRouteOf, runEnhance, sessionRouteOf } from './orchestrate'
import { isTrustedRequest } from './loopback'
import { readBoundedJson, writeJson, endResponse } from './http'

/** Envelope slack over the UTF-8 text cap: JSON quoting can inflate ~2-6x in the worst case. */
const bodyCapOf = (maxInputChars: number): number => maxInputChars * 6 + 4096

/**
 * Consecutive FAILED calls that trip the cool-down, and how long it lasts.
 *
 * The sliding window below counts successful calls only, so a run of timeouts
 * never burns the user's quota (see the gate note in serveEnhance). That
 * leaves one hole: a deterministic upstream failure — a wrong API key, a
 * mistyped provider, a model the account cannot reach — fails in
 * milliseconds, and a retry loop against such a failure is bounded only by
 * the concurrency cap, i.e. barely at all. Three consecutive failures are
 * enough to tell "the model is flaky" from "this route cannot work", so the
 * route pauses instead of hammering the provider.
 */
const FAILURE_STREAK_LIMIT = 3
const FAILURE_COOLDOWN_MS = 30_000

/** Per-mount admission state: sliding-window rate stamps, active-call count, failure breaker. */
interface AdmissionGate {
  stamps: number[]
  active: number
  /** Consecutive failed calls since the last success. */
  failures: number
  /** Epoch millis until which every call is refused with `cooldown`. */
  cooldownUntil: number
}

/** Body cap of a mode create/save: a 4000-char template, JSON-escaped, with slack. */
const DIRECTION_BODY_CAP = 64 * 1024

/**
 * The effective mode list as the routes answer it.
 * @param config - the resolved config.
 * @param store - the saved modes.
 * @param createdId - the id of a mode just created, echoed back.
 * @returns the list value.
 */
function directionListOf(config: Config, store: DirectionStore, createdId?: string): DirectionList {
  const directions = resolveDirections(config.customDirections, store.read())
  return {
    directions,
    defaultId: defaultDirectionOf(directions, config.defaultDirection).id,
    ...(createdId !== undefined ? { createdId } : {}),
  }
}

/**
 * Serve the mode editor routes. Same loopback fence as every route here (the
 * caller checked it); writes go to the host store, never to the settings
 * textarea, which stays a read-only lower layer.
 * @param readConfig - per-request config reader.
 * @param store - the saved modes.
 * @param pathname - `/prompt-boost/directions` or `/prompt-boost/directions/<id>`.
 * @param req - the incoming request.
 * @param res - the outgoing response.
 */
async function serveDirections(readConfig: () => Config, store: DirectionStore, pathname: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let config: Config
  try {
    config = readConfig()
  } catch (error) {
    writeJson(res, 500, { ok: false, error: { code: 'internal', message: `prompt-boost 配置无效：${error instanceof Error ? error.message : String(error)}` } })
    return
  }
  const rawId = pathname === DIRECTIONS_ENDPOINT ? undefined : pathname.slice(DIRECTIONS_ENDPOINT.length + 1)
  let id: string | undefined
  try {
    id = rawId === undefined ? undefined : decodeURIComponent(rawId)
  } catch {
    id = ''
  }
  const method = req.method ?? 'GET'
  const allowed = id === undefined ? ['GET', 'POST'] : ['PUT', 'DELETE']
  if (!allowed.includes(method)) {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: `only ${allowed.join('/')} is allowed` } })
    return
  }
  if (method === 'GET') {
    writeJson(res, 200, { ok: true, value: directionListOf(config, store) })
    return
  }
  const fail = (status: number, message: string): void => {
    writeJson(res, status, { ok: false, error: { code: 'rejected', message } })
  }
  const saved = store.read()
  const effective = resolveDirections(config.customDirections, saved)
  const persist = (rows: typeof saved, createdId?: string): void => {
    try {
      store.write(rows)
    } catch (error) {
      writeJson(res, 500, { ok: false, error: { code: 'internal', message: `保存失败：${error instanceof Error ? error.message : String(error)}` } })
      return
    }
    writeJson(res, 200, { ok: true, value: directionListOf(config, store, createdId) })
  }

  if (method === 'DELETE') {
    const index = saved.findIndex((row) => row.id === id)
    if (index < 0) {
      if (findDirection(effective, id) !== undefined) fail(422, '这是内置模式或插件设置里定义的模式，不能删除；可以编辑它。')
      else fail(404, '没有这个模式。')
      return
    }
    persist(saved.filter((_, at) => at !== index))
    return
  }

  // POST (create) / PUT (save): both carry { label, instruction }.
  const contentType = req.headers['content-type']
  if (contentType !== undefined && !String(contentType).toLowerCase().startsWith('application/json')) {
    fail(415, '仅支持 application/json 请求体。')
    return
  }
  let body: unknown
  try {
    body = await readBoundedJson(req, DIRECTION_BODY_CAP)
  } catch (error) {
    fail(error instanceof Error && error.message === 'body too large' ? 413 : 422, '请求体无效。')
    return
  }
  const input = body as { label?: unknown; instruction?: unknown } | null
  const problem = checkSavedInput(input?.label, input?.instruction)
  if (problem !== undefined) {
    fail(422, problem)
    return
  }
  const row = { label: String(input?.label).trim(), instruction: String(input?.instruction).trim() }

  if (method === 'POST') {
    if (saved.length >= MAX_SAVED_DIRECTIONS || effective.length >= MAX_DIRECTIONS) {
      fail(422, `模式数量已达上限（${Math.min(MAX_SAVED_DIRECTIONS, MAX_DIRECTIONS)} 个），请先删除一些自定义模式。`)
      return
    }
    const createdId = newDirectionId(new Set(effective.map((direction) => direction.id)))
    persist([...saved, { id: createdId, ...row }], createdId)
    return
  }

  // PUT: only an existing mode can be saved (no minting ids through PUT).
  if (id === undefined || findDirection(effective, id) === undefined) {
    fail(404, '没有这个模式。')
    return
  }
  const index = saved.findIndex((entry) => entry.id === id)
  if (index < 0 && saved.length >= MAX_SAVED_DIRECTIONS) {
    fail(422, `已保存的模式数量已达上限（${MAX_SAVED_DIRECTIONS} 个）。`)
    return
  }
  const next = index < 0 ? [...saved, { id, ...row }] : saved.map((entry, at) => (at === index ? { id, ...row } : entry))
  persist(next)
}

/**
 * Serve the model catalog (GET). Same loopback fence as the enhance route; no
 * admission gate, since listing models makes no billable call.
 * @param ctx - registrant context (llm, optional sessions/settings).
 * @param readConfig - per-request config reader (for the fallback route).
 * @param req - the incoming request.
 * @param res - the outgoing response.
 */
async function serveModels(ctx: Context, readConfig: () => Config, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: 'only GET is allowed' } })
    return
  }
  const face = catalogFaceOf(ctx.get('llm'))
  if (face === undefined) {
    writeJson(res, 501, { ok: false, error: { code: 'internal', message: '当前 DSH 版本的模型服务不支持列出模型。' } })
    return
  }
  const sessionParam = new URL(req.url ?? '/', 'http://x').searchParams.get('sessionId')
  const sessionId = sessionParam !== null && sessionParam !== '' ? sessionParam : undefined
  let fallback: RoutePair | undefined
  try {
    fallback = resolveRoute(readConfig(), sessionRouteOf(ctx, sessionId), defaultRouteOf(ctx))
  } catch {
    // An invalid settings section only loses the "follow" label, not the list.
    fallback = undefined
  }
  try {
    writeJson(res, 200, { ok: true, value: await buildModelCatalog(face, fallback) })
  } catch (error) {
    writeJson(res, 502, { ok: false, error: { code: 'upstream', message: error instanceof Error ? error.message : String(error) } })
  }
}

/**
 * Serve one enhance POST against the request envelope.
 * @param ctx - registrant context (llm, optional sessions/settings).
 * @param readConfig - per-request config reader.
 * @param gate - per-mount admission state.
 * @param pathname - the request path, already parsed by the prefix handler.
 * @param req - the incoming request.
 * @param res - the outgoing response.
 * @param stream - whether to answer with an SSE stream of incremental frames
 *   instead of one JSON envelope. Both modes share the whole admission path;
 *   only the response shape differs.
 */
async function serveEnhance(ctx: Context, readConfig: () => Config, gate: AdmissionGate, pathname: string, req: IncomingMessage, res: ServerResponse, stream: boolean, store: DirectionStore): Promise<void> {
  if (!isTrustedRequest(req)) {
    writeJson(res, 403, { ok: false, error: { code: 'internal', message: 'forbidden: loopback-only' } })
    return
  }
  if (pathname === MODELS_ENDPOINT) {
    await serveModels(ctx, readConfig, req, res)
    return
  }
  if (pathname === DIRECTIONS_ENDPOINT || pathname.startsWith(`${DIRECTIONS_ENDPOINT}/`)) {
    await serveDirections(readConfig, store, pathname, req, res)
    return
  }
  // One route, two exact endpoints (one-shot JSON / incremental SSE):
  // anything else under the prefix is unknown.
  if (pathname !== ENHANCE_ENDPOINT && pathname !== ENHANCE_STREAM_ENDPOINT) {
    writeJson(res, 404, { ok: false, error: { code: 'internal', message: 'not found' } })
    return
  }
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: 'only POST is allowed' } })
    return
  }
  const contentType = req.headers['content-type']
  if (contentType !== undefined && !String(contentType).toLowerCase().startsWith('application/json')) {
    writeJson(res, 415, { ok: false, error: { code: 'rejected', message: '仅支持 application/json 请求体。' } })
    return
  }
  let config: Config
  try {
    config = readConfig()
  } catch (error) {
    // resolveConfig fails loud on an invalid section — surface it instead of
    // letting the rejection escape the handler.
    writeJson(res, 500, { ok: false, error: { code: 'internal', message: `prompt-boost 配置无效：${error instanceof Error ? error.message : String(error)}` } })
    return
  }
  // Fail before reading the body when the plugin is switched off.
  if (!config.enabled) {
    writeJson(res, 403, { ok: false, error: { code: 'rejected', message: '提示词增强已在设置中关闭。' } })
    return
  }
  // Fast reject on a declared body that already exceeds the cap: refuse before
  // reading a single byte. The streamed cap inside readBoundedJson stays as the
  // backstop for chunked bodies, which carry no Content-Length at all. A caller
  // that declares megabytes and dribbles them (or never sends them) must not
  // hold the connection open, so the socket is destroyed once the 413 lands.
  const cap = bodyCapOf(config.maxInputChars)
  const declaredLength = Number(req.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > cap) {
    // `connection: close` instead of destroying the socket: the 413 still has
    // to reach the caller, and a blunt destroy also kills whatever else rides
    // this keep-alive connection. Declaring the connection non-reusable lets
    // Node discard the unread body and close on its own schedule.
    res.setHeader('connection', 'close')
    writeJson(res, 413, { ok: false, error: { code: 'rejected', message: '请求体超过大小上限。' } })
    return
  }
  let body: unknown
  try {
    body = await readBoundedJson(req, cap)
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'body too large'
    writeJson(res, tooLarge ? 413 : 422, {
      ok: false,
      error: { code: 'rejected', message: tooLarge ? '请求体超过大小上限。' : '请求体不是有效的 JSON。' },
    })
    return
  }
  const record = body as { sessionId?: unknown; text?: unknown; direction?: unknown; provider?: unknown; model?: unknown } | null
  if (record === null || typeof record !== 'object' || typeof record.text !== 'string') {
    writeJson(res, 422, { ok: false, error: { code: 'rejected', message: '请求体必须是 { sessionId?, text, direction? } JSON。' } })
    return
  }
  // The client sends a direction id only, never instruction text: the
  // instruction is looked up here from the operator's settings, so the page
  // cannot smuggle arbitrary text into the system prompt.
  if (record.direction !== undefined && typeof record.direction !== 'string') {
    writeJson(res, 422, { ok: false, error: { code: 'rejected', message: 'direction 必须是字符串。' } })
    return
  }
  const directions = resolveDirections(config.customDirections, store.read())
  const direction = record.direction === undefined || record.direction === ''
    ? defaultDirectionOf(directions, config.defaultDirection)
    : findDirection(directions, record.direction)
  if (direction === undefined) {
    writeJson(res, 422, { ok: false, error: { code: 'rejected', message: `未知的提升方向：${String(record.direction).slice(0, 40)}（请检查插件设置里的自定义方向）` } })
    return
  }
  // A model chosen in the menu: a pair, and only one the live catalog lists,
  // so the page cannot route a boost to an arbitrary provider/model string.
  let routeOverride: RoutePair | undefined
  const hasProvider = record.provider !== undefined && record.provider !== ''
  const hasModel = record.model !== undefined && record.model !== ''
  if (hasProvider || hasModel) {
    if (!hasProvider || !hasModel || typeof record.provider !== 'string' || typeof record.model !== 'string') {
      writeJson(res, 422, { ok: false, error: { code: 'rejected', message: 'provider 与 model 必须成对提供（字符串）。' } })
      return
    }
    const face = catalogFaceOf(ctx.get('llm'))
    if (face === undefined || !(await isModelAvailable(face, record.provider, record.model))) {
      writeJson(res, 422, { ok: false, error: { code: 'rejected', message: `所选模型 ${record.provider.slice(0, 60)} / ${record.model.slice(0, 80)} 当前不可用，请右键按钮重新选择模型。` } })
      return
    }
    routeOverride = { provider: record.provider, model: record.model }
  }
  const sessionId = typeof record.sessionId === 'string' && record.sessionId !== '' ? record.sessionId : undefined
  const check = checkInputText(record.text, config.maxInputChars)
  if (!check.ok) {
    // The over-length case carries structured counts so the client renders
    // its localized too-long message (matching the client-side guard);
    // empty text (server-side only — the client guards it first) stays generic.
    writeJson(res, 422, {
      ok: false,
      error: check.code === 'too-long'
        ? { code: 'rejected', params: { count: check.count, max: check.max } }
        : { code: 'rejected' },
    })
    return
  }
  // Admission gate (after validation, so only real calls consume budget):
  // sliding-window rate cap, then concurrency cap. Rejected calls answer 429
  // with the configured limits so the user can act.
  //
  // The rate window counts SUCCESSFUL calls only — a stamp lands after the
  // 200 has been written, never on failure. Counting attempts instead would
  // burn the user's window on a run of timeouts/upstream errors and lock
  // them out right when the model recovers. The concurrency cap below still
  // bounds in-flight calls regardless of outcome, so failed calls cannot be
  // used to hammer the upstream either.
  const now = Date.now()
  // Failure breaker first: a host stuck on a broken route must refuse before
  // it reads a body or spends a window slot, and the wait is advertised so the
  // panel can say when to try again.
  if (now < gate.cooldownUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((gate.cooldownUntil - now) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    writeJson(res, 429, {
      ok: false,
      error: { code: 'cooldown', params: { retryAfterSeconds, failures: FAILURE_STREAK_LIMIT } },
    })
    return
  }
  // Trim the window in one splice instead of a `while (shift)` loop: with the
  // configured cap at 600 the worst case drops from O(N²) array shifts to a
  // single O(N) relocation. The cap is bounded, so this stays cheap in
  // absolute terms; the point is to avoid the quadratic shape on every call.
  const stamps = gate.stamps
  const cut = now - 60000
  let validFrom = 0
  while (validFrom < stamps.length && (stamps[validFrom] ?? cut) < cut) validFrom++
  if (validFrom > 0) stamps.splice(0, validFrom)
  if (stamps.length >= config.rateLimitPerMinute) {
    // The window is bounded, so the oldest surviving stamp tells exactly when
    // a slot frees up — advertise it instead of making the user guess.
    const oldest = stamps[0] ?? now
    const retryAfterSeconds = Math.max(1, Math.ceil((60000 - (now - oldest)) / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    writeJson(res, 429, {
      ok: false,
      error: { code: 'rate-limit', params: { limit: config.rateLimitPerMinute, retryAfterSeconds } },
    })
    return
  }
  // No Retry-After here: a busy slot frees whenever some in-flight call
  // settles, which is not a delay this route can predict.
  if (gate.active >= config.maxConcurrent) {
    writeJson(res, 429, {
      ok: false,
      error: { code: 'concurrency-limit', params: { max: config.maxConcurrent } },
    })
    return
  }
  gate.active += 1
  // Cancel the model call when the browser goes away mid-flight. `res.close`
  // also fires after a normal response completes, so guard with
  // `writableEnded` — only a premature close aborts the call.
  const callerAbort = new AbortController()
  const onConnectionClosed = (): void => {
    if (!res.writableEnded) callerAbort.abort()
  }
  res.on('close', onConnectionClosed)
  try {
    const runOptions = {
      text: record.text,
      sessionRoute: sessionRouteOf(ctx, sessionId),
      signal: callerAbort.signal,
      direction,
      ...routeOverride !== undefined ? { routeOverride } : {},
      ...sessionId !== undefined ? { sessionId } : {},
    }
    if (stream) {
      // The stream already opens before the model call, so the client sees
      // the first token instead of waiting for the whole rewrite. Frames go
      // through the backpressure-aware writer: a slow reader pauses the delta
      // path instead of letting the socket buffer grow without bound.
      const sse = createSseWriter(res)
      try {
        sse.open()
        // Display-only normalization: withhold a fence the final body will not
        // have. The authoritative text still comes from `normalizeOutput` at
        // the end, so this cannot change what the user applies.
        const display = createStreamNormalizer()
        const value = await runEnhance(ctx, config, {
          ...runOptions,
          onDelta: async (delta: string): Promise<void> => {
            const safe = display.push(delta)
            if (safe === '') return
            await sse.write(`event: delta\ndata: ${JSON.stringify({ type: 'delta', text: safe })}\n\n`)
          },
        })
        // End the display stream: release whatever the fence heuristic was
        // still withholding, so the incremental view shows the same text the
        // done frame is about to carry (the model may end inside a fence).
        const tail = display.finish()
        if (tail !== '') {
          await sse.write(`event: delta\ndata: ${JSON.stringify({ type: 'delta', text: tail })}\n\n`)
        }
        await sse.write(`event: done\ndata: ${JSON.stringify({ type: 'done', value })}\n\n`)
        // Terminate the response. Without this the chunked body never receives
        // its closing `0\r\n\r\n`, so the connection stays half-open: a browser
        // client survives only because it returns on the `done` frame and
        // cancels the reader, but any whole-body reader (`response.text()`, a
        // curl, a proxy) waits forever, and the socket can never be reused.
        endResponse(res)
      } finally {
        // Always release the transport listener, success or failure.
        sse.dispose()
      }
    } else {
      const value = await runEnhance(ctx, config, runOptions)
      writeJson(res, 200, { ok: true, value })
    }
    // Count only on success: failed calls must not consume the sliding window
    // (see the gate note above). `Date.now()` at completion, not admission,
    // keeps the window honest — a slow success still counts as one call.
    stamps.push(Date.now())
    gate.failures = 0
  } catch (error) {
    // A caller that walked away is not a failing route: aborting mid-flight
    // must never move the breaker toward its cool-down.
    if (!callerAbort.signal.aborted) {
      gate.failures += 1
      if (gate.failures >= FAILURE_STREAK_LIMIT) {
        gate.cooldownUntil = Date.now() + FAILURE_COOLDOWN_MS
        gate.failures = 0
      }
    }
    const wire = toEnhanceError(error)
    if (stream && res.headersSent) {
      // Headers are already out: the failure has to ride the same stream, and
      // the stream has to be closed the same way the success path closes it.
      // Writing the `error` frame alone leaves the chunked body unterminated —
      // the frame reaches a browser (which acts on it), while a whole-body
      // reader keeps waiting for the closing chunk that never comes.
      if (!res.writableEnded) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: wire })}\n\n`)
        } catch {
          // Socket already gone: the write is moot, the end below still applies.
        }
      }
      endResponse(res)
    } else {
      writeJson(res, wire.code === 'timeout' ? 504 : wire.code === 'unconfigured' ? 409 : 502, { ok: false, error: wire })
    }
  } finally {
    res.off('close', onConnectionClosed)
    gate.active -= 1
  }
}

/**
 * Contexts that already own the route. The admission gate is created per
 * registration, so mounting twice on one context would silently double the
 * effective limits — exactly the drift a re-applied plugin (reload, re-link)
 * must not introduce.
 *
 * The recorded mount carries the webserver it was registered on: if the host
 * ever rebuilds that service while reusing the same context, a bare "already
 * mounted" flag would leave the plugin alive with no route at all (button
 * present, every click 404). Comparing identities lets the registration heal
 * itself instead of staying silently absent.
 */
interface RouteMount {
  webserver: unknown
  dispose: () => void
}

const mounts = new WeakMap<Context, RouteMount>()

/**
 * Register the /prompt-boost prefix route on the shared webserver.
 *
 * Two lifetime rules, both learned the hard way:
 *
 * 1. The webserver is a *dependency*, not something to snapshot. Reading it
 *    once at apply time would leave the plugin routeless in any composition
 *    that loads the webserver later, and would keep serving from a dead
 *    service after the host rebuilds it. `ctx.inject` scopes a child fiber to
 *    the service, so this block re-runs on replacement and is torn down when
 *    the service goes away.
 * 2. The registration must live exactly as long as that fiber.
 *    `webServer.register` only hands back a "drop from the table" function; the
 *    service does not reclaim it on unload. Left to a module-level map, an
 *    unloaded plugin keeps answering requests with a stale config reader and a
 *    stale admission gate, and a reload throws `duplicate prefix route`.
 *    `ctx.effect` is what actually reclaims it.
 *
 * @param ctx - registrant context.
 * @param readConfig - per-request config reader so settings changes apply immediately.
 */
export function registerEnhanceRoute(ctx: Context, readConfig: () => Config, store: DirectionStore = createMemoryStore()): void {
  ctx.inject(['webServer'], (routeCtx: Context) => {
    const webserver = routeCtx.get('webServer') as unknown as {
      register(route: unknown): unknown
    } | undefined
    if (webserver === undefined) return
    const existing = mounts.get(ctx)
    // Already mounted on this very service (a second apply on a live fiber, or
    // a re-link): a second registration would also double the effective rate
    // and concurrency limits, which is exactly the drift a reload must not add.
    if (existing !== undefined && existing.webserver === webserver) return
    if (existing !== undefined) {
      // The service was rebuilt: drop the stale registration (it belongs to a
      // webserver that no longer serves) and mount on the live one.
      try {
        existing.dispose()
      } catch {
        // Already torn down with the old service.
      }
      mounts.delete(ctx)
    }
    const gate: AdmissionGate = { stamps: [], active: 0, failures: 0, cooldownUntil: 0 }
    routeCtx.effect(() => {
      const dispose = webserver.register({
        kind: 'prefix',
        path: ENHANCE_PREFIX,
        handler: (req: IncomingMessage, res: ServerResponse): Promise<void> => {
          const pathname = new URL(req.url ?? '/', 'http://x').pathname
          return serveEnhance(ctx, readConfig, gate, pathname, req, res, pathname === ENHANCE_STREAM_ENDPOINT, store)
        },
      })
      const disposed = typeof dispose === 'function' ? dispose as () => void : (): void => {}
      mounts.set(ctx, { webserver, dispose: disposed })
      return (): void => {
        // Only the owner clears the record: after a service swap a newer mount
        // may already own it, and deleting that would make the next apply
        // register a duplicate on a live table.
        if (mounts.get(ctx)?.dispose === disposed) mounts.delete(ctx)
        try {
          disposed()
        } catch {
          // Already torn down with the old service.
        }
      }
    }, 'prompt-boost: enhance route')
  })
}
