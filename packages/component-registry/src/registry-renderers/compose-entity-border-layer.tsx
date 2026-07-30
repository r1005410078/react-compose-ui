import { resolveComposeAppearance, type ComposeEntity } from '@compose-ui/core'

/** Entity 顶层边框覆盖层的输入。 @public */
export interface ComposeEntityBorderLayerProps {
  /** 要渲染边框的 Entity。 */
  readonly entity: ComposeEntity
}

/**
 * 在 Paint、Renderer 与子 Entity 之后渲染不参与盒模型的实体边框。
 *
 * @remarks
 * 边框不能依赖父节点的 `inset box-shadow` 或 `outline`：前者会被铺满型 Renderer
 * 覆盖，后者仍可能被定位 Paint/Canvas 子层覆盖。该覆盖层固定在 Entity 自身隔离的
 * stacking context 顶部，并在边界内使用 `border-box` 绘制。
 *
 * @public
 */
export function ComposeEntityBorderLayer({ entity }: ComposeEntityBorderLayerProps) {
  const appearance = resolveComposeAppearance(entity)
  if (appearance.borderWidth <= 0) return null

  return (
    <div
      aria-hidden="true"
      data-compose-entity-border=""
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2147483647,
        boxSizing: 'border-box',
        border: `${appearance.borderWidth}px solid ${appearance.borderColor}`,
        borderRadius: 'inherit',
        pointerEvents: 'none',
      }}
    />
  )
}
