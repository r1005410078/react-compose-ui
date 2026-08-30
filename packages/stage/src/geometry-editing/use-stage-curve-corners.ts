import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeLayoutItem,
  getComposeLock,
  translateComposeCurve,
  type ComposeCurve,
  type ComposeDocument,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  applyStageCurveCorner,
  stageCurveBoxGeometry,
  stageCurveLocalPoint,
  type StagePoint,
  type StageSceneIndex,
} from '@compose-ui/stage-engine'

/** 一次圆角手柄手势的阶段性结果，与引擎的 `curve-corner.change` 同形。 @internal */
export interface StageCurveCornerChange {
  readonly entityId: string
  readonly cornerIndex: number
  readonly phase: 'start' | 'move' | 'end' | 'cancel'
  readonly worldPoint: StagePoint
}

/** {@link useStageCurveCorners} 的入参。 @internal */
export interface StageCurveCornersOptions {
  readonly document: ComposeDocument
  readonly index: StageSceneIndex
  readonly idFactory: () => string
  readonly dispatch: (command: EditorCommand) => unknown
  /** 写进事务标签的那句话，由宿主本地化。 */
  readonly label: (entityName: string) => string
}

/** {@link useStageCurveCorners} 的返回值。 @internal */
export interface StageCurveCornersSession {
  /**
   * 拖动期间的盒局部预览几何；没有手势在跑时为 `null`。
   *
   * @remarks
   * 与夹点拖动是同一种分工：文档在松手那一刻才变，拖动过程中画的是「松手会变成什么样」。
   */
  readonly preview: { readonly entityId: string; readonly curve: ComposeCurve } | null
  /**
   * 正在被拖的那个角；没有手势在跑时为 `null`。
   *
   * @remarks
   * 半径读数据此知道该量哪一个角。它**不由 `preview` 派生**——四个角共用一个半径，预览几何
   * 上没有任何字段说得出手按在哪一个上。
   */
  readonly activeIndex: number | null
  /** 处理一次引擎回传的阶段性结果。 */
  readonly handleChange: (change: StageCurveCornerChange) => void
}

/**
 * 圆角手柄的拖动会话。
 *
 * @remarks
 * 半径的反解住在 `core`（`composeCornerRadiusAt`），本 Hook 只做三件事：把世界落点换算进盒
 * 局部坐标、拿预览几何喂给覆盖层、在松手那一刻派发一条 `entity.curve.set`。
 *
 * **写入走 `entity.curve.set` 而不是别的命令**：它是曲线几何写入的唯一漏斗，撤销因此是一步，
 * 而圆角与顶点改的是同一个 Component。
 *
 * @internal
 */
export function useStageCurveCorners(options: StageCurveCornersOptions): StageCurveCornersSession {
  const [preview, setPreview] = useState<StageCurveCornersSession['preview']>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // 事件回调不该因为文档每次变化而重建：手势进行中重建会让引擎的兼容性检查误判。
  // 写在 layout effect 里而不是渲染期——渲染期写 ref 在并发渲染下会被读到撕裂的值。
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })

  const solve = useCallback((change: StageCurveCornerChange): ComposeCurve | null => {
    const { index } = latest.current
    const curve = stageCurveBoxGeometry(index, change.entityId)
    const local = stageCurveLocalPoint(index, change.entityId, change.worldPoint)
    if (!curve || !local) return null
    return applyStageCurveCorner(curve, change.cornerIndex, local)
  }, [])

  const handleChange = useCallback((change: StageCurveCornerChange) => {
    if (change.phase === 'cancel') {
      setPreview(null)
      setActiveIndex(null)
      return
    }
    const next = solve(change)
    if (change.phase !== 'end') {
      // `start` 也画一次：用户按下去还没动的那一刻，屏幕上就该是「松手会变成什么样」。
      setPreview(next ? { entityId: change.entityId, curve: next } : null)
      setActiveIndex(change.cornerIndex)
      return
    }
    setPreview(null)
    setActiveIndex(null)
    const { document, dispatch, idFactory, label } = latest.current
    const entity = document.entities[change.entityId]
    // 锁保护的正是「别动我」，圆角同样是几何。
    if (!next || !entity || getComposeLock(entity).locked) return
    const offset = getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 }
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId: change.entityId,
        // 载荷是 **parent 局部坐标**，与夹点写回同一条路：`stageCurveBoxGeometry` 给出的是
        // 盒局部几何，直接交出去会让那条唯一漏斗按它重新归一化，把盒的 offset 抹成 (0,0)
        // ——症状是松手那一刻矩形整个跳回原点。
        curve: translateComposeCurve(next, offset.x, offset.y) as unknown as JsonValue,
      },
      meta: { label: label(entity.name), source: 'stage', targetIds: [change.entityId] },
    })
  }, [solve])

  return { activeIndex, preview, handleChange }
}
