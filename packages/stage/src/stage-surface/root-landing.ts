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
  /** 已经换算到 `parentId` 局部坐标系的包围盒；保留世界落点，不做钳制。 */
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
 *   另外一个场景」——场景就是放在顶层的容器，升格只加 `Frame`；新场景的 Clip 归一为不裁剪
 *   （与「新建场景」命令的默认一致），其余外观与 Component 原样保留。显式升格既有容器不走
 *   这里，不受归一影响。
 * - **其余 Entity** 落进激活场景并保留世界落点：换算成局部坐标后即使越出场景边界也不钳制。
 *   场景默认不裁剪，越界对象仍然可见；用户给场景开启裁剪后越界被裁掉是其显式选择。
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
    // 新画的容器还没有任何用户语义：把 Clip 归一为不裁剪再升格，使所有新建场景路径
    // 的默认一致。promoteComposeEntityToFrame 的「原地保留」不变量只约束既有容器的升格。
    const normalized: ComposeEntity = {
      ...candidate,
      components: {
        ...candidate.components,
        Clip: { enabled: false, horizontal: 'visible', vertical: 'visible' },
      },
    }
    const promoted = isComposeFrameEntity(normalized)
      ? normalized
      : promoteComposeEntityToFrame(normalized, size)
    return {
      parentId: null,
      bounds: worldBounds,
      entity: { ...promoted, name: `${label} ${document.rootIds.length + 1}` },
    }
  }
  const frameId = resolveTargetFrameId(document, NO_SELECTION, activeFrameId)
  const frame = frameId ? getComposeFrame(document.entities[frameId]) : null
  if (!frameId || !frame) return null
  const bounds = boundsInParentSpace(
    worldBounds,
    invertMatrix(getEntityWorldMatrix(document, layoutSnapshot, frameId)),
  )
  return { parentId: frameId, bounds, entity: buildEntity(bounds) }
}
