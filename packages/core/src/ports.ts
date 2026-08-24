/**
 * `Ports` Component 的类型、校验与读取。
 *
 * @remarks
 * 端口是「这个 Entity 身上可以接线的点」。它**挂在任意 Entity 上**，与 `Interaction` 是同一条
 * 判断：画一个矩形给它两个端口，与放一个组件实例，在捕捉、校验与导线求解眼里必须是同一件事。
 * @packageDocumentation
 */

import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePosition,
  type JsonObject,
} from './document-types'

/**
 * Entity 身上的一个接线端口。
 *
 * @remarks
 * `position` 是 **Entity 局部坐标**（盒左上角为原点），与 `Curve` 的盒局部几何同一个空间，
 * 因此换算复用同一个世界矩阵，不需要第二套投影。
 *
 * 只有 id 与位置：`id` 稳定是导线绑定不断的前提，而面向用户的名称眼下没有任何消费者。
 * @public
 */
export interface ComposePort extends JsonObject {
  /** Entity 内唯一且稳定的端口 id。 */
  readonly id: string
  /** Entity 局部坐标下的位置。 */
  readonly position: ComposePosition
}

/**
 * 可选的 `Ports` Component。
 *
 * @remarks
 * 不参与布局求解、几何或任何编辑期语义：加上它前后的求解结果必须逐字段一致。
 * @public
 */
export interface ComposePorts extends JsonObject {
  readonly items: readonly ComposePort[]
}

/** Ports 候选值的字段级问题。 @internal */
export interface ComposePortsValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const PORTS_FIELDS = ['items'] as const
const PORT_FIELDS = ['id', 'position'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinitePosition(value: unknown): value is ComposePosition {
  return isRecord(value)
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Object.keys(value).every((key) => key === 'x' || key === 'y')
}

function collectUnknownFields(
  value: Record<string, unknown>,
  known: readonly string[],
  basePath: readonly (string | number)[],
  issues: ComposePortsValidationIssue[],
) {
  const allowed = new Set<string>(known)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issues.push({ path: [...basePath, key], message: `未知字段 ${key}` })
  })
}

/**
 * 收集 Ports 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposePortsValidationIssues(
  value: unknown,
): readonly ComposePortsValidationIssue[] {
  if (!isRecord(value)) return [{ path: [], message: 'Ports 必须是对象' }]
  const issues: ComposePortsValidationIssue[] = []
  collectUnknownFields(value, PORTS_FIELDS, [], issues)
  if (!Array.isArray(value.items)) {
    issues.push({ path: ['items'], message: 'items 必须是数组' })
    return issues
  }
  // 空列表非法：一个不带任何端口的端口声明读不出意图。不再需要端口时删掉整个 Component，
  // 与曲线外观「三项全清就整个删掉」是同一条判断。
  if (value.items.length === 0) {
    issues.push({ path: ['items'], message: 'items 不得为空；不再需要端口时删除整个 Component' })
  }
  const seen = new Set<string>()
  value.items.forEach((item, index) => {
    const path = ['items', index] as const
    if (!isRecord(item)) {
      issues.push({ path, message: '端口必须是对象' })
      return
    }
    collectUnknownFields(item, PORT_FIELDS, path, issues)
    if (typeof item.id !== 'string' || item.id === '') {
      issues.push({ path: [...path, 'id'], message: 'id 必须是非空字符串' })
    }
    // id 稳定是导线绑定不断的前提；重复 id 会让绑定指向「其中一个」，而运行期没有正确答案。
    else if (seen.has(item.id)) {
      issues.push({ path: [...path, 'id'], message: `端口 id ${item.id} 重复` })
    }
    else seen.add(item.id)
    if (!isFinitePosition(item.position)) {
      issues.push({ path: [...path, 'position'], message: 'position 必须是有限的 x/y' })
    }
  })
  return issues
}

/** 判断未知输入是否为完整、严格的 Ports。 @public */
export function isValidComposePorts(value: unknown): value is ComposePorts {
  return collectComposePortsValidationIssues(value).length === 0
}

/** 读取 Entity 上可选的 Ports。 @public */
export function getComposePorts(
  entity: ComposeEntity | undefined,
): ComposePorts | undefined {
  return entity?.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.ports
  ] as ComposePorts | undefined
}

/**
 * 读取 Entity 上的端口列表。
 *
 * @remarks
 * 捕捉、校验与将来的导线求解都经这里读，不各自去摸 `components`——多一处直读就多一处会漏掉
 * 「缺席即没有端口」的地方。
 *
 * @returns 没有 `Ports` 时是空数组。
 * @public
 */
export function getComposePortItems(
  entity: ComposeEntity | undefined,
): readonly ComposePort[] {
  const ports = getComposePorts(entity)
  return Array.isArray(ports?.items) ? ports.items : []
}

/**
 * 从组件实例的离线快照里读组件根 Frame 的端口。
 *
 * @remarks
 * 快照住在 `Renderer` 的 `resolvedSnapshot` prop 里，但它的**类型是本包的协议**
 * （`ComposeResolvedComponentSnapshot`），因此这里读它不是越界。逐层防御地读：快照由宿主
 * 写入，形状不合就当作没有端口。
 */
function instanceRootPorts(entity: ComposeEntity | undefined): readonly ComposePort[] {
  const renderer = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer] as
    { readonly props?: { readonly resolvedSnapshot?: { readonly document?: ComposeDocument } } }
    | undefined
  const document = renderer?.props?.resolvedSnapshot?.document
  const rootId = document?.rootIds?.[0]
  return rootId ? getComposePortItems(document?.entities?.[rootId]) : []
}

/**
 * 读取一个 Entity 对外提供的端口。
 *
 * @remarks
 * 两个来源，**不复制**：Entity 自己声明的 `Ports`，以及组件实例从它的离线快照里带出来的
 * 组件根端口。
 *
 * 曾经打算把组件根的端口**镜像**到实例 Entity 上，理由是「命中与捕捉读的字段必须是文档级
 * 契约」。这条边界在这里由**读取入口住在 core** 满足——捕捉只依赖本包，不需要认识组件协议。
 * 而镜像要在创建与每一次刷新快照的地方各写一遍，漏一处的症状是「端口停在符号搬走之前的
 * 位置」，看起来像捕捉坏了而不是同步坏了。
 *
 * 实例自己声明的端口**压过**组件根的：那是作者在这一个实例上的显式覆盖。
 *
 * @returns 两处都没有时是空数组。
 * @public
 */
export function getComposeEntityPorts(
  entity: ComposeEntity | undefined,
): readonly ComposePort[] {
  const own = getComposePortItems(entity)
  return own.length > 0 ? own : instanceRootPorts(entity)
}
