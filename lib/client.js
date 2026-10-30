window.__ModuleLoader__.load({
	id: "dsh-prompt-booster",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/EnhanceButton.tsx
var import_react4 = require("react");
var import_react_dom = require("react-dom");

// src/shared/validate.ts
function isInvisibleCodePoint(cp) {
  return cp >= 8203 && cp <= 8205 || cp === 65279 || cp >= 8234 && cp <= 8238 || cp >= 8294 && cp <= 8297;
}
function scanText(text) {
  let count = 0;
  let visibleNonBlank = false;
  for (const ch of text) {
    count++;
    const code = ch.codePointAt(0) ?? 0;
    if (!isInvisibleCodePoint(code) && !/\s/.test(ch)) visibleNonBlank = true;
  }
  return { count, visibleNonBlank };
}
function checkInputText(text, maxChars) {
  const { count, visibleNonBlank } = scanText(text);
  if (!visibleNonBlank) {
    return { ok: false, code: "empty" };
  }
  if (count > maxChars) {
    return { ok: false, code: "too-long", count, max: maxChars };
  }
  return { ok: true };
}

// src/shared/protocol.ts
var ENHANCE_ENDPOINT = "/prompt-boost/enhance";
var ENHANCE_STREAM_ENDPOINT = "/prompt-boost/enhance-stream";
var MODELS_ENDPOINT = "/prompt-boost/models";
var DIRECTIONS_ENDPOINT = "/prompt-boost/directions";
var PROMPT_ENHANCE_ROW_IDS = [
  "prompt-boost",
  "dsh-prompt-booster",
  "dsh-prompt-boost",
  "web-ui-prompt-boost"
];

// src/client/enhance-client.ts
var EnhanceClientError = class extends Error {
  constructor(detail) {
    super(detail.message);
    this.detail = detail;
  }
};
function jsonBody(body) {
  return new TextEncoder().encode(JSON.stringify(body));
}
var KNOWN_ERROR_CODES = /* @__PURE__ */ new Set([
  "rejected",
  "rate-limit",
  "concurrency-limit",
  "cooldown",
  "timeout",
  "upstream",
  "unconfigured",
  "internal"
]);
function parseError(value) {
  const record = value;
  if (record !== null && typeof record === "object") {
    const code = typeof record.code === "string" && KNOWN_ERROR_CODES.has(record.code) ? record.code : "internal";
    const message = typeof record.message === "string" && record.message !== "" ? record.message : void 0;
    const params = record.params !== null && typeof record.params === "object" ? record.params : void 0;
    return { code, ...message !== void 0 ? { message } : {}, ...params !== void 0 ? { params } : {} };
  }
  return { code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\u3002" };
}
function parseResult(value) {
  const record = value;
  if (record !== null && typeof record === "object" && typeof record.text === "string" && record.text !== "" && typeof record.provider === "string" && record.provider !== "" && typeof record.model === "string" && record.model !== "" && typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)) {
    return { text: record.text, provider: record.provider, model: record.model, elapsedMs: record.elapsedMs };
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u7ED3\u679C\u3002" });
}
async function readEnvelope(response) {
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u54CD\u5E94\u3002" });
  }
  const envelope = parsed;
  if (envelope !== null && typeof envelope === "object" && envelope.ok === true) {
    return parseResult(envelope.value);
  }
  if (envelope !== null && typeof envelope === "object" && envelope.error !== void 0) {
    throw new EnhanceClientError(parseError(envelope.error));
  }
  throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
}
async function rejectionOf(response) {
  try {
    const parsed = await response.json();
    if (parsed !== null && typeof parsed === "object" && parsed.error !== void 0) {
      return new EnhanceClientError(parseError(parsed.error));
    }
  } catch {
  }
  return new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF08HTTP ${response.status}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002` });
}
function takeFrames(buffer) {
  const frames = [];
  let rest = buffer;
  for (let index = rest.indexOf("\n\n"); index !== -1; index = rest.indexOf("\n\n")) {
    const raw = rest.slice(0, index);
    rest = rest.slice(index + 2);
    let event = "message";
    const data = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length > 0) frames.push({ event, data: data.join("\n") });
  }
  return { frames, rest };
}
function parseFrame(frame) {
  if (frame.event !== "delta" && frame.event !== "done" && frame.event !== "error") return void 0;
  let parsed;
  try {
    parsed = JSON.parse(frame.data);
  } catch {
    return void 0;
  }
  const record = parsed;
  if (record === null || typeof record !== "object" || record.type !== frame.event) return void 0;
  return record;
}
async function requestEnhanceStream(body, options) {
  let response;
  try {
    response = await fetch(ENHANCE_STREAM_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: jsonBody(body),
      signal: options.signal
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!response.ok) throw await rejectionOf(response);
  const stream = response.body;
  if (stream === null || stream === void 0 || !contentType.includes("event-stream")) {
    void Promise.resolve().then(() => stream?.cancel()).catch(() => {
    });
    return requestEnhance(body, options.signal);
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = takeFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event === void 0) continue;
        if (event.type === "delta") options.onDelta(event.text);
        else if (event.type === "done") return parseResult(event.value);
        else throw new EnhanceClientError(parseError(event.error));
      }
    }
  } finally {
    void Promise.resolve().then(() => reader.cancel()).catch(() => {
    });
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u63D0\u524D\u5173\u95ED\u4E86\u589E\u5F3A\u6D41\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
}
async function requestEnhance(body, signal) {
  let response;
  try {
    response = await fetch(ENHANCE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody(body),
      signal
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  return readEnvelope(response);
}
async function fetchModelCatalog(sessionId, signal) {
  const url = sessionId === void 0 ? MODELS_ENDPOINT : `${MODELS_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`;
  let response;
  try {
    response = await fetch(url, { method: "GET", signal });
  } catch (error) {
    throw new EnhanceClientError({ code: "internal", message: error instanceof Error ? error.message : String(error) });
  }
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
  }
  const envelope = parsed;
  if (envelope !== null && typeof envelope === "object" && envelope.ok === true && envelope.value !== void 0 && Array.isArray(envelope.value.groups)) {
    return {
      groups: envelope.value.groups,
      failures: Array.isArray(envelope.value.failures) ? envelope.value.failures : [],
      ...envelope.value.fallback !== void 0 ? { fallback: envelope.value.fallback } : {}
    };
  }
  if (envelope !== null && typeof envelope === "object" && envelope.error !== void 0) {
    throw new EnhanceClientError(parseError(envelope.error));
  }
  throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
}
async function directionCall(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      ...body !== void 0 ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}
    });
  } catch (error) {
    throw new EnhanceClientError({ code: "internal", message: error instanceof Error ? error.message : String(error) });
  }
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
  }
  const envelope = parsed;
  if (envelope?.ok === true && envelope.value !== void 0 && Array.isArray(envelope.value.directions)) return envelope.value;
  if (envelope?.error !== void 0) throw new EnhanceClientError(parseError(envelope.error));
  throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
}
function fetchDirections() {
  return directionCall("GET", DIRECTIONS_ENDPOINT);
}
function createDirection(input) {
  return directionCall("POST", DIRECTIONS_ENDPOINT, input);
}
function saveDirection(id, input) {
  return directionCall("PUT", `${DIRECTIONS_ENDPOINT}/${encodeURIComponent(id)}`, input);
}
function deleteDirection(id) {
  return directionCall("DELETE", `${DIRECTIONS_ENDPOINT}/${encodeURIComponent(id)}`);
}

// src/client/directions-store.ts
var listeners = /* @__PURE__ */ new Set();
var current;
var inflight;
function getDirectionList() {
  return current;
}
function setDirectionList(list) {
  current = list;
  for (const listener of listeners) listener();
}
function subscribeDirectionList(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function refreshDirectionList() {
  if (inflight !== void 0) return inflight;
  inflight = fetchDirections().then(
    (list) => setDirectionList(list),
    (error) => {
      console.warn("[prompt-boost] could not load modes from the host; using the local list.", error);
    }
  ).finally(() => {
    inflight = void 0;
  });
  return inflight;
}

// src/client/model-choice.ts
var MODEL_CHOICE_KEY = "dsh-prompt-boost:model";
var listeners2 = /* @__PURE__ */ new Set();
var loaded = false;
var current2;
function routeOf(value) {
  const record = value;
  if (record === null || typeof record !== "object") return void 0;
  if (typeof record.provider !== "string" || record.provider === "") return void 0;
  if (typeof record.model !== "string" || record.model === "") return void 0;
  return {
    provider: record.provider,
    model: record.model,
    ...typeof record.name === "string" && record.name !== "" ? { name: record.name } : {},
    ...typeof record.providerName === "string" && record.providerName !== "" ? { providerName: record.providerName } : {}
  };
}
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = globalThis.localStorage?.getItem(MODEL_CHOICE_KEY);
    current2 = raw === null || raw === void 0 ? void 0 : routeOf(JSON.parse(raw));
  } catch {
    current2 = void 0;
  }
}
function getModelChoice() {
  ensureLoaded();
  return current2;
}
function setModelChoice(route) {
  ensureLoaded();
  current2 = route === void 0 ? void 0 : routeOf(route);
  try {
    if (current2 === void 0) globalThis.localStorage?.removeItem(MODEL_CHOICE_KEY);
    else globalThis.localStorage?.setItem(MODEL_CHOICE_KEY, JSON.stringify(current2));
  } catch {
  }
  for (const listener of listeners2) listener();
}
function subscribeModelChoice(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
function routeLabel(route) {
  return route.name !== void 0 && route.name !== "" ? route.name : route.model;
}

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Svg(props) {
  const { size = 16, className, children, fill = false } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      className,
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: fill ? "currentColor" : "none",
      stroke: fill ? "none" : "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      children
    }
  );
}
function SparkleIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, fill: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 1.75c.2 0 .37.14.42.33l.62 2.38a2.9 2.9 0 0 0 2.07 2.07l2.38.62a.44.44 0 0 1 0 .85l-2.38.62a2.9 2.9 0 0 0-2.07 2.07l-.62 2.38a.44.44 0 0 1-.85 0l-.62-2.38a2.9 2.9 0 0 0-2.07-2.07l-2.38-.62a.44.44 0 0 1 0-.85l2.38-.62a2.9 2.9 0 0 0 2.07-2.07l.62-2.38a.44.44 0 0 1 .43-.33Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12.6 1.2c.1 0 .18.07.2.16l.17.66c.08.32.33.57.65.65l.66.17a.21.21 0 0 1 0 .41l-.66.17a.9.9 0 0 0-.65.65l-.17.66a.21.21 0 0 1-.41 0l-.17-.66a.9.9 0 0 0-.65-.65l-.66-.17a.21.21 0 0 1 0-.41l.66-.17a.9.9 0 0 0 .65-.65l.17-.66a.21.21 0 0 1 .2-.16Z" })
  ] });
}
function SpinnerIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "5.75", opacity: "0.25" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13.75 8A5.75 5.75 0 0 0 8 2.25" })
  ] });
}
function PencilIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10.6 2.9a1.6 1.6 0 0 1 2.27 2.27l-7.4 7.4-3.07.8.8-3.07 7.4-7.4Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m9.5 4 2.5 2.5" })
  ] });
}
function PlusIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3.25v9.5M3.25 8h9.5" }) });
}
function ChevronRightIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 3.5 4.5 4.5L6 12.5" }) });
}
function ChevronLeftIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 3.5 5.5 8l4.5 4.5" }) });
}
function CheckIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m3.25 8.5 3 3 6.5-7" }) });
}
function CloseIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 4 8 8M12 4l-8 8" }) });
}
function AlertIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 4.9v3.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "11.1", r: "0.35", fill: "currentColor" })
  ] });
}
function UndoIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.5 3.5 2.75 6.25 5.5 9" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.75 6.25h6.5a3.5 3.5 0 0 1 0 7H7" })
  ] });
}
function CpuIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "4", y: "4", width: "8", height: "8", rx: "1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 6.5h3v3h-3zM6 1.75V4M10 1.75V4M6 12v2.25M10 12v2.25M1.75 6H4M1.75 10H4M12 6h2.25M12 10h2.25" })
  ] });
}
function WandIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m2.5 13.5 7.75-7.75M9 3.25l.5-1.5.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5ZM12.75 7.5l.25-.75.25.75.75.25-.75.25-.25.75-.25-.75-.75-.25.75-.25Z" }) });
}
function ShrinkIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.75 4.5h10.5M4.75 8h6.5M6.5 11.5h3" }) });
}
function ListIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 4h7.25M6 8h7.25M6 12h7.25" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "3", cy: "4", r: "0.6", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "3", cy: "8", r: "0.6", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "3", cy: "12", r: "0.6", fill: "currentColor" })
  ] });
}
function DetailIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 2.75h6.5L13 6.25v7H3z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.25 2.75v3.5H13M5.75 9h4.5M8 6.75v4.5" })
  ] });
}
function CodeIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.25 4.75 2 8l3.25 3.25M10.75 4.75 14 8l-3.25 3.25M9 3 7 13" }) });
}
function SearchIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Svg, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7", cy: "7", r: "4.25" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m10.25 10.25 3.25 3.25" })
  ] });
}
function BookIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.25 3.25h4a1.75 1.75 0 0 1 1.75 1.75v8.25a1.5 1.5 0 0 0-1.5-1.5H2.25zM13.75 3.25h-4A1.75 1.75 0 0 0 8 5v8.25a1.5 1.5 0 0 1 1.5-1.5h4.25z" }) });
}
function LanguageIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2 3.5h6M5 2v1.5M3.25 3.5c.4 2.3 2 4 4.25 4.75M6.75 3.5C6.3 6 4.6 7.9 2.25 8.75M8.5 14l2.75-6.5L14 14M9.4 12h3.7" }) });
}
function BookmarkIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.25 2.75h7.5v10.5L8 10.75l-3.75 2.5z" }) });
}
var MODE_ICONS = {
  general: WandIcon,
  concise: ShrinkIcon,
  structured: ListIcon,
  detailed: DetailIcon,
  coding: CodeIcon,
  research: SearchIcon,
  academic: BookIcon,
  english: LanguageIcon
};
function ModeIcon(props) {
  const { id, ...rest } = props;
  const Icon = MODE_ICONS[id] ?? BookmarkIcon;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { ...rest });
}

// src/client/ResultPanel.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var retryable = (code) => code === "upstream" || code === "timeout" || code === "internal";
var UPSTREAM_ERROR_KEYS = {
  auth: "error.upstream.auth",
  "invalid-credential": "error.upstream.invalidCredential",
  "rate-limit": "error.upstream.rateLimit",
  quota: "error.upstream.quota",
  empty: "error.upstream.empty",
  "context-window": "error.upstream.contextWindow",
  "tool-call": "error.upstream.toolCall",
  "max-tokens": "error.upstream.maxTokens"
};
function localizedErrorMessage(t, code, params) {
  if (code === "rejected" && typeof params?.count === "number" && typeof params?.max === "number") {
    return t("error.tooLong", { count: params.count, max: params.max });
  }
  if (code === "upstream" && typeof params?.reason === "string") {
    const specific = UPSTREAM_ERROR_KEYS[params.reason];
    if (specific !== void 0) return t(specific);
  }
  switch (code) {
    case "rejected":
      return t("error.rejected");
    case "rate-limit":
      return t("error.rateLimit", params);
    case "concurrency-limit":
      return t("error.concurrencyLimit", params);
    case "cooldown":
      return t("error.cooldown", params);
    case "timeout":
      return t("error.timeout", params);
    case "unconfigured":
      return t("error.unconfigured");
    case "upstream":
      return t("error.upstream");
    default:
      return t("error.internal");
  }
}
function fallbackCopy(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
function ResultPanel(props) {
  const { state, t, onApply, onCancel, onRetry } = props;
  const [copied, setCopied] = (0, import_react.useState)("idle");
  const panelRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (panel === null) return;
        const focusables = panel.querySelectorAll('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (first === void 0 || last === void 0) return;
        const active = document.activeElement;
        const atRoot = active === panel;
        if (event.shiftKey && (active === first || atRoot)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  const openerRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener === null || !opener.isConnected) return;
      const active = document.activeElement;
      if (active === null || active === document.body) opener.focus();
    };
  }, []);
  const copy = (0, import_react.useCallback)(() => {
    if (state.result === void 0) return;
    const text = state.result.text;
    const done = (ok) => setCopied(ok ? "ok" : "failed");
    if (navigator.clipboard !== void 0) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
      return;
    }
    done(fallbackCopy(text));
  }, [state.result]);
  const formatMs = (ms) => ms < 1e3 ? `${ms}ms` : `${(ms / 1e3).toFixed(1)}s`;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-overlay", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onCancel();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "section",
    {
      ref: panelRef,
      className: "dsh-pe-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("panel.title"),
      tabIndex: -1,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "dsh-pe-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-head-mark", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SparkleIcon, { size: 14 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-head-title", children: t("panel.title") }),
          state.direction !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-pe-chip", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModeIcon, { id: state.direction.id, size: 12 }),
            t("panel.direction", { label: state.direction.label })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-grow" }),
          state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-pe-meta", title: `${state.result.provider} / ${state.result.model}`, children: [
            t("panel.model", { provider: state.result.provider, model: state.result.model }),
            " \xB7 ",
            t("panel.elapsed", { ms: formatMs(state.result.elapsedMs) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-pe-icon-btn", "aria-label": t("panel.close"), onClick: onCancel, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloseIcon, { size: 14 }) })
        ] }),
        state.phase === "loading" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-loading", children: state.streaming === void 0 || state.streaming === "" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SpinnerIcon, { size: 22, className: "dsh-pe-spinning dsh-pe-loading-spin" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: t("panel.loading") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-hint", children: t("panel.loading.hint") })
        ] }) : (
          // Incremental view: the text already generated, replaced by the
          // normalized full body the moment the call settles.
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-stream", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-col-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SpinnerIcon, { size: 12, className: "dsh-pe-spinning" }),
              t("panel.streaming")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "dsh-pe-col-text", children: state.streaming })
          ] })
        ) }),
        state.phase === "error" && state.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-error", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AlertIcon, { size: 16, className: "dsh-pe-error-icon" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-error-copy", children: state.error.localized !== void 0 ? (
            // Client-side guard failures carry their own pre-localized copy.
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: state.error.localized })
          ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: localizedErrorMessage(t, state.error.code, state.error.params) }),
            state.error.message !== void 0 && state.error.message !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-error-detail", children: state.error.message })
          ] }) })
        ] }),
        state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-col", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pe-col-title", children: t("panel.original") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "dsh-pe-col-text", children: state.original })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-col is-result", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-col-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SparkleIcon, { size: 12 }),
              t("panel.enhanced")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: "dsh-pe-col-text", children: state.result.text })
          ] })
        ] }),
        state.phase === "result" && state.stale && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-pe-stale", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AlertIcon, { size: 14 }),
          t("panel.stale.warn")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "dsh-pe-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-grow" }),
          state.phase === "error" && retryable(state.error?.code) && onRetry !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-pe-action ghost", onClick: onRetry, children: t("panel.retry") }),
          state.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-pe-action ghost", onClick: copy, children: copied === "ok" ? t("panel.copied") : copied === "failed" ? t("panel.copyFailed") : t("panel.copy") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-pe-action primary", onClick: onApply, children: t("panel.apply") })
          ] }),
          state.phase !== "result" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-pe-action ghost", onClick: onCancel, children: state.phase === "loading" ? t("panel.cancel") : t("panel.close") })
        ] })
      ]
    }
  ) });
}

// src/client/undo-stack.ts
function totalOf(stacks) {
  let n = 0;
  for (const stack of stacks.values()) n += stack.length;
  return n;
}
function createUndoStack(maxDepth = 3, maxTotalEntries = 60) {
  const stacks = /* @__PURE__ */ new Map();
  return {
    push(sessionId, entry) {
      const stack = stacks.get(sessionId) ?? [];
      stack.push(entry);
      while (stack.length > maxDepth) stack.shift();
      stacks.delete(sessionId);
      stacks.set(sessionId, stack);
      while (totalOf(stacks) > maxTotalEntries) {
        const oldest = stacks.keys().next().value;
        if (oldest === void 0) break;
        stacks.delete(oldest);
      }
    },
    peek(sessionId) {
      const stack = stacks.get(sessionId);
      return stack === void 0 || stack.length === 0 ? void 0 : stack[stack.length - 1];
    },
    pop(sessionId) {
      const stack = stacks.get(sessionId);
      const entry = stack?.pop();
      if (stack !== void 0 && stack.length === 0) stacks.delete(sessionId);
      return entry;
    },
    clear(sessionId) {
      stacks.delete(sessionId);
    },
    depth(sessionId) {
      return stacks.get(sessionId)?.length ?? 0;
    }
  };
}

// src/client/ui-state.ts
var listeners3 = /* @__PURE__ */ new Set();
var panelState;
var version = 0;
function notify() {
  version++;
  for (const listener of listeners3) listener();
}
var pendingDeltaText = "";
var pendingDeltaSession;
var pendingDeltaScheduled = false;
function flushPendingDelta() {
  pendingDeltaScheduled = false;
  if (pendingDeltaText === "" || pendingDeltaSession === void 0) return;
  const sessionId = pendingDeltaSession;
  const text = pendingDeltaText;
  pendingDeltaText = "";
  pendingDeltaSession = void 0;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { ...panelState, streaming: (panelState.streaming ?? "") + text };
  notify();
}
function scheduleDeltaFlush() {
  if (pendingDeltaScheduled) return;
  pendingDeltaScheduled = true;
  queueMicrotask(flushPendingDelta);
}
var undoStore = createUndoStack(3);
function pushUndo(sessionId, entry) {
  undoStore.push(sessionId, entry);
  notify();
}
function peekUndo(sessionId) {
  return undoStore.peek(sessionId);
}
function popUndo(sessionId) {
  const entry = undoStore.pop(sessionId);
  notify();
  return entry;
}
var sessions = /* @__PURE__ */ new Map();
var lastMountedSession;
function subscribe(listener) {
  listeners3.add(listener);
  return () => {
    listeners3.delete(listener);
  };
}
function getVersion() {
  return version;
}
function getPanel() {
  return panelState;
}
function abortOf(state) {
  try {
    state?.abort?.();
  } catch {
  }
}
function openLoading(state) {
  abortOf(panelState);
  panelState = { ...state, phase: "loading" };
  notify();
}
function settleResult(sessionId, result) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "result", original: panelState.original, result, ...directionOf(panelState) };
  notify();
}
function settleError(sessionId, error) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "error", original: panelState.original, error, ...directionOf(panelState) };
  notify();
}
function directionOf(state) {
  return state.direction !== void 0 ? { direction: state.direction } : {};
}
function appendDelta(sessionId, text) {
  if (text === "") return;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  pendingDeltaText += text;
  pendingDeltaSession = sessionId;
  scheduleDeltaFlush();
}
function openError(sessionId, original, error, direction) {
  abortOf(panelState);
  panelState = { sessionId, phase: "error", original, error, ...direction !== void 0 ? { direction } : {} };
  notify();
}
function setStale(sessionId, stale) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "result" || panelState.stale === stale) return;
  panelState = { ...panelState, stale };
  notify();
}
function closePanel() {
  abortOf(panelState);
  if (panelState === void 0) return;
  panelState = void 0;
  notify();
}
function registerSession(sessionId, entry) {
  sessions.set(sessionId, entry);
  lastMountedSession = sessionId;
  notify();
  return () => {
    if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
    if (lastMountedSession === sessionId) {
      const keys = [...sessions.keys()];
      lastMountedSession = keys[keys.length - 1];
    }
    if (panelState?.sessionId === sessionId) closePanel();
    undoStore.clear(sessionId);
    notify();
  };
}
function shortcutTarget() {
  const active = document.activeElement;
  if (active !== null && active instanceof Element) {
    let node = active;
    for (let depth = 0; depth < 8 && node !== null; depth++) {
      if (node === document.body || node === document.documentElement) break;
      for (const entry of sessions.values()) {
        if (entry.root !== null && (node === entry.root || node.contains(entry.root))) {
          const found = entry;
          return () => found.run();
        }
      }
      node = node.parentElement;
    }
  }
  const fallback = lastMountedSession !== void 0 ? sessions.get(lastMountedSession) : void 0;
  return fallback === void 0 ? void 0 : () => fallback.run();
}
var quickState;
function getQuick() {
  return quickState;
}
function startQuick(state) {
  quickState = state;
  notify();
}
function endQuick(sessionId) {
  if (quickState?.sessionId !== sessionId) return;
  quickState = void 0;
  notify();
}
var notices = /* @__PURE__ */ new Map();
function setNotice(sessionId, notice) {
  if (notice === void 0) {
    if (!notices.delete(sessionId)) return;
  } else {
    notices.set(sessionId, notice);
  }
  notify();
}
function getNotice(sessionId) {
  return notices.get(sessionId);
}

// src/client/settings.ts
var DEFAULT_CLIENT_SETTINGS = {
  enabled: true,
  maxInputChars: 12e3,
  shortcut: "ctrl+alt+e",
  streaming: true,
  defaultDirection: "general",
  customDirections: "",
  quickApply: true
};
var listeners4 = /* @__PURE__ */ new Set();
var current3 = DEFAULT_CLIENT_SETTINGS;
function setClientSettings(next) {
  current3 = next;
  for (const listener of listeners4) listener();
}
function getClientSettings() {
  return current3;
}
function subscribeClientSettings(listener) {
  listeners4.add(listener);
  return () => {
    listeners4.delete(listener);
  };
}
function decodeClientSettings(section) {
  const record = section;
  if (record === null || typeof record !== "object") return DEFAULT_CLIENT_SETTINGS;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_CLIENT_SETTINGS.enabled,
    maxInputChars: typeof record.maxInputChars === "number" && Number.isFinite(record.maxInputChars) && record.maxInputChars > 0 ? Math.floor(record.maxInputChars) : DEFAULT_CLIENT_SETTINGS.maxInputChars,
    shortcut: typeof record.shortcut === "string" ? record.shortcut : DEFAULT_CLIENT_SETTINGS.shortcut,
    streaming: typeof record.streaming === "boolean" ? record.streaming : DEFAULT_CLIENT_SETTINGS.streaming,
    defaultDirection: typeof record.defaultDirection === "string" && record.defaultDirection.trim() !== "" ? record.defaultDirection.trim().toLowerCase() : DEFAULT_CLIENT_SETTINGS.defaultDirection,
    customDirections: typeof record.customDirections === "string" ? record.customDirections : DEFAULT_CLIENT_SETTINGS.customDirections,
    quickApply: typeof record.quickApply === "boolean" ? record.quickApply : DEFAULT_CLIENT_SETTINGS.quickApply
  };
}

// src/client/session-key.ts
var import_react2 = require("react");
var fallbackSeq = 0;
var zoneKeys = /* @__PURE__ */ new WeakMap();
function fallbackKeyOf(share) {
  if (share === void 0) return `pe:mount:${++fallbackSeq}`;
  const known = zoneKeys.get(share);
  if (known !== void 0) return known;
  const minted = `pe:zone:${++fallbackSeq}`;
  zoneKeys.set(share, minted);
  return minted;
}
function useSessionKey(maybeSessionId, share) {
  const fallback = (0, import_react2.useRef)(void 0);
  if (maybeSessionId !== void 0 && maybeSessionId !== "") return maybeSessionId;
  if (fallback.current === void 0) fallback.current = fallbackKeyOf(share);
  return fallback.current;
}
function serverSessionId(maybeSessionId) {
  return maybeSessionId !== void 0 && maybeSessionId !== "" ? maybeSessionId : void 0;
}

// src/client/DirectionMenu.tsx
var import_react3 = require("react");

// src/shared/directions.ts
var LABEL_MAX_CHARS = 20;
var INSTRUCTION_MAX_CHARS = 4e3;
var GENERAL_DIRECTION_ID = "general";
var ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
var MAX_DIRECTIONS = 48;
var LIGHT_TOUCH_INSTRUCTION = [
  "Light touch only. Keep the user's own form and voice: a one-line request stays one or two sentences, a short paragraph stays a short paragraph.",
  "Do exactly two things: (1) fix wording, grammar and the order of ideas so the request reads smoothly and logically; (2) add a few small details that the draft or the conversation context clearly implies and that make the request less ambiguous, such as the concrete thing being referred to or an obvious constraint.",
  'Do NOT add a role line, headings, numbered steps, an output-format section, acceptance criteria, edge-case lists, or placeholders such as "(\u5F85\u8865\u5145\uFF1A\u2026)" / "(TBD: \u2026)". If something is missing and not implied, leave it out.',
  "Keep the length close to the original: at most about 1.5x, or a little more only when the draft is a few words long.",
  "This overrides the role, steps, output-format, acceptance-criteria, boundary-condition and placeholder guidance above."
].join(" ");
var BUILTIN_DIRECTIONS = [
  {
    id: GENERAL_DIRECTION_ID,
    label: { zh: "\u521D\u6B65\u63D0\u5347", en: "Quick boost" },
    hint: { zh: "\u8865\u5145\u5C11\u91CF\u7EC6\u8282\uFF0C\u7406\u987A\u8BED\u53E5", en: "Add a few details, smooth the wording" },
    instruction: LIGHT_TOUCH_INSTRUCTION,
    custom: false
  },
  {
    id: "concise",
    label: { zh: "\u7CBE\u7B80", en: "Concise" },
    hint: { zh: "\u53BB\u6389\u5197\u4F59\uFF0C\u4FDD\u7559\u5168\u90E8\u7EA6\u675F", en: "Cut filler, keep every constraint" },
    instruction: "Make the prompt concise: remove redundancy, filler and repetition, merge overlapping points, and keep every constraint the user stated. Prefer a compact list over prose. The result should be no longer than the original; this overrides the 1x\u20133x length guideline.",
    custom: false
  },
  {
    id: "structured",
    label: { zh: "\u7ED3\u6784\u5316", en: "Structured" },
    hint: { zh: "\u6309\u5C0F\u6807\u9898\u5206\u8282\uFF1A\u89D2\u8272 / \u76EE\u6807 / \u6B65\u9AA4 / \u8F93\u51FA", en: "Sectioned with headings: role / goal / steps / output" },
    instruction: "Emphasize structure: lay the prompt out in clearly headed sections (role, goal, background, steps, output format, acceptance criteria), using short headings and numbered lists. Omit a section only when the draft gives nothing for it.",
    custom: false
  },
  {
    id: "detailed",
    label: { zh: "\u8865\u5145\u7EC6\u8282", en: "Fill in details" },
    hint: { zh: "\u627E\u51FA\u7F3A\u5931\u4FE1\u606F\uFF0C\u5217\u6210\u5F85\u8865\u5145\u9879", en: "Surface missing info as placeholders" },
    instruction: 'Make the prompt more complete: identify the details an assistant would need but the draft does not give, and add an explicit placeholder for each one, e.g. "(\u5F85\u8865\u5145\uFF1A\u76EE\u6807\u8BFB\u8005)" / "(TBD: target audience)". Add a short list of assumptions the assistant should confirm before starting. Length may exceed 3x the original when the placeholders need it.',
    custom: false
  },
  {
    id: "coding",
    label: { zh: "\u7F16\u7A0B\u4EFB\u52A1", en: "Coding task" },
    hint: { zh: "\u5199\u660E\u6280\u672F\u6808\u3001\u6539\u52A8\u8303\u56F4\u3001\u6D4B\u8BD5\u548C\u9A8C\u6536", en: "Stack, scope of change, tests, acceptance" },
    instruction: "Frame the prompt as a software engineering task for a coding agent: state the goal, the relevant files / modules / tech stack (placeholder if unknown), constraints (keep existing behavior, minimal and focused changes, follow the project's conventions), concrete steps, how to verify the change (tests, commands to run), and what to report back when done.",
    custom: false
  },
  {
    id: "research",
    label: { zh: "\u8C03\u7814\u5206\u6790", en: "Research" },
    hint: { zh: "\u660E\u786E\u95EE\u9898\u3001\u8303\u56F4\u3001\u6765\u6E90\u548C\u62A5\u544A\u7ED3\u6784", en: "Question, scope, sources, report shape" },
    instruction: "Frame the prompt as a research and analysis task: define the core question, the scope and time range, which kinds of sources to prefer and how to cite them, the dimensions to compare, and the structure of the final report. Ask the assistant to separate verified facts from its own inferences and to say when evidence is missing.",
    custom: false
  },
  {
    id: "academic",
    label: { zh: "\u5B66\u672F\u5199\u4F5C", en: "Academic writing" },
    hint: { zh: "\u4E25\u8C28\u63AA\u8F9E\u3001\u5F15\u7528\u89C4\u8303\u3001\u672F\u8BED\u4E00\u81F4", en: "Formal register, citations, consistent terms" },
    instruction: "Frame the prompt for academic writing: state the discipline and target audience, a formal and precise register, the expected structure, the citation style (placeholder if unknown), and require consistent terminology. Explicitly forbid invented references, data or quotations.",
    custom: false
  },
  {
    id: "english",
    label: { zh: "\u6539\u5199\u4E3A\u82F1\u6587", en: "Rewrite in English" },
    hint: { zh: "\u8F93\u51FA\u82F1\u6587\u63D0\u793A\u8BCD", en: "Output the prompt in English" },
    instruction: "Write the rewritten prompt in English regardless of the input language; this overrides the language-mirroring rule. Keep proper nouns, code, file paths and quoted text unchanged.",
    custom: false
  }
];
function parseCustomDirections(source) {
  const directions = [];
  const issues = [];
  if (typeof source !== "string") return { directions, issues };
  const seen = /* @__PURE__ */ new Set();
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const first = line.indexOf("|");
    const second = first < 0 ? -1 : line.indexOf("|", first + 1);
    if (first < 0 || second < 0) {
      issues.push({ line: index + 1, reason: "\u683C\u5F0F\u5E94\u4E3A\u300Cid | \u540D\u79F0 | \u6307\u4EE4\u300D" });
      return;
    }
    const id = line.slice(0, first).trim().toLowerCase();
    const label = line.slice(first + 1, second).trim();
    const instruction = line.slice(second + 1).trim();
    if (!ID_PATTERN.test(id)) {
      issues.push({ line: index + 1, reason: `id\u300C${id}\u300D\u53EA\u80FD\u5305\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u3001- \u548C _\uFF0C\u957F\u5EA6 1\u201332` });
      return;
    }
    if (label === "") {
      issues.push({ line: index + 1, reason: "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" });
      return;
    }
    if (instruction === "" && id !== GENERAL_DIRECTION_ID) {
      issues.push({ line: index + 1, reason: "\u6307\u4EE4\u4E0D\u80FD\u4E3A\u7A7A" });
      return;
    }
    if (seen.has(id)) {
      issues.push({ line: index + 1, reason: `id\u300C${id}\u300D\u91CD\u590D\uFF0C\u5DF2\u5FFD\u7565\u540E\u51FA\u73B0\u7684\u4E00\u884C` });
      return;
    }
    seen.add(id);
    directions.push({ id, label: { zh: label, en: label }, hint: { zh: "", en: "" }, instruction, custom: true, source: "settings" });
  });
  return { directions, issues };
}
function resolveDirections(customSource, saved = []) {
  const { directions: custom } = parseCustomDirections(customSource);
  const merged = BUILTIN_DIRECTIONS.map((builtin) => ({ ...builtin, source: "builtin" }));
  const place = (direction) => {
    const index = merged.findIndex((row) => row.id === direction.id);
    if (index < 0) {
      merged.push(direction);
      return;
    }
    const previous = merged[index];
    const replaces = previous.source === "saved" ? previous.replaces : previous.source ?? "builtin";
    merged[index] = direction.source === "saved" && replaces !== void 0 ? { ...direction, replaces } : direction;
  };
  for (const direction of custom) place(direction);
  for (const row of saved) {
    if (!ID_PATTERN.test(row.id) || typeof row.label !== "string" || typeof row.instruction !== "string") continue;
    const label = row.label.trim();
    if (label === "") continue;
    place({ id: row.id, label: { zh: label, en: label }, hint: { zh: "", en: "" }, instruction: row.instruction, custom: true, source: "saved" });
  }
  return merged.slice(0, MAX_DIRECTIONS);
}
function checkSavedInput(label, instruction) {
  if (typeof label !== "string" || label.trim() === "") return "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A";
  if (Array.from(label.trim()).length > LABEL_MAX_CHARS) return `\u540D\u79F0\u6700\u591A ${LABEL_MAX_CHARS} \u4E2A\u5B57`;
  if (typeof instruction !== "string") return "\u6A21\u677F\u5FC5\u987B\u662F\u6587\u672C";
  if (Array.from(instruction).length > INSTRUCTION_MAX_CHARS) return `\u6A21\u677F\u6700\u591A ${INSTRUCTION_MAX_CHARS} \u4E2A\u5B57`;
  return void 0;
}
function findDirection(list, id) {
  if (id === void 0) return void 0;
  return list.find((direction) => direction.id === id);
}
function defaultDirectionOf(list, defaultId) {
  return findDirection(list, defaultId) ?? findDirection(list, GENERAL_DIRECTION_ID) ?? BUILTIN_DIRECTIONS[0];
}

// src/client/DirectionMenu.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var MENU_WIDTH = 280;
var EDITOR_WIDTH = 420;
var GAP = 6;
var ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';
function positionOf(anchor, width = MENU_WIDTH) {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(GAP, Math.min(rect.right - width, viewportWidth - width - GAP));
  const spaceAbove = rect.top - GAP * 2;
  const spaceBelow = viewportHeight - rect.bottom - GAP * 2;
  if (spaceAbove >= 240 || spaceAbove >= spaceBelow) {
    return { left, bottom: viewportHeight - rect.top + GAP, maxHeight: Math.max(160, spaceAbove) };
  }
  return { left, top: rect.bottom + GAP, maxHeight: Math.max(160, spaceBelow) };
}
function clip(text, max) {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max).join("")}\u2026`;
}
function DirectionMenu(props) {
  const { anchor, directions, defaultId, lang, t, chosenModel, loadModels, onPick, onPickModel, onClose, onSaveDirection, onDeleteDirection } = props;
  const rootRef = (0, import_react3.useRef)(null);
  const [page, setPage] = (0, import_react3.useState)("directions");
  const width = page === "edit" ? EDITOR_WIDTH : MENU_WIDTH;
  const [position, setPosition] = (0, import_react3.useState)(() => positionOf(anchor));
  const [editor, setEditor] = (0, import_react3.useState)(void 0);
  (0, import_react3.useLayoutEffect)(() => {
    setPosition(positionOf(anchor, width));
  }, [anchor, width]);
  const [catalog, setCatalog] = (0, import_react3.useState)({ status: "idle" });
  const focusTarget = (0, import_react3.useRef)('[data-default="true"]');
  (0, import_react3.useLayoutEffect)(() => {
    const root = rootRef.current;
    if (root === null) return;
    const target = page === "edit" ? root.querySelector(".dsh-pe-editor-label") : root.querySelector(focusTarget.current) ?? root.querySelector(ITEM_SELECTOR);
    target?.focus();
  }, [page, catalog.status]);
  (0, import_react3.useEffect)(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (target !== null && (rootRef.current?.contains(target) === true || anchor.contains(target))) return;
      onClose();
    };
    const onResize = () => onClose();
    const onScroll = (event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
      setPosition(positionOf(anchor, width));
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose, width]);
  const openModels = (0, import_react3.useCallback)(() => {
    focusTarget.current = '[aria-checked="true"]';
    setPage("models");
    setCatalog({ status: "loading" });
    loadModels().then(
      (value) => setCatalog({ status: "ready", catalog: value }),
      (error) => setCatalog({ status: "error", message: error instanceof Error ? error.message : String(error) })
    );
  }, [loadModels]);
  const backToDirections = (0, import_react3.useCallback)(() => {
    focusTarget.current = '[data-model-row="true"]';
    setPage("directions");
  }, []);
  const openEditor = (0, import_react3.useCallback)((direction) => {
    setEditor({
      ...direction !== void 0 ? { direction } : {},
      label: direction === void 0 ? "" : direction.label[lang],
      instruction: direction?.instruction ?? "",
      busy: false,
      confirmDelete: false
    });
    setPage("edit");
  }, [lang]);
  const closeEditor = (0, import_react3.useCallback)((focusId) => {
    focusTarget.current = focusId !== void 0 ? `[data-direction-id="${focusId}"]` : editor?.direction !== void 0 ? `[data-direction-id="${editor.direction.id}"]` : '[data-add-row="true"]';
    setEditor(void 0);
    setPage("directions");
  }, [editor]);
  const submitEditor = (0, import_react3.useCallback)(() => {
    if (editor === void 0 || editor.busy) return;
    const problem = checkSavedInput(editor.label, editor.instruction);
    if (problem !== void 0) {
      setEditor({ ...editor, error: problem });
      return;
    }
    setEditor({ ...editor, busy: true, error: void 0 });
    const input = { label: editor.label.trim(), instruction: editor.instruction.trim() };
    onSaveDirection(editor.direction?.id, input).then(
      (list) => closeEditor(list.createdId ?? editor.direction?.id),
      (error) => setEditor((current4) => current4 === void 0 ? current4 : {
        ...current4,
        busy: false,
        error: t("editor.failed", { message: error instanceof Error ? error.message : String(error) })
      })
    );
  }, [editor, onSaveDirection, closeEditor, t]);
  const removeEditor = (0, import_react3.useCallback)(() => {
    const direction = editor?.direction;
    if (editor === void 0 || direction === void 0 || editor.busy) return;
    const restoring = direction.replaces !== void 0;
    if (!restoring && !editor.confirmDelete) {
      setEditor({ ...editor, confirmDelete: true });
      return;
    }
    setEditor({ ...editor, busy: true, error: void 0 });
    onDeleteDirection(direction.id).then(
      () => closeEditor(restoring ? direction.id : void 0),
      (error) => setEditor((current4) => current4 === void 0 ? current4 : {
        ...current4,
        busy: false,
        error: t("editor.failed", { message: error instanceof Error ? error.message : String(error) })
      })
    );
  }, [editor, onDeleteDirection, closeEditor, t]);
  const pickModel = (0, import_react3.useCallback)((route) => {
    onPickModel(route);
    backToDirections();
  }, [onPickModel, backToDirections]);
  const move = (delta) => {
    const items = Array.from(rootRef.current?.querySelectorAll(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const current4 = items.indexOf(document.activeElement);
    const next = delta === "first" ? 0 : delta === "last" ? items.length - 1 : ((current4 < 0 ? 0 : current4 + delta) + items.length) % items.length;
    items[next]?.focus();
  };
  const onKeyDown = (event) => {
    if (page === "edit") {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        submitEditor();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        move(1);
        break;
      case "ArrowUp":
        move(-1);
        break;
      case "Home":
        move("first");
        break;
      case "End":
        move("last");
        break;
      case "ArrowLeft":
        if (page !== "models") return;
        backToDirections();
        break;
      case "ArrowRight": {
        const id = document.activeElement?.dataset.directionId;
        const direction = id === void 0 ? void 0 : directions.find((row) => row.id === id);
        if (page !== "directions" || direction === void 0) return;
        openEditor(direction);
        break;
      }
      case "Escape":
        if (page === "models") {
          backToDirections();
          break;
        }
        onClose();
        anchor.focus();
        break;
      case "Tab":
        onClose();
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const style = { left: position.left, width, maxHeight: position.maxHeight };
  if (position.bottom !== void 0) style.bottom = position.bottom;
  if (position.top !== void 0) style.top = position.top;
  const modelLabel = chosenModel === void 0 ? t("menu.follow") : routeLabel(chosenModel);
  const hoverFocus = (event) => event.currentTarget.focus();
  const pageLabel = page === "directions" ? t("menu.title") : page === "models" ? t("menu.modelsTitle") : editor?.direction !== void 0 ? t("editor.titleEdit") : t("editor.titleAdd");
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      ref: rootRef,
      className: `dsh-pe-menu is-${page}`,
      role: "menu",
      "aria-label": pageLabel,
      style,
      onKeyDown,
      onContextMenu: (event) => event.preventDefault(),
      children: [
        page === "directions" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-title", "aria-hidden": true, children: t("menu.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-menu-scroll", children: [
            directions.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-empty", children: t("menu.empty") }),
            directions.map((direction) => {
              const hint = direction.hint[lang] !== "" ? direction.hint[lang] : direction.custom ? clip(direction.instruction, 36) : "";
              const isDefault = direction.id === defaultId;
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-menu-line", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    tabIndex: -1,
                    "data-default": isDefault ? "true" : void 0,
                    "data-direction-id": direction.id,
                    className: "dsh-pe-menu-item",
                    onMouseEnter: hoverFocus,
                    onClick: () => onPick(direction),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dsh-pe-menu-icon${isDefault ? " is-default" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ModeIcon, { id: direction.id, size: 14 }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-menu-copy", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-menu-label", children: [
                          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-name", children: direction.label[lang] }),
                          isDefault && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-tag", children: t("menu.default") }),
                          direction.source === "saved" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-tag is-mine", children: direction.replaces !== void 0 ? t("menu.edited") : t("menu.mine") })
                        ] }),
                        hint !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-hint", children: hint })
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    tabIndex: -1,
                    className: "dsh-pe-menu-edit",
                    title: t("menu.edit", { label: direction.label[lang] }),
                    "aria-label": t("menu.edit", { label: direction.label[lang] }),
                    onClick: (event) => {
                      event.stopPropagation();
                      openEditor(direction);
                    },
                    children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PencilIcon, { size: 13 })
                  }
                )
              ] }, direction.id);
            }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                tabIndex: -1,
                "data-add-row": "true",
                className: "dsh-pe-menu-item dsh-pe-menu-add",
                onMouseEnter: hoverFocus,
                onClick: () => openEditor(void 0),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-icon", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PlusIcon, { size: 14 }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-name", children: t("menu.add") })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-sep", role: "separator" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              role: "menuitem",
              tabIndex: -1,
              "aria-haspopup": "menu",
              "data-model-row": "true",
              title: t("menu.modelHint"),
              className: "dsh-pe-menu-item dsh-pe-menu-cell",
              onMouseEnter: hoverFocus,
              onClick: openModels,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-icon", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CpuIcon, { size: 14 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-visually-hidden", children: t("menu.model", { label: modelLabel }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-name", "aria-hidden": true, children: t("menu.modelShort") }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-value", "aria-hidden": true, children: modelLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronRightIcon, { size: 12, className: "dsh-pe-menu-chevron" })
              ]
            }
          )
        ] }),
        page === "models" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              role: "menuitem",
              tabIndex: -1,
              className: "dsh-pe-menu-back",
              onMouseEnter: hoverFocus,
              onClick: backToDirections,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronLeftIcon, { size: 14 }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("menu.modelsTitle") })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-menu-scroll", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitemradio",
                "aria-checked": chosenModel === void 0,
                tabIndex: -1,
                className: "dsh-pe-menu-item",
                onMouseEnter: hoverFocus,
                onClick: () => pickModel(void 0),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-check", children: chosenModel === void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CheckIcon, { size: 14 }) }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-menu-copy", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-name", children: t("menu.follow") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-hint", children: catalog.status === "ready" && catalog.catalog.fallback !== void 0 ? t("menu.followHint", { label: routeLabel(catalog.catalog.fallback) }) : t("menu.followHintUnknown") })
                  ] })
                ]
              }
            ),
            catalog.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-empty", children: t("menu.loading") }),
            catalog.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-note is-error", children: t("menu.loadFailed", { message: catalog.message }) }),
            catalog.status === "ready" && catalog.catalog.groups.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-empty", children: t("menu.noModels") }),
            catalog.status === "ready" && chosenModel !== void 0 && !catalog.catalog.groups.some((group) => group.id === chosenModel.provider && group.models.some((model) => model.id === chosenModel.model)) && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-note is-warn", children: t("menu.chosenUnavailable", { label: routeLabel(chosenModel) }) }),
            catalog.status === "ready" && catalog.catalog.groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { role: "group", "aria-label": group.name, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-group", "aria-hidden": true, children: group.name }),
              group.models.map((model) => {
                const checked = chosenModel?.provider === group.id && chosenModel.model === model.id;
                return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                  "button",
                  {
                    type: "button",
                    role: "menuitemradio",
                    "aria-checked": checked,
                    tabIndex: -1,
                    title: `${group.id} / ${model.id}`,
                    className: "dsh-pe-menu-item",
                    onMouseEnter: hoverFocus,
                    onClick: () => pickModel({ provider: group.id, model: model.id, name: model.name, providerName: group.name }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-check", children: checked && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CheckIcon, { size: 14 }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-menu-copy", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-name", children: model.name }),
                        model.description !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-menu-hint", children: clip(model.description, 60) })
                      ] })
                    ]
                  },
                  model.id
                );
              })
            ] }, group.id)),
            catalog.status === "ready" && catalog.catalog.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-note is-error", title: failure.message, children: t("menu.providerFailed", { name: failure.name }) }, failure.id))
          ] })
        ] }),
        page === "edit" && editor !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "form",
          {
            className: "dsh-pe-editor",
            onSubmit: (event) => {
              event.preventDefault();
              submitEditor();
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-editor-head", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pe-menu-back is-inline", "aria-label": t("menu.back"), onClick: () => closeEditor(), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronLeftIcon, { size: 14 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-editor-badge", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ModeIcon, { id: editor.direction?.id ?? "", size: 14 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-editor-title", children: editor.direction !== void 0 ? t("editor.titleEdit") : t("editor.titleAdd") })
              ] }),
              editor.direction?.source === "builtin" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-editor-note", children: t("editor.noteBuiltin") }),
              editor.direction?.source === "settings" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-editor-note", children: t("editor.noteSettings") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "dsh-pe-editor-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-editor-caption", children: t("editor.label") }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "input",
                  {
                    className: "dsh-pe-editor-label",
                    value: editor.label,
                    maxLength: LABEL_MAX_CHARS,
                    placeholder: t("editor.labelPlaceholder"),
                    disabled: editor.busy,
                    onChange: (event) => setEditor({ ...editor, label: event.target.value, error: void 0, confirmDelete: false })
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "dsh-pe-editor-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-editor-caption", children: [
                  t("editor.template"),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-pe-editor-count", children: [
                    Array.from(editor.instruction).length,
                    " / ",
                    INSTRUCTION_MAX_CHARS
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "textarea",
                  {
                    className: "dsh-pe-editor-template",
                    value: editor.instruction,
                    rows: 8,
                    placeholder: t("editor.templatePlaceholder"),
                    disabled: editor.busy,
                    onChange: (event) => setEditor({ ...editor, instruction: event.target.value, error: void 0, confirmDelete: false })
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-editor-help", children: t("editor.help") }),
              editor.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-pe-menu-note is-error", role: "alert", children: editor.error }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-editor-actions", children: [
                editor.direction?.source === "saved" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: `dsh-pe-action ${editor.direction.replaces === void 0 ? "danger" : "ghost"}${editor.confirmDelete ? " is-armed" : ""}`,
                    disabled: editor.busy,
                    onClick: removeEditor,
                    children: editor.direction.replaces !== void 0 ? t("editor.restore") : editor.confirmDelete ? t("editor.confirmDelete") : t("editor.delete")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-grow" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pe-action ghost", disabled: editor.busy, onClick: () => closeEditor(), children: t("editor.cancel") }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "submit", className: "dsh-pe-action primary", disabled: editor.busy, children: editor.busy ? t("editor.saving") : t("editor.save") })
              ] })
            ]
          }
        )
      ]
    }
  );
}

// src/client/EnhanceButton.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function errorText(t, error) {
  if (error.localized !== void 0) return error.localized;
  const primary = localizedErrorMessage(t, error.code, error.params);
  return error.message !== void 0 && error.message !== "" ? `${primary}\uFF08${error.message}\uFF09` : primary;
}
var LONG_PRESS_MS = 500;
function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}
function stringOf(value) {
  return typeof value === "string" ? value : "";
}
function EnhanceButton(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const wireId = serverSessionId(sessionId);
  const draft = useInput((state) => stringOf(state.draft));
  const phase = useInput((state) => state.phase);
  const occurrenceCount = useInput((state) => countOf(state.occurrences));
  const attachmentCount = useInput((state) => {
    const record = state;
    return countOf(record.attachmentIds) + countOf(record.imageIds);
  });
  const settings = (0, import_react4.useSyncExternalStore)(subscribeClientSettings, getClientSettings);
  const panel = (0, import_react4.useSyncExternalStore)(subscribe, getPanel);
  const rootRef = (0, import_react4.useRef)(null);
  const quick = (0, import_react4.useSyncExternalStore)(subscribe, getQuick);
  const quickBusy = quick !== void 0 && quick.sessionId === uiKey;
  const busy = quickBusy || panel !== void 0 && panel.sessionId === uiKey && panel.phase === "loading";
  const draftRef = (0, import_react4.useRef)(draft);
  (0, import_react4.useEffect)(() => {
    draftRef.current = draft;
  });
  const lang = t("meta.lang") === "en" ? "en" : "zh";
  const hostList = (0, import_react4.useSyncExternalStore)(subscribeDirectionList, getDirectionList);
  const localDirections = (0, import_react4.useMemo)(() => resolveDirections(settings.customDirections), [settings.customDirections]);
  const directions = hostList?.directions ?? localDirections;
  const defaultDirection = defaultDirectionOf(directions, settings.defaultDirection);
  (0, import_react4.useEffect)(() => {
    if (getDirectionList() === void 0) void refreshDirectionList();
  }, []);
  const [menuOpen, setMenuOpen] = (0, import_react4.useState)(false);
  const chosenModel = (0, import_react4.useSyncExternalStore)(subscribeModelChoice, getModelChoice);
  const longPressTimer = (0, import_react4.useRef)(void 0);
  const suppressClick = (0, import_react4.useRef)(false);
  const anyBusy = quick !== void 0 || panel !== void 0 && panel.phase === "loading";
  const otherBusy = anyBusy && !busy;
  const start = (0, import_react4.useCallback)((directionId) => {
    if (anyBusy) return;
    const chosen = findDirection(directions, directionId) ?? defaultDirection;
    const panelDirection = { id: chosen.id, label: chosen.label[lang] };
    const quickMode = settings.quickApply && chosen.id === GENERAL_DIRECTION_ID;
    setNotice(uiKey, void 0);
    const reject = (localized) => {
      if (quickMode) setNotice(uiKey, { text: localized, draft });
      else openError(uiKey, draft, { code: "rejected", localized }, panelDirection);
    };
    if (!settings.enabled) {
      const disabled = t("error.disabled");
      reject(disabled);
      return;
    }
    if (attachmentCount > 0 && draft.trim() === "") {
      const attachmentsOnly = t("error.attachmentsOnly");
      reject(attachmentsOnly);
      return;
    }
    const check = checkInputText(draft, settings.maxInputChars);
    if (!check.ok) {
      const message = check.code === "empty" ? t("error.empty") : t("error.tooLong", { count: check.count, max: check.max });
      reject(message);
      return;
    }
    if (occurrenceCount > 0) {
      const occurrences = t("error.occurrences");
      reject(occurrences);
      return;
    }
    if (phase !== "plain") {
      const busyPhase = t("error.phase");
      reject(busyPhase);
      return;
    }
    const controller = new AbortController();
    const body = {
      sessionId: wireId,
      text: draft,
      direction: chosen.id,
      ...chosenModel !== void 0 ? { provider: chosenModel.provider, model: chosenModel.model } : {}
    };
    if (quickMode) {
      const original = draft;
      startQuick({ sessionId: uiKey, abort: () => controller.abort() });
      requestEnhance(body, controller.signal).then((result) => {
        endQuick(uiKey);
        if (draftRef.current !== original) {
          openLoading({ sessionId: uiKey, original, direction: panelDirection });
          settleResult(uiKey, result);
          return;
        }
        pushUndo(uiKey, { original, applied: result.text });
        inputActions.setDraft(result.text);
      }, (error) => {
        endQuick(uiKey);
        if (controller.signal.aborted) return;
        const detail = error instanceof EnhanceClientError ? error.detail : { code: "internal", message: error instanceof Error ? error.message : String(error) };
        setNotice(uiKey, { text: errorText(t, detail), draft: draftRef.current });
      });
      return;
    }
    openLoading({ sessionId: uiKey, original: draft, abort: () => controller.abort(), direction: panelDirection });
    const settle = (result) => settleResult(uiKey, result);
    const fail = (error) => {
      const detail = error instanceof EnhanceClientError ? error.detail : { code: "internal", message: error instanceof Error ? error.message : String(error) };
      settleError(uiKey, detail);
    };
    if (settings.streaming) {
      requestEnhanceStream(body, {
        signal: controller.signal,
        onDelta: (delta) => appendDelta(uiKey, delta)
      }).then(settle, fail);
      return;
    }
    requestEnhance(body, controller.signal).then(settle, fail);
  }, [anyBusy, draft, attachmentCount, occurrenceCount, phase, settings, uiKey, wireId, t, directions, defaultDirection, lang, chosenModel, inputActions]);
  const loadModels = (0, import_react4.useCallback)(() => fetchModelCatalog(wireId), [wireId]);
  const onSaveDirection = (0, import_react4.useCallback)(async (id, input) => {
    try {
      const list = id === void 0 ? await createDirection(input) : await saveDirection(id, input);
      setDirectionList(list);
      return list;
    } catch (error) {
      throw new Error(error instanceof EnhanceClientError ? errorText(t, error.detail) : String(error));
    }
  }, [t]);
  const onDeleteDirection = (0, import_react4.useCallback)(async (id) => {
    try {
      const list = await deleteDirection(id);
      setDirectionList(list);
      return list;
    } catch (error) {
      throw new Error(error instanceof EnhanceClientError ? errorText(t, error.detail) : String(error));
    }
  }, [t]);
  const onContextMenu = (0, import_react4.useCallback)((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (anyBusy) return;
    void refreshDirectionList();
    setMenuOpen(true);
  }, [anyBusy]);
  const onPointerDown = (0, import_react4.useCallback)((event) => {
    suppressClick.current = false;
    if (event.pointerType !== "touch" || anyBusy) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }, [anyBusy]);
  const cancelLongPress = (0, import_react4.useCallback)(() => {
    clearTimeout(longPressTimer.current);
  }, []);
  (0, import_react4.useEffect)(() => () => clearTimeout(longPressTimer.current), []);
  const onClick = (0, import_react4.useCallback)(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (quickBusy) {
      quick?.abort();
      return;
    }
    start();
  }, [start, quickBusy, quick]);
  const closeMenu = (0, import_react4.useCallback)(() => setMenuOpen(false), []);
  const pick = (0, import_react4.useCallback)((direction) => {
    setMenuOpen(false);
    start(direction.id);
  }, [start]);
  const runRef = (0, import_react4.useRef)(start);
  (0, import_react4.useEffect)(() => {
    runRef.current = start;
  });
  (0, import_react4.useEffect)(() => {
    const entry = {
      root: rootRef.current,
      run: () => runRef.current()
    };
    return registerSession(uiKey, entry);
  }, [uiKey]);
  (0, import_react4.useEffect)(() => {
    if (panel !== void 0 && panel.sessionId === uiKey && panel.phase === "result") {
      setStale(uiKey, draft !== panel.original);
    }
  }, [draft, panel, uiKey]);
  const apply2 = (0, import_react4.useCallback)(() => {
    if (panel === void 0 || panel.phase !== "result" || panel.result === void 0) return;
    pushUndo(uiKey, { original: draft, applied: panel.result.text });
    inputActions.setDraft(panel.result.text);
    closePanel();
  }, [draft, inputActions, panel, uiKey]);
  if (!settings.enabled) return null;
  const owned = panel !== void 0 && panel.sessionId === uiKey ? panel : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        ref: rootRef,
        type: "button",
        className: `dsh-pe-btn${busy ? " is-busy" : ""}`,
        title: quickBusy ? t("button.quickBusy") : busy ? t("button.busy") : otherBusy ? t("button.otherBusy") : t("button.title", { label: defaultDirection.label[lang], model: chosenModel === void 0 ? t("menu.follow") : routeLabel(chosenModel) }),
        "aria-label": otherBusy ? t("button.otherBusy") : t("button.title", { label: defaultDirection.label[lang], model: chosenModel === void 0 ? t("menu.follow") : routeLabel(chosenModel) }),
        "aria-haspopup": "menu",
        "aria-expanded": menuOpen,
        "aria-disabled": otherBusy || void 0,
        onClick,
        onContextMenu,
        onPointerDown,
        onPointerUp: cancelLongPress,
        onPointerLeave: cancelLongPress,
        onPointerCancel: cancelLongPress,
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-btn-icon", "aria-hidden": true, children: busy ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SpinnerIcon, { size: 16, className: "dsh-pe-spinning" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SparkleIcon, { size: 16 }) })
      }
    ),
    owned !== void 0 && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        ResultPanel,
        {
          state: owned,
          t,
          onApply: apply2,
          onCancel: () => closePanel(),
          onRetry: owned.phase === "error" ? () => start(owned.direction?.id) : void 0
        }
      ),
      document.body
    ),
    menuOpen && rootRef.current !== null && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        DirectionMenu,
        {
          anchor: rootRef.current,
          directions,
          defaultId: defaultDirection.id,
          lang,
          t,
          chosenModel,
          loadModels,
          onPickModel: setModelChoice,
          onSaveDirection,
          onDeleteDirection,
          onPick: pick,
          onClose: closeMenu
        }
      ),
      document.body
    )
  ] });
}

// src/client/UndoBar.tsx
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function UndoBar(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const draft = useInput((state) => {
    const value = state.draft;
    return typeof value === "string" ? value : "";
  });
  (0, import_react5.useSyncExternalStore)(subscribe, getVersion);
  const entry = peekUndo(uiKey);
  const notice = getNotice(uiKey);
  const quickBusy = getQuick()?.sessionId === uiKey;
  (0, import_react5.useEffect)(() => {
    if (notice !== void 0 && notice.draft !== draft) setNotice(uiKey, void 0);
  }, [draft, notice, uiKey]);
  (0, import_react5.useEffect)(() => {
    if (entry !== void 0 && entry.applied !== draft) popUndo(uiKey);
  }, [draft, entry, uiKey]);
  if (quickBusy) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-pe-strip is-running", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SpinnerIcon, { size: 14, className: "dsh-pe-spinning dsh-pe-strip-icon" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dsh-pe-strip-text", children: t("quick.running") })
    ] });
  }
  if (notice !== void 0 && notice.draft === draft) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-pe-strip is-warn", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AlertIcon, { size: 14, className: "dsh-pe-strip-icon" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dsh-pe-strip-text", children: notice.text }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dsh-pe-icon-btn small", "aria-label": t("undo.dismiss"), onClick: () => setNotice(uiKey, void 0), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CloseIcon, { size: 12 }) })
    ] });
  }
  if (entry === void 0 || entry.applied !== draft) return null;
  const undo = () => {
    inputActions.setDraft(entry.original);
    popUndo(uiKey);
  };
  const dismiss = () => {
    popUndo(uiKey);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dsh-pe-strip is-done", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CheckIcon, { size: 14, className: "dsh-pe-strip-icon" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dsh-pe-strip-text", children: t("undo.applied") }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "dsh-pe-strip-action", onClick: undo, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UndoIcon, { size: 12 }),
      t("undo.undo")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dsh-pe-icon-btn small", "aria-label": t("undo.dismiss"), onClick: dismiss, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CloseIcon, { size: 12 }) })
  ] });
}

// src/client/locales.ts
var zh = {
  "meta.lang": "zh",
  "menu.title": "\u9009\u62E9\u63D0\u5347\u65B9\u5411",
  "menu.default": "\u9ED8\u8BA4",
  "menu.empty": "\u6CA1\u6709\u53EF\u7528\u7684\u65B9\u5411",
  "panel.direction": "\u65B9\u5411\uFF1A{label}",
  "menu.edit": "\u7F16\u8F91\u300C{label}\u300D\u7684\u6A21\u677F",
  "menu.add": "\u6DFB\u52A0\u6A21\u5F0F",
  "menu.mine": "\u81EA\u5B9A\u4E49",
  "menu.edited": "\u5DF2\u4FEE\u6539",
  "editor.titleEdit": "\u7F16\u8F91\u6A21\u5F0F",
  "editor.titleAdd": "\u6DFB\u52A0\u6A21\u5F0F",
  "editor.label": "\u540D\u79F0",
  "editor.labelPlaceholder": "\u4F8B\u5982\uFF1A\u4EA7\u54C1\u9700\u6C42",
  "editor.template": "\u63D0\u5347\u6A21\u677F",
  "editor.templatePlaceholder": "\u544A\u8BC9\u6A21\u578B\u8FD9\u4E2A\u6A21\u5F0F\u8981\u600E\u4E48\u6539\u5199\uFF0C\u4F8B\u5982\uFF1A\u6539\u5199\u6210\u7ED9\u4EA7\u54C1\u7ECF\u7406\u770B\u7684\u9700\u6C42\u8BF4\u660E\uFF0C\u5199\u660E\u80CC\u666F\u3001\u76EE\u6807\u7528\u6237\u548C\u9A8C\u6536\u6807\u51C6\u3002",
  "editor.help": "\u6A21\u677F\u4F1A\u8FFD\u52A0\u5728\u57FA\u7840\u6539\u5199\u89C4\u5219\u4E4B\u540E\u3002\u65E0\u8BBA\u6A21\u677F\u600E\u4E48\u5199\uFF0C\u90FD\u4E0D\u4F1A\u6539\u53D8\u4F60\u7684\u539F\u610F\u3001\u4E0D\u4F1A\u7F16\u9020\u5185\u5BB9\uFF0C\u4E5F\u53EA\u4F1A\u8F93\u51FA\u6539\u5199\u540E\u7684\u63D0\u793A\u8BCD\u3002\u6309 \u2318/Ctrl+Enter \u4FDD\u5B58\u3002",
  "editor.noteBuiltin": "\u8FD9\u662F\u5185\u7F6E\u6A21\u5F0F\u3002\u4FDD\u5B58\u540E\u4EE5\u4F60\u7684\u7248\u672C\u4E3A\u51C6\uFF0C\u4E4B\u540E\u53EF\u4EE5\u968F\u65F6\u6062\u590D\u9ED8\u8BA4\u3002",
  "editor.noteSettings": "\u8FD9\u4E2A\u6A21\u5F0F\u6765\u81EA\u63D2\u4EF6\u8BBE\u7F6E\u3002\u5728\u8FD9\u91CC\u4FDD\u5B58\u540E\u4EE5\u8FD9\u91CC\u7684\u7248\u672C\u4E3A\u51C6\uFF0C\u4E4B\u540E\u53EF\u4EE5\u6062\u590D\u6210\u8BBE\u7F6E\u91CC\u7684\u7248\u672C\u3002",
  "editor.save": "\u4FDD\u5B58",
  "editor.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "editor.cancel": "\u53D6\u6D88",
  "editor.restore": "\u6062\u590D\u9ED8\u8BA4",
  "editor.delete": "\u5220\u9664",
  "editor.confirmDelete": "\u786E\u8BA4\u5220\u9664\uFF1F",
  "editor.failed": "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}",
  "menu.model": "\u63D0\u5347\u6A21\u578B\uFF1A{label}",
  "menu.modelShort": "\u63D0\u5347\u6A21\u578B",
  "menu.modelHint": "\u53EA\u7528\u4E8E\u63D0\u5347\u63D0\u793A\u8BCD\uFF0C\u4E0D\u5F71\u54CD\u5BF9\u8BDD\u4F7F\u7528\u7684\u6A21\u578B",
  "menu.back": "\u8FD4\u56DE",
  "menu.modelsTitle": "\u9009\u62E9\u63D0\u5347\u4F7F\u7528\u7684\u6A21\u578B",
  "menu.follow": "\u8DDF\u968F\u9ED8\u8BA4",
  "menu.followHint": "\u5F53\u524D\u4F1A\u7528\uFF1A{label}",
  "menu.followHintUnknown": "\u4F9D\u6B21\u4F7F\u7528\uFF1A\u63D2\u4EF6\u8BBE\u7F6E \u2192 \u5F53\u524D\u4F1A\u8BDD \u2192 DSH \u9ED8\u8BA4\u6A21\u578B",
  "menu.loading": "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u5217\u8868\u2026",
  "menu.loadFailed": "\u8BFB\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25\uFF1A{message}",
  "menu.noModels": "\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B",
  "menu.chosenUnavailable": "\u4E4B\u524D\u9009\u7684\u300C{label}\u300D\u5DF2\u4E0D\u5728\u53EF\u7528\u5217\u8868\u4E2D\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9",
  "menu.providerFailed": "{name}\uFF1A\u8BFB\u53D6\u6A21\u578B\u5931\u8D25",
  "button.title": "\u63D0\u793A\u8BCD\u63D0\u5347\uFF08\u5DE6\u952E\uFF1A{label}\uFF0C\u6A21\u578B\uFF1A{model}\uFF1B\u53F3\u952E\uFF1A\u9009\u62E9\u65B9\u5411\u548C\u6A21\u578B\uFF09",
  "button.busy": "\u6B63\u5728\u63D0\u5347\u2026",
  "button.quickBusy": "\u6B63\u5728\u63D0\u5347\u2026\uFF08\u518D\u70B9\u4E00\u6B21\u53D6\u6D88\uFF09",
  "quick.running": "\u6B63\u5728\u63D0\u5347\uFF0C\u5B8C\u6210\u540E\u4F1A\u76F4\u63A5\u66FF\u6362\u8F93\u5165\u6846\u5185\u5BB9\u2026",
  "button.otherBusy": "\u53E6\u4E00\u4E2A\u4F1A\u8BDD\u6B63\u5728\u589E\u5F3A\u4E2D\uFF1B\u8BF7\u7B49\u5B83\u5B8C\u6210\u6216\u5148\u5173\u95ED\u5176\u7ED3\u679C\u9762\u677F\u3002",
  "panel.title": "\u63D0\u793A\u8BCD\u63D0\u5347",
  "panel.loading": "\u6B63\u5728\u589E\u5F3A\uFF0C\u7A0D\u5019\u2026",
  "panel.streaming": "\u6B63\u5728\u751F\u6210\uFF08\u8FB9\u5199\u8FB9\u663E\u793A\uFF09\u2026",
  "panel.loading.hint": "\u539F\u6587\u4FDD\u7559\u5728\u8F93\u5165\u6846\u4E2D\uFF0C\u4E0D\u4F1A\u88AB\u52A8\u4FEE\u6539\u3002",
  "panel.cancel": "\u53D6\u6D88",
  "panel.original": "\u539F\u59CB\u63D0\u793A\u8BCD",
  "panel.enhanced": "\u63D0\u5347\u7ED3\u679C",
  "panel.apply": "\u56DE\u586B\u5230\u8F93\u5165\u6846",
  "panel.copy": "\u590D\u5236\u7ED3\u679C",
  "panel.copied": "\u5DF2\u590D\u5236",
  "panel.copyFailed": "\u590D\u5236\u5931\u8D25",
  "panel.close": "\u5173\u95ED",
  "panel.retry": "\u91CD\u8BD5",
  "panel.stale.warn": "\u8349\u7A3F\u5728\u589E\u5F3A\u671F\u95F4\u6709\u6539\u52A8\u2014\u2014\u589E\u5F3A\u7ED3\u679C\u57FA\u4E8E\u589E\u5F3A\u524D\u7684\u6587\u672C\u3002\u56DE\u586B\u5C06\u8986\u76D6\u4F60\u7684\u6700\u65B0\u7F16\u8F91(\u64A4\u9500\u53EF\u6062\u590D\u56DE\u586B\u524D\u7684\u8349\u7A3F)\u3002",
  "panel.model": "\u6A21\u578B\uFF1A{provider} / {model}",
  "panel.elapsed": "\u8017\u65F6 {ms}",
  "undo.applied": "\u5DF2\u66FF\u6362\u4E3A\u63D0\u5347\u540E\u7684\u5185\u5BB9",
  "undo.undo": "\u64A4\u9500",
  "undo.dismiss": "\u5173\u95ED\u63D0\u793A",
  "error.empty": "\u8F93\u5165\u6846\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u8F93\u5165\u8981\u589E\u5F3A\u7684\u63D0\u793A\u8BCD\u3002",
  "error.tooLong": "\u5185\u5BB9\u5171 {count} \u4E2A\u5B57\u7B26\uFF0C\u8D85\u8FC7 {max} \u4E2A\u5B57\u7B26\u4E0A\u9650\uFF08\u6309 Unicode \u5B57\u7B26\u6570\u7EDF\u8BA1\uFF0C\u4E0D\u662F token \u6570\uFF09\u3002\u4E3A\u907F\u514D\u6539\u53D8\u539F\u610F\u4E0D\u4F1A\u81EA\u52A8\u622A\u65AD\uFF0C\u8BF7\u7CBE\u7B80\u540E\u518D\u8BD5\u3002",
  "error.attachmentsOnly": "\u8F93\u5165\u6846\u53EA\u9644\u52A0\u4E86\u9644\u4EF6\uFF08\u56FE\u7247\u6216\u6587\u4EF6\uFF09\uFF0C\u8BF7\u8865\u5145\u8981\u589E\u5F3A\u7684\u6587\u672C\u3002",
  "error.occurrences": "\u8F93\u5165\u5185\u5BB9\u5305\u542B\u547D\u4EE4\u6216\u6587\u4EF6\u5F15\u7528\uFF0C\u6682\u4E0D\u652F\u6301\u589E\u5F3A\uFF1B\u8BF7\u5148\u79FB\u9664\u540E\u518D\u8BD5\u3002",
  "error.phase": "\u5F53\u524D\u8F93\u5165\u6B63\u88AB\u5360\u7528\uFF08\u63D0\u4EA4\u4E2D\uFF09\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "error.disabled": "\u63D0\u793A\u8BCD\u589E\u5F3A\u5DF2\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5173\u95ED\u3002",
  "error.rejected": "\u589E\u5F3A\u8BF7\u6C42\u88AB\u62D2\u7EDD\u3002",
  "error.timeout": "\u589E\u5F3A\u8D85\u65F6\uFF08{seconds} \u79D2\uFF09\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.unconfigured": "\u5C1A\u672A\u786E\u5B9A\u589E\u5F3A\u7528\u7684\u6A21\u578B\uFF1A\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u6210\u5BF9\u586B\u5199 provider/model\uFF0C\u6216\u5148\u5728\u5F53\u524D\u4F1A\u8BDD\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF08\u5C06\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B\uFF09\u3002",
  "error.upstream": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.internal": "\u589E\u5F3A\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.rateLimit": "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF1A\u6BCF\u5206\u949F\u6700\u591A {limit} \u6B21\u589E\u5F3A\uFF0C\u8BF7\u5728 {retryAfterSeconds} \u79D2\u540E\u518D\u8BD5\u3002",
  "error.concurrencyLimit": "\u5DF2\u6709 {max} \u4E2A\u589E\u5F3A\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u7B49\u5176\u4E2D\u4E00\u4E2A\u5B8C\u6210\u540E\u518D\u8BD5\u3002",
  "error.cooldown": "\u8FDE\u7EED {failures} \u6B21\u589E\u5F3A\u5931\u8D25\uFF0C\u5DF2\u6682\u505C\u8C03\u7528\u4EE5\u514D\u6301\u7EED\u51B2\u51FB\u6A21\u578B\u670D\u52A1\uFF1B\u8BF7 {retryAfterSeconds} \u79D2\u540E\u91CD\u8BD5\uFF0C\u6216\u5148\u68C0\u67E5\u8BBE\u7F6E\u91CC\u7684\u6A21\u578B\u914D\u7F6E\u3002",
  "error.upstream.auth": "\u9274\u6743\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u8BE5 provider \u7684 API Key \u914D\u7F6E\u3002",
  "error.upstream.invalidCredential": "\u9274\u6743\u5931\u8D25\uFF1A\u5B58\u50A8\u7684 API Key \u4E0D\u53EF\u7528\uFF0C\u8BF7\u4FEE\u6B63\u540E\u91CD\u8BD5\u3002",
  "error.upstream.rateLimit": "\u6A21\u578B\u670D\u52A1\u9650\u6D41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "error.upstream.quota": "\u6A21\u578B\u670D\u52A1\u914D\u989D/\u4F59\u989D\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u8D26\u6237\u3002",
  "error.upstream.empty": "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "error.upstream.contextWindow": "\u8F93\u5165\u8D85\u51FA\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF0C\u8BF7\u7CBE\u7B80\u539F\u6587\u6216\u66F4\u6362\u6A21\u578B\u3002",
  "error.upstream.toolCall": "\u6A21\u578B\u8BF7\u6C42\u4E86\u5DE5\u5177\u8C03\u7528\uFF0C\u63D0\u793A\u8BCD\u589E\u5F3A\u53EA\u9700\u8981\u7EAF\u6587\u672C\uFF1B\u8BF7\u66F4\u6362\u6A21\u578B\u540E\u91CD\u8BD5\u3002",
  "error.upstream.maxTokens": "\u91CD\u5199\u7ED3\u679C\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650\uFF08maxOutputTokens\uFF09\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u8C03\u5927\u4E0A\u9650\u6216\u7CBE\u7B80\u539F\u6587\u540E\u91CD\u8BD5\u3002"
};
var en = {
  "meta.lang": "en",
  "menu.title": "Choose a boost direction",
  "menu.default": "default",
  "menu.empty": "No directions available",
  "panel.direction": "Direction: {label}",
  "menu.edit": "Edit the template of \u201C{label}\u201D",
  "menu.add": "Add a mode",
  "menu.mine": "custom",
  "menu.edited": "edited",
  "editor.titleEdit": "Edit mode",
  "editor.titleAdd": "Add a mode",
  "editor.label": "Name",
  "editor.labelPlaceholder": "e.g. Product spec",
  "editor.template": "Boost template",
  "editor.templatePlaceholder": "Tell the model how this mode should rewrite, e.g. turn it into a spec for a product manager with background, target users and acceptance criteria.",
  "editor.help": "The template is appended after the base rewrite rules. Whatever it says, the rewrite keeps your intent, invents nothing and outputs only the prompt. \u2318/Ctrl+Enter saves.",
  "editor.noteBuiltin": "A built-in mode. Once saved, your version is used; you can restore the default any time.",
  "editor.noteSettings": "This mode comes from the plugin settings. Once saved here, this version is used; you can restore the settings version.",
  "editor.save": "Save",
  "editor.saving": "Saving\u2026",
  "editor.cancel": "Cancel",
  "editor.restore": "Restore default",
  "editor.delete": "Delete",
  "editor.confirmDelete": "Really delete?",
  "editor.failed": "Could not save: {message}",
  "menu.model": "Boost model: {label}",
  "menu.modelShort": "Boost model",
  "menu.modelHint": "Only used for boosting; the chat model is unchanged",
  "menu.back": "Back",
  "menu.modelsTitle": "Choose the model for boosting",
  "menu.follow": "Follow default",
  "menu.followHint": "Currently: {label}",
  "menu.followHintUnknown": "Plugin settings \u2192 this session \u2192 DSH default model",
  "menu.loading": "Loading models\u2026",
  "menu.loadFailed": "Could not load models: {message}",
  "menu.noModels": "No models available",
  "menu.chosenUnavailable": "The previously chosen \u201C{label}\u201D is no longer available \u2014 pick again",
  "menu.providerFailed": "{name}: could not list models",
  "button.title": "Prompt boost (click: {label}, model: {model}; right-click: direction and model)",
  "button.busy": "Boosting\u2026",
  "button.quickBusy": "Boosting\u2026 (click again to cancel)",
  "quick.running": "Boosting \u2014 the result will replace the input box\u2026",
  "button.otherBusy": "Another session is enhancing right now \u2014 wait for it, or close its result panel first.",
  "panel.title": "Prompt Boost",
  "panel.loading": "Enhancing, please wait\u2026",
  "panel.streaming": "Generating (shown as it is written)\u2026",
  "panel.loading.hint": "Your draft stays untouched until you apply the result.",
  "panel.cancel": "Cancel",
  "panel.original": "Original prompt",
  "panel.enhanced": "Boosted result",
  "panel.apply": "Fill into input box",
  "panel.copy": "Copy result",
  "panel.copied": "Copied",
  "panel.copyFailed": "Copy failed",
  "panel.close": "Close",
  "panel.retry": "Retry",
  "panel.stale.warn": "The draft changed while enhancing \u2014 the result is based on the pre-enhance text. Applying will overwrite your latest edits (undo restores the draft as it was before applying).",
  "panel.model": "Model: {provider} / {model}",
  "panel.elapsed": "{ms} elapsed",
  "undo.applied": "Replaced with the boosted prompt",
  "undo.undo": "Undo",
  "undo.dismiss": "Dismiss",
  "error.empty": "The input box is empty \u2014 type a prompt to enhance first.",
  "error.tooLong": "The draft is {count} characters, above the {max} cap (Unicode characters, not tokens). It is never auto-truncated (that would change your meaning) \u2014 please shorten it.",
  "error.attachmentsOnly": "The composer only has attachments; add the text you want enhanced.",
  "error.occurrences": "The draft contains commands or file references, which are not supported yet \u2014 remove them first.",
  "error.phase": "The input box is busy (submitting) \u2014 try again in a moment.",
  "error.disabled": "Prompt enhance is disabled in the plugin settings.",
  "error.rejected": "The enhance request was rejected.",
  "error.timeout": "The enhancement timed out ({seconds}s). Retry; your draft is untouched.",
  "error.unconfigured": "No model resolved for the enhancement: pair provider/model in the plugin settings, or send a message in the current session first (the enhancement will follow the session model).",
  "error.upstream": "The model provider returned an error. Retry; your draft is untouched.",
  "error.internal": "Enhancement failed. Retry; your draft is untouched.",
  "error.rateLimit": "Too many requests \u2014 at most {limit} enhancements per minute; retry in {retryAfterSeconds} seconds.",
  "error.concurrencyLimit": "{max} enhancements are already running \u2014 wait for one to finish, then retry.",
  "error.cooldown": "{failures} enhancements failed in a row; calls are paused to stop hammering the model service. Retry in {retryAfterSeconds}s, or check the model settings first.",
  "error.upstream.auth": "Authentication failed \u2014 check the API key configured for this provider.",
  "error.upstream.invalidCredential": "Authentication failed \u2014 the stored API key is invalid; fix it and retry.",
  "error.upstream.rateLimit": "The model provider is rate-limiting; retry later.",
  "error.upstream.quota": "The model provider reports a quota/balance issue \u2014 check your account.",
  "error.upstream.empty": "The model returned an empty response; retry.",
  "error.upstream.contextWindow": "The input exceeds the model context window \u2014 shorten it or switch models.",
  "error.upstream.toolCall": "The model requested tool calls, but prompt enhance needs plain text \u2014 switch models and retry.",
  "error.upstream.maxTokens": "The rewrite hit the output cap (maxOutputTokens) \u2014 raise it in settings or shorten the draft."
};
var dictionaries = { zh, en };
var NS = "prompt-boost";

// src/client/styles.ts
var STYLE_ID = "dsh-prompt-boost-styles";
var TOKENS = `
  --pb-fg: var(--dsw-alias-label-primary, #1a1d24);
  --pb-fg-2: var(--dsw-alias-label-secondary, #4b5160);
  --pb-fg-3: var(--dsw-alias-label-tertiary, #7b8191);
  --pb-fg-caption: var(--dsw-alias-label-caption, #9aa0ad);
  --pb-surface: var(--dsw-alias-bg-layer-3, #ffffff);
  --pb-surface-sunk: color-mix(in srgb, var(--pb-fg) 4%, var(--pb-surface));
  --pb-border: var(--dsw-alias-border-l1, rgba(17, 24, 39, 0.08));
  --pb-border-strong: var(--dsw-alias-border-l3, rgba(17, 24, 39, 0.16));
  --pb-hover: var(--dsw-alias-interactive-bg-hover, rgba(17, 24, 39, 0.05));
  --pb-active: var(--dsw-alias-interactive-bg-active, rgba(17, 24, 39, 0.09));
  --pb-brand: var(--dsw-alias-brand-primary, #4d6bfe);
  --pb-brand-fg: var(--dsw-alias-label-primary-inverted, #ffffff);
  --pb-brand-soft: color-mix(in srgb, var(--pb-brand) 12%, transparent);
  --pb-danger: var(--dsw-alias-state-error-primary, #e5484d);
  --pb-danger-soft: var(--dsw-alias-interactive-bg-hover-danger, rgba(229, 72, 77, 0.1));
  --pb-warn: var(--dsw-alias-state-warn-label, #b4690e);
  --pb-warn-soft: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f59e0b) 12%, transparent);
  --pb-success: var(--dsw-alias-state-success-primary, #2f9e6a);
  --pb-success-soft: color-mix(in srgb, var(--pb-success) 12%, transparent);
  --pb-radius-xs: var(--dsw-radius-xs, 4px);
  --pb-radius-sm: var(--dsw-radius-sm, 8px);
  --pb-radius-md: var(--dsw-radius-md, 12px);
  --pb-radius-lg: var(--dsw-radius-lg, 16px);
  --pb-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(17, 24, 39, 0.08), 0 3px 8px rgba(0, 0, 0, 0.04), 0 0 20px rgba(0, 0, 0, 0.05));
  --pb-focus: 0 0 0 2px var(--dsw-focus-ring-color, color-mix(in srgb, var(--pb-brand) 45%, transparent));
  --pb-font: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif);
`;
var CSS = `
.dsh-pe-btn, .dsh-pe-menu, .dsh-pe-overlay, .dsh-pe-strip {${TOKENS}}
.dsh-pe-menu, .dsh-pe-panel, .dsh-pe-strip { --dsw-elevation-stroke-color: var(--dsw-alias-border-l1, rgba(17, 24, 39, 0.08)); }

@keyframes dsh-pe-spin { to { transform: rotate(360deg); } }
@keyframes dsh-pe-pop { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes dsh-pe-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dsh-pe-shimmer { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.dsh-pe-spinning { animation: dsh-pe-spin 0.8s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-spinning { animation-duration: 2.4s; }
  .dsh-pe-menu, .dsh-pe-panel, .dsh-pe-overlay, .dsh-pe-strip { animation: none !important; }
}
.dsh-pe-visually-hidden {
  position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.dsh-pe-grow { flex: 1; }

/* ---- composer button ---------------------------------------------------- */
.dsh-pe-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  border: none; border-radius: var(--pb-radius-sm);
  background: transparent; color: var(--pb-fg-2);
  cursor: pointer; transition: background-color 0.12s, color 0.12s;
}
.dsh-pe-btn:hover { background: var(--pb-hover); color: var(--pb-brand); }
.dsh-pe-btn:active { background: var(--pb-active); }
.dsh-pe-btn:focus-visible { outline: none; box-shadow: var(--pb-focus); }
.dsh-pe-btn[aria-expanded="true"] { background: var(--pb-hover); color: var(--pb-brand); }
.dsh-pe-btn.is-busy { color: var(--pb-brand); }
.dsh-pe-btn[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.dsh-pe-btn .dsh-pe-btn-icon { display: inline-flex; }

/* ---- right-click menu --------------------------------------------------- */
.dsh-pe-menu {
  position: fixed; z-index: 1100; box-sizing: border-box;
  display: flex; flex-direction: column;
  padding: 4px; overflow: hidden;
  border-radius: var(--pb-radius-md);
  background: var(--pb-surface); color: var(--pb-fg);
  box-shadow: var(--pb-shadow);
  font-family: var(--pb-font); font-size: 13px; line-height: 18px;
  animation: dsh-pe-pop 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: bottom right;
}
.dsh-pe-menu-scroll {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(0,0,0,0.15)) transparent;
}
.dsh-pe-menu-title {
  padding: 6px 8px 4px; font-size: 11px; line-height: 16px;
  color: var(--pb-fg-caption); letter-spacing: 0.02em;
}
.dsh-pe-menu-line { position: relative; display: flex; align-items: center; }
.dsh-pe-menu-item {
  box-sizing: border-box; display: flex; align-items: center; gap: 8px;
  width: 100%; min-height: 34px; padding: 5px 8px;
  border: none; border-radius: var(--pb-radius-sm);
  background: transparent; color: inherit; font: inherit; text-align: left;
  cursor: pointer; outline: none; transition: background-color 0.08s;
}
.dsh-pe-menu-line .dsh-pe-menu-item { padding-right: 34px; }
.dsh-pe-menu-item:hover, .dsh-pe-menu-item:focus, .dsh-pe-menu-item:focus-visible { background: var(--pb-hover); }
.dsh-pe-menu-item:active { background: var(--pb-active); }
.dsh-pe-menu-icon {
  flex: 0 0 24px; height: 24px; display: grid; place-items: center;
  border-radius: 7px; color: var(--pb-fg-2);
  background: var(--pb-surface-sunk); box-shadow: inset 0 0 0 0.5px var(--pb-border);
}
.dsh-pe-menu-icon.is-default { color: var(--pb-brand); background: var(--pb-brand-soft); box-shadow: none; }
.dsh-pe-menu-copy { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.dsh-pe-menu-label { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dsh-pe-menu-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-pe-menu-hint {
  font-size: 11px; line-height: 16px; color: var(--pb-fg-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-pe-menu-tag {
  flex: none; padding: 0 6px; border-radius: 999px;
  font-size: 10px; line-height: 16px; font-weight: 500;
  color: var(--pb-brand); background: var(--pb-brand-soft);
}
.dsh-pe-menu-tag.is-mine { color: var(--pb-success); background: var(--pb-success-soft); }
.dsh-pe-menu-edit {
  position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
  width: 26px; height: 26px; display: grid; place-items: center; padding: 0;
  border: none; border-radius: var(--pb-radius-xs);
  background: transparent; color: var(--pb-fg-3);
  cursor: pointer; opacity: 0; transition: opacity 0.1s, background-color 0.1s, color 0.1s;
}
.dsh-pe-menu-line:hover .dsh-pe-menu-edit,
.dsh-pe-menu-line:focus-within .dsh-pe-menu-edit { opacity: 1; }
.dsh-pe-menu-edit:hover { background: var(--pb-active); color: var(--pb-fg); }
.dsh-pe-menu-edit:focus-visible { opacity: 1; outline: none; box-shadow: var(--pb-focus); }
@media (hover: none) { .dsh-pe-menu-edit { opacity: 0.7; } }
.dsh-pe-menu-add { color: var(--pb-fg-2); }
.dsh-pe-menu-add .dsh-pe-menu-icon {
  background: transparent; box-shadow: inset 0 0 0 1px var(--pb-border-strong); color: var(--pb-fg-3);
}
.dsh-pe-menu-add:hover .dsh-pe-menu-icon, .dsh-pe-menu-add:focus .dsh-pe-menu-icon { color: var(--pb-brand); box-shadow: inset 0 0 0 1px var(--pb-brand); }
.dsh-pe-menu-sep { height: 0.5px; margin: 4px 8px; background: var(--pb-border-strong); flex: none; }
.dsh-pe-menu-cell { gap: 8px; flex: none; }
.dsh-pe-menu-cell .dsh-pe-menu-name { flex: none; }
.dsh-pe-menu-value {
  flex: 1; min-width: 0; text-align: right; color: var(--pb-fg-3);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-pe-menu-chevron { flex: none; color: var(--pb-fg-caption); }
.dsh-pe-menu-back {
  display: flex; align-items: center; gap: 6px; flex: none;
  width: 100%; min-height: 30px; padding: 4px 6px; margin-bottom: 2px;
  border: none; border-radius: var(--pb-radius-sm);
  background: transparent; color: var(--pb-fg-2); font: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer; outline: none; text-align: left;
}
.dsh-pe-menu-back:hover, .dsh-pe-menu-back:focus { background: var(--pb-hover); color: var(--pb-fg); }
.dsh-pe-menu-back.is-inline { width: 26px; min-height: 26px; padding: 0; margin: 0; justify-content: center; }
.dsh-pe-menu-check { flex: 0 0 16px; display: grid; place-items: center; color: var(--pb-brand); }
.dsh-pe-menu-group {
  padding: 10px 8px 4px; font-size: 11px; line-height: 16px; font-weight: 500;
  color: var(--pb-fg-caption);
}
.dsh-pe-menu-empty { padding: 8px; font-size: 12px; color: var(--pb-fg-3); }
.dsh-pe-menu-note {
  margin: 4px; padding: 6px 8px; border-radius: var(--pb-radius-sm);
  font-size: 11px; line-height: 16px;
}
.dsh-pe-menu-note.is-error { color: var(--pb-danger); background: var(--pb-danger-soft); }
.dsh-pe-menu-note.is-warn { color: var(--pb-warn); background: var(--pb-warn-soft); }

/* ---- mode editor (inside the menu) -------------------------------------- */
.dsh-pe-editor { display: flex; flex-direction: column; gap: 10px; padding: 4px 6px 6px; overflow-y: auto; }
.dsh-pe-editor-head { display: flex; align-items: center; gap: 6px; margin: -2px -2px 0; }
.dsh-pe-editor-badge {
  width: 22px; height: 22px; display: grid; place-items: center;
  border-radius: 6px; color: var(--pb-brand); background: var(--pb-brand-soft);
}
.dsh-pe-editor-title { font-size: 13px; font-weight: 600; }
.dsh-pe-editor-note {
  padding: 7px 9px; border-radius: var(--pb-radius-sm);
  font-size: 11px; line-height: 16px; color: var(--pb-fg-2); background: var(--pb-surface-sunk);
}
.dsh-pe-editor-field { display: flex; flex-direction: column; gap: 5px; }
.dsh-pe-editor-caption {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 11px; line-height: 16px; font-weight: 500; color: var(--pb-fg-2);
}
.dsh-pe-editor-count { font-weight: 400; color: var(--pb-fg-caption); font-variant-numeric: tabular-nums; }
.dsh-pe-editor-field input, .dsh-pe-editor-field textarea {
  box-sizing: border-box; width: 100%; padding: 7px 10px;
  border: 1px solid var(--pb-border-strong); border-radius: var(--pb-radius-sm);
  background: var(--pb-surface-sunk); color: var(--pb-fg);
  font: inherit; font-size: 13px; line-height: 20px; outline: none;
  transition: border-color 0.12s, box-shadow 0.12s, background-color 0.12s;
}
.dsh-pe-editor-field textarea { resize: vertical; min-height: 140px; max-height: 50vh; }
.dsh-pe-editor-field input::placeholder, .dsh-pe-editor-field textarea::placeholder { color: var(--pb-fg-caption); }
.dsh-pe-editor-field input:focus, .dsh-pe-editor-field textarea:focus {
  border-color: var(--pb-brand); background: var(--pb-surface);
  box-shadow: 0 0 0 3px var(--pb-brand-soft);
}
.dsh-pe-editor-field input:disabled, .dsh-pe-editor-field textarea:disabled { opacity: 0.6; }
.dsh-pe-editor-help { font-size: 11px; line-height: 16px; color: var(--pb-fg-3); }
.dsh-pe-editor-actions { display: flex; align-items: center; gap: 6px; padding-top: 2px; }

/* ---- shared buttons ----------------------------------------------------- */
.dsh-pe-action {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; padding: 0 14px;
  border: none; border-radius: var(--pb-radius-sm);
  font: inherit; font-size: 12px; font-weight: 500; line-height: 1;
  cursor: pointer; transition: background-color 0.12s, color 0.12s, opacity 0.12s;
}
.dsh-pe-action:focus-visible { outline: none; box-shadow: var(--pb-focus); }
.dsh-pe-action:disabled { opacity: 0.5; cursor: default; }
.dsh-pe-action.primary { background: var(--pb-brand); color: var(--pb-brand-fg); }
.dsh-pe-action.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--pb-brand) 88%, #000); }
.dsh-pe-action.ghost { background: transparent; color: var(--pb-fg-2); box-shadow: inset 0 0 0 1px var(--pb-border-strong); }
.dsh-pe-action.ghost:hover:not(:disabled) { background: var(--pb-hover); color: var(--pb-fg); }
.dsh-pe-action.danger { background: transparent; color: var(--pb-danger); padding: 0 10px; }
.dsh-pe-action.danger:hover:not(:disabled), .dsh-pe-action.danger.is-armed { background: var(--pb-danger-soft); }
.dsh-pe-icon-btn {
  width: 28px; height: 28px; display: grid; place-items: center; padding: 0; flex: none;
  border: none; border-radius: var(--pb-radius-sm);
  background: transparent; color: var(--pb-fg-3); cursor: pointer;
}
.dsh-pe-icon-btn:hover { background: var(--pb-hover); color: var(--pb-fg); }
.dsh-pe-icon-btn:focus-visible { outline: none; box-shadow: var(--pb-focus); }
.dsh-pe-icon-btn.small { width: 22px; height: 22px; border-radius: 999px; }

/* ---- preview panel ------------------------------------------------------ */
.dsh-pe-overlay {
  position: fixed; inset: 0; z-index: var(--dsh-pe-z-index, 1000);
  display: flex; align-items: flex-end; justify-content: center;
  padding: 24px 16px 96px;
  background: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.28));
  backdrop-filter: blur(2px);
  animation: dsh-pe-fade 0.14s ease-out;
}
.dsh-pe-panel {
  display: flex; flex-direction: column;
  width: min(880px, 100%); max-height: min(72vh, 660px);
  border-radius: var(--pb-radius-lg); overflow: hidden; outline: none;
  background: var(--pb-surface); color: var(--pb-fg);
  box-shadow: var(--pb-shadow), 0 24px 64px rgba(0, 0, 0, 0.18);
  font-family: var(--pb-font); font-size: 13px;
  animation: dsh-pe-pop 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.dsh-pe-head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 12px 12px 16px; border-bottom: 0.5px solid var(--pb-border-strong);
}
.dsh-pe-head-mark {
  width: 24px; height: 24px; display: grid; place-items: center; flex: none;
  border-radius: 7px; color: var(--pb-brand); background: var(--pb-brand-soft);
}
.dsh-pe-head-title { font-size: 14px; font-weight: 600; white-space: nowrap; }
.dsh-pe-chip {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  padding: 2px 8px; border-radius: 999px;
  font-size: 11px; line-height: 16px; color: var(--pb-fg-2); background: var(--pb-surface-sunk);
  box-shadow: inset 0 0 0 0.5px var(--pb-border-strong);
}
.dsh-pe-meta {
  min-width: 0; font-size: 11px; color: var(--pb-fg-caption);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-pe-body { display: flex; gap: 12px; flex: 1; min-height: 0; padding: 14px 16px; }
.dsh-pe-col {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  border-radius: var(--pb-radius-md); background: var(--pb-surface-sunk);
  box-shadow: inset 0 0 0 0.5px var(--pb-border);
}
.dsh-pe-col.is-result {
  background: color-mix(in srgb, var(--pb-brand) 5%, var(--pb-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pb-brand) 28%, transparent);
}
.dsh-pe-col-title {
  display: flex; align-items: center; gap: 5px;
  padding: 10px 14px 0; font-size: 11px; font-weight: 500; color: var(--pb-fg-3);
}
.dsh-pe-col.is-result .dsh-pe-col-title { color: var(--pb-brand); }
.dsh-pe-col-text {
  flex: 1; margin: 0; padding: 8px 14px 14px; overflow: auto;
  white-space: pre-wrap; word-break: break-word;
  font-family: inherit; font-size: 13px; line-height: 1.65; color: var(--pb-fg);
}
.dsh-pe-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-height: 160px; padding: 24px 16px; color: var(--pb-fg-2);
}
.dsh-pe-loading-spin { color: var(--pb-brand); margin-bottom: 4px; }
.dsh-pe-loading .dsh-pe-hint { font-size: 11px; color: var(--pb-fg-caption); }
.dsh-pe-stream { align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.dsh-pe-stream .dsh-pe-col-title { padding: 0 0 6px; color: var(--pb-brand); animation: dsh-pe-shimmer 1.6s ease-in-out infinite; }
.dsh-pe-stream .dsh-pe-col-text {
  padding: 12px 14px; border-radius: var(--pb-radius-md); background: var(--pb-surface-sunk);
  max-height: 46vh;
}
.dsh-pe-error {
  display: flex; gap: 10px; margin: 16px; padding: 12px 14px;
  border-radius: var(--pb-radius-md); background: var(--pb-danger-soft); color: var(--pb-danger);
  line-height: 1.55;
}
.dsh-pe-error-icon { flex: none; margin-top: 2px; }
.dsh-pe-error-copy { min-width: 0; }
.dsh-pe-error .dsh-pe-error-detail {
  margin-top: 4px; font-size: 11px; color: var(--pb-fg-3);
  white-space: pre-wrap; word-break: break-word;
}
.dsh-pe-stale {
  display: flex; align-items: flex-start; gap: 8px;
  margin: 0 16px 12px; padding: 8px 12px; border-radius: var(--pb-radius-sm);
  font-size: 12px; line-height: 1.5; color: var(--pb-warn); background: var(--pb-warn-soft);
}
.dsh-pe-stale svg { flex: none; margin-top: 2px; }
.dsh-pe-foot { display: flex; align-items: center; gap: 8px; padding: 10px 16px 14px; }

/* ---- status strip above the composer ------------------------------------ */
.dsh-pe-strip {
  display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
  margin: 0 0 6px; padding: 4px 6px 4px 10px; box-sizing: border-box;
  border-radius: 999px; font-family: var(--pb-font); font-size: 12px; line-height: 18px;
  color: var(--pb-fg-2); background: var(--pb-surface);
  box-shadow: var(--pb-shadow);
  animation: dsh-pe-pop 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.dsh-pe-strip-icon { flex: none; }
.dsh-pe-strip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pe-strip.is-running { padding-right: 12px; }
.dsh-pe-strip.is-running .dsh-pe-strip-icon { color: var(--pb-brand); }
.dsh-pe-strip.is-running .dsh-pe-strip-text { animation: dsh-pe-shimmer 1.6s ease-in-out infinite; }
.dsh-pe-strip.is-done .dsh-pe-strip-icon { color: var(--pb-success); }
.dsh-pe-strip.is-warn { color: var(--pb-warn); background: color-mix(in srgb, var(--pb-warn) 8%, var(--pb-surface)); border-radius: var(--pb-radius-md); }
.dsh-pe-strip.is-warn .dsh-pe-strip-text { white-space: normal; }
.dsh-pe-strip-action {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  height: 22px; padding: 0 9px; border: none; border-radius: 999px;
  font: inherit; font-size: 12px; font-weight: 500;
  color: var(--pb-brand); background: var(--pb-brand-soft); cursor: pointer;
}
.dsh-pe-strip-action:hover { background: color-mix(in srgb, var(--pb-brand) 20%, transparent); }
.dsh-pe-strip-action:focus-visible { outline: none; box-shadow: var(--pb-focus); }
`;
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return false;
  const element = document.createElement("style");
  element.id = STYLE_ID;
  element.textContent = CSS;
  document.head.appendChild(element);
  return true;
}

// src/client/shortcut.ts
var MODIFIER_ALIASES = /* @__PURE__ */ new Map([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["alt", "alt"],
  ["option", "alt"],
  ["shift", "shift"],
  ["meta", "meta"],
  ["cmd", "meta"],
  ["command", "meta"],
  ["win", "meta"],
  ["super", "meta"]
]);
var isKeyToken = (token) => /^[a-z0-9]$/.test(token) || /^f([1-9]|1[0-2])$/.test(token);
function codeFor(token) {
  if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  return `F${token.slice(1)}`;
}
function parseShortcut(spec) {
  if (spec === void 0) return null;
  const tokens = spec.trim().toLowerCase().split("+").map((token) => token.trim()).filter((token) => token !== "");
  if (tokens.length === 0 || tokens.length > 5) return null;
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  const last = tokens[tokens.length - 1] ?? "";
  if (!isKeyToken(last)) return null;
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(token);
    if (modifier === void 0) return null;
    modifiers[modifier] = true;
  }
  if (!modifiers.ctrl && !modifiers.alt && !modifiers.meta) return null;
  return { ...modifiers, key: last, code: codeFor(last) };
}
function matchesShortcut(event, combo) {
  if (combo === null) return false;
  return event.ctrlKey === combo.ctrl && event.altKey === combo.alt && event.shiftKey === combo.shift && event.metaKey === combo.meta && (event.code === combo.code || event.key.toLowerCase() === combo.key);
}

// src/client/settings-source.ts
var RANK = {
  none: 0,
  legacyScope: 1,
  binder: 2,
  configForms: 3
};
function sectionOf(snapshot) {
  if (snapshot === null || typeof snapshot !== "object") return void 0;
  const record = snapshot;
  if (record.status === "unavailable") return void 0;
  return record.value;
}
function servedNamespaces(forms) {
  try {
    const namespaces = forms.describe?.()?.getSnapshot?.()?.view?.namespaces;
    return Array.isArray(namespaces) ? namespaces.map((entry) => String(entry?.ns ?? "")) : [];
  } catch {
    return [];
  }
}
function installClientSettingsSource(ctx, options) {
  let rank = RANK.none;
  const adopt = (next, section) => {
    if (section === void 0 || next < rank) return;
    rank = next;
    options.onSection(section);
  };
  const adoptSnapshot = (next, form) => {
    try {
      const section = sectionOf(form.getSnapshot?.());
      if (section !== void 0) adopt(next, section);
    } catch {
    }
  };
  ctx.inject(["configForms"], (formsCtx) => {
    const forms = formsCtx.configForms;
    if (forms === void 0 || typeof forms.get !== "function") return;
    let boundId;
    let unsubscribeForm;
    const resolveEntryId = () => {
      const served = servedNamespaces(forms);
      return options.rowIds.find((id) => served.includes(id)) ?? served.find((ns) => ns.includes("prompt-boost")) ?? options.rowIds[0];
    };
    const bind = () => {
      const entryId = resolveEntryId();
      if (entryId === void 0 || entryId === boundId) return;
      let form;
      try {
        form = forms.get?.(entryId);
      } catch {
        return;
      }
      if (form === void 0) return;
      try {
        unsubscribeForm?.();
      } catch {
      }
      unsubscribeForm = void 0;
      boundId = entryId;
      adoptSnapshot(RANK.configForms, form);
      try {
        unsubscribeForm = form.subscribe?.(() => adoptSnapshot(RANK.configForms, form));
      } catch {
        unsubscribeForm = void 0;
      }
    };
    bind();
    ctx.effect(() => () => {
      try {
        unsubscribeForm?.();
      } catch {
      }
    }, "prompt-boost: settings form mirror");
    try {
      const watch = forms.describe?.()?.subscribe?.(() => bind());
      if (typeof watch === "function") {
        ctx.effect(() => () => {
          try {
            watch();
          } catch {
          }
        }, "prompt-boost: settings namespace watch");
      }
    } catch {
    }
  });
  ctx.inject(["webUiSettings"], (binderCtx) => {
    const binder = binderCtx.webUiSettings;
    if (binder === void 0 || typeof binder.bind !== "function") return;
    let bound;
    for (const namespace of options.rowIds) {
      try {
        bound = binder.bind({ namespace });
      } catch {
        bound = void 0;
      }
      if (bound !== void 0) break;
    }
    if (bound === void 0) return;
    adoptSnapshot(RANK.binder, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.binder, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "prompt-boost: settings binder mirror");
  });
  ctx.inject(["settingsScope"], (scopeCtx) => {
    const scopeCtxLike = scopeCtx;
    const scope = scopeCtxLike.settingsScope;
    if (scope === void 0 || typeof scope.bind !== "function") return;
    let bound;
    try {
      bound = scope.bind({ namespace: options.rowIds[0] ?? "prompt-boost", decode: (value) => value });
    } catch {
      return;
    }
    adoptSnapshot(RANK.legacyScope, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.legacyScope, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "prompt-boost: settings scope mirror");
  });
}

// src/client/index.tsx
var inject = [];
function report(step, error) {
  try {
    console.warn(`[prompt-boost] ${step} failed; that feature stays off.`, error);
  } catch {
  }
  return () => {
  };
}
function apply(ctx) {
  ensureStyles();
  ctx.inject(["locale"], (localeCtx) => {
    ctx.effect(() => {
      try {
        return localeCtx.locale.register(NS, dictionaries);
      } catch (error) {
        return report("dictionary registration", error);
      }
    }, "dsh-prompt-boost: dictionaries");
  });
  setClientSettings(decodeClientSettings(void 0));
  installClientSettingsSource(ctx, {
    rowIds: PROMPT_ENHANCE_ROW_IDS,
    onSection: (section) => setClientSettings(decodeClientSettings(section))
  });
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.right", () => {
      try {
        return slots.register(
          { name: "conversation.input.right", id: "prompt-boost", order: 60, locale: NS },
          EnhanceButton
        );
      } catch (error) {
        return report("composer enhance button slot", error);
      }
    });
  });
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.dock", () => {
      try {
        return slots.register(
          { name: "conversation.input.dock", id: "prompt-boost-undo", order: 90, locale: NS },
          UndoBar
        );
      } catch (error) {
        return report("undo bar slot", error);
      }
    });
  });
  ctx.effect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const settings = getClientSettings();
      if (!settings.enabled) return;
      const combo = parseShortcut(settings.shortcut);
      if (!matchesShortcut(event, combo)) return;
      const target = shortcutTarget();
      if (target === void 0) return;
      event.preventDefault();
      event.stopPropagation();
      target();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, "dsh-prompt-boost: shortcut");
}

		return module.exports;
	}
});

