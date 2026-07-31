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
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: input.size.width, min: 1, max: null },
      height: { mode: 'fixed', value: input.size.height, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
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
