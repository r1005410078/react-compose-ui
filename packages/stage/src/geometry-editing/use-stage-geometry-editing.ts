import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getComposeCurve, getComposeLock } from '@compose-ui/core'
import {
  applyStageCurveGrip,
  stageCurveBoxGeometry,
  stageCurveGrips,
  stageCurveLocalPoint,
  stageCurveOutline,
} from '@compose-ui/stage-engine'
import type { ComposeCurve, ComposeDocument } from '@compose-ui/core'
import type {
  StageEditablePath,
  StageGripTarget,
  StagePoint,
  StageSceneIndex,
} from '@compose-ui/stage-engine'
import type { ComposeStageEditablePathChange, ComposeStageTool } from '../types'

/**
 * 把一个**已经解算过**的世界落点应用到某个夹点上。
 *
 * @remarks
 * 拖动期与点亮期共用它：两处各写一遍的话，下一个改夹点数学的人只会改到其中一处，而漏掉的
 * 那处症状是「拖出来的和点出来的形状不一样」。写成模块级纯函数，因为两个调用点拿 `document`
 * 与 `index` 的方式不同——渲染期直接读，事件回调走 ref。
 */
function applyGripAt(
  document: ComposeDocument,
  index: StageSceneIndex,
  entityId: string,
  gripId: string,
  world: StagePoint,
): ComposeCurve | null {
  const geometry = stageCurveBoxGeometry(document, index, entityId)
  if (!geometry) return null
  const local = stageCurveLocalPoint(index, entityId, world)
  return local ? applyStageCurveGrip(geometry, gripId, local) : null
}

/**
 * 几何编辑要用到的那一小片命令会话。
 *
 * @remarks
 * 会话本身住在绘图 Hook 里——提示、橡皮筋、捕捉标记与键入坐标都在那边。这里只需要能启动它、
 * 喂一个落点、取消它，以及知道此刻被作用的是哪个夹点。两个 Hook 因此仍然只有一条依赖方向，
 * 由 Stage 用 ref 打断循环。
 *
 * @internal
 */
export interface StageGeometryCommandSession {
  readonly start: (target: StageGripTarget) => void
  readonly pick: (world: StagePoint) => void
  readonly cancel: () => void
  readonly clearNotice: () => void
}

/** {@link useStageGeometryEditing} 的输入。 @internal */
export interface StageGeometryEditingOptions {
  readonly document: ComposeDocument
  readonly index: StageSceneIndex
  /** 夹点取点的命令会话；见 {@link StageGeometryCommandSession}。 */
  readonly session: StageGeometryCommandSession
  /**
   * 已点亮的夹点 id；没有会话时为 `null`。
   *
   * @remarks
   * 事实来源在会话那一侧（拖动与点亮共用它）。这里只用来决定点亮期要不要出预览。
   */
  readonly armedGripId: string | null
  /**
   * 解算后的世界落点；点亮期的预览钉在它上面。
   *
   * @remarks
   * **不能在这里重新解算一遍**：十字线、橡皮筋终点与捕捉标记读的都是这个值，各算各的会让
   * 预览停在用户不会落笔的地方。指针在图面之外时为 `null`——此时没有落点可言。
   */
  readonly resolvedPointer: StagePoint | null
  readonly selectedIds: readonly string[]
  readonly tool: ComposeStageTool
  /** 宿主传入了自己的可编辑路径；此时不进入几何编辑，覆盖层至多渲染一条路径。 */
  readonly hostPathActive: boolean
  /**
   * 与绘图命令**同一条**落点解算；分叉的症状是「画线时吸端点、拖顶点时不吸」。
   *
   * @remarks
   * 只服务拖动期的本地预览：提交那一步由会话产出效果、由引擎规划成命令，因此不在这里解算。
   */
  readonly resolvePoint: (world: StagePoint) => { readonly point: StagePoint }
}

/** {@link useStageGeometryEditing} 的返回。 @internal */
export interface StageGeometryEditing {
  /** 正在几何编辑的 Entity；没有会话时为 `null`。 */
  readonly entityId: string | null
  /** 会话的夹点与轮廓，交给既有的可编辑路径覆盖层渲染。 */
  readonly editablePath: StageEditablePath | null
  /**
   * 一次指针手势正在进行中。
   *
   * @remarks
   * **不由「有没有预览」派生**：点亮期同样有预览（几何跟着光标走），派生的话点亮会被当成
   * 拖动，热夹点与拾取框跟着一起错。
   */
  readonly dragging: boolean
  readonly isGeometryEditable: (entityId: string) => boolean
  readonly enter: (entityId: string) => void
  readonly exit: () => void
  /** 处理一次夹点手势；返回 false 表示这次手势不属于本会话，应交回宿主。 */
  readonly handlePathChange: (change: ComposeStageEditablePathChange) => boolean
}

/**
 * 曲线的几何编辑会话。
 *
 * @remarks
 * 与画布内文字编辑同构：会话状态住在 Stage 自己这里，进入由交互内核发效果请求，退出的四个
 * 入口里有三个（点空白、选中别的对象、换工具）表现为选区或工具变化，本 Hook 自己就看得见。
 *
 * 拖动**不经过宿主**：曲线几何就是文档本身，而 Stage 已经为 resize、move 与绘制派发命令。
 * 绕道宿主再绕回来只会让编辑器去实现一份它不该知道的曲线数学。
 *
 * @internal
 */
export function useStageGeometryEditing(
  options: StageGeometryEditingOptions,
): StageGeometryEditing {
  const {
    document, index, session, armedGripId, resolvedPointer,
    selectedIds, tool, hostPathActive, resolvePoint,
  } = options
  const [target, setTarget] = useState<string | null>(null)
  /** 拖动期间的盒局部预览几何；文档要等松手才动。 */
  const [preview, setPreview] = useState<ComposeCurve | null>(null)
  /** 一次指针手势在不在进行中；与「有没有预览」是两件事。 */
  const [dragging, setDragging] = useState(false)
  /**
   * 这次手势的按下点、指针后来有没有离开过它，以及这一下算不算一次对夹点的点击。
   *
   * @remarks
   * 前两者把「拖一下」与「点一下」分开：动过就在松手那一刻提交，一步没动则把会话留着、夹点
   * 点亮。判据是**落点有没有变过**而不是一个位移阈值——阈值是本仓库别处都不需要的魔法数。
   * 必须与按下点逐个比较，不能只看「来过 move 没有」：路径手势在 `pointerup` 上也会先发一次
   * `move`（终点与松手修饰键都由那一次带回来），因此原地单击同样会收到一个 move 阶段。
   *
   * `armable` 挡的是**连击中的那一下**：用户单击选中、再双击进入几何编辑时，第三下落在刚
   * 显形、正好压在光标底下的中点夹点上——那显然不是他对这个夹点的点击。手势本身照开（双击
   * 进入之后马上拖中点是常用手法），只是原地松手时取消而不是点亮。计数恰好为 2 的按下到不了
   * 这里，插件把它解释成 corner / smooth 切换。
   */
  const gestureRef = useRef<{
    start: StagePoint
    moved: boolean
    armable: boolean
  } | null>(null)

  const isGeometryEditable = useCallback((candidate: string) => {
    const entity = document.entities[candidate]
    return Boolean(entity && getComposeCurve(entity) && !getComposeLock(entity).locked)
  }, [document])

  const exit = useCallback(() => {
    setTarget(null)
    setPreview(null)
    setDragging(false)
    gestureRef.current = null
  }, [])

  const enter = useCallback((candidate: string) => {
    if (hostPathActive) return
    setTarget(candidate)
    setPreview(null)
    setDragging(false)
    gestureRef.current = null
    // 用户此刻站在一个会取点的状态里；上一条命令留下的说明在讲一件已经过去的事。
    session.clearNotice()
  }, [hostPathActive, session])

  // 会话的存续**在渲染时求值**而不是靠 effect 去清状态：点空白、选中别的对象、换工具、撤销
  // 删掉目标都表现为这几个输入的变化，派生一次就全覆盖了，而 effect 版本要多渲染一帧才收敛。
  //
  // 条件是选中集**恰好只有目标**，不是「包含目标」：会话是单对象作用域。它的全部呈现
  // （夹点、轮廓、十字光标、被排除出捕捉的那一个 Entity）都只描述一个对象，而会话又抑制了
  // 选区包围盒与手柄——Shift 累加进来的第二个对象因此在图面上完全隐身，它明明被选中了。
  const entityId = target !== null
    && selectedIds.length === 1
    && selectedIds[0] === target
    && isGeometryEditable(target)
    && tool === 'select'
    && !hostPathActive
    ? target
    : null

  /**
   * 求解一次**预览**落点：解算 → 盒局部 → 应用夹点。
   *
   * @remarks
   * 只画预览。提交那一步走会话与引擎规划，与点亮后取点、点亮后键入坐标同一条路——三条各自
   * 算一遍的话，下一个改夹点数学的人只会改到其中一处。
   */
  const latest = useRef({ document, index, resolvePoint, session })
  useLayoutEffect(() => {
    latest.current = { document, index, resolvePoint, session }
  })
  /** 拖动期：裸落点先过点输入管线，再应用。点亮期不走这里——那边的落点已经解算过了。 */
  const solve = useCallback((target: string, gripId: string, world: StagePoint) => {
    const current = latest.current
    return applyGripAt(
      current.document, current.index, target, gripId, current.resolvePoint(world).point,
    )
  }, [])

  /**
   * 点亮期的预览：几何跟着光标走。
   *
   * @remarks
   * 只画一条橡皮筋是不够的——用户看不到「点下去会变成什么样」，而那条从旧位置指向光标的直线
   * 只在直线端点上勉强像结果，在弧的半径夹点、多段线顶点与直线的平移夹点上说的完全是另一
   * 回事。这与拖动期共用 `applyAt`：两处各写一遍的话，下一个改夹点数学的人只会改到其中一处。
   *
   * 拖动中不出：那一档由手势自己的本地预览承担，重算一遍等于两个来源抢同一块画面。
   */
  const armedPreview = useMemo(() => {
    if (entityId === null || armedGripId === null || dragging || !resolvedPointer) return null
    // 读渲染期的 `document` / `index` 而不是那条 ref：预览是渲染的产物，而 ref 要到布局
    // effect 才更新——读它等于让预览慢一帧，React 也不允许在渲染期访问 ref。
    return applyGripAt(document, index, entityId, armedGripId, resolvedPointer)
  }, [armedGripId, document, dragging, entityId, index, resolvedPointer])
  /** 两者互斥：拖动时只有 `preview`，点亮时只有 `armedPreview`。 */
  const activePreview = preview ?? armedPreview

  const editablePath = useMemo((): StageEditablePath | null => {
    if (entityId === null || hostPathActive) return null
    const grips = stageCurveGrips(document, index, entityId, activePreview)
    if (grips.length === 0) return null
    return {
      entityId,
      polyline: stageCurveOutline(document, index, entityId, activePreview),
      // 等时采样点表达速度快慢，那是运动路径的语义；几何没有时间。
      dots: [],
      vertices: grips.map((grip) => ({
        id: grip.id,
        point: grip.point,
        // 曲线词汇里没有三次段，因此没有切线手柄可给。
        inTangent: null,
        outTangent: null,
        mode: 'corner' as const,
        // 角色与方向角原样带上：覆盖层照它画形状，不认识多段线。
        role: grip.role,
        ...(grip.angle === undefined ? {} : { angle: grip.angle }),
      })),
    }
  }, [activePreview, document, entityId, hostPathActive, index])

  const handlePathChange = useCallback((change: ComposeStageEditablePathChange) => {
    if (entityId === null || hostPathActive) return false
    const current = latest.current
    if (change.phase === 'cancel') {
      setPreview(null)
      setDragging(false)
      gestureRef.current = null
      current.session.cancel()
      return true
    }
    if (change.phase === 'start') {
      // 会话在 `pointerdown` 就开：提示要在用户按住的**那一刻**出现，等他动或不动才给已经迟了。
      // `origin` 取**文档**里的位置——它同时是橡皮筋起点与被排除出捕捉的那一个点。
      const grip = stageCurveGrips(current.document, current.index, entityId)
        .find(({ id }) => id === change.vertexId)
      if (!grip) return true
      gestureRef.current = {
        start: change.worldPoint,
        moved: false,
        armable: (change.clickCount ?? 1) <= 1,
      }
      setDragging(true)
      current.session.start({ entityId, gripId: change.vertexId, origin: grip.point })
      // 按下即解一次：用户不必先移动一下才看到落点。
      const preview = solve(entityId, change.vertexId, change.worldPoint)
      if (preview) setPreview(preview)
      return true
    }
    const gesture = gestureRef.current
    if (gesture
      && (change.worldPoint.x !== gesture.start.x || change.worldPoint.y !== gesture.start.y)) {
      gesture.moved = true
    }
    if (change.phase === 'move') {
      const preview = solve(entityId, change.vertexId, change.worldPoint)
      if (preview) setPreview(preview)
      return true
    }
    // 松手：动过就提交并结束会话，一步没动则把会话留着、夹点保持点亮。
    setPreview(null)
    setDragging(false)
    gestureRef.current = null
    if (gesture?.moved) current.session.pick(change.worldPoint)
    else if (gesture && !gesture.armable) current.session.cancel()
    return true
  }, [entityId, hostPathActive, solve])

  return {
    entityId,
    editablePath,
    dragging: entityId !== null && dragging,
    isGeometryEditable,
    enter,
    exit,
    handlePathChange,
  }
}
