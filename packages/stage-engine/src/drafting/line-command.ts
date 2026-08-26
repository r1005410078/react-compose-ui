import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createComposeLineCurve } from '@compose-ui/core'
import { createStageCopyCommand, createStageMoveCommand } from './move-copy-command'
import { createStageEraseCommand } from './erase-command'
import { createStageVertexCommand } from './vertex-command'
import {
  createStageArcCommand,
  createStageCircleCommand,
  createStagePolylineCommand,
  createStageRectangleCommand,
} from './shape-commands'
import type { StageDraftingContext, StageDraftingEffect, StageDraftingMessages } from './drafting-types'

function firstPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.specifyFirstPoint, accepts: ['point'] }
}

function nextPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // Enter 结束命令，与 AutoCAD 一致；没有 `defaultKeyword` 时 `accept` 会被拒绝，因此这里
  // 由 session 直接把 `accept` 解释成结束。
  return { message: messages.specifyNextPoint, accepts: ['point'] }
}

/**
 * 建立一次 LINE 执行的状态机。
 *
 * @remarks
 * 纯状态机：不碰 React、不碰 DOM，输入是归一化的 `ComposeCommandInput`，输出是提示、预览与
 * 本步要创建的几何。因此喂一串输入即可完整测试。
 *
 * **逐段落地**（`prompt` 携带 `commit`）而不是攒到最后一次性提交：曲线是普通页面 Entity，
 * 画一段就该在场景树里出现一行——那正是这条统一路线要让用户看见的事实。代价是撤销粒度变成
 * 一段一步，这与 AutoCAD 的 `U` 关键字粒度一致。
 *
 * **端口绑定不在这里**：本包不认识端口，效果上也不再有导线标记。曲线的两个端点就是那两次
 * 落点，宿主按取点时记下的来源接上绑定即可。逐段落地因此顺带成立一件事——中间那个点被两段
 * 共用，两段都会绑到它，而两段确实都碰到了那个端子。
 *
 * @public
 */
export function createStageLineSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let previous: ComposeCommandPoint | null = null
  let prompt = firstPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    // 待定段：还没落地的那一条。已画完的段都已经是真的 Entity，不必也不该在预览里重画。
    preview(point) {
      return previous ? { curves: [createComposeLineCurve(previous, point)] } : null
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      // 没有 `defaultKeyword`，因此 Enter 的含义由命令自己给：已经取过点就是**正常结束**，
      // 一点都没取才是什么也没发生。
      //
      // 结束必须是 `commit` 而不是 `cancelled`：逐段落地意味着此刻文档上已经没有待提交的
      // 东西，`effect` 因此是空的——但宿主是按 status 决定提示文案的，回 `cancelled` 会让
      // 用户画完一条线看到「已取消」。空 effect 是合法的：字段全部可选，它表达的正是
      // 「命令正常结束，本步没有新产出」。
      if (input.kind === 'accept') {
        return previous ? { status: 'commit', effect: {} } : { status: 'cancelled' }
      }

      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }

      const point = input.point
      const reference = previous
      previous = point
      prompt = nextPrompt(messages)
      return {
        status: 'prompt',
        prompt,
        preview: { reference: point },
        // 第一点只是起点，还构不成一段。
        ...(reference
          ? { commit: { curves: [createComposeLineCurve(reference, point)], reference: point } }
          : {}),
      }
    },
  }
}

/**
 * 建立一次**两点曲线**执行的状态机。
 *
 * @remarks
 * 与 LINE 的差别只有两处：取两个点就结束，以及提交时带上调用方给的那个标记。
 *
 * `extras` 是提交效果上的附加标记，**不是几何**。它眼下只有 `ARROW` 一个消费者——`WIRE`
 * 合并进 `LINE` 之后没有第二种线可分。工厂仍然留着：「只有一个消费者」在本仓库不是把抽象
 * 折回去的理由，而取点逻辑一旦复制，下一个改它的人只会改到其中一处。
 */
function createTwoPointCurveSession(
  context: StageDraftingContext,
  extras: Pick<StageDraftingEffect, 'arrow'>,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let start: ComposeCommandPoint | null = null
  let prompt = firstPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    preview(point) {
      return start ? { curves: [createComposeLineCurve(start, point)], ...extras } : null
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }
      if (!start) {
        start = input.point
        prompt = nextPrompt(messages)
        return { status: 'prompt', prompt, preview: { reference: input.point } }
      }
      return {
        status: 'commit',
        effect: {
          curves: [createComposeLineCurve(start, input.point)],
          ...extras,
          reference: input.point,
        },
      }
    },
  }
}

/**
 * 建立一次 ARROW 执行的状态机。
 *
 * @remarks
 * 取两个点而不是像 `LINE` 那样连着画：**一支箭头只有一个头**。走 LINE 那条逐段落地的路，
 * 画三个点会得到两支各自带头的箭头——那不是任何人点这个按钮时想要的东西。
 *
 * @public
 */
export function createStageArrowSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  return createTwoPointCurveSession(context, { arrow: true })
}

/** ARROW 命令定义。 @public */
export function createStageArrowCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'ARROW',
    aliases: ['AR'],
    title: messages.arrowTitle,
    category: messages.drawCategory,
    start: createStageArrowSession,
  }
}

/** LINE 命令定义。 @public */
export function createStageLineCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'LINE',
    aliases: ['L'],
    title: messages.lineTitle,
    category: messages.drawCategory,
    start: createStageLineSession,
  }
}

/** 创建绘图模式的命令集合。 @public */
export function createStageDraftingCommands(
  messages: StageDraftingMessages,
): readonly ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>[] {
  return [
    createStageLineCommand(messages),
    createStageArrowCommand(messages),
    createStageArcCommand(messages),
    createStageCircleCommand(messages),
    createStageRectangleCommand(messages),
    createStagePolylineCommand(messages),
    createStageMoveCommand(messages),
    createStageCopyCommand(messages),
    createStageEraseCommand(messages),
    createStageVertexCommand(messages),
  ]
}
