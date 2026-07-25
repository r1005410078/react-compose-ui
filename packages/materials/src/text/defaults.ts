import type { JsonObject, NodeStyle } from '@compose-ui/core'

/** Text 内置尺寸。 @internal */
export const DEFAULT_TEXT_SIZE = Object.freeze({ width: 280, height: 72 })

/** Text 内置节点样式。 @internal */
export const DEFAULT_TEXT_STYLE: NodeStyle = Object.freeze({
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
})

/** Text 内置文字 props。 @internal */
export const DEFAULT_TEXT_PROPS: JsonObject = Object.freeze({
  text: 'Text',
  color: '#172033',
  fontSize: 24,
})
