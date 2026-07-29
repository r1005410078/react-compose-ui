import type {
  ComposeAppearance,
  ComposeEntity,
  ComposeShadow,
  ResolvedComposeAppearance,
} from './document-types'
import { getComposeAppearance } from './entity'

/** 从关闭状态开始编辑单个 shadow 子字段时使用的稳定基线。 @public */
export const DEFAULT_COMPOSE_SHADOW: ComposeShadow = {
  color: '#00000040',
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
}

/** 缺失 Appearance 时使用的透明外观。 @public */
export const DEFAULT_COMPOSE_APPEARANCE: ResolvedComposeAppearance = {
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
}

/** 将部分 Appearance 解析为渲染端完整值。 @public */
export function resolveComposeAppearance(
  entityOrAppearance: ComposeEntity | ComposeAppearance | undefined,
): ResolvedComposeAppearance {
  const isEntity = entityOrAppearance !== undefined
    && typeof entityOrAppearance.id === 'string'
    && typeof entityOrAppearance.name === 'string'
    && typeof entityOrAppearance.components === 'object'
  const appearance: ComposeAppearance | undefined = isEntity
    ? getComposeAppearance(entityOrAppearance as ComposeEntity)
    : entityOrAppearance as ComposeAppearance | undefined
  const shadow = appearance?.shadow === undefined
    ? DEFAULT_COMPOSE_APPEARANCE.shadow
    : appearance.shadow
  return {
    backgroundColor: appearance?.backgroundColor
      ?? DEFAULT_COMPOSE_APPEARANCE.backgroundColor,
    borderColor: appearance?.borderColor ?? DEFAULT_COMPOSE_APPEARANCE.borderColor,
    borderWidth: appearance?.borderWidth ?? DEFAULT_COMPOSE_APPEARANCE.borderWidth,
    borderRadius: appearance?.borderRadius ?? DEFAULT_COMPOSE_APPEARANCE.borderRadius,
    opacity: appearance?.opacity ?? DEFAULT_COMPOSE_APPEARANCE.opacity,
    shadow: shadow ? { ...shadow } : null,
  }
}
