/**
 * Self-contained stylesheet, injected once as a <style> element: the plugin
 * ships no CSS build step, and class names are prefixed to stay collision
 * free inside the web shell.
 *
 * Every color, radius, shadow and font comes from DSH's own design tokens
 * (`--dsw-*`), so the plugin looks like part of DSH and follows DSH's
 * light/dark theme (`body[data-ds-dark-theme]`) rather than the OS setting.
 * Each token carries a light fallback for hosts that do not define it.
 * @module dsh-prompt-boost/client/styles
 */

const STYLE_ID = 'dsh-prompt-boost-styles'

/** Local aliases onto DSH tokens, shared by every plugin surface. */
const TOKENS = `
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
`

/** The plugin's stylesheet. */
export const CSS = `
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
`

/**
 * Inject the stylesheet once per document.
 * @returns true when injected, false when it was already present.
 */
export function ensureStyles(): boolean {
  if (document.getElementById(STYLE_ID) !== null) return false
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
  return true
}
