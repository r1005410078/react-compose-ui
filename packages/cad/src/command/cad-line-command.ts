import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type { EditorCommand } from '@compose-ui/core'
import { createCadLineEntity } from '../document'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

const UNDO_KEY = 'U'
const FINISH_KEY = 'F'

function firstPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return { message: messages.specifyFirstPoint, accepts: ['point'] }
}

function nextPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return {
    message: messages.specifyNextPoint,
    accepts: ['point', 'keyword'],
    keywords: [
      { key: UNDO_KEY, label: messages.keywordUndo },
      { key: FINISH_KEY, label: messages.keywordFinish },
    ],
    // Enter 结束命令，与 AutoCAD 一致。
    defaultKeyword: FINISH_KEY,
  }
}

function segmentsOf(vertices: readonly ComposeCommandPoint[]) {
  return vertices.slice(0, -1).map((start, index) => ({ start, end: vertices[index + 1]! }))
}

/**
 * 建立一次 LINE 执行的状态机。
 *
 * @remarks
 * 纯状态机：不碰 React、不碰 DOM，输入是归一化的 {@link ComposeCommandInput}，输出是提示、
 * 预览与至多一个待派发命令。因此喂一串输入即可完整测试。
 *
 * @public
 */
export function createCadLineSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const vertices: ComposeCommandPoint[] = []
  let prompt = firstPrompt(messages)

  const preview = (): ComposeCommandStep<CadCommandEffect> => ({
    status: 'prompt',
    prompt,
    preview: {
      segments: segmentsOf(vertices),
      command: null,
      reference: vertices[vertices.length - 1],
    },
  })

  const commit = (): ComposeCommandStep<CadCommandEffect> => {
    const segments = segmentsOf(vertices)
    if (segments.length === 0) return { status: 'cancelled' }
    const commands: EditorCommand[] = segments.map((segment) => ({
      id: context.idFactory(),
      type: CAD_COMMAND_TYPES.addEntity,
      payload: {
        entity: createCadLineEntity(context.idFactory(), {
          layerId: context.layerId,
          start: segment.start,
          end: segment.end,
        }),
      } as never,
    }))
    return {
      status: 'commit',
      effect: {
        segments,
        reference: vertices[vertices.length - 1],
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

      if (input.kind === 'point') {
        vertices.push(input.point)
        prompt = nextPrompt(messages)
        return preview()
      }

      // 尚未取得第一点时，除了取点与取消之外没有可走的分支。
      if (vertices.length === 0) return { status: 'rejected', message: messages.expectedPoint }

      const key = input.kind === 'keyword'
        ? input.key.trim().toUpperCase()
        : input.kind === 'accept'
          ? prompt.defaultKeyword ?? ''
          : null
      if (key === null) return { status: 'rejected', message: messages.expectedPoint }

      if (key === FINISH_KEY) return commit()
      if (key === UNDO_KEY) {
        vertices.pop()
        // 退回到只剩第一点之前，等同于命令从未开始——AutoCAD 在这里同样直接结束命令。
        if (vertices.length === 0) return { status: 'cancelled' }
        prompt = nextPrompt(messages)
        return preview()
      }
      return { status: 'rejected', message: messages.expectedPoint }
    },
  }
}

/** LINE 命令定义。 @public */
export function createCadLineCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'LINE',
    aliases: ['L'],
    title: messages.lineTitle,
    start: createCadLineSession,
  }
}
