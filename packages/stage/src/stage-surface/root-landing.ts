import {
  getComposeFrame,
  isComposeFrameEntity,
  promoteComposeEntityToFrame,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  applyMatrix,
  clampBoundsIntoFrame,
  getEntityWorldMatrix,
  invertMatrix,
  isComposeContainerEntity,
  resolveTargetFrameId,
  type StageRect,
} from '@compose-ui/stage-engine'

/** 落点解析只关心"没有选中任何东西"这一种回退，因此选区常量提到模块级。 */
const NO_SELECTION: readonly string[] = []

/**
 * 在所有场景之外新建时的落点。
 *
 * @internal
 */
export interface RootLanding {
  /** 落点父级；`null` 表示文档根，即这次新建产出的是一块场景。 */
  readonly parentId: string | null
  /** 已经换算到 `parentId` 局部坐标系、并在必要时钳制过的包围盒。 */
  readonly bounds: StageRect
  /** 需要写回文档的 Entity；容器已被升格为场景并改名。 */
  readonly entity: ComposeEntity
}

/**
 * 把世界坐标下的包围盒换算到某个父级的局部坐标系。
 *
 * @internal
 */
export function boundsInParentSpace(
  bounds: StageRect,
  inverseParent: ReturnType<typeof invertMatrix> | null,
): StageRect {
  if (!inverseParent) return bounds
  const points = [
    applyMatrix(inverseParent, { x: bounds.x, y: bounds.y }),
    applyMatrix(inverseParent, { x: bounds.x + bounds.width, y: bounds.y }),
    applyMatrix(inverseParent, { x: bounds.x, y: bounds.y + bounds.height }),
    applyMatrix(inverseParent, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }),
  ]
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

/**
 * 解析"在所有场景之外新建 Entity"的落点。
 *
 * @remarks
 * 文档根只接受 Frame，所以这条路径必须二选一，MUST NOT 像过去那样一律回退到 `rootIds[0]`：
 *
 * - **容器类**（含 Hierarchy 且不是 Group）升格为一块新场景。这就是「在场景外画一个容器就是
 *   另外一个场景」——场景就是放在顶层的容器，升格只加 `Frame`，外观与其余 Component 原样保留。
 * - **其余 Entity** 落进激活场景。落点在定义上一定在场景外面（否则命中测试就找到父容器了），
 *   因此换算完还要钳制，不然新对象要么被 Clip 吃掉、要么飘在场景外，都读作「画了但没出现」。
 *
 * 目标场景用空选区调用 {@link resolveTargetFrameId}，刻意不让「当前选中了什么」影响落点：
 * 在空白处画东西的意图是"放进正在编辑的那块场景"，而不是"放进上次点过的东西所在的场景"。
 *
 * @param worldBounds - 世界坐标下的目标包围盒。
 * @param buildEntity - 用最终落点包围盒构造 Entity；升格分支拿到的是世界坐标包围盒。
 * @returns 文档里一块 Frame 都没有时返回 `null`（文档 schema 不允许，这里只是防御）。
 * @internal
 */
export function resolveRootLanding(
  context: {
    readonly document: ComposeDocument
    readonly layoutSnapshot: ComposeLayoutSnapshot
    readonly registry: ComposeEntityRegistry
    readonly activeFrameId?: string | null
  },
  worldBounds: StageRect,
  buildEntity: (bounds: StageRect) => ComposeEntity,
): RootLanding | null {
  const { document, layoutSnapshot, registry, activeFrameId } = context
  const candidate = buildEntity(worldBounds)
  if (isComposeContainerEntity(candidate)) {
    const size = {
      width: Math.max(1, worldBounds.width),
      height: Math.max(1, worldBounds.height),
    }
    // 名称取自场景 Preset，Stage 因此不需要自己持有一份「场景」文案。
    const label = registry.getPreset('frame')?.defaultName ?? 'Scene'
    const promoted = isComposeFrameEntity(candidate)
      ? candidate
      : promoteComposeEntityToFrame(candidate, size)
    return {
      parentId: null,
      bounds: worldBounds,
      entity: { ...promoted, name: `${label} ${document.rootIds.length + 1}` },
    }
  }
  const frameId = resolveTargetFrameId(document, NO_SELECTION, activeFrameId)
  const frame = frameId ? getComposeFrame(document.entities[frameId]) : null
  if (!frameId || !frame) return null
  const local = boundsInParentSpace(
    worldBounds,
    invertMatrix(getEntityWorldMatrix(document, layoutSnapshot, frameId)),
  )
  const bounds = clampBoundsIntoFrame(local, frame.size)
  return { parentId: frameId, bounds, entity: buildEntity(bounds) }
}
