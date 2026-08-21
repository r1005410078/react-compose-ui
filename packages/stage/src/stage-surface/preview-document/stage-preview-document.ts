import {
  getComposeLayoutItem,
  getComposeVisibility,
  getComposeRenderer,
  getComposeTransform,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type JsonValue,
} from '@compose-ui/core'
import {
  applyMatrix,
  getEntityParentId,
  getEntityWorldBounds,
  getEntityWorldMatrix,
  invertMatrix,
  unionRects,
} from '@compose-ui/stage-engine'
import type {
  StagePoint,
  StageSegmentPreview,
  StageTransform,
} from '@compose-ui/stage-engine'

/**
 * 两点 Shape 在各轴上的几何朝向。
 *
 * @remarks
 * 与线段几何同住而不是跟着绘制走：产生它的是绘制，但读它的是预览烘焙与端点求解，
 * 放在绘制侧会让预览目录反向依赖创建目录。
 */
export type ShapeDirection = {
  readonly x: -1 | 0 | 1
  readonly y: -1 | 0 | 1
}

/** 按 Entity 分组的预览变换。 */
export type StageTransformMap = Readonly<Record<string, StageTransform>>

type ShapeAxis = -1 | 0 | 1

export function transformDocument(
  document: ComposeDocument,
  transforms: StageTransformMap,
  directions: Readonly<Record<string, ShapeDirection>> = {},
): ComposeDocument {
  if (Object.keys(transforms).length === 0 && Object.keys(directions).length === 0) return document
  const entities = { ...document.entities }
  const ids = new Set([...Object.keys(transforms), ...Object.keys(directions)])
  for (const id of ids) {
    const entity = entities[id]
    if (entity) {
      const transform = transforms[id]
      const direction = directions[id]
      const renderer = getComposeRenderer(entity)
      entities[id] = {
        ...entity,
        components: {
          ...entity.components,
          ...(transform
            ? {
                Transform: { rotation: transform.rotation },
                LayoutItem: {
                  ...getComposeLayoutItem(entity),
                  offset: { x: transform.x, y: transform.y },
                  width: { ...getComposeLayoutItem(entity).width, value: transform.width },
                  height: { ...getComposeLayoutItem(entity).height, value: transform.height },
                },
              }
            : {}),
          ...(direction && renderer?.type === 'shape'
            ? {
                Renderer: {
                  ...renderer,
                  props: {
                    ...renderer.props,
                    direction: direction as unknown as JsonValue,
                  },
                },
              }
            : {}),
        },
      }
    }
  }
  return { ...document, entities }
}

/** 把位移方向归约成 -1/0/1 三态。 */
export function directionAxis(delta: number): ShapeAxis {
  if (Math.abs(delta) < 0.000_001) return 0
  return delta < 0 ? -1 : 1
}

export function shapeDirection(value: unknown): ShapeDirection {
  if (!value || typeof value !== 'object') return { x: 1, y: 1 }
  const candidate = value as { readonly x?: unknown; readonly y?: unknown }
  return {
    x: candidate.x === -1 || candidate.x === 0 ? candidate.x : 1,
    y: candidate.y === -1 || candidate.y === 0 ? candidate.y : 1,
  }
}

export function localLineEndpoint(
  axis: ShapeAxis,
  size: number,
  endpoint: 'start' | 'end',
) {
  if (axis === 0) return size / 2
  if (endpoint === 'start') return axis < 0 ? size : 0
  return axis < 0 ? 0 : size
}

export function rotatePoint(point: StagePoint, center: StagePoint, degrees: number): StagePoint {
  const radians = degrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = point.x - center.x
  const y = point.y - center.y
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  }
}

export interface ShapeSegmentGeometry {
  readonly entityId: string
  readonly start: StagePoint
  readonly end: StagePoint
}

export interface ShapeSegmentTransform {
  readonly direction: ShapeDirection
  readonly transform: StageTransform
}

export function lineSegmentForEntity(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
): ShapeSegmentGeometry | null {
  const entity = document.entities[entityId]
  const renderer = entity ? getComposeRenderer(entity) : null
  const box = snapshot.boxes[entityId]
  if (
    !entity
    || !renderer
    || renderer.type !== 'shape'
    || !box
    || (renderer.props.kind !== 'line' && renderer.props.kind !== 'arrow')
  ) return null
  const direction = shapeDirection(renderer.props.direction)
  const matrix = getEntityWorldMatrix(document, snapshot, entityId)
  const endpoint = (kind: 'start' | 'end') => applyMatrix(matrix, {
    x: localLineEndpoint(direction.x, box.width, kind),
    y: localLineEndpoint(direction.y, box.height, kind),
  })
  return { entityId, start: endpoint('start'), end: endpoint('end') }
}

export function lineSegmentTransform(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  preview: StageSegmentPreview,
): ShapeSegmentTransform | null {
  const entity = document.entities[preview.entityId]
  const renderer = entity ? getComposeRenderer(entity) : null
  if (!entity || !renderer || renderer.type !== 'shape') return null
  const parentId = getEntityParentId(document, preview.entityId)
  const inverseParent = parentId
    ? invertMatrix(getEntityWorldMatrix(document, snapshot, parentId))
    : null
  const start = inverseParent ? applyMatrix(inverseParent, preview.start) : preview.start
  const end = inverseParent ? applyMatrix(inverseParent, preview.end) : preview.end
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const rotation = getComposeTransform(entity).rotation
  // Line 的几何由未旋转的 box + direction 表达；先逆转 Entity 自身旋转，再维持其 rotation。
  const localStart = rotation === 0 ? start : rotatePoint(start, center, -rotation)
  const localEnd = rotation === 0 ? end : rotatePoint(end, center, -rotation)
  const direction = {
    x: directionAxis(localEnd.x - localStart.x),
    y: directionAxis(localEnd.y - localStart.y),
  } satisfies ShapeDirection
  const rawWidth = Math.abs(localEnd.x - localStart.x)
  const rawHeight = Math.abs(localEnd.y - localStart.y)
  return {
    direction,
    transform: {
      // SVG 的零轴在最小 1px box 的中心绘制，使端点仍落在真实坐标而非产生 1px 斜线。
      x: direction.x === 0 ? localStart.x - 0.5 : Math.min(localStart.x, localEnd.x),
      y: direction.y === 0 ? localStart.y - 0.5 : Math.min(localStart.y, localEnd.y),
      width: Math.max(1, rawWidth),
      height: Math.max(1, rawHeight),
      rotation,
    },
  }
}

export function transformLayoutSnapshot(
  snapshot: ComposeLayoutSnapshot,
  transforms: StageTransformMap,
): ComposeLayoutSnapshot {
  if (Object.keys(transforms).length === 0) return snapshot
  const boxes = { ...snapshot.boxes }
  Object.entries(transforms).forEach(([entityId, transform]) => {
    const box = boxes[entityId]
    if (!box) return
    boxes[entityId] = {
      ...box,
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
    }
  })
  return { ...snapshot, boxes }
}

export function bootstrapSelectionBounds(
  document: ComposeDocument,
  layoutSnapshot: ComposeLayoutSnapshot,
  ids: readonly string[],
) {
  return unionRects(ids
    .filter((id) => {
      const entity = document.entities[id]
      return entity ? getComposeVisibility(entity).visible : false
    })
    .map((id) => getEntityWorldBounds(document, layoutSnapshot, id)))
}
