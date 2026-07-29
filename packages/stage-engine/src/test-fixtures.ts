import type {
  ComposeDocument,
  ComposeEntity,
  ComposeResizeMode,
} from '@compose-ui/core'

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
    ...(options.resize ? ['TransformConstraints'] : []),
  ]
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: [
          'Transform',
          'Visibility',
          'Lock',
          ...(hasHierarchy ? ['Hierarchy', 'Clip'] : ['Renderer']),
          ...optionalKeys.filter((key) => key === 'TransformConstraints'),
        ],
        capabilityIds: [],
      },
      Transform: transform,
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
            TransformConstraints: {
              movable: options.movable ?? true,
              resize: options.resize,
              rotatable: options.rotatable ?? true,
              minSize: options.minSize ?? { width: 1, height: 1 },
              maxSize: options.maxSize ?? null,
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
    schemaVersion: 4,
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
    output: { width: 1280, height: 720, backgroundColor: '#111827' },
    rootIds,
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}
