/**
 * `Wire` Component 的类型、校验与几何求解。
 *
 * @remarks
 * 导线是**带盒的普通曲线 Entity**，`Wire` 只回答一个问题：**这一端绑到了哪个端口**。
 * 自由端不存坐标——`Curve` 就是那个点。没有盒的导线才需要另存一份端点坐标；这里存第二份
 * 等于给同一个端点造两个事实来源。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  COMPOSE_DEFAULT_TRANSFORM_PIVOT,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutItem,
  type ComposeLayoutSnapshot,
  type ComposePosition,
  type ComposeTransform,
  type JsonObject,
} from './document-types'
import { getComposeCurve, normalizeComposeCurveGeometry, projectComposeCurveToBox } from './curve'
import { getComposeEntityPorts } from './ports'
import type { ComposeCurve } from './curve'

/** 导线一端绑定的端口。 @public */
export interface ComposeWireBinding extends JsonObject {
  readonly entityId: string
  readonly portId: string
}

/**
 * 可选的 `Wire` Component。
 *
 * @remarks
 * 缺席的一端就是自由端，几何由 `Curve` 自己给出。
 *
 * 用 `JsonObject &` 交叉而不是 `extends`：索引签名的 `JsonValue` 不接受 `undefined`，而两端
 * 都是可选的；`ComposeAppearance` 出于同样原因采用这种写法。
 * @public
 */
export type ComposeWire = JsonObject & {
  readonly start?: ComposeWireBinding
  readonly end?: ComposeWireBinding
}

/** Wire 候选值的字段级问题。 @internal */
export interface ComposeWireValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const WIRE_FIELDS = ['start', 'end'] as const
const BINDING_FIELDS = ['entityId', 'portId'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectBindingIssues(
  value: unknown,
  basePath: readonly (string | number)[],
  issues: ComposeWireValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path: basePath, message: '绑定必须是对象' })
    return
  }
  const allowed = new Set<string>(BINDING_FIELDS)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issues.push({ path: [...basePath, key], message: `未知字段 ${key}` })
  })
  // 缺字段是「配错了」，与「还没配」（整端缺席）必须可区分：后者是自由端，前者是坏数据。
  BINDING_FIELDS.forEach((key) => {
    if (typeof value[key] !== 'string' || value[key] === '') {
      issues.push({ path: [...basePath, key], message: `${key} 必须是非空字符串` })
    }
  })
}

/**
 * 收集 Wire 候选值的字段级问题。
 *
 * @remarks
 * **指向不存在的实体或端口不在此列**：那是解算失败而不是文档非法，与实例动画「指向不存在的
 * id 时保留原值并在 Inspector 标为失效」是同一条判断。
 *
 * @internal
 */
export function collectComposeWireValidationIssues(
  value: unknown,
): readonly ComposeWireValidationIssue[] {
  if (!isRecord(value)) return [{ path: [], message: 'Wire 必须是对象' }]
  const issues: ComposeWireValidationIssue[] = []
  const allowed = new Set<string>(WIRE_FIELDS)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issues.push({ path: [key], message: `未知字段 ${key}` })
  })
  WIRE_FIELDS.forEach((key) => {
    if (value[key] !== undefined) collectBindingIssues(value[key], [key], issues)
  })
  return issues
}

/** 判断未知输入是否为完整、严格的 Wire。 @public */
export function isValidComposeWire(value: unknown): value is ComposeWire {
  return collectComposeWireValidationIssues(value).length === 0
}

/** 读取 Entity 上可选的 Wire。 @public */
export function getComposeWire(entity: ComposeEntity | undefined): ComposeWire | undefined {
  return entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.wire] as ComposeWire | undefined
}

/**
 * 导线一端的三种状态。
 *
 * @remarks
 * **失效必须与自由可区分**：两者的几何都来自作者文档，屏幕上看不出差别，而含义完全不同——
 * 一个是作者本来就没接，另一个是接过的东西没了。
 *
 * @public
 */
export type ComposeWireEndState = 'free' | 'bound' | 'dangling'

/**
 * 判定导线一端的接线状态。
 *
 * @remarks
 * 住在 `core` 是因为它有**两个**消费者：Wire Inspector 与图面上的端点记号。各判一次必然
 * 漂移，而漂移的症状是「面板说失效、图上说接着」——用户无从判断哪个才对。
 *
 * @public
 */
export function getComposeWireEndState(
  document: ComposeDocument | undefined,
  binding: ComposeWireBinding | undefined,
): ComposeWireEndState {
  if (!binding) return 'free'
  const entity = document?.entities[binding.entityId]
  return getComposeEntityPorts(entity).some(({ id }) => id === binding.portId)
    ? 'bound'
    : 'dangling'
}

const TO_RADIANS = Math.PI / 180

/**
 * 把一个端口解算到它所在 Entity 的**父级坐标**。
 *
 * @remarks
 * 盒来自布局快照而不是 `LayoutItem`：实例的 `LayoutItem` 是 Hug，那个尺寸值只是测量缺席时的
 * 兜底，而旋转基点要按真实盒尺寸算。
 *
 * @returns 实体不存在、没有这个端口或缺少布局盒时为 `null`。
 * @public
 */
export function resolveComposePortPoint(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  binding: ComposeWireBinding,
): ComposePosition | null {
  const entity = document.entities[binding.entityId]
  const port = getComposeEntityPorts(entity).find(({ id }) => id === binding.portId)
  const box = snapshot.boxes[binding.entityId]
  if (!entity || !port || !box) return null
  const transform = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.transform] as
    ComposeTransform | undefined
  const rotation = typeof transform?.rotation === 'number' ? transform.rotation : 0
  if (rotation === 0) {
    return { x: box.x + port.position.x, y: box.y + port.position.y }
  }
  const pivot = transform?.pivot ?? COMPOSE_DEFAULT_TRANSFORM_PIVOT
  const anchor = { x: pivot.x * box.width, y: pivot.y * box.height }
  const dx = port.position.x - anchor.x
  const dy = port.position.y - anchor.y
  const radians = rotation * TO_RADIANS
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: box.x + anchor.x + dx * cos - dy * sin,
    y: box.y + anchor.y + dx * sin + dy * cos,
  }
}

/** 一条导线解算后的父级坐标几何。 @internal */
interface ResolvedWireGeometry {
  readonly curve: ComposeCurve
  readonly offset: ComposePosition
  readonly size: { readonly width: number; readonly height: number }
}

function resolveWireGeometry(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
  entity: ComposeEntity,
  wire: ComposeWire,
): ResolvedWireGeometry | null {
  const curve = getComposeCurve(entity)
  const box = snapshot.boxes[entity.id]
  if (!curve || (curve.kind !== 'line' && curve.kind !== 'polyline') || !box) return null
  // 作者几何按**画出来的**那条线读：盒被拉过之后，`Curve` 里的值不再是屏幕上的位置。
  const drawn = projectComposeCurveToBox(curve, box)
  // 上面的守卫已经排除了别的 kind，投影也不会换成第三种；这里重述一遍是为了把收窄写在类型里，
  // 而不是靠读者去追投影的实现。
  if (drawn.kind !== 'line' && drawn.kind !== 'polyline') return null
  /*
   * 首尾两个顶点就是导线的两端，中间的拐点是纯几何——`Wire` 回答的是「这一端接到了哪个端口」，
   * 而拐点不接任何东西。两种 kind 因此收敛成同一串顶点处理，只有首尾会被写。
   */
  const authored: ComposePosition[] = (drawn.kind === 'line'
    ? [drawn.start, drawn.end]
    : drawn.vertices
  ).map((point) => ({ x: box.x + point.x, y: box.y + point.y }))
  if (authored.length < 2) return null
  // 任一端解算失败就用作者几何兜底：塌到原点或整条消失都会让用户以为导线被删了。
  const start = wire.start ? resolveComposePortPoint(document, snapshot, wire.start) : null
  const end = wire.end ? resolveComposePortPoint(document, snapshot, wire.end) : null
  if (!start && !end) return null
  /*
   * **只写首尾**，其余顶点原样保留——绑定端移动之后原本水平的那一段会变斜，这是明写的代价。
   * 不为它补偿相邻顶点：一条导线两端都可能绑定，两端各自要求「保持我这一段正交」时中间顶点
   * 该听谁的没有答案（框选一片符号一起挪恰恰最常见）；而任何这类规则都是**自动路由的一半**，
   * 半条规则产出的形状用户预测不了，比一条明显变斜的线更难修。
   */
  const points = [...authored]
  if (start) points[0] = start
  if (end) points[points.length - 1] = end
  const first = points[0]!
  const last = points[points.length - 1]!
  const next: ComposeCurve = points.length === 2
    ? { kind: 'line', start: first, end: last }
    : { kind: 'polyline', vertices: points, closed: false }
  const normalized = normalizeComposeCurveGeometry(next)
  return { curve: normalized.curve, offset: normalized.offset, size: normalized.size }
}

/** {@link resolveComposeWires} 的结果。 @public */
export interface ComposeResolvedWires {
  readonly document: ComposeDocument
  readonly snapshot: ComposeLayoutSnapshot
}

/**
 * 把全部导线的绑定端解算成几何。
 *
 * @remarks
 * **求解不存储**，与块实例几何是同一条原则：收益不是少存两个数，而是「移动后重解」那段代码
 * 根本不存在——移动、方向键微调、Inspector 改位置、撤销、粘贴、导入与组件刷新全部自动正确，
 * 而逐条挂钩子**漏一条的症状是「线错位」**，看起来像渲染缺陷而不是数据缺陷。
 *
 * 求解**会改导线自己的盒**，因此文档与快照必须成对返回：分头产出会让命中读到的盒与渲染画出的
 * 几何差一帧。导线是绝对定位，改它的盒不影响任何其他 Entity 的求解，因此不需要二次求解。
 *
 * @returns 没有任何导线需要解算时**原样返回入参**，引用不变，订阅方的记忆化因此不会失效。
 * @public
 */
export function resolveComposeWires(
  document: ComposeDocument,
  snapshot: ComposeLayoutSnapshot,
): ComposeResolvedWires {
  let entities: Record<string, ComposeEntity> | null = null
  let boxes: Record<string, ComposeLayoutSnapshot['boxes'][string]> | null = null
  for (const [id, entity] of Object.entries(document.entities)) {
    const wire = getComposeWire(entity)
    if (!wire || (!wire.start && !wire.end)) continue
    const resolved = resolveWireGeometry(document, snapshot, entity, wire)
    if (!resolved) continue
    const box = snapshot.boxes[id]!
    const item = entity.components[COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem] as
      ComposeLayoutItem | undefined
    if (!item) continue
    entities ??= { ...document.entities }
    boxes ??= { ...snapshot.boxes }
    entities[id] = {
      ...entity,
      components: {
        ...entity.components,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: resolved.curve as unknown as JsonObject,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.layoutItem]: {
          ...item,
          offset: resolved.offset,
          width: { ...item.width, value: resolved.size.width },
          height: { ...item.height, value: resolved.size.height },
        },
      },
    }
    boxes[id] = {
      ...box,
      x: resolved.offset.x,
      y: resolved.offset.y,
      width: resolved.size.width,
      height: resolved.size.height,
    }
  }
  if (!entities || !boxes) return { document, snapshot }
  return {
    document: { ...document, entities },
    snapshot: { ...snapshot, boxes },
  }
}
