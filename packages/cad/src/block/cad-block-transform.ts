import type { CadInsert } from '../document'
import type { CadInputPoint } from '../point-input'

/**
 * 把块局部坐标变换到世界坐标。
 *
 * @remarks
 * 顺序是**比例 → 旋转 → 平移**，与 DXF 的 INSERT 一致。换个顺序不是风格问题：先平移再旋转
 * 会绕世界原点转，符号会甩到图纸另一头。
 *
 * 旋转按屏幕坐标系：Y 轴向下，因此正角在屏幕上是顺时针。这与 `parseCadCoordinate` 的极坐标
 * 取同一个约定——两处不一致会让「45 度」在命令行和插入参数里指向不同方向。
 *
 * @param point - 块局部坐标下的点。
 * @param insert - 插入参数。
 * @returns 世界坐标下的点。
 * @public
 */
export function transformCadBlockPoint(point: CadInputPoint, insert: CadInsert): CadInputPoint {
  const scaledX = point.x * insert.scale.x
  const scaledY = point.y * insert.scale.y
  const radians = (insert.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: insert.position.x + scaledX * cos - scaledY * sin,
    y: insert.position.y + scaledX * sin + scaledY * cos,
  }
}

/** 默认插入参数：不缩放、不旋转。 @public */
export function createCadInsert(
  blockId: string,
  position: CadInputPoint,
  overrides: { readonly rotation?: number; readonly scale?: CadInputPoint } = {},
): CadInsert {
  return {
    blockId,
    position: { x: position.x, y: position.y },
    rotation: overrides.rotation ?? 0,
    scale: overrides.scale ? { x: overrides.scale.x, y: overrides.scale.y } : { x: 1, y: 1 },
  }
}

/**
 * 把世界坐标反变换回块局部坐标。
 *
 * @remarks
 * {@link transformCadBlockPoint} 的逆：平移 → 旋转 → 比例，每一步都反着来。`PORT` 命令用它把
 * 用户在图面上指的点写回块定义。
 *
 * 任一轴比例为 0 时变换不可逆，返回 `null` 而不是产出 `Infinity`。这不是理论情况——镜像符号
 * 用负比例是常规用法，手滑写成 0 完全可能，而 `Infinity` 会一路流进文档。
 *
 * @returns 块局部坐标；不可逆时为 `null`。
 * @public
 */
export function inverseCadBlockPoint(
  point: CadInputPoint,
  insert: CadInsert,
): CadInputPoint | null {
  if (insert.scale.x === 0 || insert.scale.y === 0) return null
  const dx = point.x - insert.position.x
  const dy = point.y - insert.position.y
  const radians = (insert.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  // 旋转矩阵是正交的，因此逆旋转即转置：绕 -θ 转。
  const unrotatedX = dx * cos + dy * sin
  const unrotatedY = -dx * sin + dy * cos
  return { x: unrotatedX / insert.scale.x, y: unrotatedY / insert.scale.y }
}
