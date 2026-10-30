/**
 * Browser-side client of the POST /prompt-boost/enhance host route:
 * same-origin fetch with abort support and a typed error surface. Every
 * failure is a structured EnhanceError the panel renders verbatim.
 * @module dsh-prompt-boost/client/enhance-client
 */

import { DIRECTIONS_ENDPOINT, ENHANCE_ENDPOINT, ENHANCE_STREAM_ENDPOINT, MODELS_ENDPOINT, type DirectionInput, type DirectionList, type ModelCatalog, type EnhanceError, type EnhanceErrorCode, type EnhanceRequestBody, type EnhanceResult, type EnhanceStreamEvent } from '../shared/protocol'

/** Typed fetch failure carrying the wire error. */
export class EnhanceClientError extends Error {
  constructor(public readonly detail: EnhanceError) {
    super(detail.message)
  }
}

/**
 * Encode one request body.
 *
 * UTF-8 bytes rather than a bare string: with `types: ["node"]` the `BodyInit`
 * union has no `string` member (the DOM-only `string` form relies on the
 * global fetch types), and the explicit encoder also makes the wire size of a
 * CJK-heavy draft statable instead of implicit.
 * @param body - the typed request envelope.
 * @returns the UTF-8 encoded JSON payload.
 */
function jsonBody(body: EnhanceRequestBody): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body))
}

/** The stable error codes the host may send; anything else normalizes to `internal`. */
const KNOWN_ERROR_CODES = new Set<EnhanceErrorCode>([
  'rejected',
  'rate-limit',
  'concurrency-limit',
  'cooldown',
  'timeout',
  'upstream',
  'unconfigured',
  'internal',
])

/** Narrow one wire error, normalizing unknown codes. `message`/`params` are optional. */
function parseError(value: unknown): EnhanceError {
  const record = value as Partial<EnhanceError> | null
  if (record !== null && typeof record === 'object') {
    const code: EnhanceErrorCode = typeof record.code === 'string' && KNOWN_ERROR_CODES.has(record.code as EnhanceErrorCode)
      ? record.code as EnhanceErrorCode
      : 'internal'
    const message = typeof record.message === 'string' && record.message !== '' ? record.message : undefined
    const params = record.params !== null && typeof record.params === 'object'
      ? record.params as Record<string, string | number>
      : undefined
    return { code, ...(message !== undefined ? { message } : {}), ...(params !== undefined ? { params } : {}) }
  }
  return { code: 'internal', message: '宿主服务返回异常。' }
}

/** Strictly narrow one success value; anything malformed is a client-visible error. */
function parseResult(value: unknown): EnhanceResult {
  const record = value as Partial<EnhanceResult> | null
  if (
    record !== null && typeof record === 'object'
    && typeof record.text === 'string' && record.text !== ''
    && typeof record.provider === 'string' && record.provider !== ''
    && typeof record.model === 'string' && record.model !== ''
    && typeof record.elapsedMs === 'number' && Number.isFinite(record.elapsedMs)
  ) {
    return { text: record.text, provider: record.provider, model: record.model, elapsedMs: record.elapsedMs }
  }
  throw new EnhanceClientError({ code: 'internal', message: '宿主服务返回了无法解析的结果。' })
}

/** Read and validate the response envelope. */
async function readEnvelope(response: Response): Promise<EnhanceResult> {
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new EnhanceClientError({ code: 'internal', message: '宿主服务返回了无法解析的响应。' })
  }
  const envelope = parsed as { ok?: unknown; value?: EnhanceResult; error?: EnhanceError } | null
  if (envelope !== null && typeof envelope === 'object' && envelope.ok === true) {
    return parseResult(envelope.value)
  }
  if (envelope !== null && typeof envelope === 'object' && envelope.error !== undefined) {
    throw new EnhanceClientError(parseError(envelope.error))
  }
  throw new EnhanceClientError({ code: 'internal', message: `宿主服务返回异常（HTTP ${response.status}）。` })
}

/**
 * Turn a non-2xx reply into the error the host actually meant.
 *
 * A refused request is not a missing stream. The route answers 429 for the
 * rate/concurrency/cooldown cases, 409 for an unconfigured model, 422 for a
 * rejected draft and 5xx for upstream failures — and every one of those
 * carries a structured envelope naming the reason. Retrying it as if the
 * transport were at fault spends the user's quota a second time and replaces
 * the real reason with whatever the retry happens to fail with.
 * @param response - the refused response (its body is consumed here).
 * @returns the displayable error, falling back to the status code.
 */
async function rejectionOf(response: Response): Promise<EnhanceClientError> {
  try {
    const parsed = await response.json() as { error?: unknown } | null
    if (parsed !== null && typeof parsed === 'object' && parsed.error !== undefined) {
      return new EnhanceClientError(parseError(parsed.error))
    }
  } catch {
    // Not the JSON envelope (proxy error page, empty body): fall through.
  }
  return new EnhanceClientError({ code: 'internal', message: `宿主服务拒绝了请求（HTTP ${response.status}），请稍后重试。` })
}

/** One SSE frame: the event name line and the `data:` payload line. */
interface StreamFrame {
  event: string
  data: string
}
/** Split one buffer into complete SSE frames; the remainder stays buffered. */
function takeFrames(buffer: string): { frames: StreamFrame[]; rest: string } {
  const frames: StreamFrame[] = []
  let rest = buffer
  for (let index = rest.indexOf('\n\n'); index !== -1; index = rest.indexOf('\n\n')) {
    const raw = rest.slice(0, index)
    rest = rest.slice(index + 2)
    let event = 'message'
    const data: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') })
  }
  return { frames, rest }
}

/** Narrow one stream frame into a typed event; unparseable frames are skipped. */
function parseFrame(frame: StreamFrame): EnhanceStreamEvent | undefined {
  if (frame.event !== 'delta' && frame.event !== 'done' && frame.event !== 'error') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(frame.data)
  } catch {
    return undefined
  }
  const record = parsed as { type?: unknown } | null
  if (record === null || typeof record !== 'object' || record.type !== frame.event) return undefined
  return record as EnhanceStreamEvent
}

/** Incremental enhancement options. */
export interface EnhanceStreamOptions {
  /** Caller cancellation (panel cancel button / unmount). */
  signal?: AbortSignal
  /** Receives each newly displayable piece of text. */
  onDelta: (text: string) => void
}

/**
 * Request one enhancement and show it while it is written.
 *
 * Degrades to {@link requestEnhance} whenever the incremental path is not
 * actually available: an older host without the stream route, a proxy that
 * buffered the response into one blob, or a browser without a readable fetch
 * body. The result is the same normalized body either way — only the display
 * is progressive.
 * @param body - the session id and the raw draft text.
 * @param options - cancellation and the delta sink.
 * @returns the enhancement result.
 * @throws EnhanceClientError with a displayable message on every failure.
 */
export async function requestEnhanceStream(body: EnhanceRequestBody, options: EnhanceStreamOptions): Promise<EnhanceResult> {
  let response: Response
  try {
    response = await fetch(ENHANCE_STREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: jsonBody(body),
      signal: options.signal,
    } as RequestInit)
  } catch (error) {
    if (options.signal?.aborted) {
      throw new EnhanceClientError({ code: 'internal', message: '已取消增强；原输入未改动。' })
    }
    void error
    throw new EnhanceClientError({ code: 'internal', message: '无法连接宿主服务，请确认 dsh web 正在运行后重试。' })
  }
  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase()
  // A refusal is the server answering, not a missing stream: report it as-is
  // instead of discarding the envelope and re-sending the same request.
  if (!response.ok) throw await rejectionOf(response)
  const stream = response.body
  if (stream === null || stream === undefined || !contentType.includes('event-stream')) {
    // Not a stream (old host, buffered proxy): release the body and take the
    // one-shot path instead.
    // `cancel()` may return a promise in some runtimes and undefined in
    // others, so wrap before catching rather than assuming a promise.
    void Promise.resolve().then(() => stream?.cancel()).catch(() => {})
    return requestEnhance(body, options.signal)
  }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { frames, rest } = takeFrames(buffer)
      buffer = rest
      for (const frame of frames) {
        const event = parseFrame(frame)
        if (event === undefined) continue
        if (event.type === 'delta') options.onDelta(event.text)
        else if (event.type === 'done') return parseResult(event.value)
        else throw new EnhanceClientError(parseError(event.error))
      }
    }
  } finally {
    void Promise.resolve().then(() => reader.cancel()).catch(() => {})
  }
  throw new EnhanceClientError({ code: 'internal', message: '宿主服务提前关闭了增强流，请重试；原输入未改动。' })
}

/**
 * Request one enhancement from the host route.
 * @param body - the session id and the raw draft text.
 * @param signal - caller cancellation (panel cancel button / unmount).
 * @returns the enhancement result.
 * @throws EnhanceClientError with a displayable message on every failure.
 */
export async function requestEnhance(body: EnhanceRequestBody, signal?: AbortSignal): Promise<EnhanceResult> {
  let response: Response
  try {
    response = await fetch(ENHANCE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: jsonBody(body),
      signal,
    } as RequestInit)
  } catch (error) {
    if (signal?.aborted) {
      throw new EnhanceClientError({ code: 'internal', message: '已取消增强；原输入未改动。' })
    }
    void error
    throw new EnhanceClientError({ code: 'internal', message: '无法连接宿主服务，请确认 dsh web 正在运行后重试。' })
  }
  return readEnvelope(response)
}

/**
 * Fetch the model catalog the boost menu lists (the same live list as DSH's
 * own model picker).
 * @param sessionId - the composer's session, so the "follow" row can name the
 *   model that session would use; absent for the harness default.
 * @param signal - cancellation.
 * @returns the catalog.
 * @throws EnhanceClientError on transport or host failure.
 */
export async function fetchModelCatalog(sessionId: string | undefined, signal?: AbortSignal): Promise<ModelCatalog> {
  const url = sessionId === undefined ? MODELS_ENDPOINT : `${MODELS_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`
  let response: Response
  try {
    response = await fetch(url, { method: 'GET', signal } as RequestInit)
  } catch (error) {
    throw new EnhanceClientError({ code: 'internal', message: error instanceof Error ? error.message : String(error) })
  }
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new EnhanceClientError({ code: 'internal', message: `宿主服务返回异常（HTTP ${response.status}）。` })
  }
  const envelope = parsed as { ok?: unknown; value?: ModelCatalog; error?: EnhanceError } | null
  if (envelope !== null && typeof envelope === 'object' && envelope.ok === true && envelope.value !== undefined && Array.isArray(envelope.value.groups)) {
    return {
      groups: envelope.value.groups,
      failures: Array.isArray(envelope.value.failures) ? envelope.value.failures : [],
      ...(envelope.value.fallback !== undefined ? { fallback: envelope.value.fallback } : {}),
    }
  }
  if (envelope !== null && typeof envelope === 'object' && envelope.error !== undefined) {
    throw new EnhanceClientError(parseError(envelope.error))
  }
  throw new EnhanceClientError({ code: 'internal', message: `宿主服务返回异常（HTTP ${response.status}）。` })
}

/**
 * One call to the mode editor routes.
 * @param method - HTTP method.
 * @param path - the route path.
 * @param body - the JSON body, if any.
 * @returns the fresh mode list.
 * @throws EnhanceClientError with the host's message on failure.
 */
async function directionCall(method: string, path: string, body?: DirectionInput): Promise<DirectionList> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    } as RequestInit)
  } catch (error) {
    throw new EnhanceClientError({ code: 'internal', message: error instanceof Error ? error.message : String(error) })
  }
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new EnhanceClientError({ code: 'internal', message: `宿主服务返回异常（HTTP ${response.status}）。` })
  }
  const envelope = parsed as { ok?: unknown; value?: DirectionList; error?: EnhanceError } | null
  if (envelope?.ok === true && envelope.value !== undefined && Array.isArray(envelope.value.directions)) return envelope.value
  if (envelope?.error !== undefined) throw new EnhanceClientError(parseError(envelope.error))
  throw new EnhanceClientError({ code: 'internal', message: `宿主服务返回异常（HTTP ${response.status}）。` })
}

/** The effective modes (built-in + settings + saved). */
export function fetchDirections(): Promise<DirectionList> {
  return directionCall('GET', DIRECTIONS_ENDPOINT)
}

/** Create a mode; the answer carries its new id in `createdId`. */
export function createDirection(input: DirectionInput): Promise<DirectionList> {
  return directionCall('POST', DIRECTIONS_ENDPOINT, input)
}

/** Save (edit) an existing mode. */
export function saveDirection(id: string, input: DirectionInput): Promise<DirectionList> {
  return directionCall('PUT', `${DIRECTIONS_ENDPOINT}/${encodeURIComponent(id)}`, input)
}

/** Delete a saved mode, or restore a built-in / settings mode to its original. */
export function deleteDirection(id: string): Promise<DirectionList> {
  return directionCall('DELETE', `${DIRECTIONS_ENDPOINT}/${encodeURIComponent(id)}`)
}
