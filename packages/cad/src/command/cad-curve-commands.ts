import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createCadArcEntity } from '../document'
import { arcThroughPoints } from '../geometry'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

function pointPrompt(message: string): ComposeCommandPrompt {
  return { message, accepts: ['point'] }
}

function addArcCommand(
  context: CadCommandContext,
  arc: {
    readonly center: ComposeCommandPoint
    readonly radius: number
    readonly startAngle: number
    readonly sweep: number
  },
) {
  return {
    id: context.idFactory(),
    type: CAD_COMMAND_TYPES.addEntity,
    payload: {
      entity: createCadArcEntity(context.idFactory(), {
        layerId: context.layerId,
        center: arc.center,
        radius: arc.radius,
        startAngle: arc.startAngle,
        sweep: arc.sweep,
      }),
    } as never,
  }
}

/**
 * 建立一次 CIRCLE 执行的状态机。
 *
 * @remarks
 * 圆心 + 半径点，与 AutoCAD 的默认次序一致。半径由两点距离求得而不是让用户键入一个数：图上
 * 已经有的东西（另一个圆的边、一条线的端点）可以直接捕过去，键入数字反而要求用户先自己量。
 *
 * 两点重合时半径为 0，此时拒绝并停在原提示——0 半径的圆在屏幕上不存在，却仍会参与命中与捕捉，
 * 成为一个点不中也删不掉的幽灵。
 *
 * @public
 */
export function createCadCircleSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let center: ComposeCommandPoint | null = null
  let prompt: ComposeCommandPrompt = pointPrompt(messages.circleCenter)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (center === null) {
        center = input.point
        prompt = pointPrompt(messages.circleRadius)
        return { status: 'prompt', prompt, preview: { command: null, reference: center } }
      }

      const radius = Math.hypot(input.point.x - center.x, input.point.y - center.y)
      if (!(radius > 0)) return { status: 'rejected', message: messages.degenerateRadius }
      return {
        status: 'commit',
        effect: {
          reference: center,
          command: addArcCommand(context, { center, radius, startAngle: 0, sweep: 360 }),
        },
      }
    },
  }
}

/** CIRCLE 命令定义。 @public */
export function createCadCircleCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'CIRCLE',
    aliases: ['C'],
    title: messages.circleTitle,
    start: createCadCircleSession,
  }
}

/**
 * 建立一次 ARC 执行的状态机。
 *
 * @remarks
 * **三点定弧**（起点、弧上一点、终点），与 AutoCAD 的默认次序一致。三个位置都能直接从图上
 * 捕到，而「圆心 + 起止角」要求用户先知道圆心在哪。
 *
 * 三点共线时外接圆退化成直线，此时**拒绝但不结束命令**：沿一条既有直线连点三下在实际操作里
 * 很常见，结束命令会让用户从头再来。这与 INSERT 打错块名的处理是同一条理由。
 *
 * @public
 */
export function createCadArcSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const vertices: ComposeCommandPoint[] = []
  let prompt: ComposeCommandPrompt = pointPrompt(messages.arcStartPoint)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (vertices.length < 2) {
        vertices.push(input.point)
        prompt = pointPrompt(vertices.length === 1 ? messages.arcThroughPoint : messages.arcEndPoint)
        return {
          status: 'prompt',
          prompt,
          preview: {
            command: null,
            reference: input.point,
            // 前两点之间先画一条橡皮筋：还不知道弧往哪边鼓，但「已经定下了哪两个点」要看得见。
            segments: vertices.length === 2 ? [{ start: vertices[0]!, end: vertices[1]! }] : [],
          },
        }
      }

      const arc = arcThroughPoints(vertices[0]!, vertices[1]!, input.point)
      // 共线：停在原提示等下一个点，`vertices` 不动。
      if (!arc) return { status: 'rejected', message: messages.collinearArc }
      return {
        status: 'commit',
        effect: {
          reference: input.point,
          command: addArcCommand(context, arc),
        },
      }
    },
  }
}

/** ARC 命令定义。 @public */
export function createCadArcCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'ARC',
    aliases: ['A'],
    title: messages.arcTitle,
    start: createCadArcSession,
  }
}
