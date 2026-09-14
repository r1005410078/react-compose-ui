import { decodeComposeInstancePath, isComposeInstancePath } from '@compose-ui/core'
import type { StageRect } from '@compose-ui/stage-engine'

/**
 * 求实例内部实体在 Stage surface 中的屏幕矩形。
 *
 * @remarks
 * 内部实体不在宿主文档里，几何由嵌套 Runtime 决定，因此只能读 DOM。返回值已是 surface
 * 相对坐标，可直接交给 Overlay，不需要再经过 viewport 变换——DOM 矩形本身已含缩放与平移。
 *
 * 内部实体可能因快照切换或尚未渲染而缺失，此时返回 `null` 而不是抛错。
 *
 * **这是全仓唯一一条按 Entity id 去 DOM 里查节点的路径，因此 `hostId` MUST 豁免视口裁剪**
 * （`useStageCulledEntityIds` 的节点级豁免，今天由「选择集」这一项覆盖它）。再新增这类查询
 * 时必须同时把它的目标放进那份豁免——判据是「谁按 id 查 DOM 谁豁免」，不是枚举场景。
 *
 * @param surface - Stage surface 元素
 * @param address - 复合地址；传入宿主裸 ID 时返回 `null`
 *
 * @public
 */
export function instanceSelectionScreenBounds(
  surface: Element,
  address: string,
): StageRect | null {
  if (!isComposeInstancePath(address)) return null
  const decoded = decodeComposeInstancePath(address)
  if (!decoded.ok) return null
  const [hostId, innerId] = decoded.segments
  if (!hostId || !innerId) return null
  const host = surface.querySelector(`[data-entity-id="${CSS.escape(hostId)}"]`)
  if (!host) return null
  const inner = host.querySelector(
    `[data-component-instance-entity-id="${CSS.escape(innerId)}"]`,
  )
  if (!inner) return null
  const innerRect = inner.getBoundingClientRect()
  const surfaceRect = surface.getBoundingClientRect()
  return {
    x: innerRect.left - surfaceRect.left,
    y: innerRect.top - surfaceRect.top,
    width: innerRect.width,
    height: innerRect.height,
  }
}
