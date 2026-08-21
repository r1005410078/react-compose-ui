import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type { EditorCommand } from '@compose-ui/core'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'

function selectPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  // Enter 表示「选完了」。没有 keywords，因此不给 defaultKeyword，由 accept 直接提交。
  return { message: messages.selectObjects, accepts: ['selection'] }
}

/**
 * 建立一次 ERASE 执行的状态机。
 *
 * @remarks
 * **两条次序共用同一条状态机**：启动上下文里已有选择就直接提交，没有就提示选择对象、把随后
 * 的点选与框选结果攒起来。这正是 AutoCAD 的行为，也是选择集这一步存在的理由——两条路收到的
 * 是同一种输入。
 *
 * @public
 */
export function createCadEraseSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const messages = context.messages
  const picked: string[] = [...context.selection]
  // 已经选好对象就没有任何要等的输入：`prompt` 为 null，宿主会立刻以 accept 推进，对象当场
  // 被删——这就是 AutoCAD 里 `E↵` 的手感。没选就提示选择对象，把随后的点选与框选攒起来。
  let prompt: ComposeCommandPrompt | null = picked.length > 0 ? null : selectPrompt(messages)

  const commit = (): ComposeCommandStep<CadCommandEffect> => {
    if (picked.length === 0) return { status: 'cancelled' }
    const commands: EditorCommand[] = picked.map((entityId) => ({
      id: context.idFactory(),
      type: CAD_COMMAND_TYPES.removeEntity,
      payload: { entityId } as never,
    }))
    return {
      status: 'commit',
      effect: {
        removed: [...picked],
        command: {
          id: context.idFactory(),
          type: 'transaction.batch',
          payload: { commands } as never,
        },
      },
    }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input) {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        for (const id of input.ids) {
          if (!picked.includes(id)) picked.push(id)
        }
        prompt = selectPrompt(messages)
        return { status: 'prompt', prompt, preview: { removed: [...picked], command: null } }
      }
      if (input.kind === 'accept') return commit()
      return { status: 'rejected', message: messages.expectedSelection }
    },
  }
}

/** ERASE 命令定义。 @public */
export function createCadEraseCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'ERASE',
    aliases: ['E'],
    title: messages.eraseTitle,
    start: createCadEraseSession,
  }
}
