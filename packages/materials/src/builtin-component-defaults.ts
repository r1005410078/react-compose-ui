import type { ComposeGeometryConstraints } from '@compose-ui/core'

/*
 * 内建 Component 的默认数据同时服务两个消费者：Registry 定义的 `createDefault()`，以及
 * Inspector 传给 Property Panel 的重置基线 `defaultValue`。两者必须来自同一处，否则重置
 * 会把属性恢复到与新建 Component 不同的值。定义模块本身依赖 Inspector 工厂，因此默认值
 * 放在这个无依赖的叶子模块中，避免形成循环依赖。
 */

/** 新建 Visibility Component 的默认数据。 @internal */
export const DEFAULT_COMPOSE_VISIBILITY = { visible: true } as const

/** 新建 Lock Component 的默认数据。 @internal */
export const DEFAULT_COMPOSE_LOCK = { locked: false } as const

/** 新建 Clip Component 的默认数据。 @internal */
export const DEFAULT_COMPOSE_CLIP = {
  enabled: true,
  horizontal: 'clip',
  vertical: 'clip',
} as const

/** 新建 GeometryConstraints Component 的默认数据。 @internal */
export const DEFAULT_COMPOSE_GEOMETRY_CONSTRAINTS: ComposeGeometryConstraints = {
  movable: true,
  resize: 'free',
  rotatable: true,
}

/** 新建 Transform Component 的默认数据。 @internal */
export const DEFAULT_COMPOSE_TRANSFORM = { rotation: 0 } as const
