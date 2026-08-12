import {
  getComposeHierarchy,
  getComposeTransform,
  getComposeVisibility,
  isComposeGroupEntity,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type ComposeSpatialTransform,
} from '@compose-ui/core'

/**
 * 二维坐标。
 *
 * @public
 */
export interface StagePoint {
  readonly x: number
  readonly y: number
}

/**
 * 轴对齐矩形。
 *
 * @public
 */
export interface StageRect extends StagePoint {
  readonly width: number
  readonly height: number
}

/**
 * 无限 Stage 的受控视口。
 *
 * @remarks x/y 使用屏幕 CSS 像素，zoom 限制为 0.1～8。
 * @public
 */
export interface StageViewport extends StagePoint {
  readonly zoom: number
}

/**
 * DOMMatrix 兼容的二维仿射矩阵字段。
 *
 * @public
 */
export interface StageMatrix {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly e: number
  readonly f: number
}

/** Stage 几何算法使用的扁平 Transform 投影；不进入 ComposeDocument。 @public */
export interface StageTransform {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
}

/**
 * 一条世界坐标吸附候选线。
 *
 * @public
 */
export interface StageGuide {
  readonly axis: 'x' | 'y'
  readonly value: number
  /** 候选来源；距离相同时持久化辅助线优先于节点。 */
  readonly source?: 'guide' | 'node'
}

/** @public */
export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const identity: StageMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/**
 * 把世界坐标转换为 Stage viewport 屏幕坐标。
 *
 * @public
 */
export function worldToScreen(point: StagePoint, viewport: StageViewport): StagePoint {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  }
}

/**
 * 把 viewport 屏幕坐标转换为无限世界坐标。
 *
 * @public
 */
export function screenToWorld(point: StagePoint, viewport: StageViewport): StagePoint {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}

/**
 * 计算保持指定屏幕点下世界坐标不动的新视口。
 *
 * @public
 */
export function zoomViewportAt(
  viewport: StageViewport,
  screenPoint: StagePoint,
  requestedZoom: number,
): StageViewport {
  const zoom = Math.min(8, Math.max(0.1, requestedZoom))
  const anchor = screenToWorld(screenPoint, viewport)
  return {
    x: screenPoint.x - anchor.x * zoom,
    y: screenPoint.y - anchor.y * zoom,
    zoom,
  }
}

/**
 * 按应用顺序组合两个二维矩阵。
 *
 * @public
 */
export function multiplyMatrices(left: StageMatrix, right: StageMatrix): StageMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

/**
 * 将二维矩阵应用到坐标。
 *
 * @public
 */
export function applyMatrix(matrix: StageMatrix, point: StagePoint): StagePoint {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  }
}

/**
 * 求可逆二维仿射矩阵的 inverse。
 *
 * @throws 矩阵不可逆时抛出错误。
 * @public
 */
export function invertMatrix(matrix: StageMatrix): StageMatrix {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < Number.EPSILON) throw new Error('Stage matrix is not invertible')
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  }
}

function translation(x: number, y: number): StageMatrix {
  return { ...identity, e: x, f: y }
}

function rotation(degrees: number): StageMatrix {
  const radians = degrees * Math.PI / 180
  return {
    a: Math.cos(radians),
    b: Math.sin(radians),
    c: -Math.sin(radians),
    d: Math.cos(radians),
    e: 0,
    f: 0,
  }
}

/**
 * 将节点相对父级的 transform 转成绕自身中心旋转的矩阵。
 *
 * @public
 */
export function matrixFromTransform(transform: StageTransform): StageMatrix {
  const centerX = transform.width / 2
  const centerY = transform.height / 2
  return multiplyMatrices(
    translation(transform.x + centerX, transform.y + centerY),
    multiplyMatrices(rotation(transform.rotation), translation(-centerX, -centerY)),
  )
}

/**
 * 将无 skew 的世界/局部矩阵分解回节点 transform。
 *
 * @remarks resize 产生的正 scale 已由 width/height 表达，位置反解会剥离矩阵 scale。
 * @param matrix - 要分解的二维矩阵。
 * @param width - 结果节点宽度。
 * @param height - 结果节点高度。
 * @public
 */
export function decomposeMatrix(
  matrix: StageMatrix,
  width: number,
  height: number,
): StageTransform {
  const rotationRadians = Math.atan2(matrix.b, matrix.a)
  const rotation = rotationRadians * 180 / Math.PI
  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)
  const centerX = width / 2
  const centerY = height / 2
  return {
    // Resize mapping 已把 scale 写入目标 width/height；位置反解只能使用纯旋转分量，
    // 否则会再次应用 scale，导致手柄相对指针向固定边的反方向漂移。
    x: matrix.e - centerX + cosine * centerX - sine * centerY,
    y: matrix.f - centerY + sine * centerX + cosine * centerY,
    width,
    height,
    rotation,
  }
}

/**
 * 创建平移矩阵。
 *
 * @public
 */
export function translationMatrix(x: number, y: number): StageMatrix {
  return translation(x, y)
}

/**
 * 创建围绕世界坐标点旋转的矩阵。
 *
 * @public
 */
export function rotationMatrixAround(center: StagePoint, degrees: number): StageMatrix {
  return multiplyMatrices(
    translation(center.x, center.y),
    multiplyMatrices(rotation(degrees), translation(-center.x, -center.y)),
  )
}

/**
 * 创建把一个世界矩形线性映射到另一个矩形的矩阵。
 *
 * @public
 */
export function rectMappingMatrix(from: StageRect, to: StageRect): StageMatrix {
  const scaleX = to.width / from.width
  const scaleY = to.height / from.height
  return multiplyMatrices(
    translation(to.x, to.y),
    multiplyMatrices(
      { a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0 },
      translation(-from.x, -from.y),
    ),
  )
}

/**
 * 返回 Entity 的直接父 Entity ID；根 Entity 返回 null。
 *
 * @public
 */
export function getEntityParentId(document: ComposeDocument, entityId: string): string | null {
  if (document.rootIds.includes(entityId)) return null
  for (const entity of Object.values(document.entities)) {
    if (getComposeHierarchy(entity)?.childIds.includes(entityId)) return entity.id
  }
  return null
}

/**
 * 组合节点与全部祖先的世界矩阵。
 *
 * @public
 */
export function getEntityWorldMatrix(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
): StageMatrix {
  const entity = document.entities[entityId]
  if (!entity) throw new Error(`Unknown Entity ${entityId}`)
  const box = snapshot.boxes[entityId]
  if (!box) throw new Error(`Layout snapshot ${snapshot.revision} has no box for Entity ${entityId}`)
  const local = matrixFromTransform({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: getComposeTransform(entity).rotation,
  })
  const parentId = getEntityParentId(document, entityId)
  return parentId === null
    ? local
    : multiplyMatrices(getEntityWorldMatrix(document, snapshot, parentId), local)
}

/**
 * 计算节点旋转四角的世界轴对齐包围框。
 *
 * @public
 */
export function getEntityWorldBounds(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entityId: string,
): StageRect {
  const entity = document.entities[entityId]
  if (!entity) throw new Error(`Unknown Entity ${entityId}`)
  const box = snapshot.boxes[entityId]
  if (!box) throw new Error(`Layout snapshot ${snapshot.revision} has no box for Entity ${entityId}`)
  const ownBounds = () => {
    const matrix = getEntityWorldMatrix(document, snapshot, entityId)
    const points = [
      applyMatrix(matrix, { x: 0, y: 0 }),
      applyMatrix(matrix, { x: box.width, y: 0 }),
      applyMatrix(matrix, { x: box.width, y: box.height }),
      applyMatrix(matrix, { x: 0, y: box.height }),
    ]
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return {
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
    }
  }
  if (isComposeGroupEntity(entity)) {
    const descendantBounds: StageRect[] = []
    const visit = (childId: string) => {
      const child = document.entities[childId]
      if (!child || !getComposeVisibility(child).visible) return
      descendantBounds.push(getEntityWorldBounds(document, snapshot, childId))
      if (!isComposeGroupEntity(child)) {
        getComposeHierarchy(child)?.childIds.forEach(visit)
      }
    }
    getComposeHierarchy(entity)?.childIds.forEach(visit)
    return unionRects(descendantBounds) ?? ownBounds()
  }
  return ownBounds()
}

/** 将持久化 ECS Transform 投影为 Stage 几何值。 @public */
export function toStageTransform(transform: ComposeSpatialTransform): StageTransform {
  return {
    x: transform.position.x,
    y: transform.position.y,
    width: transform.size.width,
    height: transform.size.height,
    rotation: transform.rotation,
  }
}

/** 将 Stage 几何值转回持久化 ECS Transform。 @public */
export function toComposeTransform(transform: StageTransform): ComposeSpatialTransform {
  return {
    position: { x: transform.x, y: transform.y },
    size: { width: transform.width, height: transform.height },
    rotation: transform.rotation,
  }
}

/**
 * 合并多个世界矩形。
 *
 * @public
 */
export function unionRects(rects: readonly StageRect[]): StageRect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * 判断两个世界矩形是否相交。
 *
 * @remarks
 * 边缘接触算相交。框选的「碰到即选中」预期下，用户把框正好拖到节点边上时应当选中，
 * 因此这里不做开区间判定。
 * @public
 */
export function rectsIntersect(first: StageRect, second: StageRect): boolean {
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y
}

/**
 * 判断 `inner` 是否完全落在 `outer` 内。
 *
 * @remarks
 * 边缘重合算包含，与 {@link rectsIntersect} 的闭区间判定保持一致。
 * @public
 */
export function rectContains(outer: StageRect, inner: StageRect): boolean {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
}

function rectLines(rect: StageRect, delta: StagePoint, axis: 'x' | 'y') {
  return axis === 'x'
    ? [
        rect.x + delta.x,
        rect.x + rect.width / 2 + delta.x,
        rect.x + rect.width + delta.x,
      ]
    : [
        rect.y + delta.y,
        rect.y + rect.height / 2 + delta.y,
        rect.y + rect.height + delta.y,
      ]
}

/**
 * 以固定 6 屏幕像素阈值修正移动 delta 并返回命中的世界参考线。
 *
 * @public
 */
export function snapTranslation(
  bounds: StageRect,
  delta: StagePoint,
  candidates: readonly StageGuide[],
  zoom: number,
  disabled = false,
  grid?: {
    readonly stepX: number
    readonly stepY: number
    readonly offsetX: number
    readonly offsetY: number
    readonly enabled: boolean
  },
): { readonly delta: StagePoint; readonly guides: readonly StageGuide[] } {
  if (disabled) return { delta, guides: [] }
  const threshold = 6 / zoom
  const next = { ...delta }
  const guides: StageGuide[] = []
  for (const axis of ['x', 'y'] as const) {
    let best: { distance: number; correction: number; guide: StageGuide } | null = null
    for (const guide of candidates.filter((item) => item.axis === axis)) {
      for (const line of rectLines(bounds, delta, axis)) {
        const correction = guide.value - line
        const distance = Math.abs(correction)
        const preferred = best
          && distance === best.distance
          && guide.source === 'guide'
          && best.guide.source !== 'guide'
        if (distance <= threshold && (!best || distance < best.distance || preferred)) {
          best = { distance, correction, guide }
        }
      }
    }
    if (best) {
      if (axis === 'x') next.x += best.correction
      else next.y += best.correction
      guides.push(best.guide)
    }
    else if (grid?.enabled) {
      const step = axis === 'x' ? grid.stepX : grid.stepY
      const offset = axis === 'x' ? grid.offsetX : grid.offsetY
      const coordinate = axis === 'x'
        ? bounds.x + delta.x
        : bounds.y + delta.y
      const snapped = offset + Math.round((coordinate - offset) / step) * step
      if (axis === 'x') next.x += snapped - coordinate
      else next.y += snapped - coordinate
    }
  }
  return { delta: next, guides }
}

/**
 * 根据世界指针位置调整共同轴对齐包围框。
 *
 * @public
 */
export function resizeBounds(
  bounds: StageRect,
  handle: ResizeHandle,
  point: StagePoint,
  modifiers: { readonly shift?: boolean; readonly alt?: boolean } = {},
): StageRect {
  const minimum = 1
  let left = bounds.x
  let right = bounds.x + bounds.width
  let top = bounds.y
  let bottom = bounds.y + bounds.height
  const horizontal = handle.includes('e') ? 'e' : handle.includes('w') ? 'w' : null
  const vertical = handle.includes('s') ? 's' : handle.includes('n') ? 'n' : null

  if (horizontal === 'e') right = Math.max(left + minimum, point.x)
  if (horizontal === 'w') left = Math.min(right - minimum, point.x)
  if (vertical === 's') bottom = Math.max(top + minimum, point.y)
  if (vertical === 'n') top = Math.min(bottom - minimum, point.y)

  if (modifiers.alt) {
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    if (horizontal) {
      const half = Math.max(minimum / 2, Math.abs((horizontal === 'e' ? right : left) - centerX))
      left = centerX - half
      right = centerX + half
    }
    if (vertical) {
      const half = Math.max(minimum / 2, Math.abs((vertical === 's' ? bottom : top) - centerY))
      top = centerY - half
      bottom = centerY + half
    }
  }

  if (modifiers.shift && horizontal && vertical) {
    const ratio = bounds.width / bounds.height
    let width = right - left
    let height = bottom - top
    if (width / height > ratio) height = width / ratio
    else width = height * ratio
    if (horizontal === 'w') left = right - width
    else right = left + width
    if (vertical === 'n') top = bottom - height
    else bottom = top + height
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** 旋转角度吸附步进（度），与 Figma / Godot 默认一致。 @public */
export const ROTATION_SNAP_DEGREES = 15

/**
 * 计算指针围绕共同中心产生的顺时针角度变化。
 *
 * @remarks
 * `shift` 时按 {@link ROTATION_SNAP_DEGREES} 吸附。若提供 `baseRotation`，吸附的是
 * 「实体绝对旋转角」（`baseRotation + delta`），否则仅吸附相对 delta。
 *
 * @public
 */
export function rotationFromPointer(
  center: StagePoint,
  start: StagePoint,
  current: StagePoint,
  shiftOrOptions: boolean | {
    readonly shift?: boolean
    /** 手势开始时参考实体的旋转角（度）。 */
    readonly baseRotation?: number
    readonly step?: number
  } = false,
): number {
  const options = typeof shiftOrOptions === 'boolean'
    ? { shift: shiftOrOptions }
    : shiftOrOptions
  const shift = options.shift ?? false
  const step = options.step ?? ROTATION_SNAP_DEGREES
  const baseRotation = options.baseRotation ?? 0
  const angle = (point: StagePoint) => Math.atan2(point.y - center.y, point.x - center.x)
  let degrees = (angle(current) - angle(start)) * 180 / Math.PI
  while (degrees <= -180) degrees += 360
  while (degrees > 180) degrees -= 360
  if (!shift) return degrees
  // 绝对角吸附：使 base + delta 落在 step 的整数倍上。
  const target = Math.round((baseRotation + degrees) / step) * step
  return target - baseRotation
}

/**
 * 将指针投影到「起点方位 + 旋转 delta」射线上，用于角度吸附时的拉线视觉对齐。
 *
 * @public
 */
export function pointOnRotationRay(
  center: StagePoint,
  start: StagePoint,
  current: StagePoint,
  deltaDegrees: number,
): StagePoint {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const currentLength = Math.hypot(current.x - center.x, current.y - center.y)
  const startLength = Math.hypot(start.x - center.x, start.y - center.y)
  const length = currentLength > 1 ? currentLength : (startLength > 1 ? startLength : 1)
  const angle = startAngle + deltaDegrees * Math.PI / 180
  return {
    x: center.x + Math.cos(angle) * length,
    y: center.y + Math.sin(angle) * length,
  }
}
