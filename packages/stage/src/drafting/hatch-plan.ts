/**
 * `HATCH` 的规划：把一次落点变成命令。
 *
 * @remarks
 * 解算住在引擎（`resolveStageHatchRegion`），规划住在这里——新建那一支要一个 `hatch` Preset
 * 与一个新的 Entity id，而**引擎不建 Entity、不认识 Preset id**。两支都在宿主规划，才不会把
 * 同一件事拆到两个包里。
 */

import {
  BUILTIN_COMMAND_TYPES,
  getComposeAppearance,
  getComposeCurve,
  getComposeHatch,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeEntity,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  applyMatrix,
  resolveStageHatchRegion,
  type StageHatchRejection,
  type StagePoint,
} from '@compose-ui/stage-engine'
import {
  createStageDraftingCurveCommand,
  stageCurveToParent,
  type StageDraftingCommitContext,
} from './drafting-entity'

/** {@link planStageHatch} 的入参。 @internal */
export interface StageHatchPlanOptions {
  /** 这一次的填充色；由宿主记在本次编辑会话里。 */
  readonly color: string
  /** 这个 Entity 是不是接线节点；节点不当边界。 */
  readonly isJunction?: (entity: ComposeEntity) => boolean
  /** 给一个已有形状填色的历史标签。 */
  readonly fillLabel: (name: string) => string
  /** 被拒绝时的说明；三种原因三句，互不相同。 */
  readonly rejection: (reason: StageHatchRejection) => string
}

/** {@link planStageHatch} 的结果。 @internal */
export interface StageHatchPlan {
  readonly commands: readonly EditorCommand[]
  /** 要显示的说明；成功时是 null。 */
  readonly notice: string | null
  /** 走了哪一支；呈现层据此决定要不要把新建的 id 记进栈。 */
  readonly branch: 'fill' | 'create' | 'rejected'
  /** 边界没闭合时的自由端，世界坐标；呈现层在这些位置画断口记号。 */
  readonly gaps: readonly StagePoint[]
}

/**
 * 把一次填充落点变成命令。
 *
 * @remarks
 * 两支由**图上看得见的东西**决定，不藏任何状态：边界恰好是某一个对象的完整几何时改它的填充，
 * 否则新建一块。悬停预览读的是同一个 `resolveStageHatchRegion`——否则「看见的那块面」与「填上
 * 的那块面」不是同一块。
 *
 * @internal
 */
export function planStageHatch(
  context: StageDraftingCommitContext,
  point: StagePoint,
  options: StageHatchPlanOptions,
): StageHatchPlan {
  const resolution = resolveStageHatchRegion(
    context.index,
    point,
    options.isJunction ? { isJunction: options.isJunction } : {},
  )
  if (resolution.status === 'rejected') {
    return {
      commands: [],
      notice: options.rejection(resolution.reason),
      branch: 'rejected',
      gaps: resolution.gaps ?? [],
    }
  }

  if (resolution.status === 'fill') {
    /*
     * 改一个已有形状的填充：整份 `Appearance` 重写（`entity.appearance.set` 的语义就是替换），
     * 因此要把现有的其余字段原样带上——只写 `backgroundPaint` 会把边框、圆角与透明度一起抹掉。
     */
    const entity = context.document.entities[resolution.entityId]!
    const appearance = {
      ...getComposeAppearance(entity),
      backgroundPaint: { kind: 'solid', color: options.color },
    }
    return {
      commands: [{
        id: context.idFactory(),
        type: BUILTIN_COMMAND_TYPES.setAppearance,
        payload: {
          entityId: resolution.entityId,
          appearance: appearance as unknown as JsonValue,
        },
        meta: {
          label: options.fillLabel(entity.name),
          source: 'stage',
          targetIds: [resolution.entityId],
        },
      }],
      notice: null,
      branch: 'fill',
      gaps: [],
    }
  }

  const created = createStageDraftingCurveCommand(context, resolution.curve, {
    hatch: {
      seed: resolution.seed,
      color: options.color,
      belowIds: resolution.boundaryIds,
    },
  })
  // Preset 缺失时不静默退回普通曲线：那会画出一块看着像填充、却没有 `Hatch` 因而永远重新
  // 生成不了的色块。
  if (!created) {
    return { commands: [], notice: null, branch: 'rejected', gaps: [] }
  }
  return { commands: [created.command], notice: null, branch: 'create', gaps: [] }
}

/**
 * 把求出来的那块面拍成一组环，供悬停预览画一块半透明的色。
 *
 * @remarks
 * 一条子路径一个环，因此岛在预览里也是洞——覆盖层按 `evenodd` 填，与落地之后
 * `isPointInsideComposeCurve` 读出的是同一个答案。**看得见的洞与点不中的洞是同一个洞**这句话
 * 从预览这一刻就成立。
 *
 * 贝塞尔按固定份数取样：预览是一块色而不是可拖的几何，误差在一个像素以内看不出来。
 *
 * @internal
 */
export function stageHatchPreviewRings(curve: ComposeCurve): readonly (readonly StagePoint[])[] {
  if (curve.kind === 'polyline') return [curve.vertices.map(({ x, y }) => ({ x, y }))]
  if (curve.kind !== 'path') return []
  const STEPS = 12
  return curve.subpaths.map((subpath) => {
    const ring: StagePoint[] = [{ x: subpath.start.x, y: subpath.start.y }]
    let from = subpath.start
    subpath.segments.forEach((cubic) => {
      for (let i = 1; i <= STEPS; i += 1) {
        const t = i / STEPS
        const u = 1 - t
        ring.push({
          x: u * u * u * from.x + 3 * u * u * t * cubic.c1.x
            + 3 * u * t * t * cubic.c2.x + t * t * t * cubic.to.x,
          y: u * u * u * from.y + 3 * u * u * t * cubic.c1.y
            + 3 * u * t * t * cubic.c2.y + t * t * t * cubic.to.y,
        })
      }
      from = cubic.to
    })
    return ring
  })
}

/**
 * 拿一块填充自己的 `seed` 把当初那次求解原样再跑一遍。
 *
 * @remarks
 * **同一个算法、同一个输入、没有第二套规则**——这正是 `Hatch` 只存 `seed`、不存边界对象标识的
 * 理由：存了就要回答「这条边是与哪个对象的第几个交点」，而一条直线穿过一个圆有两个交点，
 * 选哪一个是个启发式。
 *
 * `seed` 是 **Entity 局部坐标**，因此先经这块填充自己的世界矩阵搬回世界空间。它跟着 Entity 走，
 * 所以整块填充被移动过之后仍然指着同一个位置——而边界没跟着动的话，求出来的就是另一块面，
 * 那正是「过期」。
 *
 * @returns 求不出来（边界改到围不出面了）时返回 `null`。
 * @internal
 */
export function planStageHatchRegeneration(
  context: StageDraftingCommitContext,
  entityId: string,
  options: Pick<StageHatchPlanOptions, 'isJunction'> = {},
): EditorCommand | null {
  const entity = context.document.entities[entityId]
  const hatch = entity ? getComposeHatch(entity) : undefined
  const matrix = context.index.getWorldMatrix(entityId)
  if (!hatch || !matrix) return null
  const resolution = resolveStageHatchRegion(
    context.index,
    applyMatrix(matrix, hatch.seed),
    options.isJunction ? { isJunction: options.isJunction } : {},
  )
  /*
   * 只受理 `create` 那一支。`fill` 意味着这块面的边界如今恰好是某一个对象的完整几何——那时该
   * 去改那个对象的填充，而不是把这块填充重画成与它逐像素重合的第二份墨。用户拿桶再点一下就
   * 走到正确的那一支，而这里替他选会留下一块他没要求过的重复对象。
   */
  if (resolution.status !== 'create') return null
  return createStageDraftingCurveCommand(context, resolution.curve, { replace: entityId })?.command
    ?? null
}

/**
 * 这块填充与当前的边界还对得上吗。
 *
 * @remarks
 * 判据是**照 seed 再求一遍，看几何变不变**：求解是确定性的，同一份输入给出逐位相同的结果，
 * 因此几何一变就说明边界动过。求不出来（缺口、落点掉到界外）同样算过期——那正是 AutoCAD 最
 * 常被抱怨的那一档，而它在那边是**静默**的。
 *
 * 一次调用跑一遍 O(N²) 的两两求交，因此只在这块填充被选中时问。
 *
 * @internal
 */
export function stageHatchIsStale(
  context: StageDraftingCommitContext,
  entityId: string,
  options: Pick<StageHatchPlanOptions, 'isJunction'> = {},
): boolean {
  const entity = context.document.entities[entityId]
  const hatch = entity ? getComposeHatch(entity) : undefined
  const matrix = context.index.getWorldMatrix(entityId)
  if (!hatch || !matrix) return false
  const resolution = resolveStageHatchRegion(
    context.index,
    applyMatrix(matrix, hatch.seed),
    options.isJunction ? { isJunction: options.isJunction } : {},
  )
  if (resolution.status !== 'create') return true
  const current = getComposeCurve(entity)
  const next = normalizeComposeCurveGeometry(
    stageCurveToParent(context, resolution.curve, entityId),
  ).curve
  return JSON.stringify(current) !== JSON.stringify(next)
}
