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
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  getComposeAppearance,
  getComposeCurve,
  composeCurveInnerAnchor,
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
import type { ComposeHatchState } from '@compose-ui/component-registry'
import {
  createStageDraftingCurveCommand,
  stageCurveToParent,
  stagePointToParent,
  type StageDraftingCommitContext,
} from './drafting-entity'
import { batchStageCommands } from './wire-tap'

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
 * 拿一块填充自己的锚点把当初那次求解原样再跑一遍，并把锚点与边界清单一起写回。
 *
 * @remarks
 * **同一个算法、同一个输入、没有第二套规则**——它与每帧跑的那条派生求解读的是同一份解算，
 * 差别只在**谁按下的**：派生只在清单没变时动手，这一条是用户明确说「按现在的边界重来」。
 *
 * 锚点是 **Entity 局部坐标**，因此先经这块填充自己的世界矩阵搬回世界空间。它跟着 Entity 走，
 * 所以整块填充被移动过之后仍然指着同一个位置。
 *
 * **三样东西一起写，在一个事务里**：几何、重取的锚点、新的边界清单。只写几何是不够的，而这
 * 不是洁癖——
 * - 盒跟着新几何变了，而锚点是**相对盒**的，不重写它的话每按一次「重新生成」锚点就往外漂
 *   一点，几次之后掉到界外，此后这块填充再也重算不回来；
 * - 清单不更新的话，这块填充此后**永远跟不上**——派生那一侧比对的是存着的那份，而它记的还是
 *   上一次那几个边界。用户按下那一下想说的正是「现在这几个才是我的边界」。
 *
 * 锚点重取到新几何的**最大内切圆圆心**，与派生那一侧逐字相同：两条路走出不同的锚点，等于同
 * 一块填充按不同入口重算会得到不同结果。退化到求不出圆心时退回原来那个世界位置——那一档不该
 * 顺手把锚点扔掉。
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
  if (!entity || !hatch || !matrix) return null
  const worldSeed = applyMatrix(matrix, hatch.seed)
  const resolution = resolveStageHatchRegion(
    context.index,
    worldSeed,
    options.isJunction ? { isJunction: options.isJunction } : {},
  )
  /*
   * 只受理 `create` 那一支。`fill` 意味着这块面的边界如今恰好是某一个对象的完整几何——那时该
   * 去改那个对象的填充，而不是把这块填充重画成与它逐像素重合的第二份墨。用户拿桶再点一下就
   * 走到正确的那一支，而这里替他选会留下一块他没要求过的重复对象。
   */
  if (resolution.status !== 'create') return null
  const geometry = createStageDraftingCurveCommand(
    context,
    resolution.curve,
    { replace: entityId },
  )?.command
  if (!geometry) return null

  const normalized = normalizeComposeCurveGeometry(
    stageCurveToParent(context, resolution.curve, entityId),
  )
  const parentSeed = stagePointToParent(context, worldSeed, entityId)
  const anchor = composeCurveInnerAnchor(normalized.curve) ?? {
    x: parentSeed.x - normalized.offset.x,
    y: parentSeed.y - normalized.offset.y,
  }
  const next: EditorCommand = {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.updateComponent,
    payload: {
      entityId,
      key: COMPOSE_BUILTIN_COMPONENT_KEYS.hatch,
      value: {
        seed: { x: anchor.x, y: anchor.y },
        // 空清单不写：`boundaryIds` 的校验拒绝空数组，而「没有边界」的含义就是「不跟随」。
        ...(resolution.boundaryIds.length > 0
          ? { boundaryIds: [...resolution.boundaryIds] }
          : {}),
      } as unknown as JsonValue,
    },
    meta: { label: entity.name, source: 'stage', targetIds: [entityId] },
  }
  // 几何与 `Hatch` 分成两条会产生一个可观察的不一致中间态，撤销也变两步。
  return batchStageCommands(context.idFactory, [geometry, next], entity.name, {
    label: entity.name,
    source: 'stage',
    targetIds: [entityId],
  }) ?? geometry
}

/**
 * 断开关联：删掉 `Hatch`，这个 Entity 变回一条普通闭合多段线。
 *
 * @remarks
 * 几何与填充色**一个字节都不动**——断开的是「跟着边界走」这件事，不是这块墨。它本来就是一条
 * 闭合多段线，因此不需要为「脱离关联的填充」发明任何新东西；`Hatch` 缺席即不是填充，这与
 * `Clip` 缺席即不裁剪是同一条。
 *
 * 这一条**不需要求面**，与另外两条同住一个端口是因为它们都答同一格 Inspector 上的事：端口
 * 缺席时那三颗按钮一起不画。
 *
 * MUST NOT 做成「跟不跟随」的布尔开关——那会造出一块看不见的状态，两块长得一样的填充一块跟
 * 一块不跟，而屏幕上没有任何东西解释为什么。
 *
 * @returns 这个 Entity 上本来就没有 `Hatch` 时返回 `null`。
 * @internal
 */
export function planStageHatchDetach(
  context: StageDraftingCommitContext,
  entityId: string,
  label: (name: string) => string,
): EditorCommand | null {
  const entity = context.document.entities[entityId]
  if (!entity || !getComposeHatch(entity)) return null
  return {
    id: context.idFactory(),
    type: BUILTIN_COMMAND_TYPES.removeComponent,
    payload: { entityId, key: COMPOSE_BUILTIN_COMPONENT_KEYS.hatch },
    meta: { label: label(entity.name), source: 'inspector', targetIds: [entityId] },
  }
}

/**
 * 这块填充与当前的边界是什么关系——三档。
 *
 * @remarks
 * 判据是**照锚点再求一遍，看几何变不变**：求解是确定性的，同一份输入给出逐位相同的结果，
 * 因此几何一变就说明边界动过。
 *
 * 三档的分界在**求不求得出面**上：求不出来（缺口、锚点掉到界外、边界被剪断）是 `broken`，
 * 求得出但与当前几何不同是 `stale`。把这两档收成一个「过期」曾经是 v1 的做法，而它让
 * 「按一下重新生成就好了」与「先去把那条缝补上」读起来是同一句话——前者按一下就回来，
 * 后者按多少下都没用。
 *
 * `fill` 那一支算 `stale` 而不是 `current`：它意味着这块面的边界如今恰好是某一个对象的完整
 * 几何，与这块填充自己的几何是两回事；{@link planStageHatchRegeneration} 在那一支不动手，
 * 因此说成「跟不上了」正好，而说成「一致」是错的。
 *
 * 一次调用跑一遍 O(N²) 的两两求交，因此只在这块填充被选中时问。
 *
 * @internal
 */
export function stageHatchState(
  context: StageDraftingCommitContext,
  entityId: string,
  options: Pick<StageHatchPlanOptions, 'isJunction'> = {},
): ComposeHatchState {
  const entity = context.document.entities[entityId]
  const hatch = entity ? getComposeHatch(entity) : undefined
  const matrix = context.index.getWorldMatrix(entityId)
  // 还没有布局盒（新建的那一帧）时不报任何问题：那不是边界的毛病。
  if (!hatch || !matrix) return 'current'
  const resolution = resolveStageHatchRegion(
    context.index,
    applyMatrix(matrix, hatch.seed),
    options.isJunction ? { isJunction: options.isJunction } : {},
  )
  if (resolution.status === 'rejected') return 'broken'
  if (resolution.status !== 'create') return 'stale'
  const current = getComposeCurve(entity)
  const next = normalizeComposeCurveGeometry(
    stageCurveToParent(context, resolution.curve, entityId),
  ).curve
  return JSON.stringify(current) === JSON.stringify(next) ? 'current' : 'stale'
}
