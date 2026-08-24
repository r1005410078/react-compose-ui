import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeCurve,
  getComposeLayoutItem,
  getComposeLock,
  translateComposeCurve,
} from '@compose-ui/core'
import {
  applyStageCurveGrip,
  stageCurveBoxGeometry,
  stageCurveGrips,
  stageCurveLocalPoint,
  stageCurveOutline,
} from '@compose-ui/stage-engine'
import type { ComposeCurve, ComposeDocument, JsonValue } from '@compose-ui/core'
import type { StageEditablePath, StagePoint, StageSceneIndex } from '@compose-ui/stage-engine'
import type { ComposeStageDispatch, ComposeStageEditablePathChange, ComposeStageTool } from '../types'

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
  /** 与绘图命令**同一条**落点解算；分叉的症状是「画线时吸端点、拖顶点时不吸」。 */
  readonly resolvePoint: (world: StagePoint) => StagePoint
  readonly label: (name: string) => string
}

/** {@link useStageGeometryEditing} 的返回。 @internal */
export interface StageGeometryEditing {
  /** 正在几何编辑的 Entity；没有会话时为 `null`。 */
  readonly entityId: string | null
  /** 会话的夹点与轮廓，交给既有的可编辑路径覆盖层渲染。 */
  readonly editablePath: StageEditablePath | null
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
    document, index, dispatch, idFactory, selectedIds, tool, hostPathActive, resolvePoint, label,
  } = options
  const [target, setTarget] = useState<string | null>(null)
  /** 拖动期间的盒局部预览几何；文档要等松手才动。 */
  const [preview, setPreview] = useState<ComposeCurve | null>(null)

  const isGeometryEditable = useCallback((candidate: string) => {
    const entity = document.entities[candidate]
    return Boolean(entity && getComposeCurve(entity) && !getComposeLock(entity).locked)
  }, [document])

  const exit = useCallback(() => {
    setTarget(null)
    setPreview(null)
  }, [])

  const enter = useCallback((candidate: string) => {
    if (hostPathActive) return
    setTarget(candidate)
    setPreview(null)
  }, [hostPathActive])

  // 会话的存续**在渲染时求值**而不是靠 effect 去清状态：点空白、选中别的对象、换工具、撤销
  // 删掉目标都表现为这几个输入的变化，派生一次就全覆盖了，而 effect 版本要多渲染一帧才收敛。
  const entityId = target !== null
    && selectedIds.includes(target)
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

  /** 求解一次落点：解算 → 盒局部 → 应用夹点。 */
  const latest = useRef({ document, index, resolvePoint })
  useLayoutEffect(() => {
    latest.current = { document, index, resolvePoint }
  })
  const solve = useCallback((target: string, gripId: string, world: StagePoint) => {
    const current = latest.current
    const geometry = stageCurveBoxGeometry(current.document, current.index, target)
    if (!geometry) return null
    const local = stageCurveLocalPoint(current.index, target, current.resolvePoint(world))
    return local ? applyStageCurveGrip(geometry, gripId, local) : null
  }, [])

  const handlePathChange = useCallback((change: ComposeStageEditablePathChange) => {
    if (entityId === null || hostPathActive) return false
    if (change.phase === 'cancel') {
      setPreview(null)
      return true
    }
    const next = solve(entityId, change.vertexId, change.worldPoint)
    if (change.phase !== 'end') {
      // 开始阶段也解一次：按下即吸附，用户不必先移动一下才看到落点。
      if (next) setPreview(next)
      return true
    }
    setPreview(null)
    if (!next) return true
    const entity = latest.current.document.entities[entityId]
    const offset = entity ? getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 } : { x: 0, y: 0 }
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId,
        // 载荷是 parent 局部坐标；盒与几何由那条唯一漏斗重新归一化，越界不需要钳制。
        curve: translateComposeCurve(next, offset.x, offset.y) as unknown as JsonValue,
      },
      meta: {
        label: label(entity?.name ?? ''),
        source: 'stage',
        targetIds: [entityId],
      },
    })
    return true
  }, [dispatch, entityId, hostPathActive, idFactory, label, solve])

  return { entityId, editablePath, isGeometryEditable, enter, exit, handlePathChange }
}
