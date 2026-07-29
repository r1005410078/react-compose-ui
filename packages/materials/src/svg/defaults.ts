import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

export const DEFAULT_SVG_SIZE = Object.freeze({ width: 320, height: 180 })
export const DEFAULT_SVG_PROPS: JsonObject = Object.freeze({
  asset: null,
  alt: '',
  fit: 'contain',
  overrideFill: false,
  fillColor: '#ffffff',
  overrideStroke: false,
  strokeColor: '#ffffff',
})
export const DEFAULT_SVG_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
})
