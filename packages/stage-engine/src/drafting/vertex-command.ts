import type {
  ComposeCommandDefinition,
  ComposeCommandPrompt,
  ComposeCommandSession,
  ComposeCommandStep,
} from '@compose-ui/commands'
import type {
  StageDraftingContext,
  StageDraftingEffect,
  StageDraftingMessages,
  StageGripTarget,
} from './drafting-types'

/**
 * 建立一次夹点取点。
 *
 * @remarks
 * **一点会话**，与 `LINE` 的第二点同形。它由手势启动而不由词启动，因此不注册进命令词汇表
 * ——注册一个只有在夹点点亮时才活的词，只会让命令面板多出一条用户敲不动的项。这不与
 * 「命令行只认一份词汇表」冲突：那条约束的对象是**动作**，而本会话是一个手势的中间态。
 *
 * 会话自己不碰几何：落点原样装进效果，由规划那一步应用到夹点上。拖动、点亮后取点与点亮后
 * 键入坐标因此汇到同一处求解，撤销粒度对三者相同。
 *
 * @public
 */
export function createStageGripSession(
  messages: StageDraftingMessages,
  target: StageGripTarget,
): ComposeCommandSession<StageDraftingEffect> {
  // 提示恒定：取到点即结束，没有第二步可走。
  //
  // `polar`：会话的参照点就是 `reference`（缺席时是夹点的原位置），两个数读作「离参照多远、
  // 往哪边」。
  //
  // `constrain` 原样进提示：钉死角度约束这件事由**提示**声明，宿主的落点解算只认这一个字段，
  // 夹点会话因此与 `WIRE` 的第二个点走同一条解算。
  const prompt: ComposeCommandPrompt = {
    message: messages.specifyNewLocation,
    accepts: ['point'],
    fields: 'polar',
    ...(target.constrain ? { constrain: target.constrain } : {}),
  }
  const { entityId, gripId, origin } = target
  let done = false
  return {
    get prompt() {
      return done ? null : prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'point') {
        done = true
        // 效果只带规划要用的三样加落点：约束与参照是取点期的事，点已经取到了。
        return { status: 'commit', effect: { curveGrip: { entityId, gripId, origin, point: input.point } } }
      }
      return { status: 'rejected', message: messages.expectedPoint }
    },
  }
}

/**
 * 选择对象的提示。
 *
 * @remarks
 * 候选多于一个时换一句话说清楚原因。几何编辑是单对象作用域，而此刻用户手上正好有一份不能
 * 用的选择集——泛泛地说「选择对象」会让他以为自己还没选。
 */
function selectPrompt(messages: StageDraftingMessages, count: number): ComposeCommandPrompt {
  return {
    message: count > 1 ? messages.expectedSingleObject : messages.selectObjects,
    accepts: ['selection'],
  }
}

/**
 * 建立一次 VERTEX 执行的状态机。
 *
 * @remarks
 * 与 `ERASE` 是同一条**两次序共用**的状态机：启动上下文里已经选好一个可编辑对象就当场提交，
 * 没选好就提示选择对象并消费宿主喂进来的选择集。
 *
 * 候选不是恰好一个时以 `rejected` 表达而不是什么都不做：命令行的三种拒绝必须互相可分，
 * 「敲了没反应」与敲错字在屏幕上无法区分。
 *
 * @public
 */
export function createStageVertexSession(
  context: StageDraftingContext,
): ComposeCommandSession<StageDraftingEffect> {
  const { messages } = context
  const editable = (ids: readonly string[]) => (
    context.isGeometryEditable ? ids.filter(context.isGeometryEditable) : ids
  )
  let picked = editable(context.selection ?? [])
  let prompt: ComposeCommandPrompt | null = picked.length === 1
    ? null
    : selectPrompt(messages, picked.length)

  const commit = (): ComposeCommandStep<StageDraftingEffect> => {
    const target = picked.length === 1 ? picked[0] : undefined
    if (target === undefined) {
      return { status: 'rejected', message: messages.expectedSingleObject }
    }
    return { status: 'commit', effect: { enterGeometryEditing: target } }
  }

  return {
    get prompt() {
      return prompt
    },
    advance(input): ComposeCommandStep<StageDraftingEffect> {
      if (input.kind === 'cancel') return { status: 'cancelled' }
      if (input.kind === 'selection') {
        // 替换而不是并入：选择集归宿主，会话只是镜像。
        picked = editable(input.ids)
        prompt = selectPrompt(messages, picked.length)
        return { status: 'prompt', prompt }
      }
      if (input.kind === 'accept') return commit()
      return { status: 'rejected', message: messages.expectedSelection }
    },
  }
}

/** VERTEX 命令定义。 @public */
export function createStageVertexCommand(
  messages: StageDraftingMessages,
): ComposeCommandDefinition<StageDraftingContext, StageDraftingEffect> {
  return {
    id: 'VERTEX',
    aliases: ['VE'],
    title: messages.vertexTitle,
    category: messages.editCategory,
    start: createStageVertexSession,
  }
}
