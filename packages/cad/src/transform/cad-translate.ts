import {
  CAD_COMPONENT_KEYS,
  getCadInsert,
  getCadLine,
  type CadPoint,
} from '../document'
import type { ComposeEntity } from '@compose-ui/core'

/**
 * 平移一个 Entity。
 *
 * @remarks
 * **按 Component 分派而不是统一改坐标**，因为位移对两类 Entity 的含义不同：
 *
 * - `CadLine`：两个端点各加一个位移。
 * - `CadInsert`：只改插入点，**块定义一个字节都不动**。块存在的理由就是「改一次定义，全部
 *   实例跟着变」；位移若下沉到块内几何，移动一个实例会把所有实例一起搬走。
 *
 * 新增图元类型时在这里补一支，而不是让每个调用方各自认识所有 Component。认不出来的 Entity
 * 原样返回——静默不动好过按错误的语义搬走它。
 *
 * @param delta - 世界坐标的位移。
 * @returns 平移后的 Entity；无需改动时返回入参本身。
 * @public
 */
export function translateCadEntity(entity: ComposeEntity, delta: CadPoint): ComposeEntity {
  const shift = (point: CadPoint): CadPoint => ({ x: point.x + delta.x, y: point.y + delta.y })

  const line = getCadLine(entity)
  if (line) {
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.line]: { start: shift(line.start), end: shift(line.end) },
      },
    }
  }

  const insert = getCadInsert(entity)
  if (insert) {
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.insert]: { ...insert, position: shift(insert.position) },
      },
    }
  }

  return entity
}
