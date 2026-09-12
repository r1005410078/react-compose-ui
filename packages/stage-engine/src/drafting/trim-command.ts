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

function pickPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // 只等 `pick`：它既不是点（不过点输入管线，也不画十字线）也不是选择集（不改选择集）。
  // 徽标由提示自己声明——等待选择对象的命令画的是同一个拾取框，而 ERASE 与 TRIM 都删东西。
  return { message: messages.selectTrimTarget, accepts: ['pick'], badge: 'scissors' }
}

/**
 * 建立一次 TRIM 执行的状态机。
 *
 * @remarks
 * 每次收到 `pick` 交出一个 `commit` 且提示不变、继续等下一截——与 `COPY` 连续放置同形；
 * `accept`（回车、右键）与 `cancel` 结束。**不读启动上下文里的选择集**：没有「先选切割边」
 * 这一档，图上所有曲线都是切割边。
 *
 * 哪一截、能不能剪由规划那一步按落点解算（`resolveStageTrimPiece`），会话只说「这里」：
 * 引擎的命令层不认识文档，而边界规则要读别的曲线在哪儿。
 *
 * @public
 */
export function createStageTrimSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  const prompt = pickPrompt(messages)
  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel' || input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind !== 'pick') return { status: 'rejected', message: messages.expectedPick }
      if (input.targets.length === 0) return { status: 'prompt', prompt }
      return { status: 'prompt', prompt, commit: { trim: input.targets } }
    },
  }
}

/**
 * TRIM 命令定义。
 *
 * @remarks
 * 别名 `TR`，**不给单键**：`T` 已归文字工具，给一个记不住的键比不给更差，与 `POLYGON` 同一条。
 *
 * @public
 */
export function createStageTrimCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'TRIM',
    aliases: ['TR'],
    title: messages.trimTitle,
    category: messages.editCategory,
    start: createStageTrimSession,
  }
}
