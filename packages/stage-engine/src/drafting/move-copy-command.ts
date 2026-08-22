import type {
  ComposeCommandDefinition,
  ComposeCommandPoint,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
} from './drafting-types'

function selectPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  // Enter 表示「选完了」。没有 keywords，因此不给 defaultKeyword，由 accept 直接推进。
  return { message: messages.selectObjects, accepts: ['selection'] }
}

function basePrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.basePoint, accepts: ['point'] }
}

function displacementPrompt(messages: StageDraftingMessages): ComposeCommandPrompt {
  return { message: messages.displacementPoint, accepts: ['point'] }
}

function delta(from: ComposeCommandPoint, to: ComposeCommandPoint): ComposeCommandPoint {
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
 *
 * **`selection` 输入是替换而不是并入**：选择集在 Stage 里已经存在并归宿主所有（选中框、
 * 属性面板、场景树联动、Esc 清空都读它）。会话再攒一份，用户 Shift 移出一个之后宿主那份
 * 少了而会话那份没少，命令会作用在用户已经移出的对象上。
 */
function createTransformSession(
  context: StageDraftingContext,
  options: {
    readonly repeat: boolean
    readonly effect: (
      entityIds: readonly string[],
      offset: ComposeCommandPoint,
    ) => StageDraftingEffect
  },
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  let picked: readonly string[] = context.selection ?? []
  let base: ComposeCommandPoint | null = null
  // 已经选好对象就跳过「选择对象」，直接问基点——这是 AutoCAD 的「先选后执行」。
  let prompt: ComposeCommandPrompt = picked.length > 0
    ? basePrompt(messages)
    : selectPrompt(messages)

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }

      if (input.kind === 'selection') {
        picked = input.ids
        // 选择阶段不给预览：被选中的对象已经由宿主的选中框呈现，再画一层轮廓是重复。
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
        return {
          status: 'prompt',
          prompt,
          preview: { ...options.effect(picked, { x: 0, y: 0 }), reference: base },
        }
      }

      const effect = options.effect(picked, delta(base, input.point))
      if (!options.repeat) return { status: 'commit', effect }
      // 位移始终以**最初的基点**为起点，与 AutoCAD 一致：连续放置时用户心里的参照是那一个
      // 基点，而不是上一个副本的落点。
      return {
        status: 'prompt',
        prompt,
        commit: effect,
        preview: { ...options.effect(picked, { x: 0, y: 0 }), reference: base },
      }
    },
  }
}

/** 建立一次 MOVE 执行的状态机。 @public */
export function createStageMoveSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  return createTransformSession(context, {
    repeat: false,
    effect: (entityIds, offset) => ({ translate: { entityIds, delta: offset } }),
  })
}

/** 建立一次 COPY 执行的状态机。 @public */
export function createStageCopySession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  return createTransformSession(context, {
    repeat: true,
    effect: (entityIds, offset) => ({ duplicate: { entityIds, delta: offset } }),
  })
}

/** MOVE 命令定义。 @public */
export function createStageMoveCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'MOVE',
    aliases: ['M'],
    title: messages.moveTitle,
    start: createStageMoveSession,
  }
}

/** COPY 命令定义。 @public */
export function createStageCopyCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'COPY',
    aliases: ['CO'],
    title: messages.copyTitle,
    start: createStageCopySession,
  }
}
