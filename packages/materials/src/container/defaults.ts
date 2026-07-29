import type { ComposeAppearance } from '@compose-ui/core'

/** Container 内置尺寸。 @internal */
export const DEFAULT_CONTAINER_SIZE = Object.freeze({ width: 1280, height: 720 })

/** Container 内置外观。 @internal */
export const DEFAULT_CONTAINER_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundColor: '#f8fafc',
  borderColor: '#d1d5db',
  borderWidth: 1,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
})
