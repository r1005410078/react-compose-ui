import type { ComposeAppearance } from '@compose-ui/core'

/** Rectangle 内置尺寸。 @internal */
export const DEFAULT_RECTANGLE_SIZE = Object.freeze({ width: 240, height: 140 })

/** Rectangle 内置节点样式。 @internal */
export const DEFAULT_RECTANGLE_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundColor: '#2f7df6',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 12,
  opacity: 1,
  shadow: null,
})
