import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeCurve,
  getComposeLayoutItem,
  getComposeLock,
  getComposeWire,
  translateComposeCurve,
} from '@compose-ui/core'
import {
  applyStageCurveGrip,
  stageCurveBoxGeometry,
  stageCurveGrips,
  stageCurveLocalPoint,
  stageCurveOutline,
} from '@compose-ui/stage-engine'
import type {
  ComposeCurve,
  ComposeDocument,
  ComposeEntity,
  ComposeWire,
  ComposeWireBinding,
  JsonValue,
} from '@compose-ui/core'
import type { StageEditablePath, StagePoint, StageSceneIndex } from '@compose-ui/stage-engine'
import type { ComposeStageDispatch, ComposeStageEditablePathChange, ComposeStageTool } from '../types'

/** 直线两端的夹点 id；只有它们能承载导线绑定。 */
const WIRE_ENDS: Readonly<Record<string, 'start' | 'end'>> = { start: 'start', end: 'end' }

/**
 * 求出拖完这一下之后的 `Wire`。
 *
 * @remarks
 * 落在端口上就绑到它，落在别处就把这一端解绑——这是改错接线的唯一入口。两端都变自由时返回
 * `null`（删掉整个 Component）：一条谁也没接的线与普通线没有任何差别，留个空壳读不出意图。
 *
 * @returns `undefined` 表示这次拖动与接线无关，命令因此不带 `wire` 字段。
 */
function nextWireFor(
  entity: ComposeEntity | undefined,
  gripId: string,
  port: ComposeWireBinding | undefined,
): ComposeWire | null | undefined {
  const end = WIRE_ENDS[gripId]
  if (!end) return undefined
  const current = getComposeWire(entity)
  if (!current && !port) return undefined
  const next: ComposeWire = {
    ...(current ?? {}),
    ...(port ? { [end]: port } : {}),
  }
  if (!port && current) {
    // 显式删掉这一端：展开赋值改不掉已经存在的键。
    delete (next as Record<string, unknown>)[end]
  }
  return next.start || next.end ? next : null
}

/** {@link useStageGeometryEditing} 的输入。 @internal */
export interface StageGeometryEditingOptions {
  readonly document: ComposeDocument
  readonly index: StageSceneIndex
  readonly dispatch: ComposeStageDispatch
  readonly idFactory: () => string
  readonly selectedIds: readonly string[]
  readonly tool: ComposeStageTool
  /** 宿主传入了自己的可编辑路径；此时不进入几何编辑，覆盖层至多渲染一条路径。 */
  readonly hostPathActive: boolean
  /**
   * 与绘图命令**同一条**落点解算；分叉的症状是「画线时吸端点、拖顶点时不吸」。
   *
   * @remarks
   * 返回值带上落点的来源：导线的「拖到端口上就绑、拖到别处就解绑」读它，因此改接线与落点
   * 出自同一次捕捉。
   */
  readonly resolvePoint: (world: StagePoint) => {
    readonly point: StagePoint
    readonly port?: ComposeWireBinding
  }
  readonly label: (name: string) => string
}

/** {@link useStageGeometryEditing} 的返回。 @internal */
export interface StageGeometryEditing {
  /** 正在几何编辑的 Entity；没有会话时为 `null`。 */
  readonly entityId: string | null
  /** 会话的夹点与轮廓，交给既有的可编辑路径覆盖层渲染。 */
  readonly editablePath: StageEditablePath | null
  /**
   * 正在拖某个夹点。
   *
   * @remarks
   * 拾取框读它：未拖动的会话正是「等着抓点什么」的状态，框表达可抓的靶区；一旦抓住，
   * 那件事已经发生，框只会挡住落点。事实来源就是拖动期的本地预览几何，不另存一份状态。
   */
  readonly dragging: boolean
  readonly isGeometryEditable: (entityId: string) => boolean
  readonly enter: (entityId: string) => void
  readonly exit: () => void
  /**
   * 拖动期间不参与捕捉的那**一个**世界点：被拖顶点的**原**位置。
   *
   * @remarks
   * 它就在指针底下，不排除的话夹点会被吸回原处。排除**只到这一个点**——做成整个 Entity 会把
   * 同对象的其他顶点与各段中点一起收走，而「把这个角对到那个角上」正是最常做的事。
   *
   * 读的是**文档**几何而不是拖动预览：要挡的是它出发的地方，不是它此刻跟着指针到的地方。
   *
   * 未拖动时为 `null`：此刻没有任何一个点在指针底下等着把它吸回去，那条理由不成立。
   */
  readonly snapExcludedPoint: StagePoint | null
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
    document, index, dispatch, idFactory, selectedIds, tool, hostPathActive, resolvePoint, label,
  } = options
  const [target, setTarget] = useState<string | null>(null)
  /** 拖动期间的盒局部预览几何；文档要等松手才动。 */
  const [preview, setPreview] = useState<ComposeCurve | null>(null)
  /** 正在拖的夹点 id；点级排除按它反查那个顶点的原位置。 */
  const [dragVertexId, setDragVertexId] = useState<string | null>(null)

  const isGeometryEditable = useCallback((candidate: string) => {
    const entity = document.entities[candidate]
    return Boolean(entity && getComposeCurve(entity) && !getComposeLock(entity).locked)
  }, [document])

  const exit = useCallback(() => {
    setTarget(null)
    setPreview(null)
    setDragVertexId(null)
  }, [])

  const enter = useCallback((candidate: string) => {
    if (hostPathActive) return
    setTarget(candidate)
    setPreview(null)
    setDragVertexId(null)
  }, [hostPathActive])

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

  const editablePath = useMemo((): StageEditablePath | null => {
    if (entityId === null || hostPathActive) return null
    const grips = stageCurveGrips(document, index, entityId, preview)
    if (grips.length === 0) return null
    return {
      entityId,
      polyline: stageCurveOutline(document, index, entityId, preview),
      // 等时采样点表达速度快慢，那是运动路径的语义；几何没有时间。
      dots: [],
      vertices: grips.map((grip) => ({
        id: grip.id,
        point: grip.point,
        // 曲线词汇里没有三次段，因此没有切线手柄可给。
        inTangent: null,
        outTangent: null,
        mode: 'corner' as const,
      })),
    }
  }, [document, entityId, hostPathActive, index, preview])

  const snapExcludedPoint = useMemo((): StagePoint | null => {
    if (entityId === null || dragVertexId === null) return null
    // 不传 override：要的是**文档**里那个顶点的位置，也就是它出发的地方。
    const grip = stageCurveGrips(document, index, entityId)
      .find(({ id }) => id === dragVertexId)
    return grip?.point ?? null
  }, [document, dragVertexId, entityId, index])

  /** 求解一次落点：解算 → 盒局部 → 应用夹点。 */
  const latest = useRef({ document, index, resolvePoint })
  useLayoutEffect(() => {
    latest.current = { document, index, resolvePoint }
  })
  const solve = useCallback((target: string, gripId: string, world: StagePoint) => {
    const current = latest.current
    const geometry = stageCurveBoxGeometry(current.document, current.index, target)
    if (!geometry) return null
    const resolved = current.resolvePoint(world)
    const local = stageCurveLocalPoint(current.index, target, resolved.point)
    const next = local ? applyStageCurveGrip(geometry, gripId, local) : null
    return next ? { curve: next, ...(resolved.port ? { port: resolved.port } : {}) } : null
  }, [])

  const handlePathChange = useCallback((change: ComposeStageEditablePathChange) => {
    if (entityId === null || hostPathActive) return false
    if (change.phase === 'cancel') {
      setPreview(null)
      setDragVertexId(null)
      return true
    }
    // 排除点要在**解算之前**就位，否则手势的第一帧会把落点吸回顶点自己的原处。
    if (change.phase !== 'end' && dragVertexId !== change.vertexId) {
      setDragVertexId(change.vertexId)
    }
    const next = solve(entityId, change.vertexId, change.worldPoint)
    if (change.phase !== 'end') {
      // 开始阶段也解一次：按下即吸附，用户不必先移动一下才看到落点。
      if (next) setPreview(next.curve)
      return true
    }
    setPreview(null)
    setDragVertexId(null)
    if (!next) return true
    const entity = latest.current.document.entities[entityId]
    const offset = entity ? getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 } : { x: 0, y: 0 }
    const wire = nextWireFor(entity, change.vertexId, next.port)
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId,
        // 载荷是 parent 局部坐标；盒与几何由那条唯一漏斗重新归一化，越界不需要钳制。
        curve: translateComposeCurve(next.curve, offset.x, offset.y) as unknown as JsonValue,
        // 改接线与几何写在同一条命令里：分成两条会产生一个可观察的不一致中间态，撤销也变两步。
        ...(wire === undefined ? {} : { wire: wire as unknown as JsonValue }),
      },
      meta: {
        label: label(entity?.name ?? ''),
        source: 'stage',
        targetIds: [entityId],
      },
    })
    return true
  }, [dispatch, dragVertexId, entityId, hostPathActive, idFactory, label, solve])

  return {
    entityId,
    editablePath,
    dragging: entityId !== null && preview !== null,
    snapExcludedPoint,
    isGeometryEditable,
    enter,
    exit,
    handlePathChange,
  }
}
