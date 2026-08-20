/**
 * `Interaction` Component 的类型、校验与读取。
 *
 * @remarks
 * 类型放在本文件而不是 `document-types.ts`，是因为 navigate 目标复用 `ComposePageReference`，
 * 而 `page/page-types.ts` 本身依赖 `document-types.ts`——写回 `document-types.ts` 会形成循环。
 * @packageDocumentation
 */

import { COMPOSE_BUILTIN_COMPONENT_KEYS, type ComposeEntity, type JsonObject } from './document-types'
import { readComposePageReference } from './page/page-graph'
import type { ComposePageReference } from './page/page-types'

/**
 * 交互 trigger 的事件类型。
 *
 * @remarks
 * v1 只有 `click`。保留为联合类型而不是字符串字面量，使新增事件时既有文档不需要迁移。
 * @public
 */
export type ComposeInteractionEvent = 'click'

/**
 * 跳转到指定页面。
 *
 * @remarks
 * 使用 `JsonObject &` 交叉而不是 `extends JsonObject`，因为索引签名的 `JsonValue` 不接受
 * `undefined`，而 `params` 是可选的；`ComposeAnimation` 出于同样原因采用这种写法。
 * @public
 */
export type ComposeNavigateAction = JsonObject & {
  readonly type: 'navigate'
  /**
   * 目标页面；尚未选择时为 null。
   *
   * @remarks
   * 允许为 null 是编辑期的需要：属性面板新增一条交互时先产生一行，用户才能在这行里挑
   * 页面。运行期 null 目标是 no-op。**不完整**的引用（缺字段）仍然非法——那是配错了，
   * 与"还没配"是两回事。语义与 Page Slot 的 `page: null` 一致。
   */
  readonly target: ComposePageReference | null
  /**
   * 预留的跳转参数。
   *
   * @remarks
   * v1 不消费该字段——协议先留位置，因为事后给已持久化的 action 加必填结构比一开始留空贵。
   */
  readonly params?: JsonObject
}

/** 返回上一页。 @public */
export type ComposeNavigateBackAction = JsonObject & {
  readonly type: 'navigate-back'
}

/** 交互可执行的动作。 @public */
export type ComposeInteractionAction = ComposeNavigateAction | ComposeNavigateBackAction

/** 一条 trigger：某个事件触发某个动作。 @public */
export interface ComposeInteractionTrigger extends JsonObject {
  readonly event: ComposeInteractionEvent
  readonly action: ComposeInteractionAction
}

/**
 * 可选的 `Interaction` Component。
 *
 * @remarks
 * 可与任意 Entity 组合，不要求 `Renderer` 或 `Hierarchy`——大屏里可点的常常是矩形或图片，
 * 把交互绑死在某个物料上会让跳转依赖"先有按钮物料"。
 *
 * `Interaction` 不参与布局求解、几何或任何编辑期语义：加上它前后的求解结果必须逐字段一致。
 * @public
 */
export interface ComposeInteraction extends JsonObject {
  readonly version: 1
  readonly triggers: readonly ComposeInteractionTrigger[]
}

/** Interaction 候选值的字段级问题。 @internal */
export interface ComposeInteractionValidationIssue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const INTERACTION_FIELDS = ['version', 'triggers'] as const
const TRIGGER_FIELDS = ['event', 'action'] as const
const NAVIGATE_FIELDS = ['type', 'target', 'params'] as const
const NAVIGATE_BACK_FIELDS = ['type'] as const

const INTERACTION_EVENTS = new Set<string>(['click'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectUnknownFields(
  value: Record<string, unknown>,
  known: readonly string[],
  basePath: readonly (string | number)[],
  issues: ComposeInteractionValidationIssue[],
) {
  const allowed = new Set<string>(known)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      issues.push({ path: [...basePath, key], message: `未知字段 ${key}` })
    }
  })
}

function collectActionIssues(
  value: unknown,
  basePath: readonly (string | number)[],
  issues: ComposeInteractionValidationIssue[],
) {
  if (!isRecord(value)) {
    issues.push({ path: basePath, message: 'action 必须是对象' })
    return
  }
  // 未知 type 必须拒绝而不是静默丢弃：静默丢弃会让一条配好的跳转在升级后无声失效。
  if (value.type === 'navigate') {
    collectUnknownFields(value, NAVIGATE_FIELDS, basePath, issues)
    if (value.target !== null && readComposePageReference(value.target) === null) {
      issues.push({ path: [...basePath, 'target'], message: 'target 必须是完整页面引用或 null' })
    }
    if (value.params !== undefined && !isRecord(value.params)) {
      issues.push({ path: [...basePath, 'params'], message: 'params 必须是对象' })
    }
    return
  }
  if (value.type === 'navigate-back') {
    collectUnknownFields(value, NAVIGATE_BACK_FIELDS, basePath, issues)
    return
  }
  issues.push({
    path: [...basePath, 'type'],
    message: `不支持的 action type ${String(value.type)}`,
  })
}

/**
 * 收集 Interaction 候选值的字段级问题。
 *
 * @internal
 */
export function collectComposeInteractionValidationIssues(
  value: unknown,
): readonly ComposeInteractionValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: [], message: 'Interaction 必须是对象' }]
  }
  const issues: ComposeInteractionValidationIssue[] = []
  collectUnknownFields(value, INTERACTION_FIELDS, [], issues)
  if (value.version !== 1) {
    issues.push({ path: ['version'], message: 'version 必须是 1' })
  }
  if (!Array.isArray(value.triggers)) {
    issues.push({ path: ['triggers'], message: 'triggers 必须是数组' })
    return issues
  }
  // 同一事件只能声明一次：两条 click 无法确定执行顺序，允许它等于把歧义留给运行时。
  const seenEvents = new Set<string>()
  value.triggers.forEach((trigger, index) => {
    const triggerPath = ['triggers', index] as const
    if (!isRecord(trigger)) {
      issues.push({ path: triggerPath, message: 'trigger 必须是对象' })
      return
    }
    collectUnknownFields(trigger, TRIGGER_FIELDS, triggerPath, issues)
    const event = trigger.event
    if (typeof event !== 'string' || !INTERACTION_EVENTS.has(event)) {
      issues.push({
        path: [...triggerPath, 'event'],
        message: `不支持的 event ${String(event)}`,
      })
    }
    else if (seenEvents.has(event)) {
      issues.push({ path: [...triggerPath, 'event'], message: `event ${event} 重复` })
    }
    else {
      seenEvents.add(event)
    }
    collectActionIssues(trigger.action, [...triggerPath, 'action'], issues)
  })
  return issues
}

/** 判断未知输入是否为完整、严格的 Interaction。 @public */
export function isValidComposeInteraction(value: unknown): value is ComposeInteraction {
  return collectComposeInteractionValidationIssues(value).length === 0
}

/** 读取 Entity 上可选的 Interaction。 @public */
export function getComposeInteraction(
  entity: ComposeEntity | undefined,
): ComposeInteraction | undefined {
  return entity?.components[
    COMPOSE_BUILTIN_COMPONENT_KEYS.interaction
  ] as ComposeInteraction | undefined
}

/**
 * 解析 Entity 上某个事件对应的动作。
 *
 * @returns 声明了该事件时返回其动作，否则返回 null。
 * @public
 */
export function resolveComposeInteractionAction(
  entity: ComposeEntity | undefined,
  event: ComposeInteractionEvent,
): ComposeInteractionAction | null {
  const interaction = getComposeInteraction(entity)
  if (!interaction) return null
  const trigger = interaction.triggers.find((item) => item.event === event)
  return trigger ? trigger.action : null
}

/** 创建只含一条页面跳转的 Interaction。 @public */
export function createComposeNavigateInteraction(
  target: ComposePageReference | null = null,
): ComposeInteraction {
  return { version: 1, triggers: [{ event: 'click', action: { type: 'navigate', target } }] }
}
