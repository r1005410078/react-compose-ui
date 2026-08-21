import type { ComposeEntity, JsonObject } from '@compose-ui/core'

/** CAD Component 的稳定 Key。 @public */
export const CAD_COMPONENT_KEYS = {
  /** 图元所属图层。 */
  placement: 'CadPlacement',
  /** 两点直线。 */
  line: 'CadLine',
} as const

/** 世界坐标中的一个点。 @public */
export interface CadPoint extends JsonObject {
  readonly x: number
  readonly y: number
}

/**
 * 图元的图层归属。
 *
 * @remarks
 * 颜色不住在图元上：图元继承所属图层的颜色，与 DXF 的 ByLayer 一致。显式颜色覆盖是后续能力。
 *
 * @public
 */
export interface CadPlacement extends JsonObject {
  readonly layerId: string
}

/** 由两个端点定义的直线。 @public */
export interface CadLine extends JsonObject {
  readonly start: CadPoint
  readonly end: CadPoint
}

/** 读取图元的图层归属；不是图元时为 undefined。 @public */
export function getCadPlacement(entity: ComposeEntity): CadPlacement | undefined {
  return entity.components[CAD_COMPONENT_KEYS.placement] as CadPlacement | undefined
}

/** 读取直线几何；不是直线时为 undefined。 @public */
export function getCadLine(entity: ComposeEntity): CadLine | undefined {
  return entity.components[CAD_COMPONENT_KEYS.line] as CadLine | undefined
}

/**
 * 构造一条直线图元。
 *
 * @param id - 由调用方给出的稳定 Entity ID。
 * @param input - 图层归属与两个端点。
 * @public
 */
export function createCadLineEntity(
  id: string,
  input: {
    readonly layerId: string
    readonly start: { readonly x: number; readonly y: number }
    readonly end: { readonly x: number; readonly y: number }
  },
): ComposeEntity {
  // 端点显式重建而不是原样透传：入参只需满足结构，落进文档的必须是纯 JSON 对象。
  const point = ({ x, y }: { readonly x: number; readonly y: number }): CadPoint => ({ x, y })
  return {
    id,
    name: 'Line',
    components: {
      [CAD_COMPONENT_KEYS.placement]: { layerId: input.layerId },
      [CAD_COMPONENT_KEYS.line]: { start: point(input.start), end: point(input.end) },
    },
  }
}
