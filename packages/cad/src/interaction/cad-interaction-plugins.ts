import {
  applyCadSelection,
  cadSelectionBoundsFromDrag,
  cadSelectionModeFromDrag,
} from '../selection'
import type { CadInputPoint } from '../point-input'
import type {
  CadInteractionPlugin,
  CadPluginContext,
  CadPointerDownEvent,
  CadSession,
} from './cad-kernel-profile'

/** 主键；CAD 的三种指针含义都只在主键上竞争。 */
const PRIMARY_BUTTON = 0

/**
 * CAD 的手势优先级表。
 *
 * @remarks
 * 同一次左键按下在 CAD 里有四种互斥含义：交给活动命令当一个点、拖动已选中的图元、点中图元、
 * 在空白处拉框。
 * 谁赢必须是**声明出来的**，不是实现里 `if` 的书写顺序——顺序写错会静默改变行为，没有可见
 * 的失败。
 *
 * @public
 */
export const CAD_GESTURE_PRIORITY = [
  { id: 'cad.command-point', priority: 30 },
  { id: 'cad.move', priority: 25 },
  { id: 'cad.select', priority: 20 },
  { id: 'cad.marquee', priority: 10 },
] as const

/** 命令取点插件的 id。 @public */
export const CAD_COMMAND_POINT_PLUGIN_ID = 'cad.command-point'
/** 拖动移动插件的 id。 @public */
export const CAD_MOVE_PLUGIN_ID = 'cad.move'
/** 点选插件的 id。 @public */
export const CAD_SELECT_PLUGIN_ID = 'cad.select'
/** 框选插件的 id。 @public */
export const CAD_MARQUEE_PLUGIN_ID = 'cad.marquee'

function priorityOf(id: string) {
  return CAD_GESTURE_PRIORITY.find((entry) => entry.id === id)!.priority
}

/**
 * 活动命令正等待取点时，把这次按下交给命令。
 *
 * @remarks
 * 优先级最高：命令进行中点击图元不该改变选择集——AutoCAD 里画线时点到一条既有线，得到的是
 * 一个顶点（可能还带捕捉），不是把那条线选中。
 *
 * 返回 `'consumed'` 而不是会话：取点是一次性的，不产生拖拽。
 *
 * @public
 */
export function createCadCommandPointPlugin(): CadInteractionPlugin {
  return {
    id: CAD_COMMAND_POINT_PLUGIN_ID,
    priority: priorityOf(CAD_COMMAND_POINT_PLUGIN_ID),
    claim(event, ctx) {
      if (event.button !== PRIMARY_BUTTON) return null
      if (!ctx.context.prompt?.accepts.includes('point')) return null
      ctx.apply([{ kind: 'command.point', point: event.point }])
      return 'consumed'
    },
  }
}

/**
 * 点中图元时更新选择集。
 *
 * @remarks
 * **语义按 AutoCAD**：点中即加入（不需要修饰键），Shift 是移出。见 `applyCadSelection`。
 *
 * 活动命令正等待选择对象时，选中的结果还要**同时**喂给命令——这就是「先执行后选」：
 * `E↵` 之后的每一次点选都在给 ERASE 攒对象。
 *
 * @public
 */
export function createCadSelectPlugin(): CadInteractionPlugin {
  return {
    id: CAD_SELECT_PLUGIN_ID,
    priority: priorityOf(CAD_SELECT_PLUGIN_ID),
    claim(event, ctx) {
      if (event.button !== PRIMARY_BUTTON) return null
      const hit = ctx.index.hitTest(event.point)
      if (hit === null) return null

      const selection = applyCadSelection(
        ctx.context.selection,
        event.modifiers.shift ? { kind: 'remove', ids: [hit] } : { kind: 'add', ids: [hit] },
      )
      ctx.publish({ ...ctx.idleSnapshot(), selection })
      if (!event.modifiers.shift && ctx.context.prompt?.accepts.includes('selection')) {
        ctx.apply([{ kind: 'command.selection', ids: [hit] }])
      }
      return 'consumed'
    },
  }
}

/**
 * 拖动**已选中**的图元来移动它。
 *
 * @remarks
 * claim 条件是按下点命中的图元**已经在选择集里**——这正是 AutoCAD 的行为：点未选中的对象是
 * 选中它，点已选中的对象并拖动是移动它。写成「命中任何图元」的话，第一次点击就会变成一次
 * 零位移的移动，用户再也选不中东西。
 *
 * 优先级排在 `cad.select` 之上、`cad.command-point` 之下：命令正在吃点时按下是给命令的一个
 * 点，这一条由顺序天然保证，不需要在这里再判一次。
 *
 * @public
 */
export function createCadMovePlugin(): CadInteractionPlugin {
  return {
    id: CAD_MOVE_PLUGIN_ID,
    priority: priorityOf(CAD_MOVE_PLUGIN_ID),
    claim(event, ctx) {
      if (event.button !== PRIMARY_BUTTON) return null
      // Shift 是「从选择集移出」的修饰键。不让本插件参与，否则 Shift 点一个已选中的图元会
      // 变成拖动，用户再也无法把它移出选择集。
      if (event.modifiers.shift) return null
      const hit = ctx.index.hitTest(event.point)
      if (hit === null || !ctx.context.selection.includes(hit)) return null
      ctx.apply([{ kind: 'pointer.capture', pointerId: event.pointerId }])
      return createCadMoveSession(event, ctx)
    },
  }
}

/** 建立一次拖动移动会话。 @internal */
function createCadMoveSession(event: CadPointerDownEvent, initial: CadPluginContext): CadSession {
  const origin = event.point
  const moving = [...initial.context.selection]
  let current: CadInputPoint = origin
  const dragged = () => current.x !== origin.x || current.y !== origin.y

  return {
    pointerId: event.pointerId,
    update(next, ctx) {
      if (next.type !== 'pointer.move' && next.type !== 'pointer.up') return
      current = next.point
      ctx.publish({
        selection: moving,
        marquee: null,
        translate: dragged() ? { from: origin, to: current } : null,
      })
    },
    commit(ctx) {
      ctx.apply([{ kind: 'pointer.release', pointerId: event.pointerId }])
      ctx.publish({ selection: moving, marquee: null, translate: null })
      // 原地松手不产生位移：那只是一次点击，文档不该因此进一条撤销记录。
      if (!dragged()) return
      ctx.apply([{ kind: 'entities.translate', ids: moving, from: origin, to: current }])
    },
    cancel(ctx) {
      ctx.apply([{ kind: 'pointer.release', pointerId: event.pointerId }])
      ctx.publish({ selection: moving, marquee: null, translate: null })
    },
  }
}

/**
 * 在空白处按下时拉出选框。
 *
 * @remarks
 * 优先级最低：只有前两者都不要这次按下时才轮到它。这条顺序也解释了为什么「空白」不必由本
 * 插件再判一次——命中图元的按下已经被 `cad.select` 拿走了。
 *
 * **原地松手（没有拉出框）清空选择集**，与 AutoCAD 一致：空窗口选不中任何东西，效果就是取消
 * 当前选择。
 *
 * @public
 */
export function createCadMarqueePlugin(): CadInteractionPlugin {
  return {
    id: CAD_MARQUEE_PLUGIN_ID,
    priority: priorityOf(CAD_MARQUEE_PLUGIN_ID),
    claim(event, ctx) {
      if (event.button !== PRIMARY_BUTTON) return null
      ctx.apply([{ kind: 'pointer.capture', pointerId: event.pointerId }])
      return createCadMarqueeSession(event, ctx)
    },
  }
}

/** 建立一次框选会话。 @internal */
function createCadMarqueeSession(event: CadPointerDownEvent, initial: CadPluginContext): CadSession {
  const origin = event.point
  const baseSelection = initial.context.selection
  let current: CadInputPoint = origin

  const publish = (ctx: CadPluginContext, moved: boolean) => {
    ctx.publish({
      selection: baseSelection,
      marquee: moved
        ? {
            bounds: cadSelectionBoundsFromDrag(origin, current),
            mode: cadSelectionModeFromDrag(origin, current),
          }
        : null,
      translate: null,
    })
  }

  const dragged = () => current.x !== origin.x || current.y !== origin.y

  return {
    pointerId: event.pointerId,
    update(next, ctx) {
      if (next.type !== 'pointer.move' && next.type !== 'pointer.up') return
      current = next.point
      publish(ctx, dragged())
    },
    commit(ctx) {
      ctx.apply([{ kind: 'pointer.release', pointerId: event.pointerId }])
      if (!dragged()) {
        // 原地松手：空窗口选不中任何东西，等同于取消当前选择。
        ctx.publish({ selection: applyCadSelection(baseSelection, { kind: 'clear' }), marquee: null, translate: null })
        return
      }
      const bounds = cadSelectionBoundsFromDrag(origin, current)
      const mode = cadSelectionModeFromDrag(origin, current)
      const ids = ctx.index.hitBounds(bounds, mode)
      const selection = applyCadSelection(baseSelection, { kind: 'add', ids })
      ctx.publish({ selection, marquee: null, translate: null })
      if (ids.length > 0 && ctx.context.prompt?.accepts.includes('selection')) {
        ctx.apply([{ kind: 'command.selection', ids }])
      }
    },
    cancel(ctx) {
      ctx.apply([{ kind: 'pointer.release', pointerId: event.pointerId }])
      ctx.publish({ selection: baseSelection, marquee: null, translate: null })
    },
  }
}

/**
 * CAD 图面的全部交互插件，按优先级排列。
 *
 * @remarks
 * 中键平移**不在其中**：平移改的是视口，而视口是宿主的 React state，不是内核状态。把它做成
 * 插件要把视口塞进内核 context 再加一种视口效果，为一个不与任何人竞争的中键手势付这个代价
 * 不值。但指针归属仍然单线——宿主的所有按下先问仲裁器，被拒绝才走平移分支。
 *
 * @public
 */
export function createCadInteractionPlugins(): readonly CadInteractionPlugin[] {
  return [
    createCadCommandPointPlugin(),
    createCadMovePlugin(),
    createCadSelectPlugin(),
    createCadMarqueePlugin(),
  ]
}
