import type { ComposeEntity, JsonObject } from '@compose-ui/core'
import type { CadTextAlign } from '../geometry'

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
  /** 一段圆弧；整圆是扫掠 ±360 的弧。 */
  arc: 'CadArc',
  /** 一段单行文字。 */
  text: 'CadText',
  /** 一条多段线；矩形是四顶点的闭合多段线。 */
  polyline: 'CadPolyline',
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

/**
 * 一段圆弧。
 *
 * @remarks
 * **整圆是 `sweep` 为 ±360 的弧**，不另立 `CadCircle`：命中、框选、捕捉、平移、块变换与校验
 * 因此各只有一份实现，整圆自然退化成「角度判断永远为真」的那一支。渲染是唯一分支的地方——
 * SVG 的 `A` 命令在起终点重合时画不出东西，整圆走 `<circle>`。
 *
 * 角度以度为单位，**正值是屏幕上的顺时针**，与 `CadInsert.rotation` 及极坐标输入取同一约定；
 * 三处不一致会让「45 度」在不同入口指向不同方向。
 *
 * @public
 */
export interface CadArc extends JsonObject {
  readonly center: CadPoint
  /** 半径，必须为正。 */
  readonly radius: number
  /** 起始角，度。 */
  readonly startAngle: number
  /**
   * 扫掠角，度；正为顺时针，±360 及以上是整圆。
   *
   * @remarks
   * 用带符号的扫掠角而不是终止角：单给终止角分不出 10° 的短弧与 350° 的长弧，而这个歧义只在
   * 特定角度组合下现形。
   */
  readonly sweep: number
}

/**
 * 一段单行文字。
 *
 * @remarks
 * `position` 是**基线上的对齐锚点**，与 DXF 的 TEXT 同构：左对齐时在文字左端、居中时在中点、
 * 右对齐时在右端。
 *
 * `height` 是**字号（em 尺寸）**而不是 AutoCAD 的大写字高。字号是渲染直接要的那个数，也是
 * 命中框直接要的那个数；存大写字高会让渲染除以一个随字体而变的比例、命中再乘回来，同一个
 * 猜测被钉进两处然后各自漂移。DXF 导入时做一次显式换算。
 *
 * @public
 */
export interface CadText extends JsonObject {
  readonly position: CadPoint
  /** 文字内容，不得为空。 */
  readonly content: string
  /** 字号（em）在世界单位下的大小，必须为正。 */
  readonly height: number
  /** 绕插入点的旋转，度；正为屏幕顺时针。 */
  readonly rotation: number
  readonly align: CadTextAlign
}

/**
 * 一条多段线。
 *
 * @remarks
 * **矩形就是四个顶点的闭合多段线**，不另立 `CadRect`：矩形没有任何多段线没有的性质，另立
 * 类型会让命中、框选、捕捉、平移、块变换与校验各多一支逐字相同的实现。它唯一多出来的是
 * 「四个角是直角」这条约束，而那条约束在用户拖动某个顶点之后就不再成立。
 *
 * `closed` 是布尔而不是「首尾顶点重复」，与 DXF 的 LWPOLYLINE 一致：重复表示法里
 * `[A,B,C,A]` 是闭合三角形还是回到起点的开放折线无法区分。
 *
 * 没有 `bulge`（DXF 用它表示圆弧段）：现在没有命令产出它，加进来意味着遍历、命中、捕捉与
 * 框选各多一条没有用户走过的分支。它的位置已经让好了——遍历本就逐段产出几何。
 *
 * @public
 */
export interface CadPolyline extends JsonObject {
  /** 至少两个顶点。 */
  readonly vertices: readonly CadPoint[]
  /** 闭合时末点连回首点。 */
  readonly closed: boolean
}

/** 读取多段线；不是多段线时为 undefined。 @public */
export function getCadPolyline(entity: ComposeEntity): CadPolyline | undefined {
  return entity.components[CAD_COMPONENT_KEYS.polyline] as CadPolyline | undefined
}

/** 读取文字；不是文字时为 undefined。 @public */
export function getCadText(entity: ComposeEntity): CadText | undefined {
  return entity.components[CAD_COMPONENT_KEYS.text] as CadText | undefined
}

/** 读取圆弧；不是圆弧时为 undefined。 @public */
export function getCadArc(entity: ComposeEntity): CadArc | undefined {
  return entity.components[CAD_COMPONENT_KEYS.arc] as CadArc | undefined
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

/**
 * 构造一个圆弧图元。
 *
 * @param id - 由调用方给出的稳定 Entity ID。
 * @public
 */
export function createCadArcEntity(
  id: string,
  input: {
    readonly layerId: string
    readonly center: { readonly x: number; readonly y: number }
    readonly radius: number
    readonly startAngle: number
    readonly sweep: number
  },
): ComposeEntity {
  return {
    id,
    // 整圆与部分弧共用一个 Component，但名字按用户看到的东西给。
    name: Math.abs(input.sweep) >= 360 ? 'Circle' : 'Arc',
    components: {
      [CAD_COMPONENT_KEYS.placement]: { layerId: input.layerId },
      [CAD_COMPONENT_KEYS.arc]: {
        center: { x: input.center.x, y: input.center.y },
        radius: input.radius,
        startAngle: input.startAngle,
        sweep: input.sweep,
      },
    },
  }
}

/**
 * 构造一个文字图元。
 *
 * @param id - 由调用方给出的稳定 Entity ID。
 * @public
 */
export function createCadTextEntity(
  id: string,
  input: {
    readonly layerId: string
    readonly position: { readonly x: number; readonly y: number }
    readonly content: string
    readonly height: number
    readonly rotation?: number
    readonly align?: CadTextAlign
  },
): ComposeEntity {
  return {
    id,
    // 内容即名字：场景树里「Text」全都一样，标签本身才是用户认得出的那个。
    name: input.content,
    components: {
      [CAD_COMPONENT_KEYS.placement]: { layerId: input.layerId },
      [CAD_COMPONENT_KEYS.text]: {
        position: { x: input.position.x, y: input.position.y },
        content: input.content,
        height: input.height,
        rotation: input.rotation ?? 0,
        align: input.align ?? 'left',
      },
    },
  }
}

/**
 * 构造一条多段线图元。
 *
 * @param id - 由调用方给出的稳定 Entity ID。
 * @public
 */
export function createCadPolylineEntity(
  id: string,
  input: {
    readonly layerId: string
    readonly vertices: readonly { readonly x: number; readonly y: number }[]
    readonly closed?: boolean
  },
): ComposeEntity {
  const closed = input.closed ?? false
  return {
    id,
    // 闭合四顶点在用户眼里就是「矩形」，名字跟着用户的说法走。
    name: closed && input.vertices.length === 4 ? 'Rectangle' : 'Polyline',
    components: {
      [CAD_COMPONENT_KEYS.placement]: { layerId: input.layerId },
      [CAD_COMPONENT_KEYS.polyline]: {
        vertices: input.vertices.map(({ x, y }) => ({ x, y })),
        closed,
      },
    },
  }
}
