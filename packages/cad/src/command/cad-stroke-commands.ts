import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import {
  parseCadColor,
  parseCadDashPattern,
  parseCadStrokeWidth,
  type CadStrokePatch,
} from '../appearance'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

/**
 * 建立一次外观修改的状态机。
 *
 * @remarks
 * `COLOR` / `LWEIGHT` / `LTYPE` 的流程完全相同：拿选择集（没有就先要）→ 收一个文本 → 提交一条
 * `cad.entity.stroke.set`。差别只在**怎么解析那个文本**，因此共用这一个工厂——与 `MOVE`/`COPY`
 * 共用取点状态机是同一种做法。三条各写一遍的话，「先选后执行」的两条次序、空选择集的处理、
 * 拒绝之后停在原提示，这些边界会各自漂移。
 *
 * `parse` 返回 `undefined` 表示值不合法，此时**拒绝但不结束命令**：打错一个值就要重新选一遍
 * 对象，在 CAD 里是不可接受的手感。
 *
 * @internal
 */
function createStrokePropertySession(
  context: CadCommandContext,
  options: {
    readonly valuePrompt: string
    readonly invalidMessage: string
    readonly parse: (input: string) => CadStrokePatch | undefined
  },
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const picked: string[] = [...context.selection]
  const selectPrompt = (): ComposeCommandPrompt => ({
    message: messages.selectObjects,
    accepts: ['selection'],
  })
  const valuePrompt = (): ComposeCommandPrompt => ({
    message: options.valuePrompt,
    accepts: ['text'],
  })
  let prompt: ComposeCommandPrompt = picked.length > 0 ? valuePrompt() : selectPrompt()

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (picked.length === 0) {
        if (input.kind !== 'selection') {
          return { status: 'rejected', message: messages.expectedSelection }
        }
        for (const id of input.ids) {
          if (!picked.includes(id)) picked.push(id)
        }
        // 与 ERASE 一致：选择可以分多次点，用 accept 表示选完了。
        if (picked.length === 0) return { status: 'prompt', prompt }
        prompt = valuePrompt()
        return { status: 'prompt', prompt }
      }

      if (input.kind !== 'text') return { status: 'rejected', message: options.invalidMessage }
      const patch = options.parse(input.text)
      if (!patch) return { status: 'rejected', message: options.invalidMessage }
      return {
        status: 'commit',
        effect: {
          command: {
            id: context.idFactory(),
            type: CAD_COMMAND_TYPES.setStroke,
            payload: { entityIds: [...picked], patch } as never,
          },
        },
      }
    },
  }
}

/** COLOR 会话。 @public */
export function createCadColorSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  return createStrokePropertySession(context, {
    valuePrompt: context.messages.strokeColor,
    invalidMessage: context.messages.invalidColor,
    parse: (input) => {
      const color = parseCadColor(input)
      return color === undefined ? undefined : { color }
    },
  })
}

/** LWEIGHT 会话。 @public */
export function createCadLineWeightSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  return createStrokePropertySession(context, {
    valuePrompt: context.messages.strokeWidth,
    invalidMessage: context.messages.invalidStrokeWidth,
    parse: (input) => {
      const width = parseCadStrokeWidth(input)
      return width === undefined ? undefined : { width }
    },
  })
}

/** LTYPE 会话。 @public */
export function createCadLineTypeSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  return createStrokePropertySession(context, {
    valuePrompt: context.messages.strokeDash,
    invalidMessage: context.messages.invalidStrokeDash,
    parse: (input) => {
      const dashPattern = parseCadDashPattern(input)
      return dashPattern === undefined ? undefined : { dashPattern }
    },
  })
}

/** COLOR 命令定义。 @public */
export function createCadColorCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'COLOR',
    aliases: ['COL'],
    title: messages.colorTitle,
    start: createCadColorSession,
  }
}

/** LWEIGHT 命令定义。 @public */
export function createCadLineWeightCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'LWEIGHT',
    aliases: ['LW'],
    title: messages.lineWeightTitle,
    start: createCadLineWeightSession,
  }
}

/** LTYPE 命令定义。 @public */
export function createCadLineTypeCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'LTYPE',
    aliases: ['LT'],
    title: messages.lineTypeTitle,
    start: createCadLineTypeSession,
  }
}
