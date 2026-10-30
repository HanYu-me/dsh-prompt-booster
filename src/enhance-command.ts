/**
 * The `/enhance` slash command: rewrites its argument text through the same
 * host routine as the composer button and shows the result in the command
 * plane (copyable, never entering model history). Enhancing the composer
 * draft itself stays a client-side concern (button / shortcut), because the
 * draft lives in the browser.
 * @module dsh-prompt-boost/enhance-command
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition, CommandInvocation } from '@deepseek-ai/dsh-commands'
import { checkInputText, formatInputCheckZh } from './shared/validate'
import { type Config } from './config'
import { formatEnhanceError, toEnhanceError } from './enhancer'
import { runEnhance, sessionRouteOf } from './orchestrate'
import { createMemoryStore, type DirectionStore } from './direction-store'
import { defaultDirectionOf, findDirection, resolveDirections, type Direction } from './shared/directions'

/**
 * Split an optional leading `@direction` token off the command input.
 * @param raw - the trimmed command input.
 * @returns the direction id (if any) and the remaining text.
 */
export function splitDirectionToken(raw: string): { id?: string; text: string } {
  const match = /^@([a-z0-9_-]{1,32})(?:\s+|$)/i.exec(raw)
  if (match === null) return { text: raw }
  return { id: (match[1] ?? '').toLowerCase(), text: raw.slice(match[0].length).trim() }
}

/** Structural face of the commands registry (optional service). */
interface CommandsFace {
  register(definition: CommandDefinition): () => void
}

/**
 * Register the /enhance command on the (optional) commands service. Absent
 * service is a silent no-op so the plugin still loads in UI-less spines.
 * @param ctx - registrant context.
 * @param readConfig - per-call config reader.
 */
export function registerEnhanceCommand(ctx: Context, readConfig: () => Config, store: DirectionStore = createMemoryStore()): void {
  const commands = ctx.get('commands') as unknown as CommandsFace | undefined
  if (commands === undefined) return
  const definition: CommandDefinition = {
    name: 'boost',
    description: '提示词提升：/boost [@方向] <文本> —— 重写为结构化提示词，结果在此展示可复制，不进入对话历史。方向如 @concise、@coding、@english',
    input: { hint: '[@方向] 要提升的文本（提升输入框草稿请用输入框按钮或快捷键）' },
    recordInput: false,
    async handler(invocation: CommandInvocation) {
      const split = splitDirectionToken(invocation.rawInput.trim())
      const raw = split.text
      if (raw === '') {
        return { kind: 'error', text: '用法：/boost <文本>。要增强输入框里的草稿，请用输入框右侧的「增强」按钮或快捷键。' }
      }
      // Everything below reads config, and `resolveConfig` throws on the
      // invariants the schema cannot express (provider without model, an
      // out-of-range value left by hand-editing). Reading it outside the try
      // turned those into an uncaught handler throw — the user got a raw
      // exception instead of the bilingual message the route already shows.
      try {
        const config = readConfig()
        if (!config.enabled) {
          return { kind: 'error', text: '提示词增强已在插件设置中关闭。' }
        }
        const directions = resolveDirections(config.customDirections, store.read())
        const direction: Direction | undefined = split.id === undefined
          ? defaultDirectionOf(directions, config.defaultDirection)
          : findDirection(directions, split.id)
        if (direction === undefined) {
          return { kind: 'error', text: `未知的提升方向 @${split.id}。可用：${directions.map((d) => `@${d.id}`).join(' ')}` }
        }
        const check = checkInputText(raw, config.maxInputChars)
        if (!check.ok) {
          return { kind: 'error', text: formatInputCheckZh(check) }
        }
        const value = await runEnhance(ctx, config, {
          text: raw,
          sessionRoute: sessionRouteOf(ctx, invocation.agent.session.id),
          signal: invocation.signal,
          sessionId: invocation.agent.session.id,
          direction,
        })
        return { kind: 'success', text: value.text }
      } catch (error) {
        return { kind: 'error', text: formatEnhanceError(toEnhanceError(error)) }
      }
    },
  }
  ctx.effect(() => commands.register(definition))
}
