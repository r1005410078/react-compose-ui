import { transformCadBlockPoint } from '../block/cad-block-transform'
import {
  getCadInsert,
  getCadPlacement,
  type CadDocument,
  type CadPoint,
} from '../document'

/**
 * 图纸上一个已解算的实例端口。
 *
 * @public
 */
export interface CadInstancePort {
  /** 承载这个端口的顶层块实例 Entity id。 */
  readonly entityId: string
  /** 块定义中声明的端口 id。 */
  readonly portId: string
  /** 世界坐标。 */
  readonly point: CadPoint
}

/**
 * 求出图纸上全部可见实例的端口。
 *
 * @remarks
 * 隐藏图层上的实例不参与：它在屏幕上看不见，捕捉到它的端口会让光标莫名其妙地跳走。这与
 * `collectCadVisibleCurves` 对可见性的判断是同一条。
 *
 * @public
 */
export function collectCadInstancePorts(document: CadDocument): readonly CadInstancePort[] {
  const visibleLayers = new Set(
    document.layers.filter(({ visible }) => visible).map(({ id }) => id),
  )
  const result: CadInstancePort[] = []
  for (const id of document.rootIds) {
    const entity = document.entities[id]
    if (!entity) continue
    if (!visibleLayers.has(getCadPlacement(entity)?.layerId ?? '')) continue
    const insert = getCadInsert(entity)
    if (!insert) continue
    const block = document.blocks[insert.blockId]
    if (!block) continue
    for (const port of block.ports) {
      const { x, y } = transformCadBlockPoint(port.position, insert)
      result.push({ entityId: id, portId: port.id, point: { x, y } })
    }
  }
  return result
}

/**
 * 解出一个端口的世界坐标。
 *
 * @remarks
 * 不走 {@link collectCadInstancePorts}：那条按可见性过滤，而导线的几何**与图层可见性无关**——
 * 把承载实例的图层关掉，导线不应该跟着塌到原点。
 *
 * @returns 世界坐标；实例不存在、不是块实例或块未声明该端口时为 `null`。
 * @public
 */
export function resolveCadPortPoint(
  document: CadDocument,
  entityId: string,
  portId: string,
): CadPoint | null {
  const entity = document.entities[entityId]
  if (!entity) return null
  const insert = getCadInsert(entity)
  if (!insert) return null
  const port = document.blocks[insert.blockId]?.ports.find(({ id }) => id === portId)
  if (!port) return null
  const { x, y } = transformCadBlockPoint(port.position, insert)
  return { x, y }
}
