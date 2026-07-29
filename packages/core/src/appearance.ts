import type {
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

/**
 * 将 Entity 的部分 Appearance 解析为渲染端完整值。
 *
 * @remarks
 * 只接受 Entity：Appearance 是带索引签名的 JsonObject，直接接受它需要在运行时
 * 靠字段猜测与 Entity 区分，可能被含 id/name/components 键的宿主数据误判。
 *
 * @public
 */
export function resolveComposeAppearance(entity: ComposeEntity): ResolvedComposeAppearance {
  const appearance = getComposeAppearance(entity)
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
