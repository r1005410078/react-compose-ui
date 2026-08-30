import {
  BUILTIN_COMMAND_TYPES,
  getComposeHierarchy,
  getComposeLock,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { createReparentCommand } from '../commands'
import { resolveStageDropTarget, type StageDropTarget } from '../hit-testing'
import { resolveTargetFrameId } from '../geometry'
import {
  snapTranslation,
  translationMatrix,
  type StageGuide,
  type StagePoint,
  type StageRect,
  type StageTransform,
} from '../geometry'
import { describeEntityTargets } from '../commands'
import { planTransformCommit } from './transform-planning'
import { transformedSelection } from './transform-preview'
import type {
  StageInteractionContext,
  StageInteractionEffect,
  StageInteractionModifiers,
} from '../interaction-controller'
import type { StageSceneIndex } from '../hit-testing'

/**
 * 视为「还没真正开始拖动」的屏幕像素阈值。
 *
 * @remarks
 * 按下时手指或鼠标的抖动会产生几个亚像素的位移。低于这个阈值就不产出预览、也不求落点，
 * 否则一次意在选中的点击会闪出吸附参考线，甚至在密集画布上算出一个落点提示。
 * 阈值按**屏幕**像素判定，所以要乘 zoom——缩小视图下同样的世界位移在屏幕上更小。
 */
const MOVE_ACTIVATION_DISTANCE = 2

/** 一次移动预览的求解结果。 @public */
export interface StageMovePreview {
  /** 按目标 Entity 分组的预览变换；未激活时为空对象。 */
  readonly transforms: Readonly<Record<string, StageTransform>>
  /** 当前指针位置解析出的落点；未激活或不成立时为 null。 */
  readonly dropTarget: StageDropTarget | null
  /** 吸附参考线；未激活时为空数组。 */
  readonly snapGuides: readonly StageGuide[]
}

/** 求解一次移动预览所需的全部输入。 @public */
export interface StageMovePreviewQuery {
  readonly context: StageInteractionContext
  readonly index: StageSceneIndex
  /** 被移动的目标，已按顶层收敛。 */
  readonly ids: readonly string[]
  /** 接管当刻的选区世界包围盒。 */
  readonly bounds: StageRect
  /** 接管当刻的世界坐标。 */
  readonly startWorld: StagePoint
  /** 当前指针的世界坐标。 */
  readonly world: StagePoint
  /**
   * 轴向约束：来自变换指示器的轴把手，自由拖动时省略。
   *
   * @remarks
   * 是**方向角**而不是 `'x' | 'y'`：指示器的轴跟着对象的 `rotation` 转，转过的对象上那两条轴
   * 不再是水平垂直。轴对齐只是 `0` 与 `90` 这两个取值。
   */
  readonly axis?: StageMoveAxis
  /** 接管当刻冻结的 zoom，与手势的坐标基线一致。 */
  readonly zoom: number
  readonly modifiers: StageInteractionModifiers
  /** 手势中按住 Space 表达的原父级锁定。 */
  readonly parentLocked: boolean
}

/** 变换指示器轴把手给出的方向约束。 @public */
export interface StageMoveAxis {
  /** 方向角（度）；与 `距离<角度` 坐标写法同一套约定：逆时针为正、屏幕 Y 向下。 */
  readonly degrees: number
}

const RADIANS_PER_DEGREE = Math.PI / 180

/** 把位移投影到一条方向上；没有约束时原样返回。 */
function projectOntoAxis(delta: StagePoint, axis: StageMoveAxis | undefined): StagePoint {
  if (!axis) return delta
  const radians = axis.degrees * RADIANS_PER_DEGREE
  // 屏幕 Y 轴向下，因此方向向量的 y 取负——与 `angleDegrees` 是同一套约定的反向。
  const dir = { x: Math.cos(radians), y: -Math.sin(radians) }
  const along = delta.x * dir.x + delta.y * dir.y
  return { x: dir.x * along, y: dir.y * along }
}

/**
 * 求解一次移动的预览变换、吸附参考线与落点。
 *
 * @remarks
 * 纯函数：不写文档、不发效果，输出完全由输入决定。移动的三个入口（move-axis 手柄、实体拖动、
 * 以及仍在 legacy 中的分支）共用它，避免同一套吸附与落点规则出现多份。
 *
 * 落点跟随**指针本身**而不是吸附后的几何：用户判断「放进哪里」看的是光标位置，让落点跟着
 * 吸附结果跳会使贴边容器极难命中。
 *
 * @public
 */
export function planMovePreview(query: StageMovePreviewQuery): StageMovePreview {
  const { context, index, ids, bounds, startWorld, world, axis, zoom, modifiers, parentLocked } = query
  const rawDelta = { x: world.x - startWorld.x, y: world.y - startWorld.y }
  const delta = projectOntoAxis(rawDelta, axis)
  if (Math.hypot(delta.x, delta.y) * zoom < MOVE_ACTIVATION_DISTANCE) {
    return { transforms: {}, dropTarget: null, snapGuides: [] }
  }
  const { grid } = context.document.canvas
  const snapped = snapTranslation(
    bounds,
    delta,
    index.snapCandidates(
      ids,
      resolveTargetFrameId(context.document, context.selectedIds, context.activeFrameId),
    ),
    zoom,
    modifiers.command,
    {
      stepX: grid.stepX,
      stepY: grid.stepY,
      offsetX: grid.offsetX,
      offsetY: grid.offsetY,
      enabled: grid.snapEnabled,
    },
  )
  return {
    transforms: (() => {
      /*
       * 吸附之后**再投影一次**：`snapTranslation` 两轴各自独立地把盒边吸到网格或参考线上，
       * 因此被约束掉的那一轴照样会被吸出一个非零分量，不投影回去的话「沿轴拖」就会歪。
       * 自由拖动时投影是恒等变换，行为一个字节不变。
       */
      const constrained = projectOntoAxis(snapped.delta, axis)
      return transformedSelection(index, ids, translationMatrix(constrained.x, constrained.y))
    })(),
    dropTarget: resolveStageDropTarget({
      index,
      draggedIds: ids,
      worldPoint: world,
      zoom,
      modifiers: {
        alt: modifiers.alt,
        // 宿主级锁定（动画模式）与手势中的 Space 锁定同一语义，任一生效即锁定原父级。
        space: parentLocked || context.lockGestureParent === true,
      },
    }),
    snapGuides: snapped.guides,
  }
}

/**
 * 提交前复核落点仍然成立。
 *
 * @remarks
 * 拖动期间可能有其他事务把目标容器锁定、删除或去掉 Hierarchy。此时放弃结构命令，让手势退回到
 * 普通的原父级内移动，而不是提交一条指向已失效目标的命令。
 *
 * @returns 仍然成立的落点，否则 `null`。
 * @public
 */
export function resolveCommittableDropTarget(
  document: ComposeDocument,
  target: StageDropTarget | null,
): StageDropTarget | null {
  if (!target) return null
  const container = document.entities[target.containerId]
  if (!container || !getComposeHierarchy(container)) return null
  if (getComposeLock(container).locked) return null
  return target
}

/** 规划一次移动提交所需的全部输入。 @public */
export interface StageMoveCommitQuery {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly ids: readonly string[]
  readonly transforms: Readonly<Record<string, StageTransform>>
  readonly dropTarget: StageDropTarget | null
  readonly idFactory: () => string
}

/**
 * 把一次移动手势规划成至多一条命令。
 *
 * @remarks
 * 落点仍然成立时，这次手势表达的是**结构意图**（换父级或改顺序），几何随 reparent 写进同一条
 * batch——否则一次手势会产生两条事务，撤销时要按两下。Auto Layout 容器会丢弃 offset 改走 flow，
 * 绝对定位容器则保留手势落点，不然节点会弹回拖拽前的位置。
 *
 * 没有落点时退回纯几何提交，与 resize / rotate 共用 {@link planTransformCommit}。
 *
 * @returns 至多一个 effect；没有任何可提交内容时为 `null`。
 * @public
 */
export function planMoveCommit(query: StageMoveCommitQuery): StageInteractionEffect | null {
  const { document, layoutSnapshot, index, ids, transforms, dropTarget, idFactory } = query
  const target = resolveCommittableDropTarget(document, dropTarget)
  if (!target) {
    return planTransformCommit({
      document,
      layoutSnapshot,
      index,
      finished: { type: 'move', ids, transforms },
      idFactory,
    })
  }
  const container = document.entities[target.containerId]!
  const childIds = getComposeHierarchy(container)!.childIds
  // 按文档顺序提交，保证多选批量移动后的相对顺序与画布所见一致。
  const orderedIds = [...ids].sort((a, b) => {
    const left = childIds.indexOf(a)
    const right = childIds.indexOf(b)
    return (left < 0 ? Number.MAX_SAFE_INTEGER : left)
      - (right < 0 ? Number.MAX_SAFE_INTEGER : right)
  })
  return {
    type: 'command.dispatch',
    command: target.kind === 'reparent'
      ? createReparentCommand(
          document,
          layoutSnapshot,
          orderedIds,
          target.containerId,
          childIds.length,
          idFactory(),
          transforms,
        )
      : {
          id: idFactory(),
          type: BUILTIN_COMMAND_TYPES.moveEntity,
          payload: {
            entityIds: orderedIds,
            parentId: target.containerId,
            index: target.index,
          },
          meta: {
            label: `Reorder ${describeEntityTargets(document, orderedIds)}`,
            source: 'stage',
            targetIds: orderedIds,
          },
        },
  }
}
