import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
} from '@compose-ui/commands'
import type { EditorCommand } from '@compose-ui/core'
import { CAD_COMMAND_TYPES } from './cad-command-handlers'
import type { CadCommandContext, CadCommandEffect, CadCommandMessages } from './cad-command-context'

function selectPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return { message: messages.selectObjects, accepts: ['selection'] }
}

function basePrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return { message: messages.basePoint, accepts: ['point'] }
}

function displacementPrompt(messages: CadCommandMessages): ComposeCommandPrompt {
  return { message: messages.displacementPoint, accepts: ['point'] }
}

function delta(from: ComposeCommandPoint, to: ComposeCommandPoint) {
  return { x: to.x - from.x, y: to.y - from.y }
}

/**
 * MOVE 与 COPY 共用的取点状态机。
 *
 * @remarks
 * 两条命令只有一处不同：放下一个落点之后 MOVE 收束、COPY 继续等下一个。取对象、取基点、
 * 求位移三步完全一样，写两遍必然在某次改动后漂移。
 *
 * `repeat` 为 true 时用 `prompt` 状态携带 `commit` 返回——会话不结束，但本步产出的变更已经
 * 落进文档。AutoCAD 的 COPY 就是这样：放一个副本继续等下一个落点，把同一个符号摆一排是接线
 * 图里的高频动作。
 */
function createTransformSession(
  context: CadCommandContext,
  options: {
    readonly repeat: boolean
    readonly build: (
      ids: readonly string[],
      offset: { readonly x: number; readonly y: number },
    ) => EditorCommand
  },
): ComposeCommandSession<CadCommandEffect> {
  const { messages } = context
  const picked: string[] = [...context.selection]
  let base: ComposeCommandPoint | null = null
  // 已经选好对象就跳过「选择对象」，直接问基点——这是 AutoCAD 的「先选后执行」。
  let prompt: ComposeCommandPrompt = picked.length > 0
    ? basePrompt(messages)
    : selectPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    advance(input) {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'selection') {
        for (const id of input.ids) if (!picked.includes(id)) picked.push(id)
        return { status: 'prompt', prompt }
      }

      if (input.kind === 'accept') {
        // 选择对象阶段的 Enter 表示「选完了」；此后 Enter 表示结束命令。
        if (prompt.accepts.includes('selection')) {
          if (picked.length === 0) return { status: 'cancelled' }
          prompt = basePrompt(messages)
          return { status: 'prompt', prompt }
        }
        return { status: 'cancelled' }
      }

      if (input.kind !== 'point') {
        return { status: 'rejected', message: messages.expectedPoint }
      }

      if (base === null) {
        base = input.point
        prompt = displacementPrompt(messages)
        return { status: 'prompt', prompt, preview: { command: null, reference: base } }
      }

      const effect: CadCommandEffect = {
        command: options.build(picked, delta(base, input.point)),
        reference: input.point,
      }
      if (!options.repeat) return { status: 'commit', effect }
      // 位移始终以**最初的基点**为起点，与 AutoCAD 一致：连续放置时用户心里的参照是那一个
      // 基点，而不是上一个副本的落点。
      return { status: 'prompt', prompt, commit: effect, preview: { command: null, reference: base } }
    },
  }
}

/** MOVE 命令定义。 @public */
export function createCadMoveCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'MOVE',
    aliases: ['M'],
    title: messages.moveTitle,
    start: (context) => createTransformSession(context, {
      repeat: false,
      build: (entityIds, delta) => ({
        id: context.idFactory(),
        type: CAD_COMMAND_TYPES.translateEntities,
        payload: { entityIds, delta } as never,
      }),
    }),
  }
}

/** COPY 命令定义。 @public */
export function createCadCopyCommand(
  messages: CadCommandMessages,
): ComposeCommandDefinition<CadCommandContext, CadCommandEffect> {
  return {
    id: 'COPY',
    aliases: ['CO'],
    title: messages.copyTitle,
    start: (context) => createTransformSession(context, {
      repeat: true,
      build: (entityIds, delta) => ({
        id: context.idFactory(),
        type: CAD_COMMAND_TYPES.duplicateEntities,
        payload: {
          entityIds,
          delta,
          newIds: entityIds.map(() => context.idFactory()),
        } as never,
      }),
    }),
  }
}

