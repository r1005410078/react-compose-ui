import type { JsonObject, NodeStyle } from '@compose-ui/core'

export const DEFAULT_IMAGE_SIZE = Object.freeze({ width: 320, height: 180 })
export const DEFAULT_IMAGE_PROPS: JsonObject = Object.freeze({
  asset: null,
  alt: '',
  fit: 'contain',
})
export const DEFAULT_IMAGE_STYLE: NodeStyle = Object.freeze({
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
})
