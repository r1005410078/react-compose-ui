import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

export function mergeJson(
  base: JsonObject,
  override: JsonObject | undefined,
): JsonObject {
  return structuredClone({ ...base, ...(override ?? {}) })
}

export function mergeAppearance(
  base: ComposeAppearance,
  override: ComposeAppearance | undefined,
): ComposeAppearance {
  return structuredClone({ ...base, ...(override ?? {}) })
}

export function rendererPresetComponents(input: {
  readonly type: string
  readonly props: JsonObject
  readonly size: { readonly width: number; readonly height: number }
  readonly appearance: ComposeAppearance
}) {
  return {
    Transform: {
      position: { x: 0, y: 0 },
      size: { ...input.size },
      rotation: 0,
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: structuredClone(input.appearance),
    Renderer: {
      type: input.type,
      props: structuredClone(input.props),
    },
  }
}
