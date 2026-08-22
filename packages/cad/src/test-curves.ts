import type { CadSegmentCurve, CadVisibleCurve } from './index'

/**
 * 取出某个 owner 的第一段线段几何。
 *
 * @remarks
 * 可见性遍历返回的是几何联合，而绝大多数用例断言的是线段的端点坐标。在这里一次性收窄，
 * 好过让每条用例各写一遍类型守卫。
 *
 * @internal
 */
export function segmentAt(
  curves: readonly CadVisibleCurve[],
  ownerId: string,
): CadSegmentCurve {
  const found = curves.find((item) => item.ownerId === ownerId && item.curve.kind === 'segment')
  if (!found || found.curve.kind !== 'segment') {
    throw new Error(`没有找到线段几何：${ownerId}`)
  }
  return found.curve
}
