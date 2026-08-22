import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createCadPolylineEntity } from '../document'
import { isDegenerateCadPolyline } from '../geometry'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

const UNDO_KEY = 'U'
const FINISH_KEY = 'F'
const CLOSE_KEY = 'C'

function addPolylineCommand(
  context: CadCommandContext,
  vertices: readonly ComposeCommandPoint[],
  closed: boolean,
) {
  return {
    id: context.idFactory(),
    type: CAD_COMMAND_TYPES.addEntity,
    payload: {
      entity: createCadPolylineEntity(context.idFactory(), {
        layerId: context.layerId,
        vertices,
        closed,
      }),
    } as never,
  }
}

function segmentsOf(vertices: readonly ComposeCommandPoint[], closed = false) {
  const segments = vertices.slice(0, -1).map((start, index) => ({
    start,
    end: vertices[index + 1]!,
  }))
  if (closed && vertices.length > 2) {
    segments.push({ start: vertices[vertices.length - 1]!, end: vertices[0]! })
  }
  return segments
}

/**
 * 建立一次 PLINE 执行的状态机。
 *
 * @remarks
 * 与 `LINE` 同样的连点手感，差别只在提交：`LINE` 每一段各是一个 Entity，`PLINE` 整条是
 * **一个**。两条命令在 AutoCAD 里同样并存——画临时辅助线时要的恰恰是互不相干的线段。
 *
 * 只放了一个点就结束时不写入任何东西：一个点连不成线，而全部顶点重合的多段线是一个点不中也
 * 删不掉的幽灵。
 *
 * @public
 */
export function createCadPolylineSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const vertices: ComposeCommandPoint[] = []
  let prompt: ComposeCommandPrompt = {
    message: messages.specifyFirstPoint,
    accepts: ['point'],
  }

  const nextPrompt = (): ComposeCommandPrompt => ({
    message: messages.specifyNextPoint,
    accepts: ['point', 'keyword'],
    keywords: [
      { key: CLOSE_KEY, label: messages.keywordClose },
      { key: UNDO_KEY, label: messages.keywordUndo },
      { key: FINISH_KEY, label: messages.keywordFinish },
    ],
    // Enter 结束命令，与 AutoCAD 一致。
    defaultKeyword: FINISH_KEY,
  })

  const preview = (): ComposeCommandStep<CadCommandEffect> => ({
    status: 'prompt',
    prompt,
    preview: {
      segments: segmentsOf(vertices),
      command: null,
      reference: vertices[vertices.length - 1],
    },
  })

  const commit = (closed: boolean): ComposeCommandStep<CadCommandEffect> => {
    if (vertices.length < 2 || isDegenerateCadPolyline(vertices)) return { status: 'cancelled' }
    return {
      status: 'commit',
      effect: {
        segments: segmentsOf(vertices, closed),
        reference: vertices[vertices.length - 1],
        command: addPolylineCommand(context, vertices, closed),
      },
    }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'point') {
        vertices.push(input.point)
        prompt = nextPrompt()
        return preview()
      }

      if (vertices.length === 0) return { status: 'rejected', message: messages.expectedPoint }

      const key = input.kind === 'keyword'
        ? input.key.trim().toUpperCase()
        : input.kind === 'accept'
          ? prompt.defaultKeyword ?? ''
          : null
      if (key === null) return { status: 'rejected', message: messages.expectedPoint }

      if (key === FINISH_KEY) return commit(false)
      // 闭合至少要三个点：两个点「闭合」出来的是同一条线来回走一遍。
      if (key === CLOSE_KEY) {
        if (vertices.length < 3) return { status: 'rejected', message: messages.expectedPoint }
        return commit(true)
      }
      if (key === UNDO_KEY) {
        vertices.pop()
        // 退回到一个点都不剩，等同于命令从未开始——LINE 在这里同样直接结束。
        if (vertices.length === 0) return { status: 'cancelled' }
        prompt = nextPrompt()
        return preview()
      }
      return { status: 'rejected', message: messages.expectedPoint }
    },
  }
}

/** PLINE 命令定义。 @public */
export function createCadPolylineCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'PLINE',
    aliases: ['PL'],
    title: messages.polylineTitle,
    start: createCadPolylineSession,
  }
}

/**
 * 建立一次 RECTANG 执行的状态机。
 *
 * @remarks
 * 两个对角点，产出四顶点的闭合多段线。矩形是**画法**而不是类型——用户要的是「两点画个框」，
 * 不是「文档里有个叫矩形的东西」。
 *
 * 两点在任一轴上重合时拒绝：那画出来是一条线或一个点，而不是框。
 *
 * @public
 */
export function createCadRectangleSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let first: ComposeCommandPoint | null = null
  let prompt: ComposeCommandPrompt = { message: messages.rectangleFirstCorner, accepts: ['point'] }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (first === null) {
        first = input.point
        prompt = { message: messages.rectangleSecondCorner, accepts: ['point'] }
        return { status: 'prompt', prompt, preview: { command: null, reference: first } }
      }

      if (first.x === input.point.x || first.y === input.point.y) {
        return { status: 'rejected', message: messages.degenerateRectangle }
      }
      const vertices = [
        first,
        { x: input.point.x, y: first.y },
        input.point,
        { x: first.x, y: input.point.y },
      ]
      return {
        status: 'commit',
        effect: {
          segments: segmentsOf(vertices, true),
          reference: input.point,
          command: addPolylineCommand(context, vertices, true),
        },
      }
    },
  }
}

/** RECTANG 命令定义。 @public */
export function createCadRectangleCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'RECTANG',
    aliases: ['REC'],
    title: messages.rectangleTitle,
    start: createCadRectangleSession,
  }
}
