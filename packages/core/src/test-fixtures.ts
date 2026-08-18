import {
  type ComposeAnimation,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeSpatialTransform,
  type ComposeTransform,
  type JsonObject,
} from './document-types'
import { createDefaultCanvasSettings } from './canvas-settings'
import { COMPOSE_DEFAULT_FRAME_SIZE, createComposeFrameEntity } from './frame'

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

/** 测试用根 Frame 的固定 ID；`documentFixture` 总是用它包住给定的顶层 Entity。 */
export const ROOT_FRAME_ID = 'frame-root'

export function frameEntity(
  id: string,
  childIds: readonly string[] = [],
  overrides: {
    readonly width?: number
    readonly height?: number
    readonly animations?: readonly ComposeAnimation[]
  } = {},
): ComposeEntity {
  return createComposeFrameEntity({
    id,
    childIds,
    size: {
      width: overrides.width ?? COMPOSE_DEFAULT_FRAME_SIZE.width,
      height: overrides.height ?? COMPOSE_DEFAULT_FRAME_SIZE.height,
    },
    animations: overrides.animations,
  })
}

/**
 * 构造一份以单个 Frame 为根的组件文档。
 *
 * @remarks
 * Component Asset v2 要求单根且根是 Frame；这里直接把给定 Entity 挂到该 Frame 之下。
 */
export function componentDocumentFixture(
  entities: Readonly<Record<string, ComposeEntity>>,
  childIds: readonly string[] = Object.keys(entities),
  frameId = ROOT_FRAME_ID,
  size: { readonly width?: number; readonly height?: number } = {},
): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: [frameId],
    entities: {
      ...entities,
      [frameId]: frameEntity(frameId, childIds, size),
    },
  }
}

/**
 * 构造一份合法 v7 文档。
 *
 * @remarks
 * v7 的根层级只接受 Frame，因此这里总是插入一个 {@link ROOT_FRAME_ID} 根 Frame，把调用方
 * 给出的 `rootIds` 变成它的子级——测试因此不必每处都自己搭画板。
 */
export function documentFixture(
  entities: Readonly<Record<string, ComposeEntity>> = {
    rectangle: rendererEntity('rectangle'),
  },
  rootIds: readonly string[] = Object.keys(entities),
): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: [ROOT_FRAME_ID],
    entities: {
      ...entities,
      [ROOT_FRAME_ID]: frameEntity(ROOT_FRAME_ID, rootIds),
    },
  }
}
