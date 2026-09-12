import {
  getComposeLayoutItem,
  getComposeLock,
  getComposeCurve,
  projectComposeCurveToBox,
  sliceComposeCurve,
  translateComposeCurve,
  type ComposeCurve,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
} from '@compose-ui/core'
import { planStageCurveReplacement } from './curve-split'
import type { StageJunctionPredicate } from './junction-cleanup'

/** {@link planStageWireCut} 的入参。 @public */
export interface StageWireCutOptions {
  readonly idFactory: () => string
  /**
   * 这个 Entity 是不是导线。
   *
   * @remarks
   * **由宿主注入**：引擎不认识导线（判据是 `Composition.presetId` 与 `Wire` 的组合）。它只决定
   * 绑定怎么继承与要不要收拾节点，**不决定能不能剪**——矩形的一条边要让给符号、六边形要开一个
   * 口，正是抓着一段时想做的事。缺席即不是导线。
   */
  readonly isWire?: (entity: ComposeEntity) => boolean
  /** 判断一个 Entity 是不是接线节点；缺席时不收拾节点。 */
  readonly isJunction?: StageJunctionPredicate
}

/** {@link planStageWireCut} 的结果。 @public */
export interface StageWireCutPlan {
  /** 剪出来的右半，一个新 Entity；闭合折线变开放时没有它。 */
  readonly createdId: string | null
  /** 改左半那一条加建右半那一条，按这个顺序。 */
  readonly commands: readonly EditorCommand[]
}

/**
 * 一个 Entity 画出来的曲线，parent 局部坐标。
 *
 * @remarks
 * 与命中、捕捉应用同一个盒到几何的变换（`projectComposeCurveToBox`），再平移到 parent 局部——
 * `entity.curve.set` 的载荷正是这个坐标系。
 *
 * @public
 */
export function stageCurveParentGeometry(entity: ComposeEntity): ComposeCurve | null {
  const curve = getComposeCurve(entity)
  const item = getComposeLayoutItem(entity)
  if (!curve || !item) return null
  const box = projectComposeCurveToBox(curve, { width: item.width.value, height: item.height.value })
  return translateComposeCurve(box, item.offset.x, item.offset.y)
}

/**
 * 去掉一条折线的某一段。
 *
 * @remarks
 * **去掉的是整整一段，不是在一个点上断开。**在一点上断开产出的是两个**重合**的自由端——屏幕上
 * 与没剪之前逐像素相同，而那正是假接头的样子：用户按了一个键，图上什么都没有变化，他无从判断
 * 这次操作成没成功。去掉整段留下一个看得见的缺口，那是这次操作唯一的反馈。
 *
 * **开放折线只在中间段上成立。**端段去掉就是把外侧那个端点删掉，而那已经有入口（点亮外侧的
 * 端点方块按 `Delete`）；只有一段的线去掉那一段就是删掉整条线，而那也已经有入口（不点亮任何
 * 夹点直接按 `Delete`）。给同一件事造第二个入口，代价是用户读不出这两个键位有什么区别。
 * **闭合折线去掉任何一段都变成开放折线**，仍是同一个 Entity。
 *
 * 对**所有**折线成立，不只是导线：曾经「普通曲线是一个形状，剪成两个是分割」那条被推翻——
 * 矩形的一条边要让给符号、六边形要开一个口，正是抓着一段时想做的事。`isWire` 只决定绑定怎么
 * 继承。落地走 {@link planStageCurveReplacement}：左半留原 Entity、右半新建、呈现整份复制。
 *
 * @param segmentIndex - 第几段；第 `i` 段连接第 `i` 与第 `i + 1` 个顶点。
 * @returns 目标不是折线、被锁定、几何不合法，或这一段不是中间段时为 `null`。
 * @public
 */
export function planStageWireCut(
  document: ComposeDocument,
  entityId: string,
  segmentIndex: number,
  options: StageWireCutOptions,
): StageWireCutPlan | null {
  const entity = document.entities[entityId]
  if (!entity) return null
  if (getComposeLock(entity).locked) return null
  const local = stageCurveParentGeometry(entity)
  if (!local || local.kind !== 'polyline') return null
  const count = local.closed ? local.vertices.length : local.vertices.length - 1
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= count) return null
  // 开放折线的第 i 段是中间段 ⇔ 两侧各至少还剩一段，因此剪出来的两半都还有两个顶点。
  if (!local.closed && (segmentIndex < 1 || segmentIndex > local.vertices.length - 3)) return null

  const slice = sliceComposeCurve(local, segmentIndex, segmentIndex + 1)
  if (!slice) return null
  const wire = options.isWire?.(entity) === true
  const plan = planStageCurveReplacement(document, entityId, slice.remaining, {
    idFactory: options.idFactory,
    keepStart: !local.closed && wire,
    keepEnd: !local.closed && wire,
    ...(options.isJunction ? { isJunction: options.isJunction } : {}),
  })
  if (!plan) return null
  return { createdId: plan.createdIds[0] ?? null, commands: plan.commands }
}
