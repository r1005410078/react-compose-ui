import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createCadTextEntity } from '../document'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

/**
 * 新文字的默认字号（世界单位）。
 *
 * @remarks
 * 只在**一次命令会话内**被用户改过的值取代。AutoCAD 用系统变量跨命令记住它，本仓没有那个
 * 概念；为一个值引入一套系统变量机制是把一次开销换成一份长期负担。
 *
 * @public
 */
export const CAD_DEFAULT_TEXT_HEIGHT = 16

/**
 * 建立一次 TEXT 执行的状态机。
 *
 * @remarks
 * `指定插入点 → 指定字高 → 键入文字`，与 AutoCAD 一致。
 *
 * 字高一步同时接受三种输入：直接确认采用默认值、键入数字、或在图上指一点并取它到插入点的
 * 距离。三者复用既有的 `accept` / `text` / `point` 输入类型，不需要给命令协议加任何东西。
 *
 * 空内容被拒绝，与半径为零的圆同一条理由：它在屏幕上不存在，却仍然参与命中与捕捉，成为一个
 * 点不中也删不掉的幽灵。
 *
 * @public
 */
export function createCadTextSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let position: ComposeCommandPoint | null = null
  let height: number | null = null
  let prompt: ComposeCommandPrompt = { message: messages.textPosition, accepts: ['point'] }

  const heightPrompt = (): ComposeCommandPrompt => ({
    message: `${messages.textHeight} <${CAD_DEFAULT_TEXT_HEIGHT}>`,
    // 指点取距离、键入数字、或直接确认用默认值。
    accepts: ['point', 'text'],
  })

  const contentPrompt = (): ComposeCommandPrompt => ({
    message: messages.textContent,
    accepts: ['text'],
  })

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<CadCommandEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (position === null) {
        if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }
        position = input.point
        prompt = heightPrompt()
        return { status: 'prompt', prompt, preview: { command: null, reference: position } }
      }

      if (height === null) {
        if (input.kind === 'accept') {
          height = CAD_DEFAULT_TEXT_HEIGHT
        }
        else if (input.kind === 'point') {
          // 指点取距离：从插入点到这一点的长度就是字高。
          height = Math.hypot(input.point.x - position.x, input.point.y - position.y)
        }
        else if (input.kind === 'text') {
          const parsed = Number(input.text.trim())
          if (!Number.isFinite(parsed)) {
            return { status: 'rejected', message: messages.expectedTextHeight }
          }
          height = parsed
        }
        else {
          return { status: 'rejected', message: messages.expectedTextHeight }
        }
        if (!(height > 0)) {
          height = null
          return { status: 'rejected', message: messages.expectedTextHeight }
        }
        prompt = contentPrompt()
        return { status: 'prompt', prompt, preview: { command: null, reference: position } }
      }

      const content = input.kind === 'text' ? input.text : ''
      if (content.length === 0) return { status: 'rejected', message: messages.expectedTextContent }
      return {
        status: 'commit',
        effect: {
          reference: position,
          command: {
            id: context.idFactory(),
            type: CAD_COMMAND_TYPES.addEntity,
            payload: {
              entity: createCadTextEntity(context.idFactory(), {
                layerId: context.layerId,
                position,
                content,
                height,
              }),
            } as never,
          },
        },
      }
    },
  }
}

/** TEXT 命令定义。 @public */
export function createCadTextCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'TEXT',
    aliases: ['T'],
    title: messages.textTitle,
    start: createCadTextSession,
  }
}
