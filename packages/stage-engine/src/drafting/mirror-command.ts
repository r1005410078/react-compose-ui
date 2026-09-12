import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type {
  StageAlignmentMode,
} from '../gesture-planning'
import { stageAlignmentMinimum } from '../gesture-planning'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

function selectPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.selectObjects, accepts: ['selection'] }
}

function firstAxisPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.mirrorFirstPoint, accepts: ['point'], fields: 'absolute' }
}

function secondAxisPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // 第二个点回答的是「这条轴往哪个方向走、走多远」，与 `LINE` 的下一点同一种参数化。
  return { message: messages.mirrorSecondPoint, accepts: ['point'], fields: 'polar' }
}

/**
 * 建立一次 `MIRROR` 执行的状态机。
 *
 * @remarks
 * 取两个点定出镜像轴，走的是既有的两点取点节奏，因此吸附、捕捉、极轴与动态输入全部照旧——
 * 把一个刀闸镜像到母线另一侧时，用户要的正是「轴过这个端子」。
 *
 * **不提供「保留原件」的变体**：那是 `COPY` 加 `MIRROR` 两步，而两步都已经存在；做成关键字
 * 等于给同一件事造第二个入口，还要在提示里多一行。
 *
 * @public
 */
export function createStageMirrorSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let picked: readonly string[] = context.selection ?? []
  let first: ComposeCommandPoint | null = null
  // 已经选好对象就跳过「选择对象」，与 `MOVE` / `ERASE` 一致：这是 AutoCAD 的先选后执行。
  let prompt: ComposeCommandPrompt = picked.length > 0
    ? firstAxisPrompt(messages)
    : selectPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        picked = input.ids
        return { status: 'prompt', prompt }
      }
      if (input.kind === 'accept') {
        if (prompt.accepts.includes('selection')) {
          if (picked.length === 0) return { status: 'cancelled' }
          prompt = firstAxisPrompt(messages)
          return { status: 'prompt', prompt }
        }
        return { status: 'cancelled' }
      }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (first === null) {
        first = input.point
        prompt = secondAxisPrompt(messages)
        return { status: 'prompt', prompt, preview: { reference: first } }
      }
      /*
       * 两个点重合时**拒绝而不是提交**：没有方向的轴定不出镜像，静默什么都不做与敲错在
       * 屏幕上无法区分。会话留在这一步，用户再取一个点即可。
       */
      if (input.point.x === first.x && input.point.y === first.y) {
        return { status: 'rejected', message: messages.mirrorDegenerateAxis }
      }
      return {
        status: 'commit',
        effect: {
          mirror: {
            entityIds: picked,
            // `ComposeCommandPoint` 没有 `ComposePosition` 的 JSON 索引签名，经字面量转一道。
            axis: {
              a: { x: first.x, y: first.y },
              b: { x: input.point.x, y: input.point.y },
            },
          },
        },
      }
    },
  }
}

/** `MIRROR` 命令定义。 @public */
export function createStageMirrorCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'MIRROR',
    aliases: ['MI'],
    title: messages.mirrorTitle,
    category: messages.editCategory,
    start: createStageMirrorSession,
  }
}

/**
 * 一项对齐/分布的命令定义。
 *
 * @remarks
 * 它是命令会话的**退化情形**——`prompt` 为 `null`、收到确认就提交，与 `ERASE` 预选时那一档
 * 逐字相同。八项因此不是「面板动作」而是词汇表里的词，命令行敲得出来。
 *
 * 选区不足时以 `rejected` **说出来**而不是静默：「敲了没反应」与敲错字在屏幕上无法区分。
 * 走 `rejected` 而不是描述符上的 `disabledReason`，是因为后者是定义上的**静态**字段——让它
 * 跟着选区变要在每次选区变化时重建整张注册表，而 `VERTEX` 的「候选不是恰好一个」早已用
 * `rejected` 回答了同一个问题。
 *
 * @public
 */
export function createStageAlignmentCommand(options: {
  readonly id: string
  readonly aliases?: readonly string[]
  readonly title: string
  readonly mode: StageAlignmentMode
  readonly messages: StageDraftingMessages
}): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  const { id, aliases, title, mode, messages } = options
  return {
    id,
    ...(aliases ? { aliases } : {}),
    title,
    category: messages.editCategory,
    start(context): ComposeCommandSession<StageDraftingEffect> {
      const picked = context.selection ?? []
      return {
        prompt: null,
        advance(input): ComposeCommandStep<StageDraftingEffect> {
          if (input.kind === 'cancel') return { status: 'cancelled' }
          if (input.kind !== 'accept') return { status: 'rejected', message: title }
          const minimum = stageAlignmentMinimum(mode)
          if (picked.length < minimum) {
            return { status: 'rejected', message: messages.alignmentNeedsMore(minimum) }
          }
          return { status: 'commit', effect: { align: { entityIds: picked, mode } } }
        },
      }
    },
  }
}
