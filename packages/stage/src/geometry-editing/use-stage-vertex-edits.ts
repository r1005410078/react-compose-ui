import { useCallback, useLayoutEffect, useRef } from 'react'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_CURVE_PICK_TOLERANCE,
  createComposeBatchCommand,
  getComposeLayoutItem,
  getComposeLock,
  getComposeWire,
  translateComposeCurve,
  type ComposeEntity,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  deleteStageCurveVertex,
  insertStageCurveVertex,
  planStageWireCut,
  stageCurveBoxGeometry,
  stageCurveLocalPoint,
  stageCurveOutline,
  type StageCurveGeometrySource,
  type StagePoint,
  type StageVertexDelete,
  type StageVertexEdit,
  type StageVertexEditRejection,
} from '@compose-ui/stage-engine'
import { isStageJunctionEntity } from '../drafting/wire-tap'

/** 顶点增删要用到的文案；本 Hook 不认识 locale。 @internal */
export interface StageVertexEditMessages {
  readonly insert: (entityName: string) => string
  readonly del: (entityName: string) => string
  readonly rejectArc: string
  readonly rejectFloor: string
  readonly rejectSeam: string
  readonly rejectUnsupported: string
  readonly rejectWireBound: string
  readonly rejectCutEdge: string
  /** 剪断的事务标签。 */
  readonly cut: (entityName: string) => string
}

/** {@link useStageVertexEdits} 的入参。 @internal */
export interface StageVertexEditsOptions {
  /**
   * 曲线几何的来源。
   *
   * @remarks
   * 与几何编辑会话读的是同一份：插入的落点要换算进**盒局部**坐标，而那需要目标的盒与世界
   * 矩阵。
   */
  readonly geometry: StageCurveGeometrySource
  readonly idFactory: () => string
  readonly dispatch: (command: EditorCommand) => unknown
  /** 画布缩放；命中容差是屏幕 px，世界容差要除掉它。 */
  readonly zoom: number
  /**
   * 与拖夹点**同一条**落点解算。
   *
   * @remarks
   * 插入的落点因此照旧吸附、照旧捕捉特征点、照旧接受键入的坐标。为插入另开一条落点通道的
   * 症状是「拖顶点吸端点、插顶点不吸」，而用户没有办法判断哪一个才对。
   */
  readonly resolvePoint: (world: StagePoint) => { readonly point: StagePoint }
  /** 说出拒绝的原因；「敲了没反应」与敲错在屏幕上无法区分。 */
  readonly notify: (message: string) => void
  /**
   * 这个 Entity 是不是导线。
   *
   * @remarks
   * 引擎不认识导线，因此这条谓词由 Stage 注入——与夹点求解的轴对齐选项是同一条既有边界。
   * 它 MUST 与导线 Preset、端口捕捉、夹点会话钉死正交读同一个答案：各判一次的症状是
   * 「这条线在顶点模式里是导线、在画的时候不是」。
   */
  readonly isWire: (entity: ComposeEntity) => boolean
  readonly messages: StageVertexEditMessages
}

/**
 * 一次 `Delete` 落到夹点上的结果。
 *
 * @remarks
 * 三档而不是一个布尔：**拒绝与落地要分开**。落地之后被作用的那个夹点不再存在，它的取点会话
 * 跟着结束；而拒绝时几何一个字节没动、夹点还在，顺手取消会话会把刚说出来的那句理由用
 * 「已取消」冲掉——用户按了一个键，屏幕上只剩一句与他的动作无关的话。
 *
 * - `applied`：几何变了。
 * - `rejected`：说明已经落到命令行上，几何不变。
 * - `ignored`：这里没有答案，交回既有级联（删整个 Entity）。
 *
 * @internal
 */
export type StageVertexDeleteOutcome = 'applied' | 'rejected' | 'ignored'

/** {@link useStageVertexEdits} 的返回值。 @internal */
export interface StageVertexEdits {
  /** 在世界落点处插入一个顶点；落点不在这条曲线上时什么都不做。 */
  readonly insertAt: (entityId: string, worldPoint: StagePoint) => void
  /** 删除某个夹点对应的顶点，或剪断导线的一段。 */
  readonly deleteVertex: (entityId: string, gripId: string) => StageVertexDeleteOutcome
}

/**
 * 几何编辑会话内的顶点增删。
 *
 * @remarks
 * 与圆角手柄那条是同一种分工：数学住引擎（`insertStageCurveVertex` / `deleteStageCurveVertex`
 * 都是纯函数），本 Hook 只做换算、拒绝的落地文案与一条 `entity.curve.set`。
 *
 * **写入走 `entity.curve.set`**：它是曲线几何写入的唯一漏斗，因此插点连同 `kind` 从 `line`
 * 换成 `polyline` 是**一条**命令、一步撤销——拆成两条会产生一个可观察的不一致中间态。
 *
 * @internal
 */
export function useStageVertexEdits(options: StageVertexEditsOptions): StageVertexEdits {
  // 事件回调不该因为文档每次变化而重建：键盘与指针两条入口都在手势之外触发。
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })

  const commit = useCallback((
    entityId: string,
    result: StageVertexEdit,
    label: (name: string) => string,
  ): StageVertexDeleteOutcome => {
    const { geometry, dispatch, idFactory, notify, messages } = latest.current
    if (result.status === 'rejected') {
      notify(messageFor(messages, result.reason))
      return 'rejected'
    }
    const entity = geometry.document.entities[entityId]
    // 锁保护的正是「别动我」，顶点同样是几何。
    if (!entity || getComposeLock(entity).locked) return 'ignored'
    const offset = getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 }
    dispatch({
      id: idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId,
        /*
         * 载荷是 **parent 局部坐标**，与夹点、圆角写回同一条路：`stageCurveBoxGeometry` 给出
         * 的是盒局部几何，直接交出去会让那条唯一漏斗按它重新归一化、把盒的 offset 抹成
         * (0,0)——症状是插一个点整条曲线跳回原点。
         */
        curve: translateComposeCurve(
          result.curve,
          offset.x,
          offset.y,
        ) as unknown as JsonValue,
      },
      meta: { label: label(entity.name), source: 'stage', targetIds: [entityId] },
    })
    return 'applied'
  }, [])

  const insertAt = useCallback((entityId: string, worldPoint: StagePoint) => {
    const { geometry, resolvePoint, zoom, messages } = latest.current
    const curve = stageCurveBoxGeometry(geometry, entityId)
    if (!curve) return
    const resolved = resolvePoint(worldPoint).point
    /*
     * 「双击一条**段**」这句话要落到一个判据上：填过色的曲线内部同样命中，而它的中间没有段。
     * 判定在**世界空间**里做（轮廓已经变换过去），与点选、框选同一条链——把落点变换进几何
     * 空间会让非等比缩放下的圆形容差变成椭圆。
     *
     * 容差就是「多近算在这条线上」那个数，除掉缩放换进世界：`world = 屏幕 / zoom`。
     */
    const outline = stageCurveOutline(geometry, entityId)
    if (!withinTolerance(outline, resolved, COMPOSE_CURVE_PICK_TOLERANCE / zoom)) return
    const local = stageCurveLocalPoint(geometry, entityId, resolved)
    if (!local) return
    commit(entityId, insertStageCurveVertex(curve, local), messages.insert)
  }, [commit])

  const deleteVertex = useCallback((entityId: string, gripId: string) => {
    const { dispatch, geometry, idFactory, isWire, messages, notify } = latest.current
    const curve = stageCurveBoxGeometry(geometry, entityId)
    const entity = geometry.document.entities[entityId]
    if (!curve || !entity) return 'ignored'
    const wire = isWire(entity)
    const bindings = getComposeWire(entity)
    const boundEnds = wire && bindings
      ? (['start', 'end'] as const).filter((end) => bindings[end] !== undefined)
      : []
    const result: StageVertexDelete = deleteStageCurveVertex(curve, gripId, {
      ...(wire ? { wire: true } : {}),
      ...(boundEnds.length > 0 ? { boundEnds } : {}),
    })
    if (result.status !== 'cut') return commit(entityId, result, messages.del)

    // 剪断产出两个 Entity，走不了 `entity.curve.set` 那条单 Entity 的路；两条命令收成一条
    // 事务，撤销一步回到一条线。
    if (getComposeLock(entity).locked) return 'ignored'
    const plan = planStageWireCut(geometry.document, entityId, result.segmentIndex, {
      idFactory,
      isWire,
      isJunction: isStageJunctionEntity,
    })
    if (!plan) {
      notify(messages.rejectCutEdge)
      return 'rejected'
    }
    const label = messages.cut(entity.name)
    dispatch(createComposeBatchCommand({
      id: idFactory(),
      commands: [...plan.commands],
      meta: { label, source: 'stage', targetIds: plan.createdId ? [entityId, plan.createdId] : [entityId] },
    }))
    return 'applied'
  }, [commit])

  return { insertAt, deleteVertex }
}

function messageFor(
  messages: StageVertexEditMessages,
  reason: StageVertexEditRejection,
): string {
  if (reason === 'arc') return messages.rejectArc
  if (reason === 'floor') return messages.rejectFloor
  if (reason === 'path-seam') return messages.rejectSeam
  if (reason === 'wire-bound') return messages.rejectWireBound
  if (reason === 'cut-edge') return messages.rejectCutEdge
  return messages.rejectUnsupported
}

/** 落点到轮廓折线的距离在容差内。 */
function withinTolerance(
  outline: readonly StagePoint[],
  point: StagePoint,
  tolerance: number,
): boolean {
  for (let index = 1; index < outline.length; index += 1) {
    if (distanceToSegment(outline[index - 1]!, outline[index]!, point) <= tolerance) return true
  }
  return false
}

function distanceToSegment(start: StagePoint, end: StagePoint, point: StagePoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const raw = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  const t = Math.min(1, Math.max(0, raw))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}
