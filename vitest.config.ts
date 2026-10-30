import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

// Tests must never read or write the user's real saved-modes file.
export default defineConfig({
  test: {
    env: { DSH_PROMPT_BOOST_DIRECTIONS_FILE: join(tmpdir(), `dsh-prompt-boost-test-${process.pid}`, 'directions.json') },
  },
})
