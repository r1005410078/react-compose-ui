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

/** LINE 命令定义。 @public */
export function createStageLineCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'LINE',
    aliases: ['L'],
    title: messages.lineTitle,
    start: createStageLineSession,
  }
}

/** 创建绘图模式的命令集合。 @public */
export function createStageDraftingCommands(
  messages: StageDraftingMessages,
): readonly ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect>[] {
  return [
    createStageLineCommand(messages),
    createStageArcCommand(messages),
    createStageCircleCommand(messages),
    createStageRectangleCommand(messages),
    createStagePolylineCommand(messages),
    createStageMoveCommand(messages),
    createStageCopyCommand(messages),
    createStageEraseCommand(messages),
  ]
}
