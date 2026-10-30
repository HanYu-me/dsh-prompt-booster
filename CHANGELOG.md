# Changelog

## 0.1.0 — 2026-10-30

First release of dsh-prompt-booster, based on [dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance) 0.3.2 (its own history is kept in [docs/upstream/CHANGELOG.md](./docs/upstream/CHANGELOG.md)).

### Added

- Right-click (long press on touch, or the keyboard context-menu key) opens a mode menu with eight built-in modes: quick boost (`general`), concise, structured, fill in details, coding task, research, academic writing, rewrite in English.
- Mode editor in the menu: edit any mode's name and template, add new modes, restore edited built-ins, delete created modes. Stored on the host in `~/.dsh/prompt-boost/directions.json`; routes `GET/POST /prompt-boost/directions`, `PUT/DELETE /prompt-boost/directions/<id>`.
- Settings `defaultDirection`, `customDirections` (`id | name | instruction` per line) and `quickApply`.
- Boost-model choice in the menu, listing dsh's live model catalog (`GET /prompt-boost/models`); stored per browser; the host only accepts listed models.
- `/boost [@mode] text` slash command.
- The quick boost applies the result in place (no preview), with a progress strip, undo, cancel-on-second-click, and errors shown above the composer.

### Changed

- The quick boost is a light-touch rewrite: smoother wording and a few implied details, within ~1.5x the original, no added structure.
- Renamed: package `dsh-prompt-booster`, plugin id `prompt-boost`, routes `/prompt-boost/*`, command `/boost`.
- UI redesigned on dsh design tokens; follows dsh's light/dark theme instead of the OS setting; SVG icons, one per built-in mode.

### Fixed

- Boost calls no longer pass the session id to the model call. With providers that keep one live process per session (e.g. Oh My Claude), the rewrite used to run inside the user's conversation, show up as a turn, and fail with "a turn is already running in this session" while the session was busy.
