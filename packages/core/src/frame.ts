import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAnimation,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeFrame,
  type ComposeFrameGuide,
  type ComposeSize,
  type JsonObject,
} from './document-types'
import type { ComposePaint } from './paint'

/** 新建 Frame 时使用的默认尺寸。 @public */
export const COMPOSE_DEFAULT_FRAME_SIZE: ComposeSize = { width: 1280, height: 720 }

/**
 * 创建一个 Frame Component。
 *
 * @param size - 缺省为 {@link COMPOSE_DEFAULT_FRAME_SIZE}。
 * @returns 每次调用返回可独立修改的新对象。
 * @public
 */
export function createComposeFrame(size: ComposeSize = COMPOSE_DEFAULT_FRAME_SIZE): ComposeFrame {
  return { size: { width: size.width, height: size.height }, guides: [] }
}

/**
 * 读取 Entity 的 Frame Component；不是 Frame 时返回 `null`。
 *
 * @public
 */
export function getComposeFrame(entity: ComposeEntity | undefined): ComposeFrame | null {
  const frame = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.frame]
  return frame ? (frame as ComposeFrame) : null
}

/** 判断 Entity 是否为 Frame。 @public */
export function isComposeFrameEntity(entity: ComposeEntity | undefined): boolean {
  return getComposeFrame(entity) !== null
}

/**
 * 归一化读取 Frame 的局部辅助线。
 *
 * @remarks
 * `guides` 是可选字段，缺省表示"无辅助线"。所有调用方都必须走这里而不是各自写 `?? []`。
 *
 * @public
 */
export function getComposeFrameGuides(
  entity: ComposeEntity | undefined,
): readonly ComposeFrameGuide[] {
  return getComposeFrame(entity)?.guides ?? []
}

/**
 * 求 Entity 所属的最近祖先 Frame。
 *
 * @remarks
 * Frame 是坐标、布局、裁剪、动画与脚本作用域的共同边界，因此"这个 Entity 属于哪个作用域"
 * 是 animation、stage 与 editor 都要问的同一个问题——统一在 core 求解，避免三处各写一份
 * 会漂移的向上遍历。
 *
 * Entity 自身是 Frame 时返回它自己：一个 Frame 的动画清单挂在它自己身上。
 *
 * @returns 所属 Frame 的 Entity ID；Entity 不存在或不可达任何 Frame 时返回 `null`。
 * @public
 */
export function resolveOwningFrameId(
  document: ComposeDocument,
  entityId: string,
): string | null {
  if (!document.entities[entityId]) return null
  if (isComposeFrameEntity(document.entities[entityId])) return entityId
  const parentById = buildParentIndex(document)
  // 逐级上溯而不是递归，避免深层嵌套下的栈深度问题；文档拓扑保证无环，无需 visited 集合。
  let current = parentById.get(entityId)
  while (current !== undefined && current !== null) {
    if (isComposeFrameEntity(document.entities[current])) return current
    current = parentById.get(current) ?? null
  }
  return null
}

/**
 * 判断两个 Entity 之间是否跨越了嵌套 Frame 边界。
 *
 * @remarks
 * 供动画轨道校验使用：轨道所属 Entity 的最近 Frame 必须正是持有该动画清单的 Frame。
 *
 * @public
 */
export function isWithinFrame(
  document: ComposeDocument,
  entityId: string,
  frameId: string,
): boolean {
  return resolveOwningFrameId(document, entityId) === frameId
}

/** 列出文档中全部 Frame Entity ID，按文档顺序稳定返回。 @public */
export function listComposeFrameIds(document: ComposeDocument): readonly string[] {
  return Object.keys(document.entities).filter((id) =>
    isComposeFrameEntity(document.entities[id]))
}

function buildParentIndex(document: ComposeDocument): Map<string, string | null> {
  const parentById = new Map<string, string | null>()
  document.rootIds.forEach((id) => parentById.set(id, null))
  Object.entries(document.entities).forEach(([parentId, entity]) => {
    const hierarchy = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy]
    if (!hierarchy || !Array.isArray(hierarchy.childIds)) return
    hierarchy.childIds.forEach((childId) => {
      if (typeof childId === 'string') parentById.set(childId, parentId)
    })
  })
  return parentById
}

/**
 * 创建一个完整的 Frame Entity。
 *
 * @remarks
 * Frame 是 v7 唯一的"有尺寸的结构单元"，页面根、画板、组件根都用它，因此构造逻辑必须只有
 * 一份：宿主、迁移器与测试夹具共用这里，避免各自拼装出形状略有出入的 Frame。
 *
 * `LayoutItem` 的 fixed fallback 与 `Frame.size` 保持一致——Frame 一旦被降格为普通容器，
 * 尺寸不应当跳回一个陌生的值。
 *
 * @public
 */
export function createComposeFrameEntity(options: {
  readonly id: string
  readonly name?: string
  readonly childIds?: readonly string[]
  readonly size?: ComposeSize
  readonly offset?: { readonly x: number; readonly y: number }
  readonly backgroundPaint?: ComposePaint
  readonly animations?: readonly ComposeAnimation[]
}): ComposeEntity {
  const frame = createComposeFrame(options.size)
  const offset = options.offset ?? { x: 0, y: 0 }
  const base: Record<string, JsonObject> = {
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: offset.x, y: offset.y },
      width: { mode: 'fixed', value: frame.size.width, min: 1, max: null },
      height: { mode: 'fixed', value: frame.size.height, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [...(options.childIds ?? [])] },
    Frame: frame,
    Appearance: {
      backgroundPaint: options.backgroundPaint ?? { kind: 'solid', color: 'transparent' },
    },
    ...(options.animations ? { Animations: { items: options.animations } as JsonObject } : {}),
  }
  return {
    id: options.id,
    name: options.name ?? options.id,
    components: {
      Composition: {
        presetId: 'frame',
        baseComponentKeys: Object.keys(base),
        capabilityIds: [],
      },
      ...base,
    },
  }
}
