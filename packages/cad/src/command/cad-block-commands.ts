import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import { createCadInsert } from '../block'
import { CAD_COMPONENT_KEYS } from '../document'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'

function selectPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return { message: messages.selectObjects, accepts: ['selection'] }
}

function namePrompt(message: string): ComposeCommandPrompt {
  return { message, accepts: ['text'] }
}

function pointPrompt(message: string): ComposeCommandPrompt {
  return { message, accepts: ['point'] }
}

/**
 * 建立一次 BLOCK 执行的状态机。
 *
 * @remarks
 * 三步：选择对象（已有选择时跳过）→ 块名 → 插入基点。基点最后取，因为它通常要捕捉到已选
 * 几何上的某个特征点——AutoCAD 也是这个顺序。
 *
 * 提交的是**一条** `cad.block.create`：建块、删原件、插实例由 handler 在同一批 patch 里完成。
 * 拆成三条命令会让撤销要按三次，而用户做的是一个动作。
 *
 * @public
 */
export function createCadBlockSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const picked: string[] = [...context.selection]
  let name: string | null = null
  let prompt: ComposeCommandPrompt = picked.length > 0
    ? namePrompt(messages.blockName)
    : selectPrompt(messages)

  const commit = (basePoint: { readonly x: number; readonly y: number }): ComposeCommandStep<CadCommandEffect> => {
    const blockId = context.idFactory()
    return {
      status: 'commit',
      effect: {
        createdBlockId: blockId,
        // 原件被实例取代；宿主据此把它们从选择集里剔除。
        removed: [...picked],
        command: {
          id: context.idFactory(),
          type: CAD_COMMAND_TYPES.createBlock,
          payload: {
            blockId,
            name,
            basePoint: { x: basePoint.x, y: basePoint.y },
            entityIds: [...picked],
            insertId: context.idFactory(),
          } as never,
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

      if (prompt.accepts.includes('selection')) {
        if (input.kind === 'selection') {
          for (const id of input.ids) {
            if (!picked.includes(id)) picked.push(id)
          }
          return { status: 'prompt', prompt, preview: { removed: [...picked], command: null } }
        }
        if (input.kind !== 'accept') {
          return { status: 'rejected', message: messages.expectedSelection }
        }
        if (picked.length === 0) return { status: 'cancelled' }
        prompt = namePrompt(messages.blockName)
        return { status: 'prompt', prompt }
      }

      if (prompt.accepts.includes('text')) {
        // 名字走 `text` 而不是 `keyword`：块名是自由输入，关键字是命令自己列出的有限集合。
        const text = input.kind === 'text' ? input.text.trim() : ''
        if (text.length === 0) return { status: 'rejected', message: messages.expectedName }
        if (context.blocks.some((block) => block.name === text)) {
          return { status: 'rejected', message: `${messages.unknownBlock}: ${text}` }
        }
        name = text
        prompt = pointPrompt(messages.blockBasePoint)
        return { status: 'prompt', prompt }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }
      return commit(input.point)
    },
  }
}

/** BLOCK 命令定义。 @public */
export function createCadBlockCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'BLOCK',
    aliases: ['B'],
    title: messages.blockTitle,
    start: createCadBlockSession,
  }
}

/**
 * 建立一次 INSERT 执行的状态机。
 *
 * @remarks
 * 未知块名走 `rejected` 而不是 `cancelled`：打错名字在 CAD 里是常态，结束命令会让用户从头
 * 再来。会话停在原提示继续等。
 *
 * @public
 */
export function createCadInsertSession(
  context: CadCommandContext,
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  let blockId: string | null = null
  let prompt: ComposeCommandPrompt = namePrompt(messages.insertName)

  return {
    get prompt() {
      return prompt
    },
    advance(input) {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (blockId === null) {
        const text = input.kind === 'text' ? input.text.trim() : ''
        if (text.length === 0) return { status: 'rejected', message: messages.expectedName }
        const match = context.blocks.find(
          (block) => block.name.toLowerCase() === text.toLowerCase(),
        )
        if (!match) return { status: 'rejected', message: `${messages.unknownBlock}: ${text}` }
        blockId = match.id
        prompt = pointPrompt(messages.insertPoint)
        return { status: 'prompt', prompt }
      }

      if (input.kind !== 'point') return { status: 'rejected', message: messages.expectedPoint }
      const entityId = context.idFactory()
      return {
        status: 'commit',
        effect: {
          command: {
            id: context.idFactory(),
            type: CAD_COMMAND_TYPES.addEntity,
            payload: {
              entity: {
                id: entityId,
                name: context.blocks.find((block) => block.id === blockId)?.name ?? 'Insert',
                components: {
                  [CAD_COMPONENT_KEYS.placement]: { layerId: context.layerId },
                  [CAD_COMPONENT_KEYS.insert]: createCadInsert(blockId, input.point),
                },
              },
            } as never,
          },
        },
      }
    },
  }
}

/** INSERT 命令定义。 @public */
export function createCadInsertCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'INSERT',
    aliases: ['I'],
    title: messages.insertTitle,
    start: createCadInsertSession,
  }
}
