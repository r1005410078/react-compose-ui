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
