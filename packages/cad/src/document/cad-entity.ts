import type { ComposeEntity, JsonObject } from '@compose-ui/core'

/** CAD Component 的稳定 Key。 @public */
export const CAD_COMPONENT_KEYS = {
  /** 图元所属图层。 */
  placement: 'CadPlacement',
  /** 两点直线。 */
  line: 'CadLine',
  /** 一次块插入。 */
  insert: 'CadInsert',
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

/**
 * 一次块插入。
 *
 * @remarks
 * 实例几何是**求出来的**：块局部坐标依次经比例、旋转、平移得到世界坐标。不存下来是块存在的
 * 理由——改一次定义，全部实例跟着变。
 *
 * `scale` 分轴给出而不是单个数：**接线图要镜像符号**，负比例是常规用法（一个断路器画一遍，
 * 左右两条支路各插一个镜像）。补一个轴比事后改协议便宜。
 *
 * @public
 */
export interface CadInsert extends JsonObject {
  /** 引用的块 id；必须存在于文档的块表中。 */
  readonly blockId: string
  /** 插入点（世界坐标），对应块的局部原点。 */
  readonly position: CadPoint
  /** 绕插入点的旋转，单位是度，正值为屏幕上的顺时针。 */
  readonly rotation: number
  /** 两轴比例；负值表示沿该轴镜像。 */
  readonly scale: CadPoint
}

/** 读取块插入；不是实例时为 undefined。 @public */
export function getCadInsert(entity: ComposeEntity): CadInsert | undefined {
  return entity.components[CAD_COMPONENT_KEYS.insert] as CadInsert | undefined
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
