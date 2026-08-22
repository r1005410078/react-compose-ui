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
