import type { NodeStyle } from '@compose-ui/core'

/** Frame 内置尺寸。 @internal */
export const DEFAULT_FRAME_SIZE = Object.freeze({ width: 1280, height: 720 })

/** Frame 内置节点样式。 @internal */
export const DEFAULT_FRAME_STYLE: NodeStyle = Object.freeze({
  backgroundColor: '#f8fafc',
  borderColor: '#d1d5db',
  borderWidth: 1,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
})
