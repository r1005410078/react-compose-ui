import {
  evaluateComposePaintAtLocalPoint,
  type ComposeGradientStop,
  type ComposePaint,
  type ComposePaintPoint,
} from '@compose-ui/core'

export type ComposeGradientPaint = Extract<
  ComposePaint,
  { readonly kind: 'linear-gradient' | 'radial-gradient' | 'angular-gradient' }
>

export type GradientGeometryHandle =
  | 'linear-start'
  | 'linear-end'
  | 'radial-center'
  | 'radial-radius-x'
  | 'radial-radius-y'
  | 'angular-center'
  | 'angular-arm'

const MINIMUM_RADIUS = 0.01

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** 同位置色标保留原有次序，避免拖动穿越时出现无关的序列抖动。 */
export function orderedGradientStops(
  stops: readonly ComposeGradientStop[],
): readonly ComposeGradientStop[] {
  return [...stops].sort((left, right) => left.position - right.position)
}

export function nextGradientStopId(stops: readonly ComposeGradientStop[]): string {
  const used = new Set(stops.map((stop) => stop.id))
  let suffix = 0
  while (used.has(`paint-stop-${suffix}`)) suffix += 1
  return `paint-stop-${suffix}`
}

export function largestGradientGapPosition(stops: readonly ComposeGradientStop[]): number {
  const sorted = orderedGradientStops(stops)
  let left = sorted[0]?.position ?? 0
  let largestGap = -1
  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]!.position
    const gap = next - sorted[index - 1]!.position
    // 只接受严格更大的空档，因此并列时自然保留最左侧空档。
    if (gap > largestGap) {
      largestGap = gap
      left = sorted[index - 1]!.position
    }
  }
  return clamp(left + Math.max(0, largestGap) / 2)
}

export function pointAtGradientPosition(
  paint: ComposeGradientPaint,
  position: number,
): ComposePaintPoint {
  if (paint.kind === 'linear-gradient') {
    return {
      x: paint.start.x + (paint.end.x - paint.start.x) * position,
      y: paint.start.y + (paint.end.y - paint.start.y) * position,
    }
  }
  if (paint.kind === 'radial-gradient') {
    return { x: paint.center.x + paint.radiusX * position, y: paint.center.y }
  }
  const radians = (paint.angle + position * 360) * Math.PI / 180
  return {
    x: paint.center.x + Math.cos(radians),
    y: paint.center.y + Math.sin(radians),
  }
}

export function insertGradientStop(
  paint: ComposeGradientPaint,
  requestedPosition?: number,
): { readonly paint: ComposeGradientPaint; readonly stop: ComposeGradientStop } | null {
  if (paint.stops.length >= 8) return null
  const position = requestedPosition === undefined
    ? largestGradientGapPosition(paint.stops)
    : clamp(requestedPosition)
  const stop: ComposeGradientStop = {
    id: nextGradientStopId(paint.stops),
    position,
    color: evaluateComposePaintAtLocalPoint(
      paint,
      pointAtGradientPosition(paint, position),
    ),
  }
  return {
    paint: { ...paint, stops: orderedGradientStops([...paint.stops, stop]) },
    stop,
  }
}

export function moveGradientStop(
  paint: ComposeGradientPaint,
  id: string,
  position: number,
): ComposeGradientPaint {
  return {
    ...paint,
    stops: orderedGradientStops(paint.stops.map((stop) => (
      stop.id === id ? { ...stop, position: clamp(position) } : stop
    ))),
  }
}

export function removeGradientStop(
  paint: ComposeGradientPaint,
  id: string,
): { readonly paint: ComposeGradientPaint; readonly selectedStopId: string } | null {
  if (paint.stops.length <= 2) return null
  const stops = orderedGradientStops(paint.stops)
  const removedIndex = stops.findIndex((stop) => stop.id === id)
  if (removedIndex < 0) return null
  const remaining = stops.filter((stop) => stop.id !== id)
  return {
    paint: { ...paint, stops: remaining },
    selectedStopId: remaining[Math.min(removedIndex, remaining.length - 1)]!.id,
  }
}

export function normalizeGradientAngle(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function gradientAngle(paint: ComposeGradientPaint): number {
  if (paint.kind === 'linear-gradient') {
    return normalizeGradientAngle(
      Math.atan2(paint.end.y - paint.start.y, paint.end.x - paint.start.x) * 180 / Math.PI,
    )
  }
  return paint.kind === 'angular-gradient'
    ? normalizeGradientAngle(paint.angle)
    : 0
}

function cleanTrigonometricValue(value: number): number {
  if (Math.abs(value) < 1e-12) return 0
  if (Math.abs(value - 1) < 1e-12) return 1
  if (Math.abs(value + 1) < 1e-12) return -1
  return value
}

export function gradientPaintWithAngle(
  paint: ComposeGradientPaint,
  angle: number,
): ComposeGradientPaint {
  const normalized = normalizeGradientAngle(angle)
  if (paint.kind === 'angular-gradient') return { ...paint, angle: normalized }
  if (paint.kind !== 'linear-gradient') return paint
  const center = {
    x: (paint.start.x + paint.end.x) / 2,
    y: (paint.start.y + paint.end.y) / 2,
  }
  const length = Math.max(
    0.000_001,
    Math.hypot(paint.end.x - paint.start.x, paint.end.y - paint.start.y),
  )
  const radians = normalized * Math.PI / 180
  const cosine = cleanTrigonometricValue(Math.cos(radians))
  const sine = cleanTrigonometricValue(Math.sin(radians))
  const delta = { x: cosine * length / 2, y: sine * length / 2 }
  return {
    ...paint,
    start: { x: center.x - delta.x, y: center.y - delta.y },
    end: { x: center.x + delta.x, y: center.y + delta.y },
  }
}

export function gradientGeometryPoint(
  paint: ComposeGradientPaint,
  handle: GradientGeometryHandle,
): ComposePaintPoint {
  if (paint.kind === 'linear-gradient') {
    return handle === 'linear-start' ? paint.start : paint.end
  }
  if (paint.kind === 'radial-gradient') {
    if (handle === 'radial-center') return paint.center
    if (handle === 'radial-radius-y') {
      return { x: paint.center.x, y: paint.center.y + paint.radiusY }
    }
    return { x: paint.center.x + paint.radiusX, y: paint.center.y }
  }
  if (handle === 'angular-center') return paint.center
  const radians = paint.angle * Math.PI / 180
  return {
    x: paint.center.x + Math.cos(radians) * 0.36,
    y: paint.center.y + Math.sin(radians) * 0.36,
  }
}

export function updateGradientGeometry(
  paint: ComposeGradientPaint,
  handle: GradientGeometryHandle,
  requestedPoint: ComposePaintPoint,
): ComposeGradientPaint {
  const point = { x: clamp(requestedPoint.x), y: clamp(requestedPoint.y) }
  if (paint.kind === 'linear-gradient') {
    if (handle === 'linear-start') return { ...paint, start: point }
    if (handle === 'linear-end') return { ...paint, end: point }
    return paint
  }
  if (paint.kind === 'radial-gradient') {
    if (handle === 'radial-center') return { ...paint, center: point }
    if (handle === 'radial-radius-x') {
      return {
        ...paint,
        radiusX: clamp(Math.abs(point.x - paint.center.x), MINIMUM_RADIUS),
      }
    }
    if (handle === 'radial-radius-y') {
      return {
        ...paint,
        radiusY: clamp(Math.abs(point.y - paint.center.y), MINIMUM_RADIUS),
      }
    }
    return paint
  }
  if (handle === 'angular-center') return { ...paint, center: point }
  if (handle === 'angular-arm') {
    return {
      ...paint,
      angle: normalizeGradientAngle(
        Math.atan2(point.y - paint.center.y, point.x - paint.center.x) * 180 / Math.PI,
      ),
    }
  }
  return paint
}
