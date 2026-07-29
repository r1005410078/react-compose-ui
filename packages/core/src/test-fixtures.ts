import {
  type ComposeDocument,
  type ComposeEntity,
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
): ComposeTransform {
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
    readonly transform?: ComposeTransform
    readonly locked?: boolean
    readonly visible?: boolean
    readonly components?: Readonly<Record<string, JsonObject>>
  } = {},
): ComposeEntity {
  const base = {
    Transform: overrides.transform ?? transform(),
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
    readonly transform?: ComposeTransform
    readonly locked?: boolean
    readonly renderer?: boolean
  } = {},
): ComposeEntity {
  const base: Record<string, JsonObject> = {
    Transform: overrides.transform ?? transform(),
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
    schemaVersion: 5,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds,
    entities,
  }
}
