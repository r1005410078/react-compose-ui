import type { JsonObject, NodeStyle } from '@compose-ui/core'

/** 创建可安全写入文档的独立 style 副本。 @internal */
export function cloneStyle(base: NodeStyle, override?: NodeStyle): NodeStyle {
  const shadow = override && Object.prototype.hasOwnProperty.call(override, 'shadow')
    ? override.shadow
    : base.shadow
  return {
    ...base,
    ...override,
    shadow: shadow ? { ...shadow } : null,
  }
}

/** 创建可安全写入文档的独立 JSON props 副本。 @internal */
export function cloneProps(base: JsonObject, override?: JsonObject): JsonObject {
  return structuredClone({ ...base, ...override })
}
