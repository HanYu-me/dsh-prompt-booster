# Changelog

## 0.1.1 — 2026-11-02

- Attribution: added NOTICE and README credits for [dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance) by rongxingda, which this plugin is based on, as the Apache-2.0 license requires. No code changes.

## 0.1.0 — 2026-10-30

First release, based on [dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance) 0.3.2 by rongxingda (Apache-2.0). Changes on top of it:

- Composer button: left-click (or `Ctrl+Alt+E`) runs the quick boost, a light-touch rewrite (smoother wording, a few implied details, within ~1.5x the original, no added structure) applied in place, with a progress strip, undo, cancel-on-second-click, and errors shown above the composer (`quickApply`).
- Right-click (long press on touch, or the keyboard context-menu key) opens a mode menu with eight built-in modes: quick boost (`general`), concise, structured, fill in details, coding task, research, academic writing, rewrite in English. Modes other than the quick boost show an original / result preview with apply, copy and undo.
- Mode editor in the menu: edit any mode's name and template, add new modes, restore edited built-ins, delete created modes. Stored on the host in `~/.dsh/prompt-boost/directions.json`; routes `GET/POST /prompt-boost/directions`, `PUT/DELETE /prompt-boost/directions/<id>`.
- Settings `defaultDirection`, `customDirections` (`id | name | instruction` per line) and `quickApply`.
- Boost-model choice in the menu, listing dsh's live model catalog (`GET /prompt-boost/models`); stored per browser; the host only accepts listed models. Boost calls never carry the session id, so providers that keep one live process per session (e.g. Oh My Claude) do not run the rewrite inside the conversation.
- `/boost [@mode] text` slash command.
- UI on dsh design tokens; follows dsh's light/dark theme; SVG icons, one per built-in mode.
