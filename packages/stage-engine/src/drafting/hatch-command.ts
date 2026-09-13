import { normalizeComposeColor } from '@compose-ui/core'
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
  /*
   * 只等 `pick`：它既不是点（不过点输入管线——吸附会把落点挪到用户瞄的那块面之外，而填充要的
   * 正是他指着的那个位置；等待它的一步也不画十字线）也不是选择集（不改选择集）。
   *
   * `C` 是换色的**第二条入口**：货架不得成为任何能力的唯一入口，而工具栏的色板是第一条。
   */
  return {
    message: messages.pickHatchPoint,
    accepts: ['pick', 'keyword'],
    keywords: [{ key: 'C', label: messages.hatchColorKeyword }],
    badge: 'bucket',
  }
}

function colorPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.specifyHatchColor, accepts: ['text'] }
}

/**
 * 建立一次 HATCH 执行的状态机。
 *
 * @remarks
 * 每次收到 `pick` 交出一个 `commit` 且提示不变、继续等下一块——填一片区域是成批的活儿，与
 * `TRIM` 连续修剪同形；`accept`（回车、右键）与 `cancel` 结束。
 *
 * 哪一块面、改谁还是新建由规划那一步按落点解算（`resolveStageHatchRegion`），会话只说
 * 「这里」：引擎的命令层不认识文档，而边界规则要读图上每一条曲线在哪儿。
 *
 * **不读启动上下文里的选择集**：没有「先选边界」这一档，图上所有可见曲线都是边界。
 *
 * @public
 */
export function createStageHatchSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let prompt: ComposeCommandPrompt = pickPrompt(messages)
  let awaitingColor = false
  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (awaitingColor) {
        // 换色这一步只接文本；回车（`accept`）当成放弃换色，回到取点步而不是结束命令。
        if (input.kind === 'accept') {
          awaitingColor = false
          prompt = pickPrompt(messages)
          return { status: 'prompt', prompt }
        }
        if (input.kind !== 'text') return { status: 'rejected', message: messages.specifyHatchColor }
        const color = normalizeComposeColor(input.text)
        // 读不出来时**停在这一步**：清掉缓冲直接回去，用户会以为色换上了。
        if (!color) return { status: 'rejected', message: messages.invalidHatchColor }
        context.onHatchColorChange?.(color)
        awaitingColor = false
        prompt = pickPrompt(messages)
        return { status: 'prompt', prompt }
      }
      if (input.kind === 'accept') return { status: 'cancelled' }
      if (input.kind === 'keyword' && input.key.toUpperCase() === 'C') {
        awaitingColor = true
        prompt = colorPrompt(messages)
        return { status: 'prompt', prompt }
      }
      if (input.kind !== 'pick') return { status: 'rejected', message: messages.expectedHatchPoint }
      // 读顶层的落点而不是 `targets`：填充的落点在空处，本来就没有 target 可言。
      return { status: 'prompt', prompt, commit: { hatch: { point: input.point } } }
    },
  }
}

/**
 * HATCH 命令定义。
 *
 * @remarks
 * 别名 `H`，与 AutoCAD 逐字相同。**不声明单键**：提案里没有这一条，而单键是快捷键表里最容易
 * 被撞上的一类，加一个是独立的产品决定，不该作为落地的副作用发生。`H` 眼下空着，要给随时能给。
 *
 * @public
 */
export function createStageHatchCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'HATCH',
    aliases: ['H'],
    title: messages.hatchTitle,
    category: messages.editCategory,
    start: createStageHatchSession,
  }
}
