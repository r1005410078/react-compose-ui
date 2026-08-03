import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAppearance,
  type ComposeClip,
  type ComposeComposition,
  type ComposeEntity,
  type ComposeHierarchy,
  type ComposeGeometryConstraints,
  type ComposeLayoutItem,
  type ComposeLock,
  type ComposeLayout,
  type ComposeOverflowMode,
  type ComposeRenderer,
  type ComposeResolvedOverflow,
  type ComposeSpatialTransform,
  type ComposeTransform,
  type ComposeVisibility,
  type JsonObject,
} from './document-types'

const COMPONENT_KEY = /^[A-Z][A-Za-z0-9]*$/

/** 判断字符串是否为可持久化的 PascalCase Component Key。 @public */
export function isComposeComponentKey(value: string): boolean {
  return COMPONENT_KEY.test(value)
}

/** 读取未知 Component；不存在时返回 undefined。 @public */
export function getComposeComponent(
  entity: ComposeEntity,
  key: string,
): JsonObject | undefined {
  return entity.components[key]
}

/** 读取 Entity 的 Composition。 @public */
export function getComposeComposition(entity: ComposeEntity): ComposeComposition {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.composition] as ComposeComposition
}

/** 读取 Entity 的 Transform。 @public */
export function getComposeTransform(entity: ComposeEntity): ComposeTransform {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.transform] as ComposeTransform
}

/** 把持久化 LayoutItem box 与 Transform rotation 合成为 Stage 编辑值。 @public */
export function getComposeSpatialTransform(entity: ComposeEntity): ComposeSpatialTransform {
  const item = getComposeLayoutItem(entity)
  return {
    position: item.offset,
    size: { width: item.width.value, height: item.height.value },
    rotation: getComposeTransform(entity).rotation,
  }
}

/** 读取 Entity 的 LayoutItem。 @public */
export function getComposeLayoutItem(entity: ComposeEntity): ComposeLayoutItem {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem] as ComposeLayoutItem
}

/** 读取可选 GeometryConstraints。 @public */
export function getComposeGeometryConstraints(
  entity: ComposeEntity,
): ComposeGeometryConstraints | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.geometryConstraints
  ] as ComposeGeometryConstraints | undefined
}

/** 读取 Entity 的 Visibility。 @public */
export function getComposeVisibility(entity: ComposeEntity): ComposeVisibility {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.visibility] as ComposeVisibility
}

/** 读取 Entity 的 Lock。 @public */
export function getComposeLock(entity: ComposeEntity): ComposeLock {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.lock] as ComposeLock
}

/** 读取可选 Hierarchy。 @public */
export function getComposeHierarchy(entity: ComposeEntity): ComposeHierarchy | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy
  ] as ComposeHierarchy | undefined
}

/** 读取可选 Layout。 @public */
export function getComposeLayout(entity: ComposeEntity): ComposeLayout | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.layout
  ] as ComposeLayout | undefined
}

/** 读取可选 Clip。 @public */
export function getComposeClip(entity: ComposeEntity): ComposeClip | undefined {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.clip] as ComposeClip | undefined
}

/**
 * 把旧版 Clip 开关与新版分轴字段解析为完整溢出语义。
 *
 * @public
 */
export function resolveComposeOverflow(entity: ComposeEntity): ComposeResolvedOverflow {
  const clip = getComposeClip(entity)
  if (!clip?.enabled) return { horizontal: 'visible', vertical: 'visible' }
  return {
    horizontal: clip.horizontal ?? 'clip',
    vertical: clip.vertical ?? 'clip',
  }
}

/**
 * 规范化浏览器无法原样表达的滚动轴组合。
 *
 * @remarks
 * 当一个轴滚动时，CSS 会把另一轴的 visible 计算为 auto；领域协议改为 clip，避免配置与
 * 实际输出不一致。
 *
 * @public
 */
export function normalizeComposeOverflow(
  horizontal: ComposeOverflowMode,
  vertical: ComposeOverflowMode,
): ComposeResolvedOverflow {
  if (horizontal === 'scroll' && vertical === 'visible') {
    return { horizontal, vertical: 'clip' }
  }
  if (vertical === 'scroll' && horizontal === 'visible') {
    return { horizontal: 'clip', vertical }
  }
  return { horizontal, vertical }
}

/** 读取可选 Appearance。 @public */
export function getComposeAppearance(entity: ComposeEntity): ComposeAppearance | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.appearance
  ] as ComposeAppearance | undefined
}

/** 读取可选 Renderer。 @public */
export function getComposeRenderer(entity: ComposeEntity): ComposeRenderer | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.renderer
  ] as ComposeRenderer | undefined
}

/** Entity 是否可见。 @public */
export function isComposeEntityVisible(entity: ComposeEntity): boolean {
  return getComposeVisibility(entity).visible
}

/** Entity 是否锁定。 @public */
export function isComposeEntityLocked(entity: ComposeEntity): boolean {
  return getComposeLock(entity).locked
}

/** Entity 是否可作为容器。 @public */
export function isComposeContainerEntity(entity: ComposeEntity): boolean {
  return getComposeHierarchy(entity) !== undefined
}

/** 缺失 GeometryConstraints 时使用的自由变换默认值。 @public */
export function resolveComposeGeometryConstraints(
  entity: ComposeEntity,
): ComposeGeometryConstraints {
  return getComposeGeometryConstraints(entity) ?? {
    movable: true,
    resize: 'free',
    rotatable: true,
  }
}
