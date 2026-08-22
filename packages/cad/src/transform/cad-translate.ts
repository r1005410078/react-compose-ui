import {
  CAD_COMPONENT_KEYS,
  getCadArc,
  getCadInsert,
  getCadLine,
  getCadPolyline,
  getCadText,
  getCadWire,
  type CadDocument,
  type CadPoint,
  type CadWireEndpoint,
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
 * - `CadWire`：只动自由端点，**端口端点保持绑定**。导线的位置由它连着谁决定，不由自己决定；
 *   两端都绑定的导线因此平移是 no-op。
 * - `CadArc`：只移圆心，半径与角度不动。
 * - `CadText`：只移插入点，字号与旋转不动。
 * - `CadPolyline`：全部顶点各加一个位移。
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

  const polyline = getCadPolyline(entity)
  if (polyline) {
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.polyline]: {
          ...polyline,
          vertices: polyline.vertices.map(shift),
        },
      },
    }
  }

  const text = getCadText(entity)
  if (text) {
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.text]: { ...text, position: shift(text.position) },
      },
    }
  }

  const arc = getCadArc(entity)
  if (arc) {
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.arc]: { ...arc, center: shift(arc.center) },
      },
    }
  }

  const wire = getCadWire(entity)
  if (wire) {
    const shiftEndpoint = (endpoint: CadWireEndpoint): CadWireEndpoint => (
      endpoint.kind === 'free' ? { kind: 'free', point: shift(endpoint.point) } : endpoint
    )
    return {
      ...entity,
      components: {
        ...entity.components,
        [CAD_COMPONENT_KEYS.wire]: {
          start: shiftEndpoint(wire.start),
          end: shiftEndpoint(wire.end),
        },
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

/**
 * 按位移产出一份预览文档。
 *
 * @remarks
 * 拖动预览用它，而不是对已渲染的线段施加屏幕位移。两者的差别在导线上立刻现形：拖动一台设备
 * 时它的导线**并未被选中**，屏幕位移的预览里不动，提交后却会动；反过来，两端都绑定的导线
 * 平移是 no-op，屏幕位移的预览会让它跟着走然后在松手时弹回。
 *
 * 逐个调用与命令 handler **同一个** {@link translateCadEntity}，因此预览与提交不是「一致」，
 * 而是同一段代码。
 *
 * @param entityIds - 参与平移的顶层 Entity；不存在的 id 忽略。
 * @returns 新文档；没有任何 Entity 被改动时返回入参本身。
 * @public
 */
export function previewCadTranslate(
  document: CadDocument,
  entityIds: readonly string[],
  delta: CadPoint,
): CadDocument {
  const moved: Record<string, ComposeEntity> = {}
  for (const id of entityIds) {
    const entity = document.entities[id]
    if (!entity) continue
    moved[id] = translateCadEntity(entity, delta)
  }
  if (Object.keys(moved).length === 0) return document
  return { ...document, entities: { ...document.entities, ...moved } }
}
