/**
 * 布尔运算的规划：把一次解算结果变成命令。
 *
 * @remarks
 * 解算住在引擎（`resolveStageFlatten`），规划住在这里——新建那一支要一个 Preset 与一个新的
 * Entity id，而**引擎不建 Entity、不认识 Preset id**。与 `HATCH` 是同一条边界。
 *
 * 两支由**操作数有几个**决定：
 *
 * - **一个**：原地改它的几何（`entity.curve.set`）。判据是**这还是不是同一个对象**——拍平一个
 *   圆角矩形之后，它还是那个矩形：名字没变、颜色没变、位置没变、层序没变，变的只是「顶点
 *   还是控制手柄」。走这一支因此白拿了 id、动画轨道与导线绑定的保留，而且用的就是几何编辑
 *   写回文档的那条**唯一漏斗**。
 * - **多个**：合并成一个新对象，操作数在同一个事务里删掉。这时它确实不再是原来任何一个。
 */

import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  normalizeComposeCurveGeometry,
  type ComposeEntity,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  getEntityParentId,
  resolveStageBoolean,
  resolveStageFlatten,
  stageCurveToParent,
  type StageBooleanOperand,
  type StageBooleanRejection,
  type StageBooleanResolution,
} from '@compose-ui/stage-engine'
import type { ComposeBooleanOp } from '@compose-ui/core'
import { lowestSiblingIndex, type StageDraftingCommitContext } from './drafting-entity'
import { batchStageCommands } from './wire-tap'

/** 产物走通用曲线 Preset。 */
const STAGE_CURVE_PRESET_ID = 'curve'

/** {@link planStageBoolean} 的入参。 @internal */
export interface StageBooleanPlanOptions {
  /** 历史标签。 */
  readonly label: (name: string) => string
  /** 被拒绝时的说明；每种原因一句，互不相同。 */
  readonly rejection: (reason: StageBooleanRejection, entityName?: string) => string
}

/** {@link planStageBoolean} 的结果。 @internal */
export interface StageBooleanPlan {
  readonly commands: readonly EditorCommand[]
  /** 要显示的说明；成功时是 null。 */
  readonly notice: string | null
  /** 走了哪一支；呈现层据此决定要不要把新建的 id 记进栈。 */
  readonly branch: 'in-place' | 'create' | 'rejected'
  /**
   * 运算之后该选中谁；被拒绝时是 null。
   *
   * @remarks
   * 呈现层据此把选区挪到**产物**上，与编组把选区挪到新建的那个 Group 上是同一条：一次消费
   * 选区、产出一个对象的操作，做完之后用户手上握着的应当是结果。不挪的话操作数被删掉、选区
   * 跟着被静默清空——用户读到的是「我按了一下，东西没了」。
   *
   * 原地那一支填的是操作数自己的 id：它本来就在选区里，写出来是为了让这个字段的含义只有
   * 一句话，而不是「有时候是产物、有时候是 null」。
   */
  readonly resultId: string | null
}

const rejected = (
  options: StageBooleanPlanOptions,
  reason: StageBooleanRejection,
  entityName?: string,
): StageBooleanPlan => ({
  commands: [],
  notice: options.rejection(reason, entityName),
  branch: 'rejected',
  resultId: null,
})

/**
 * 一个操作数原地换几何。
 *
 * @remarks
 * 走 `entity.curve.set`——几何写入的唯一漏斗，盒与几何由它一起写、数值由它量化。这里刻意
 * **不**自己拼 `LayoutItem`：那会绕开那条漏斗，而绕开它正是「盒与几何对不上」的来路。
 */
function planInPlace(
  context: StageDraftingCommitContext,
  operand: StageBooleanOperand,
  resolution: StageBooleanResolution & { readonly status: 'resolved' },
  options: StageBooleanPlanOptions,
): StageBooleanPlan {
  const local = stageCurveToParent(
    context.document,
    context.layoutSnapshot,
    resolution.curve,
    operand.entityId,
  )
  return {
    commands: [{
      id: context.idFactory(),
      type: BUILTIN_COMMAND_TYPES.setCurve,
      payload: {
        entityId: operand.entityId,
        curve: local as unknown as JsonValue,
      },
      meta: {
        label: options.label(operand.name),
        source: 'stage',
        targetIds: [operand.entityId],
      },
    }],
    notice: null,
    branch: 'in-place',
    resultId: operand.entityId,
  }
}

/**
 * 多个操作数合并成一个新对象。
 *
 * @remarks
 * 外观、名称、父级与插入位置**取同一个来源**：层序最靠后（画在最下面）那个操作数，也就是
 * `operands[0]`。取不同来源会让场景树上那一行与画布上那块颜色指向两个不同的对象。
 *
 * 新建与删除进**同一个事务**：撤销一步 MUST 回到运算之前，而不是回到「删了一半」。
 */
function planMerged(
  context: StageDraftingCommitContext,
  operands: readonly StageBooleanOperand[],
  resolution: StageBooleanResolution & { readonly status: 'resolved' },
  options: StageBooleanPlanOptions,
): StageBooleanPlan {
  const seed = context.registry.createSeed(STAGE_CURVE_PRESET_ID)
  /*
   * Preset 缺失时什么都不发，**也不说话**——与 `drafting-entity`、`wire-tap` 与实体创建那三处
   * 逐字相同（它们都是 `if (!seed.ok) return null`）。
   *
   * 这一处**刻意不给它一句拒绝文案**，哪怕「敲了没反应与敲错字在屏幕上无法区分」那条规则摆在
   * 那里：那条规则挡的是用户**做错了什么**而屏幕上读不出来，而这一档是宿主没注册 `curve`
   * Preset——那个配置下 `LINE`、`RECTANGLE`、`PLINE` 一样画不出东西，且同样一声不吭。只给布尔
   * 运算补一句话，得到的是「按并集有提示、按直线没提示」这种更难解释的不一致。要补就四处一起
   * 补，那是另一件事。
   */
  if (!seed.ok) return { commands: [], notice: null, branch: 'rejected', resultId: null }

  const bottom = operands[0]!
  const source = context.document.entities[bottom.entityId]!
  const parentId = getEntityParentId(context.document, bottom.entityId)
  const local = stageCurveToParent(
    context.document,
    context.layoutSnapshot,
    resolution.curve,
    // 换算到 `bottom` 的**父级**局部：产物要落在它原来的位置上。
    bottom.entityId,
  )
  const normalized = normalizeComposeCurveGeometry(local)
  const layoutItem = seed.seed.components.LayoutItem as Record<string, unknown>
  const entityId = context.idFactory()
  const entity: ComposeEntity = {
    ...seed.seed,
    id: entityId,
    name: source.name,
    components: {
      ...seed.seed.components,
      // 整份 `Appearance` 取那个操作数的：只拿背景会把边框、圆角与透明度丢掉。
      Appearance: getComposeAppearance(source) as unknown as JsonValue,
      Curve: normalized.curve,
      LayoutItem: {
        ...layoutItem,
        offset: normalized.offset,
        width: { ...(layoutItem.width as object), value: normalized.size.width },
        height: { ...(layoutItem.height as object), value: normalized.size.height },
      },
    } as ComposeEntity['components'],
  }

  const insertion = lowestSiblingIndex(
    context.document,
    parentId,
    operands.map((operand) => operand.entityId),
  )
  const create: EditorCommand = {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.createEntity,
    payload: {
      entity: entity as unknown as JsonValue,
      parentId,
      ...(insertion === null ? {} : { index: insertion }),
    },
    meta: { label: options.label(source.name), source: 'stage', targetIds: [entityId] },
  }
  const remove: EditorCommand = {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.deleteEntity,
    payload: { entityIds: operands.map((operand) => operand.entityId) },
    meta: {
      label: options.label(source.name),
      source: 'stage',
      targetIds: operands.map((operand) => operand.entityId),
    },
  }
  const batched = batchStageCommands(
    context.idFactory,
    [create, remove],
    options.label(source.name),
    { label: options.label(source.name), source: 'stage', targetIds: [entityId] },
  )
  return {
    commands: batched ? [batched] : [create, remove],
    notice: null,
    branch: 'create',
    resultId: entityId,
  }
}

/**
 * 把一次拍平变成命令。
 *
 * @internal
 */
export function planStageFlatten(
  context: StageDraftingCommitContext,
  ids: readonly string[],
  options: StageBooleanPlanOptions,
): StageBooleanPlan {
  const resolution = resolveStageFlatten(context.index, ids)
  if (resolution.status === 'rejected') {
    return rejected(options, resolution.reason, resolution.entityName)
  }
  const { operands } = resolution
  return operands.length === 1
    ? planInPlace(context, operands[0]!, resolution, options)
    : planMerged(context, operands, resolution, options)
}

/**
 * 把一次区域运算变成命令。
 *
 * @remarks
 * 区域运算**恒走合并那一支**：它的产物是一个新的形状，不再是原来任何一个——拍平那条「还是
 * 同一个对象」的理由在这里不成立。
 *
 * @internal
 */
export function planStageBoolean(
  context: StageDraftingCommitContext,
  ids: readonly string[],
  op: ComposeBooleanOp,
  options: StageBooleanPlanOptions,
): StageBooleanPlan {
  const resolution = resolveStageBoolean(context.index, ids, op)
  if (resolution.status === 'rejected') {
    return rejected(options, resolution.reason, resolution.entityName)
  }
  return planMerged(context, resolution.operands, resolution, options)
}
