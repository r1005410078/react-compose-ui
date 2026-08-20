import { applyMatrix, invertMatrix, type StagePoint } from './geometry'
import { resolvedSpatialTransform } from './transform-preview'
import type { ComposePaint } from '@compose-ui/core'
import type { StageSceneIndex } from './scene-index'
import type { StagePaintHandleKind } from './interaction-controller'

/**
 * 把世界坐标换算成该 Entity 的 Paint 局部坐标。
 *
 * @remarks
 * 结构化 Paint 的几何全部用 0–1 的归一化局部坐标表达（渐变起止点、圆心、色标位置），
 * 与 Entity 的世界变换无关——旋转或缩放一个矩形不该改写它的渐变定义。因此这里先用逆世界
 * 矩阵回到局部像素，再除以 resolved 尺寸归一化。
 *
 * 用 resolved 尺寸而不是 `LayoutItem` 上的声明尺寸：Auto Layout 下的 Hug/Fill 只有求解后
 * 才有真实宽高，拿声明值会让渐变柄在这类容器上整体偏移。
 *
 * @returns 归一化局部点；Entity 不存在、没有世界矩阵或尺寸未求解时为 `null`。
 */
export function paintSpacePoint(
  index: StageSceneIndex,
  entityId: string,
  worldPoint: StagePoint,
): { readonly x: number; readonly y: number } | null {
  const entity = index.document.entities[entityId]
  const matrix = index.getWorldMatrix(entityId)
  if (!entity || !matrix) return null
  const transform = resolvedSpatialTransform(index, entityId)
  if (!transform) return null
  const local = applyMatrix(invertMatrix(matrix), worldPoint)
  return { x: local.x / transform.width, y: local.y / transform.height }
}

/**
 * 按被拖动的控制柄把指针位置写回结构化 Paint。
 *
 * @remarks
 * Solid 与 Image 没有可拖动的几何，原样返回。色标柄（`*-stop`）改的是 `position` 而不是
 * 坐标：色标只沿着渐变自身的参数轴滑动，因此各类渐变把指针投影回自己的参数——线性投影到
 * 起止向量、径向取到圆心的归一化距离、角向取相对起始角的转角。
 *
 * 径向半径钳到一个极小正数而不是 0：半径为 0 时求值会除零，且此后再也拖不回来。
 *
 * @returns 新的 Paint；输入 Paint 不被修改。
 */
export function updatePaintFromPointer(
  paint: ComposePaint,
  handle: StagePaintHandleKind,
  stopId: string | undefined,
  local: { readonly x: number; readonly y: number },
): ComposePaint {
  if (paint.kind === 'solid' || paint.kind === 'image') return paint
  if (paint.kind === 'linear-gradient') {
    if (handle === 'linear-start') return { ...paint, start: local }
    if (handle === 'linear-end') return { ...paint, end: local }
    const x = paint.end.x - paint.start.x
    const y = paint.end.y - paint.start.y
    const length = x * x + y * y
    const position = length === 0 ? 0 : Math.min(1, Math.max(0, ((local.x - paint.start.x) * x + (local.y - paint.start.y) * y) / length))
    return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
  }
  if (paint.kind === 'radial-gradient') {
    if (handle === 'radial-center') return { ...paint, center: local }
    if (handle === 'radial-radius-x') return { ...paint, radiusX: Math.max(0.000_001, Math.abs(local.x - paint.center.x)) }
    if (handle === 'radial-radius-y') return { ...paint, radiusY: Math.max(0.000_001, Math.abs(local.y - paint.center.y)) }
    const position = Math.min(1, Math.max(0, Math.abs(local.x - paint.center.x) / paint.radiusX))
    return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
  }
  if (handle === 'angular-center') return { ...paint, center: local }
  const degrees = Math.atan2(local.y - paint.center.y, local.x - paint.center.x) * 180 / Math.PI
  const angle = ((degrees % 360) + 360) % 360
  if (handle === 'angular-arm') return { ...paint, angle }
  const position = (((angle - paint.angle) % 360) + 360) % 360 / 360
  return { ...paint, stops: paint.stops.map((stop) => stop.id === stopId ? { ...stop, position } : stop) }
}
