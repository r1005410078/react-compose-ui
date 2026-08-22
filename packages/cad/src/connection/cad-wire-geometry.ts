import type { CadDocument, CadPoint, CadWireEndpoint } from '../document'
import type { CadSegment } from '../geometry'
import { resolveCadPortPoint } from './cad-port-geometry'

/**
 * 解出一个导线端点的世界坐标。
 *
 * @returns 世界坐标；端口引用不完整时为 `null`。
 * @public
 */
export function resolveCadWireEndpoint(
  document: CadDocument,
  endpoint: CadWireEndpoint,
): CadPoint | null {
  if (endpoint.kind === 'free') return endpoint.point
  return resolveCadPortPoint(document, endpoint.entityId, endpoint.portId)
}

/**
 * 解出一条导线的世界几何。
 *
 * @remarks
 * **求解不存储**，与块实例几何是同一条原则。收益不是少存两个数，而是「移动后重解」这段代码
 * 根本不存在：移动、复制、撤销、导入，任何改变实例位置的路径都自动正确。
 *
 * @returns 世界线段；任一端点引用不完整时为 `null`（悬空引用已被文档校验拦下，能走到这里
 * 只可能是外部写入，画半条线不如不画）。
 * @public
 */
export function resolveCadWireSegment(
  document: CadDocument,
  wire: { readonly start: CadWireEndpoint; readonly end: CadWireEndpoint },
): CadSegment | null {
  const start = resolveCadWireEndpoint(document, wire.start)
  const end = resolveCadWireEndpoint(document, wire.end)
  if (!start || !end) return null
  return { start, end }
}
