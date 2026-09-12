import {
  BUILTIN_COMMAND_TYPES,
  composeHorizontalMirrorAxis,
  getComposeCurve,
  getComposeLayoutItem,
  getComposeLock,
  getComposeRenderer,
  getComposeTransformPivot,
  reflectComposeCurve,
  resolveComposeGeometryConstraints,
  translateComposeCurve,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type ComposeMirrorAxis,
  type EditorCommand,
  type JsonValue,
} from '@compose-ui/core'
import {
  decomposeMatrix,
  invertMatrix,
  multiplyMatrices,
} from '../geometry'
import { planTransformCommit } from './transform-planning'
import type { StageMatrix, StageTransform } from '../geometry'
import type { StageSceneIndex } from '../hit-testing'

/** {@link planStageMirror} 的输入。 @public */
export interface StageMirrorQuery {
  readonly document: ComposeDocument
  readonly layoutSnapshot: ComposeLayoutSnapshot
  readonly index: StageSceneIndex
  readonly entityIds: readonly string[]
  /** 镜像轴，世界坐标。 */
  readonly axis: ComposeMirrorAxis
  readonly idFactory: () => string
  /** 已本地化的事务标签。 */
  readonly label?: string
}

/**
 * 组件实例的翻转取值；与物料上的 Renderer prop 同形。
 *
 * @remarks
 * 引擎不认识物料，但这个联合是**文档里那条 prop 的取值**，因此它与 `Renderer.type` 一样属于
 * 文档级词汇——与「按 `component-instance` 判定实例」是同一条既有边界。
 */
type MirrorFlip = 'none' | 'x' | 'y' | 'xy'

/** 叠一次竖直翻转：反射的「内容那一半」恒是绕自己盒中线的上下翻转。 */
const TOGGLE_VERTICAL: Readonly<Record<MirrorFlip, MirrorFlip>> = {
  none: 'y',
  y: 'none',
  x: 'xy',
  xy: 'x',
}

function currentFlip(props: unknown): MirrorFlip {
  const value = (props as Record<string, unknown> | undefined)?.['flip']
  return value === 'x' || value === 'y' || value === 'xy' ? value : 'none'
}

/**
 * 一个 Entity 自己那一半的翻转：绕**盒的水平中线**上下翻转，写成矩阵。
 *
 * @remarks
 * 一次反射不是刚体运动（行列式为负），而 `Transform` 里只有 `rotation`——它表达不了反射。
 * 把反射拆成「刚体运动 × 盒内翻转」之后，前一半落进位置与角度（`decomposeMatrix` 对刚体运动
 * 是精确的），后一半由**能表达它的那一方**承担：曲线烘进几何，组件实例走 `flip`。
 *
 * 竖直而不是水平只是一个约定：两者差一个 180° 旋转，而那一半已经在刚体运动里了。
 */
function contentFlip(height: number): StageMatrix {
  return { a: 1, b: 0, c: 0, d: -1, e: 0, f: height }
}

/** 世界反射矩阵：`[[cos2φ, sin2φ], [sin2φ, −cos2φ]]` 绕轴上一点。 */
function reflectionMatrix(axis: ComposeMirrorAxis): StageMatrix | null {
  const dx = axis.b.x - axis.a.x
  const dy = axis.b.y - axis.a.y
  if (dx === 0 && dy === 0) return null
  const angle = 2 * Math.atan2(dy, dx)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const { x, y } = axis.a
  return {
    a: cos,
    b: sin,
    c: sin,
    d: -cos,
    e: x - cos * x - sin * y,
    f: y - sin * x + cos * y,
  }
}

/**
 * 把一次镜像规划成文档命令。
 *
 * @remarks
 * 反射按 `W' = Refl · W · F` 逐个 Entity 求解：`F` 是它自己盒内的上下翻转，两个负行列式相乘
 * 让 `W'` 回到刚体运动，因此位置与角度可以精确地交给既有的变换漏斗。**子级按同样的式子各算
 * 一遍**，并在**父级的新世界矩阵**里落位——父级也动了，拿旧矩阵算子级的症状是「容器镜像之后
 * 里面的东西全跑到外面去」。
 *
 * `F` 那一半由能表达它的一方承担：
 * - **曲线**烘进几何（`entity.curve.set`），盒尺寸不变因此与变换命令写的是同一个尺寸；
 * - **组件实例**走 Renderer prop `flip`——定义是共享的，烘进去会波及每一个实例；
 * - 其余盒（文字、图片、普通容器）只反射位置与朝向。容器的内容由递归承担，而文字与图片没有
 *   承载「左右反过来」的字段——那是另一件事，不在本变更里。
 *
 * 命令共享一个 `mergeKey`：它们同步派发，因此合成一步撤销——「整棵子树一起回来」正是这条
 * 要求的内容。
 *
 * @returns 按顺序派发即可；曲线几何排在变换之前，因为后者写的才是最终位置。
 * @public
 */
export function planStageMirror(query: StageMirrorQuery): readonly EditorCommand[] {
  const { document, layoutSnapshot, index, axis, idFactory } = query
  const reflection = reflectionMatrix(axis)
  if (!reflection) return []

  const transforms: Record<string, StageTransform> = {}
  const before: EditorCommand[] = []
  const touched: string[] = []
  const newWorld = new Map<string, StageMatrix>()

  const visit = (entityId: string) => {
    const entity = document.entities[entityId]
    const world = index.getWorldMatrix(entityId)
    const box = layoutSnapshot.boxes[entityId]
    if (!entity || !world || !box) return
    // 锁定的对象连同它的子树一起留在原处：锁保护的正是「别动我」。
    if (getComposeLock(entity).locked) return

    const target = multiplyMatrices(
      multiplyMatrices(reflection, world),
      contentFlip(box.height),
    )
    newWorld.set(entityId, target)

    const parentId = index.getParentId(entityId)
    const parentWorld = (parentId ? newWorld.get(parentId) : null)
      ?? (parentId ? index.getWorldMatrix(parentId) : null)
    const local = parentWorld ? multiplyMatrices(invertMatrix(parentWorld), target) : target
    if (resolveComposeGeometryConstraints(entity).movable) {
      transforms[entityId] = decomposeMatrix(
        local,
        box.width,
        box.height,
        getComposeTransformPivot(entity),
      )
      touched.push(entityId)
    }

    const curve = getComposeCurve(entity)
    if (curve) {
      const flipped = reflectComposeCurve(curve, composeHorizontalMirrorAxis(box.height / 2))
      if (flipped) {
        const offset = getComposeLayoutItem(entity).offset
        before.push({
          id: idFactory(),
          type: BUILTIN_COMMAND_TYPES.setCurve,
          payload: {
            entityId,
            /*
             * 载荷是 parent 局部坐标，且**用旧的 offset**：盒内翻转不改变紧包围盒，因此那条
             * 唯一漏斗算出来的盒与位置都与翻转前相同，紧接着的变换命令才写最终位置。
             */
            curve: translateComposeCurve(
              flipped,
              offset.x,
              offset.y,
            ) as unknown as JsonValue,
          },
          meta: { source: 'stage', targetIds: [entityId] },
        })
      }
    } else if (getComposeRenderer(entity)?.type === 'component-instance') {
      const props = getComposeRenderer(entity)?.props ?? {}
      before.push({
        id: idFactory(),
        type: BUILTIN_COMMAND_TYPES.setRendererProps,
        payload: {
          entityId,
          props: { ...props, flip: TOGGLE_VERTICAL[currentFlip(props)] } as JsonValue,
        },
        meta: { source: 'stage', targetIds: [entityId] },
      })
    }

    for (const childId of index.order) {
      if (index.getParentId(childId) === entityId) visit(childId)
    }
  }

  for (const rootId of index.topLevelSelection(query.entityIds)) {
    if (index.isVisible(rootId)) visit(rootId)
  }

  if (touched.length === 0 && before.length === 0) return []
  /*
   * 位置与角度走既有的变换漏斗，因此整棵子树只占**一条**变换命令；`rotate` 那一档保留尺寸
   * 并写角度，正是反射需要的两样。
   */
  const planned = touched.length > 0
    ? planTransformCommit({
        document,
        layoutSnapshot,
        index,
        finished: { type: 'rotate', ids: touched, transforms },
        idFactory,
      })
    : null
  const commands = [...before]
  if (planned?.type === 'command.dispatch') commands.push(planned.command)
  const mergeKey = `stage.mirror.${idFactory()}`
  return commands.map((command) => ({
    ...command,
    meta: {
      ...command.meta,
      ...(query.label ? { label: query.label } : {}),
      mergeKey,
    },
  }))
}
