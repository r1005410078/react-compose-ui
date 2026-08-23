import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

function selectPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // Enter 表示「选完了」。没有 keywords，因此不给 defaultKeyword，由 accept 直接提交。
  return { message: messages.selectObjects, accepts: ['selection'] }
}

/**
 * 建立一次 ERASE 执行的状态机。
 *
 * @remarks
 * **两条次序共用同一条状态机**：启动上下文里已有选择就直接提交，没有就提示选择对象、把随后
 * 的点选与框选结果记下来。这正是 AutoCAD 的行为，也是选择集这一步存在的理由——两条路收到的
 * 是同一种输入。
 *
 * 已经选好对象时 `prompt` 为 `null`：宿主会立刻以 accept 推进，对象当场被删——这就是 AutoCAD
 * 里 `E↵` 的手感。没有这一档的话，宿主只能靠认识命令 id 来特判。
 *
 * @public
 */
export function createStageEraseSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let picked: readonly string[] = context.selection ?? []
  let prompt: ComposeCommandPrompt | null = picked.length > 0 ? null : selectPrompt(messages)

  const commit = (): ComposeCommandStep<StageDraftingEffect> => {
    if (picked.length === 0) return { status: 'cancelled' }
    return { status: 'commit', effect: { removed: picked } }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        // 替换而不是并入：选择集归宿主，会话只是镜像。
        picked = input.ids
        prompt = selectPrompt(messages)
        return { status: 'prompt', prompt, preview: { removed: picked } }
      }
      if (input.kind === 'accept') return commit()
      return { status: 'rejected', message: messages.expectedSelection }
    },
  }
}

/** ERASE 命令定义。 @public */
export function createStageEraseCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'ERASE',
    aliases: ['E'],
    title: messages.eraseTitle,
    category: messages.editCategory,
    start: createStageEraseSession,
  }
}
