/**
 * Modes saved from the right-click menu editor: one small JSON file on the
 * host, so edits reach every browser and the `/boost` command, and the page
 * keeps sending only a direction id (the host looks the template up here).
 *
 * File: `~/.dsh/prompt-boost/directions.json` (override with the
 * `DSH_PROMPT_BOOST_DIRECTIONS_FILE` environment variable). Written through a
 * temp file + rename, so a crash mid-write never leaves half a file. A missing
 * or unreadable file reads as "nothing saved" — it must never take the
 * button down.
 * @module dsh-prompt-boost/direction-store
 */

import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ID_PATTERN, type SavedDirection } from './shared/directions'

/** Persistence face, so tests can swap the file for memory. */
export interface DirectionStore {
  /** The saved modes, in creation order. */
  read(): SavedDirection[]
  /** Replace the saved modes. */
  write(rows: readonly SavedDirection[]): void
}

/** The default file location. */
export function defaultStorePath(): string {
  const override = process.env.DSH_PROMPT_BOOST_DIRECTIONS_FILE
  if (typeof override === 'string' && override !== '') return override
  return join(homedir(), '.dsh', 'prompt-boost', 'directions.json')
}

/**
 * Narrow untrusted file content to saved rows, dropping anything malformed.
 * @param value - parsed JSON.
 * @returns the valid rows.
 */
export function rowsOf(value: unknown): SavedDirection[] {
  const list = (value as { directions?: unknown } | null)?.directions
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const rows: SavedDirection[] = []
  for (const item of list) {
    const row = item as Partial<SavedDirection> | null
    if (row === null || typeof row !== 'object') continue
    if (typeof row.id !== 'string' || !ID_PATTERN.test(row.id) || seen.has(row.id)) continue
    if (typeof row.label !== 'string' || row.label.trim() === '' || typeof row.instruction !== 'string') continue
    seen.add(row.id)
    rows.push({ id: row.id, label: row.label.trim(), instruction: row.instruction })
  }
  return rows
}

/**
 * A file-backed store. Reads are cached by modification time, so the enhance
 * route can consult it on every request without re-parsing an unchanged file.
 * @param path - the JSON file.
 * @returns the store.
 */
export function createFileStore(path: string = defaultStorePath()): DirectionStore {
  let cache: { mtimeMs: number; rows: SavedDirection[] } | undefined
  return {
    read(): SavedDirection[] {
      let mtimeMs: number
      try {
        mtimeMs = statSync(path).mtimeMs
      } catch {
        cache = undefined
        return []
      }
      if (cache !== undefined && cache.mtimeMs === mtimeMs) return cache.rows.map((row) => ({ ...row }))
      try {
        const rows = rowsOf(JSON.parse(readFileSync(path, 'utf8')))
        cache = { mtimeMs, rows }
        return rows.map((row) => ({ ...row }))
      } catch (error) {
        console.warn(`[prompt-boost] could not read ${path}; saved modes are ignored until it is fixed.`, error)
        return []
      }
    },
    write(rows: readonly SavedDirection[]): void {
      mkdirSync(dirname(path), { recursive: true })
      const temp = `${path}.${process.pid}.tmp`
      writeFileSync(temp, `${JSON.stringify({ version: 1, directions: rows }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      renameSync(temp, path)
      cache = undefined
    },
  }
}

/**
 * An in-memory store (tests, and hosts where the file cannot be used).
 * @param initial - starting rows.
 * @returns the store.
 */
export function createMemoryStore(initial: readonly SavedDirection[] = []): DirectionStore {
  let rows = initial.map((row) => ({ ...row }))
  return {
    read: () => rows.map((row) => ({ ...row })),
    write: (next) => {
      rows = next.map((row) => ({ ...row }))
    },
  }
}
