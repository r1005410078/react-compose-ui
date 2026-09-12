import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  applyStageCurveGrip,
  isStageInteriorVertexGrip,
  stageCurveBoxGeometry,
  stageCurveGripNeighbor,
  stageCurveGrips,
  stageCurveLocalPoint,
  stageCurveOutline,
} from '@compose-ui/stage-engine'
import { isStageWireEntity } from '../drafting/wire-tap'
import type { ComposeCurve } from '@compose-ui/core'
import type {
  StageCurveGeometrySource,
  StageEditablePath,
  StageGripTarget,
  StagePoint,
} from '@compose-ui/stage-engine'
import type { ComposeStageEditablePathChange, ComposeStageTool } from '../types'
import { isComposeEntityGeometryEditable } from './geometry-editable'

/**
 * 把一个**已经解算过**的世界落点应用到某个夹点上。
 *
 * @remarks
 * 拖动期与点亮期共用它：两处各写一遍的话，下一个改夹点数学的人只会改到其中一处，而漏掉的
 * 那处症状是「拖出来的和点出来的形状不一样」。写成模块级纯函数，因为两个调用点拿几何来源的
 * 方式不同——渲染期直接读，事件回调走 ref。
 */
function applyGripAt(
  source: StageCurveGeometrySource,
  entityId: string,
  gripId: string,
  world: StagePoint,
  breakSymmetry = false,
): ComposeCurve | null {
  const geometry = stageCurveBoxGeometry(source, entityId)
  if (!geometry) return null
  const local = stageCurveLocalPoint(source, entityId, world)
  // 导线的每一段都必须保持轴对齐；判据与夹点会话、Preset、端口捕捉读的是同一个答案。
  const axisAligned = isStageWireEntity(source.document.entities[entityId])
  return local
    ? applyStageCurveGrip(geometry, gripId, local, { breakSymmetry, axisAligned })
    : null
}

/**
 * 一次路径手势对应的夹点 id。
 *
 * @remarks
 * 可编辑路径把切线手势报成「顶点 id + 哪一侧」，而曲线夹点的求解手上只有一个 id：后缀在这里
 * 合上，反查由 `stageCurveGripVertexId` 拆开。两处读同一份 id 语法，语法本身住在引擎里。
 */
function gripIdOf(change: ComposeStageEditablePathChange): string {
  if (change.handle === 'tangent-in') return `${change.vertexId}i`
  if (change.handle === 'tangent-out') return `${change.vertexId}o`
  return change.vertexId
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
  /**
   * 曲线几何的来源。
   *
   * @remarks
   * 宿主传的是**预览**文档：夹点与轮廓画在对象身上，拖动整条曲线时它们必须跟着一起走。
   * 夹点自己的拖动不受影响——那一档没有预览覆盖（路径插件不产出 `previewTransforms`），
   * 预览来源与已提交的那份逐字相同。
   */
  readonly geometry: StageCurveGeometrySource
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
    geometry, session, armedGripId, resolvedPointer,
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

  const isGeometryEditable = useCallback(
    (candidate: string) => isComposeEntityGeometryEditable(geometry.document.entities[candidate]),
    [geometry],
  )

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
  const latest = useRef({ geometry, resolvePoint, session })
  useLayoutEffect(() => {
    latest.current = { geometry, resolvePoint, session }
  })
  /** 拖动期：裸落点先过点输入管线，再应用。点亮期不走这里——那边的落点已经解算过了。 */
  const solve = useCallback((
    target: string,
    gripId: string,
    world: StagePoint,
    breakSymmetry: boolean,
  ) => {
    const current = latest.current
    return applyGripAt(
      current.geometry,
      target,
      gripId,
      current.resolvePoint(world).point,
      breakSymmetry,
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
    // 读渲染期的 `geometry` 而不是那条 ref：预览是渲染的产物，而 ref 要到布局 effect 才
    // 更新——读它等于让预览慢一帧，React 也不允许在渲染期访问 ref。
    return applyGripAt(geometry, entityId, armedGripId, resolvedPointer)
  }, [armedGripId, dragging, entityId, geometry, resolvedPointer])
  /** 两者互斥：拖动时只有 `preview`，点亮时只有 `armedPreview`。 */
  const activePreview = preview ?? armedPreview

  const editablePath = useMemo((): StageEditablePath | null => {
    if (entityId === null || hostPathActive) return null
    const all = stageCurveGrips(geometry, entityId, activePreview)
    /*
     * 导线不画内部拐点的顶点夹点：正交折线上一个内部拐点的两根轴各被一条相邻段钉死，它一个
     * 自由度都没有——留一个拖不动的方块比不留更糟（屏幕上不该出现一个鼠标动了也没反应的
     * 状态），而让它能动就等于让相邻那一段变斜。改形状的入口是段夹点，加拐点的入口仍是在段上
     * 双击插入顶点。
     */
    const shape = activePreview ?? stageCurveBoxGeometry(geometry, entityId)
    const hideInterior = shape !== null
      && isStageWireEntity(geometry.document.entities[entityId])
    const grips = hideInterior
      ? all.filter((grip) => !isStageInteriorVertexGrip(shape, grip.id))
      : all
    if (grips.length === 0) return null
    return {
      entityId,
      polyline: stageCurveOutline(geometry, entityId, activePreview),
      // 等时采样点表达速度快慢，那是运动路径的语义；几何没有时间。
      dots: [],
      vertices: grips.map((grip) => ({
        id: grip.id,
        point: grip.point,
        // `path` 的顶点两侧有控制点，走既有的切线手柄通道：那条通道本来就画「一个小圆加一根
        // 连到顶点的杆」。其余 kind 没有三次段，两侧都是 null。
        inTangent: grip.inTangent ?? null,
        outTangent: grip.outTangent ?? null,
        /*
         * 有控制点的顶点报 `smooth`，覆盖层因此**在会话里一直画**它的手柄。
         *
         * 曾经只画「正在被会话作用着的那个顶点」的，理由是密度；那条**行不通**：点亮的语义
         * 是「下一次按下就是取点」，于是按向手柄的那一下会先被点亮的会话吃掉，提交成一次顶点
         * 移动——手柄永远按不到。悬停显形有同一个毛病（指针离开顶点手柄就没了），这两条是同
         * 一个可达性问题的两种说法。
         *
         * 运动路径那一头不受影响：它的顶点两侧都是 `null`，仍然报 `corner`。
         */
        mode: (grip.inTangent ?? grip.outTangent) ? 'smooth' as const : 'corner' as const,
        // 角色与方向角原样带上：覆盖层照它画形状，不认识多段线。
        role: grip.role,
        ...(grip.angle === undefined ? {} : { angle: grip.angle }),
      })),
    }
  }, [activePreview, entityId, geometry, hostPathActive])

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
      const grip = stageCurveGrips(current.geometry, entityId)
        .find(({ id }) => id === change.vertexId)
      if (!grip) return true
      // 拖的是控制点时，橡皮筋与被排除出捕捉的那一个点都该是**它**，不是它挂着的顶点。
      const origin = change.handle === 'tangent-in'
        ? grip.inTangent ?? grip.point
        : change.handle === 'tangent-out'
          ? grip.outTangent ?? grip.point
          : grip.point
      gestureRef.current = {
        start: change.worldPoint,
        moved: false,
        armable: (change.clickCount ?? 1) <= 1,
      }
      setDragging(true)
      /*
       * 导线的夹点会话钉死正交：画线时从第二个点起钉住的规范，进了顶点模式不该凭空消失——
       * 用户拖一下端点就得到一条斜导线，而那是一张画错的图。钉的是提示里的那一档，管线次序
       * 原样成立：捕捉到端口仍然短路（改接线不受影响），键入的坐标仍然不被改写。
       *
       * 端点的参照是**相邻顶点**（那一段因此始终横平竖直，与画线时相对上一点同一件事）；
       * 内部顶点与段中点没有唯一的上一点，参照留在原位置——顶点只沿一根轴走，段只沿一根轴
       * 平移，与 AutoCAD 的 ORTHO 相对夹点基点一致。
       */
      const gripId = gripIdOf(change)
      const wire = isStageWireEntity(current.geometry.document.entities[entityId])
      const neighbor = wire ? stageCurveGripNeighbor(current.geometry, entityId, gripId) : null
      /*
       * 段夹点那一档**不钉角度约束**：它的几何本身只剩一个自由度（位移只取垂直于该段的
       * 分量），再钉一次正交，沿段方向的那半边拖动就什么都不发生——而屏幕上没有任何东西
       * 解释为什么。顶点夹点相反，它由落点决定，因此照旧钉住。
       */
      const pinned = wire && grip.role !== 'segment'
      current.session.start({
        entityId,
        gripId,
        origin,
        ...(wire ? { axisAligned: true } : {}),
        ...(pinned ? { constrain: 'ortho' as const } : {}),
        ...(neighbor ? { reference: neighbor } : {}),
      })
      // 按下即解一次：用户不必先移动一下才看到落点。
      const preview = solve(entityId, gripId, change.worldPoint, change.modifiers.alt)
      if (preview) setPreview(preview)
      return true
    }
    const gesture = gestureRef.current
    if (gesture
      && (change.worldPoint.x !== gesture.start.x || change.worldPoint.y !== gesture.start.y)) {
      gesture.moved = true
    }
    if (change.phase === 'move') {
      // `Alt` 每一帧都重读：用户可以拖到一半才按下它，而对称与否是这一帧的事。
      const preview = solve(entityId, gripIdOf(change), change.worldPoint, change.modifiers.alt)
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
