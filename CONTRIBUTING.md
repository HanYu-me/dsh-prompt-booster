# Contributing

Thanks for helping improve dsh-prompt-booster! It is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web plugin: one package with a Node (host) half and a browser half.

## Setup

```bash
git clone https://github.com/HanYu-me/dsh-prompt-booster.git
cd dsh-prompt-booster
npm install
npm test          # unit + real-http + component suites
npm run typecheck
npm run build     # tsc + esbuild → lib/index.js (host ESM) + lib/client.js (browser ModuleLoader bundle)
```

## Local debug loop

```bash
dsh plugin --profile web add link:$PWD   # once
npm run watch                            # keep rebuilding both halves
# restart dsh after changing host-half code; browser-half changes need a page reload
```

## Ground rules

- **`lib/` is committed** so GitHub installs need no build step. Run `npm run build` before pushing; CI fails if `lib/` drifts from `src/`.
- Tests never touch your real saved modes: `vitest.config.ts` points `DSH_PROMPT_BOOST_DIRECTIONS_FILE` at a temp path.
- The browser half must never throw from `apply` (that fails the whole web boot); optional wiring is caught and logged.
- Keep the README feature list accurate: the plugin catalog checks descriptions against the code.
