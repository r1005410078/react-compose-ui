import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeLock,
  getComposeWire,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePolylineCurve,
  type ComposePosition,
  type ComposeWire,
  type JsonObject,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import { getEntityParentId } from '../geometry/stage-geometry'
import { stageWireParentVertices } from './wire-merge'

/** {@link planStageWireCut} 的入参。 @public */
export interface StageWireCutOptions {
  readonly idFactory: () => string
  /**
   * 这个 Entity 是不是导线。
   *
   * @remarks
   * **由宿主注入**：引擎不认识导线（判据是 `Composition.presetId` 与 `Wire` 的组合），与夹点
   * 求解的轴对齐选项是同一条既有边界。普通曲线不受理剪断——把一个形状剪成两个是「分割」，
   * 不是用户抓着一段时会想的事。
   */
  readonly isWire: (entity: ComposeEntity) => boolean
}

/** {@link planStageWireCut} 的结果。 @public */
export interface StageWireCutPlan {
  /** 剪出来的右半，一个新 Entity。 */
  readonly createdId: string
  /** 改左半那一条加建右半那一条，按这个顺序。 */
  readonly commands: readonly EditorCommand[]
}

const polyline = (vertices: readonly ComposePosition[]): ComposePolylineCurve => (
  { kind: 'polyline', closed: false, vertices: [...vertices] }
)

/**
 * 去掉一条导线的某一段。
 *
 * @remarks
 * **去掉的是整整一段，不是在一个点上断开。**在一点上断开产出的是两个**重合**的自由端——屏幕上
 * 与没剪之前逐像素相同，而那正是假接头的样子：用户按了一个键，图上什么都没有变化，他无从判断
 * 这次操作成没成功。去掉整段留下一个看得见的缺口，那是这次操作唯一的反馈。
 *
 * **只在中间段上成立。**端段去掉就是把外侧那个端点删掉，而那已经有入口（点亮外侧的端点方块
 * 按 `Delete`）；只有一段的导线去掉那一段就是删掉整条线，而那也已经有入口（不点亮任何夹点
 * 直接按 `Delete`）。给同一件事造第二个入口，代价是用户读不出这两个键位有什么区别。
 *
 * 左半留在**原 Entity** 上（id 不变，选中与撤销都还认得它），右半是一个新 Entity，两者各自
 * 继承靠近自己那一端的绑定与整份呈现，剪口那一端各是一个自由端——与搭接断线是同一条判断。
 *
 * @param segmentIndex - 第几段；第 `i` 段连接第 `i` 与第 `i + 1` 个顶点。
 * @returns 目标不是导线、被锁定、几何不合法，或这一段不是中间段时为 `null`。
 * @public
 */
export function planStageWireCut(
  document: ComposeDocument,
  entityId: string,
  segmentIndex: number,
  options: StageWireCutOptions,
): StageWireCutPlan | null {
  const entity = document.entities[entityId]
  if (!entity || !options.isWire(entity)) return null
  if (getComposeLock(entity).locked) return null
  const vertices = stageWireParentVertices(entity)
  if (!vertices) return null
  // 第 i 段是中间段 ⇔ 两侧各至少还剩一段，因此两半都还有两个顶点。
  if (!Number.isInteger(segmentIndex) || segmentIndex < 1 || segmentIndex > vertices.length - 3) {
    return null
  }

  const wire = getComposeWire(entity)
  const left = polyline(vertices.slice(0, segmentIndex + 1))
  const right = normalizeComposeCurveGeometry(polyline(vertices.slice(segmentIndex + 1)))
  const createdId = options.idFactory()
  const rightWire: ComposeWire | undefined = wire?.end ? { end: wire.end } : undefined
  const leftWire = wire?.start ? { start: wire.start } : (wire ? null : undefined)
  const item = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem] as Record<string, unknown>
  const components: Record<string, unknown> = {
    ...entity.components,
    Curve: right.curve,
    LayoutItem: {
      ...item,
      offset: right.offset,
      width: { ...(item.width as object), value: right.size.width },
      height: { ...(item.height as object), value: right.size.height },
    },
  }
  /*
   * 剪口那一端是自由端。`Wire` 两端都空时整个不写——空 `Wire` 是读不出意图的空壳，与「两端
   * 都解除后删掉 Wire」是同一条判断；写成一个值为 `undefined` 的键会被序列化成 `null`。
   */
  if (rightWire) components[COMPOSE_BUILTIN_COMPONENT_KEYS.wire] = rightWire
  else delete components[COMPOSE_BUILTIN_COMPONENT_KEYS.wire]
  const rightEntity: ComposeEntity = {
    ...entity,
    id: createdId,
    components: components as Record<string, JsonObject>,
  }

  return {
    createdId,
    commands: [
      {
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.setCurve,
        payload: {
          entityId,
          curve: left as unknown as JsonValue,
          /*
           * 剪口那一端变成自由端。两端都自由时 `Wire` 整个去掉，但它本来就没有时**不写这个
           * 字段**——去掉一个不存在的 Component 会让整条批次被拒（`patch.invalid-path`），
           * 而两端都自由正是一张图上最常见的状态。
           */
          ...(leftWire === undefined ? {} : { wire: leftWire as unknown as JsonValue }),
        },
        meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
      },
      {
        id: options.idFactory(),
        type: BUILTIN_COMMAND_TYPES.createEntity,
        payload: {
          entity: rightEntity as unknown as JsonValue,
          parentId: getEntityParentId(document, entityId),
        },
        meta: { label: rightEntity.name, source: 'stage', targetIds: [createdId] },
      },
    ],
  }
}
