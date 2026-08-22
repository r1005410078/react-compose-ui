import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

function pointPrompt(message: string): ComposeCommandPrompt {
  return { message, accepts: ['point'] }
}

/**
 * 建立一次 WIRE 执行的状态机。
 *
 * @remarks
 * 会话只产出两个世界坐标点——**绑定不在这里做**。它是纯状态机，拿不到文档；而绑定必须依据
 * 当刻文档解出的端口位置，因此住在 `cad.wire.add` 的 handler 里。
 *
 * 一条导线只有两个端点，所以取到第二点即提交，没有 LINE 那样的连画循环：折线导线的价值几乎
 * 全部来自自动路由，没有路由的中间拐点只是把维护线形的负担交回给用户。
 *
 * @public
 */
export function createCadWireSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let start: ComposeCommandPoint | null = null
  let prompt: ComposeCommandPrompt = pointPrompt(messages.wireFirstPoint)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }

      if (start === null) {
        start = input.point
        prompt = pointPrompt(messages.wireNextPoint)
        return {
          status: 'prompt',
          prompt,
          preview: { segments: [], command: null, reference: start },
        }
      }

      const segment = { start, end: input.point }
      return {
        status: 'commit',
        effect: {
          segments: [segment],
          reference: input.point,
          command: {
            id: context.idFactory(),
            type: CAD_COMMAND_TYPES.addWire,
            payload: {
              id: context.idFactory(),
              layerId: context.layerId,
              start: { x: segment.start.x, y: segment.start.y },
              end: { x: segment.end.x, y: segment.end.y },
            } as never,
          },
        },
      }
    },
  }
}

/** WIRE 命令定义。 @public */
export function createCadWireCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'WIRE',
    aliases: ['W'],
    title: messages.wireTitle,
    start: createCadWireSession,
  }
}

function selectPrompt(message: string): ComposeCommandPrompt {
  return { message, accepts: ['selection'] }
}

/**
 * 建立一次 PORT 执行的状态机。
 *
 * @remarks
 * 与 ERASE 同一条「先选后执行」的路子：启动上下文里已有恰好一个对象就直接问点，否则先提示
 * 选一个。多选时同样要求重新选——端口加在**一个**块定义上，「加给哪个」不能靠猜。
 *
 * 目标是不是块实例、逆变换可不可逆，都由 handler 判定：那两件事都要读文档。
 *
 * @public
 */
export function createCadPortSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let target: string | null = context.selection.length === 1 ? context.selection[0]! : null
  let prompt: ComposeCommandPrompt = target === null
    ? selectPrompt(messages.portSelectInstance)
    : pointPrompt(messages.portPoint)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (target === null) {
        if (input.kind !== 'selection') {
          return { status: 'rejected', message: messages.expectedSelection }
        }
        if (input.ids.length !== 1) {
          return { status: 'rejected', message: messages.portSelectInstance }
        }
        target = input.ids[0]!
        prompt = pointPrompt(messages.portPoint)
        return { status: 'prompt', prompt }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }
      return {
        status: 'commit',
        effect: {
          command: {
            id: context.idFactory(),
            type: CAD_COMMAND_TYPES.addBlockPort,
            payload: {
              entityId: target,
              portId: context.idFactory(),
              point: { x: input.point.x, y: input.point.y },
            } as never,
          },
        },
      }
    },
  }
}

/** PORT 命令定义。 @public */
export function createCadPortCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'PORT',
    aliases: ['PO'],
    title: messages.portTitle,
    start: createCadPortSession,
  }
}
