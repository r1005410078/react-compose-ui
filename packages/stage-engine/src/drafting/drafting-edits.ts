import {
  BUILTIN_COMMAND_TYPES,
  getComposeLayoutItem,
  getComposeLock,
  getComposeWire,
  translateComposeCurve,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeWire,
  type ComposeWireBinding,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import { createDuplicateCommand, createStageDeleteEntitiesCommand } from '../commands'
import type { StageJunctionPredicate } from '../commands'
import { applyStageCurveGrip, stageCurveBoxGeometry, stageCurveLocalPoint } from '../geometry-editing'
import { translationMatrix } from '../geometry'
import {
  planStageAlignment,
  planStageMirror,
  planTransformCommit,
  resolveTransformTargets,
  transformedSelection,
} from '../gesture-planning'
import type { StageSceneIndex } from '../hit-testing'
import type { StageDraftingEffect } from './drafting-types'

/** 直线两端的夹点 id；只有它们能承载导线绑定。 */
const WIRE_ENDS: Readonly<Record<string, 'start' | 'end'>> = { start: 'start', end: 'end' }

/**
 * 求出拖完这一下之后的 `Wire`。
 *
 * @remarks
 * 落在端口上就绑到它，落在别处就把这一端解绑——这是改错接线的唯一入口。两端都变自由时返回
 * `null`（删掉整个 Component）：一条谁也没接的线与普通线没有任何差别，留个空壳读不出意图。
 *
 * @returns `undefined` 表示这次取点与接线无关，命令因此不带 `wire` 字段。
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

/** {@link planStageDraftingEdits} 的输入。 @public */
export interface StageDraftingEditQuery {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly effect: StageDraftingEffect
  readonly idFactory: () => string
  /**
   * 落点来自一个端口时的绑定；只有夹点取点用得上。
   *
   * @remarks
   * 由宿主给出而不是这里按坐标反查已有端口：反查会让一条恰好路过端口的线莫名其妙地绑上，
   * 而那个绑定在屏幕上完全不可见。键入的坐标因此永远不绑——它没有来源可言。
   */
  readonly wireBinding?: ComposeWireBinding
  /**
   * 判断一个 Entity 是不是接线节点。
   *
   * @remarks
   * 由宿主注入：节点的身份是 `Composition.presetId`，而引擎不认识 Preset id。缺席时删除不做
   * 节点清理，行为与引入本能力之前逐字相同。
   */
  readonly isJunction?: StageJunctionPredicate
  /** 夹点几何变更的已本地化标签；缺席时退回 Entity 名。 */
  readonly curveLabel?: (name: string) => string
  /** 镜像的已本地化事务标签。 */
  readonly mirrorLabel?: string
  /** 对齐与分布的已本地化事务标签。 */
  readonly alignLabel?: string
}

/**
 * 把一次绘图命令效果中**针对既有 Entity** 的部分规划成文档命令。
 *
 * @remarks
 * 新建曲线不在这里：它需要 Registry 决定 Preset，因此留在宿主。平移、复制与删除只认识文档，
 * 因此住在无 React 的引擎里，可以喂输入直接测。
 *
 * **平移与拖动手势共用提交漏斗 `planTransformCommit`，但不共用拖动预览**：
 *
 * - 拖动预览里的激活阈值区分「点一下」与「拖一下」，而命令没有这个歧义——用户已经明确取了
 *   两个点，沿用它会让小位移的 `MOVE` 静默什么也不做。
 * - 拖动预览里的平移吸附在命令路径上是**违规**的：基点与位移点已经各自经过点输入管线
 *   （指针取点吸过、键入坐标刻意没吸），再吸一次会改写键入的坐标。
 * - 拖动预览里的落点解析会跨父级重挂载，而 `MOVE` 是纯平移：用户敲 `M` 的意图是「挪一段
 *   距离」，不是「放进那个容器」。要重挂载就用拖动。
 *
 * 因此共用点定在 `planTransformCommit`——它同时是 resize 与 rotate 的提交口，产出**一条**
 * 变换命令，多选移动因此只占一步撤销。
 *
 * @returns 按顺序派发即可；没有可提交内容时为空数组。
 * @public
 */
export function planStageDraftingEdits(query: StageDraftingEditQuery): readonly EditorCommand[] {
  const { document, layoutSnapshot, index, effect, idFactory } = query
  const commands: EditorCommand[] = []

  if (effect.translate && effect.translate.entityIds.length > 0) {
    const { entityIds, delta } = effect.translate
    const targets = resolveTransformTargets({ document, index, type: 'move', ids: entityIds })
    if (targets) {
      const transforms = transformedSelection(
        index,
        targets.editableIds,
        translationMatrix(delta.x, delta.y),
      )
      const planned = planTransformCommit({
        document,
        layoutSnapshot,
        index,
        finished: { type: 'move', ids: targets.editableIds, transforms },
        idFactory,
      })
      if (planned?.type === 'command.dispatch') commands.push(planned.command)
    }
  }

  if (effect.mirror && effect.mirror.entityIds.length > 0) {
    commands.push(...planStageMirror({
      document,
      layoutSnapshot,
      index,
      entityIds: effect.mirror.entityIds,
      axis: effect.mirror.axis,
      idFactory,
      ...(query.mirrorLabel ? { label: query.mirrorLabel } : {}),
    }))
  }

  if (effect.align && effect.align.entityIds.length > 0) {
    const { entityIds, mode } = effect.align
    const transforms = planStageAlignment(index, entityIds, mode)
    const ids = Object.keys(transforms)
    if (ids.length > 0) {
      // 走既有的变换漏斗：多选对齐因此只占一步撤销，与多选移动逐字相同。
      const planned = planTransformCommit({
        document,
        layoutSnapshot,
        index,
        finished: { type: 'move', ids, transforms },
        idFactory,
      })
      if (planned?.type === 'command.dispatch') {
        commands.push(query.alignLabel
          ? { ...planned.command, meta: { ...planned.command.meta, label: query.alignLabel } }
          : planned.command)
      }
    }
  }

  if (effect.duplicate && effect.duplicate.entityIds.length > 0) {
    const { entityIds, delta } = effect.duplicate
    // 顶层收敛：父子同时选中时复制父级已经带上子级，再复制一次子级会多出一份。
    for (const sourceId of index.topLevelSelection(entityIds)) {
      const duplicated = createDuplicateCommand(
        document,
        sourceId,
        idFactory,
        idFactory(),
        undefined,
        delta,
      )
      if (duplicated) commands.push(duplicated.command)
    }
  }

  if (effect.curveGrip) {
    const { axisAligned, entityId, gripId, point } = effect.curveGrip
    const entity = document.entities[entityId]
    const geometry = stageCurveBoxGeometry(index, entityId)
    const local = stageCurveLocalPoint(index, entityId, point)
    // 提交与拖动期的预览读同一个答案：两处各写一遍的话，松手的瞬间形状会跳一下。
    const next = geometry && local
      ? applyStageCurveGrip(geometry, gripId, local, { axisAligned: axisAligned === true })
      : null
    if (entity && next && !getComposeLock(entity).locked) {
      const offset = getComposeLayoutItem(entity)?.offset ?? { x: 0, y: 0 }
      const wire = nextWireFor(entity, gripId, query.wireBinding)
      const name = entity.name ?? ''
      commands.push({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.setCurve,
        payload: {
          entityId,
          // 载荷是 parent 局部坐标；盒与几何由那条唯一漏斗重新归一化，越界不需要钳制。
          curve: translateComposeCurve(next, offset.x, offset.y) as unknown as JsonValue,
          // 改接线与几何写在同一条命令里：分成两条会产生一个可观察的不一致中间态，
          // 撤销也变两步。
          ...(wire === undefined ? {} : { wire: wire as unknown as JsonValue }),
        },
        meta: {
          label: query.curveLabel ? query.curveLabel(name) : `Edit ${name}`,
          source: 'stage',
          targetIds: [entityId],
        },
      })
    }
  }

  if (effect.removed && effect.removed.length > 0) {
    // 锁定对象不删：锁保护的正是「别动我」，而 ERASE 是最不可逆的那一种动。
    const entityIds = effect.removed.filter((id) => {
      const entity = document.entities[id]
      return entity !== undefined && !getComposeLock(entity).locked
    })
    if (entityIds.length > 0) {
      // 删除与「因此失去支路的节点」收进同一条命令：清理只有一份实现，见
      // `createStageDeleteEntitiesCommand`。
      const removal = createStageDeleteEntitiesCommand(document, entityIds, {
        idFactory,
        ...(query.isJunction ? { isJunction: query.isJunction } : {}),
        label: `Delete ${entityIds
          .map((id) => document.entities[id]?.name ?? id)
          .join(', ')}`,
      })
      if (removal) commands.push(removal)
    }
  }

  return commands
}
