import {
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeSpatialTransform,
  type ComposeTransform,
  type JsonObject,
} from './document-types'
import { createDefaultCanvasSettings } from './canvas-settings'
import { createDefaultOutputSettings } from './output-settings'

export function transform(
  x = 0,
  y = 0,
  width = 100,
  height = 100,
  rotation = 0,
): ComposeSpatialTransform {
  return {
    position: { x, y },
    size: { width, height },
    rotation,
  }
}

export function rendererEntity(
  id: string,
  overrides: {
    readonly name?: string
    readonly transform?: ComposeSpatialTransform
    readonly layoutItem?: ComposeLayoutItem
    readonly locked?: boolean
    readonly visible?: boolean
    readonly components?: Readonly<Record<string, JsonObject>>
  } = {},
): ComposeEntity {
  const base = {
    Transform: { rotation: overrides.transform?.rotation ?? 0 } satisfies ComposeTransform,
    LayoutItem: overrides.layoutItem ?? {
      positioning: 'absolute',
      offset: overrides.transform?.position ?? { x: 0, y: 0 },
      width: { mode: 'fixed', value: overrides.transform?.size.width ?? 100, min: 1, max: null },
      height: { mode: 'fixed', value: overrides.transform?.size.height ?? 100, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: overrides.visible ?? true },
    Lock: { locked: overrides.locked ?? false },
    Appearance: { backgroundPaint: { kind: 'solid', color: '#3b82f6' }, opacity: 1 },
    Renderer: { type: 'rectangle', props: {} },
  }
  return {
    id,
    name: overrides.name ?? id,
    components: {
      Composition: {
        presetId: 'rectangle',
        baseComponentKeys: Object.keys(base),
        capabilityIds: [],
      },
      ...base,
      ...overrides.components,
    },
  }
}

export function containerEntity(
  id: string,
  childIds: readonly string[] = [],
  overrides: {
    readonly transform?: ComposeSpatialTransform
    readonly layoutItem?: ComposeLayoutItem
    readonly locked?: boolean
    readonly renderer?: boolean
  } = {},
): ComposeEntity {
  const base: Record<string, JsonObject> = {
    Transform: { rotation: overrides.transform?.rotation ?? 0 } satisfies ComposeTransform,
    LayoutItem: overrides.layoutItem ?? {
      positioning: 'absolute',
      offset: overrides.transform?.position ?? { x: 0, y: 0 },
      width: { mode: 'fixed', value: overrides.transform?.size.width ?? 100, min: 1, max: null },
      height: { mode: 'fixed', value: overrides.transform?.size.height ?? 100, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: overrides.locked ?? false },
    Hierarchy: { childIds },
    Clip: { enabled: true },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
    ...(overrides.renderer ? { Renderer: { type: 'rectangle', props: {} } } : {}),
  }
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: 'container',
        baseComponentKeys: Object.keys(base),
        capabilityIds: [],
      },
      ...base,
    },
  }
}

export function documentFixture(
  entities: Readonly<Record<string, ComposeEntity>> = {
    rectangle: rendererEntity('rectangle'),
  },
  rootIds: readonly string[] = Object.keys(entities),
): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds,
    entities,
  }
}
