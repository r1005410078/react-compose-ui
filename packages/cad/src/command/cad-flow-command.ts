import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

/**
 * 建立一次 FLOW 执行的状态机。
 *
 * @remarks
 * 「先选后执行」与 `ERASE` 同一条次序：启动时已有选择就直接提交，没有就提示选择对象。
 * 没有任何参数——用户的意图是「让这些线看起来在流动」，把周期、方向、时长都问一遍只会让一个
 * 一步的操作变成四步。需要改的人可以事后改动画时长。
 *
 * @public
 */
export function createCadFlowSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const picked: string[] = [...context.selection]
  const selectPrompt = (): ComposeCommandPrompt => ({
    message: messages.selectObjects,
    accepts: ['selection'],
  })
  // 已经选好就没有要等的输入：宿主会立刻以 accept 推进，与 `E↵` 的手感一致。
  let prompt: ComposeCommandPrompt | null = picked.length > 0 ? null : selectPrompt()

  const commit = (): ComposeCommandStep<CadCommandEffect> => {
    if (picked.length === 0) return { status: 'cancelled' }
    return {
      status: 'commit',
      effect: {
        command: {
          id: context.idFactory(),
          type: CAD_COMMAND_TYPES.flow,
          payload: {
            animationId: context.idFactory(),
            name: messages.flowAnimationName,
            entityIds: [...picked],
          } as never,
        },
      },
    }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        for (const id of input.ids) {
          if (!picked.includes(id)) picked.push(id)
        }
        prompt = selectPrompt()
        return { status: 'prompt', prompt }
      }
      if (input.kind === 'accept') return commit()
      return { status: 'rejected', message: messages.expectedSelection }
    },
  }
}

/** FLOW 命令定义。 @public */
export function createCadFlowCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'FLOW',
    aliases: ['FL'],
    title: messages.flowTitle,
    start: createCadFlowSession,
  }
}
