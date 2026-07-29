import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAppearance,
  type ComposeClip,
  type ComposeComposition,
  type ComposeEntity,
  type ComposeHierarchy,
  type ComposeLock,
  type ComposeRenderer,
  type ComposeTransform,
  type ComposeTransformConstraints,
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

/** 读取可选 TransformConstraints。 @public */
export function getComposeTransformConstraints(
  entity: ComposeEntity,
): ComposeTransformConstraints | undefined {
  return entity.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.transformConstraints
  ] as ComposeTransformConstraints | undefined
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

/** 读取可选 Clip。 @public */
export function getComposeClip(entity: ComposeEntity): ComposeClip | undefined {
  return entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.clip] as ComposeClip | undefined
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

/** 缺失 TransformConstraints 时使用的自由变换默认值。 @public */
export function resolveComposeTransformConstraints(
  entity: ComposeEntity,
): ComposeTransformConstraints {
  return getComposeTransformConstraints(entity) ?? {
    movable: true,
    resize: 'free',
    rotatable: true,
    minSize: { width: 1, height: 1 },
    maxSize: null,
  }
}
