import type {
  ComposeDocument,
  ComposeEntity,
  ComposeLayoutSnapshot,
  ComposeResizeMode,
} from '@compose-ui/core'
import { getComposeLayoutItem } from '@compose-ui/core'

export function entity(
  id: string,
  options: {
    readonly x?: number
    readonly y?: number
    readonly width?: number
    readonly height?: number
    readonly rotation?: number
    readonly childIds?: readonly string[]
    readonly locked?: boolean
    readonly visible?: boolean
    readonly clip?: boolean
    readonly resize?: ComposeResizeMode
    readonly movable?: boolean
    readonly rotatable?: boolean
    readonly minSize?: { readonly width: number; readonly height: number }
    readonly maxSize?: { readonly width: number; readonly height: number } | null
  } = {},
): ComposeEntity {
  const hasHierarchy = options.childIds !== undefined
  const transform = {
    position: { x: options.x ?? 0, y: options.y ?? 0 },
    size: { width: options.width ?? 100, height: options.height ?? 50 },
    rotation: options.rotation ?? 0,
  }
  const optionalKeys = [
    ...(hasHierarchy ? ['Hierarchy', 'Clip'] : []),
    ...(options.resize ? ['GeometryConstraints'] : []),
  ]
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: [
          'Transform',
          'LayoutItem',
          'Visibility',
          'Lock',
          ...(hasHierarchy ? ['Hierarchy', 'Clip'] : ['Renderer']),
          ...optionalKeys.filter((key) => key === 'GeometryConstraints'),
        ],
        capabilityIds: [],
      },
      Transform: { rotation: transform.rotation },
      LayoutItem: {
        positioning: 'absolute',
        offset: transform.position,
        width: {
          mode: 'fixed',
          value: transform.size.width,
          min: options.minSize?.width ?? 1,
          max: options.maxSize?.width ?? null,
        },
        height: {
          mode: 'fixed',
          value: transform.size.height,
          min: options.minSize?.height ?? 1,
          max: options.maxSize?.height ?? null,
        },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: options.visible ?? true },
      Lock: { locked: options.locked ?? false },
      ...(hasHierarchy
        ? {
            Hierarchy: { childIds: [...(options.childIds ?? [])] },
            Clip: { enabled: options.clip ?? true },
          }
        : {
            Renderer: { type: 'test', props: {} },
          }),
      ...(options.resize
        ? {
            GeometryConstraints: {
              movable: options.movable ?? true,
              resize: options.resize,
              rotatable: options.rotatable ?? true,
            },
          }
        : {}),
    },
  }
}

export function document(
  entities: readonly ComposeEntity[] = [entity('a')],
  rootIds: readonly string[] = entities.map(({ id }) => id),
): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 5,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1280, height: 720, backgroundPaint: { kind: 'solid', color: '#111827' } },
    rootIds,
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}

export function layoutSnapshot(value: ComposeDocument, revision = 1): ComposeLayoutSnapshot {
  return {
    revision,
    boxes: Object.fromEntries(Object.values(value.entities).map((item) => {
      const layoutItem = getComposeLayoutItem(item)
      return [item.id, {
        x: layoutItem.offset.x,
        y: layoutItem.offset.y,
        width: layoutItem.width.value,
        height: layoutItem.height.value,
        positioning: layoutItem.positioning,
      }]
    })),
    diagnostics: [],
  }
}
