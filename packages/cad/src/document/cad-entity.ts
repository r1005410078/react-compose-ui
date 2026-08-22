import type { ComposeEntity, JsonObject } from '@compose-ui/core'

/** CAD Component 的稳定 Key。 @public */
export const CAD_COMPONENT_KEYS = {
  /** 图元所属图层。 */
  placement: 'CadPlacement',
  /** 两点直线。 */
  line: 'CadLine',
  /** 一次块插入。 */
  insert: 'CadInsert',
  /** 一条导线，端点可绑定到块实例的端口。 */
  wire: 'CadWire',
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

/**
 * 导线的一个自由端点。
 *
 * @remarks
 * 坐标是世界坐标，随导线一起平移。它与 {@link CadPortEndpoint} 的差别不只是「存不存坐标」：
 * 自由端点是作者写死的位置，端口端点是一条**引用**，位置由被引用的实例当刻决定。
 *
 * @public
 */
export interface CadFreeEndpoint extends JsonObject {
  readonly kind: 'free'
  readonly point: CadPoint
}

/**
 * 导线绑定到某个块实例端口的端点。
 *
 * @remarks
 * **存引用而不是坐标**，与块实例几何求解不复制是同一条原则：没有存下来的东西就没有会过期的
 * 东西。移动、复制、撤销、导入——任何改变实例位置的路径都自动正确，不需要在每条路径上挂一个
 * 重解钩子。
 *
 * @public
 */
export interface CadPortEndpoint extends JsonObject {
  readonly kind: 'port'
  /** 被绑定的**顶层**块实例 Entity id。 */
  readonly entityId: string
  /** 该实例所引用块定义中声明的端口 id。 */
  readonly portId: string
}

/** 导线端点。 @public */
export type CadWireEndpoint = CadFreeEndpoint | CadPortEndpoint

/**
 * 一条导线。
 *
 * @remarks
 * 只有两个端点，没有中间拐点：折线导线的价值几乎全部来自自动路由（曼哈顿走线、避障），
 * 单独加拐点而没有路由，只是把手工维护线形的负担交回给用户。
 *
 * @public
 */
export interface CadWire extends JsonObject {
  readonly start: CadWireEndpoint
  readonly end: CadWireEndpoint
}

/**
 * 块上的一个接线端口。
 *
 * @remarks
 * 端口是**符号的一部分**：声明在块定义上，一次声明、全部实例都有。挂在实例上意味着同一个
 * 符号的不同实例可以有不同端口——那样它就不是同一个符号了。
 *
 * `position` 是块局部坐标，因此端口与块内几何走同一条比例 → 旋转 → 平移。
 *
 * 只有 id 与位置：`id` 稳定是导线绑定不断的前提，而面向用户的名称眼下没有任何消费者。
 *
 * @public
 */
export interface CadPort extends JsonObject {
  /** 块内唯一且稳定的端口 id。 */
  readonly id: string
  /** 块局部坐标下的位置。 */
  readonly position: CadPoint
}

/** 读取导线；不是导线时为 undefined。 @public */
export function getCadWire(entity: ComposeEntity): CadWire | undefined {
  return entity.components[CAD_COMPONENT_KEYS.wire] as CadWire | undefined
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

/**
 * 构造一条导线图元。
 *
 * @param id - 由调用方给出的稳定 Entity ID。
 * @public
 */
export function createCadWireEntity(
  id: string,
  input: {
    readonly layerId: string
    readonly start: CadWireEndpoint
    readonly end: CadWireEndpoint
  },
): ComposeEntity {
  return {
    id,
    name: 'Wire',
    components: {
      [CAD_COMPONENT_KEYS.placement]: { layerId: input.layerId },
      [CAD_COMPONENT_KEYS.wire]: { start: input.start, end: input.end },
    },
  }
}
