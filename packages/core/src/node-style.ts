import type {
  ComposeNode,
  NodeShadow,
  NodeStyle,
  ResolvedNodeStyle,
} from './document-types'

/** 节点 style 校验问题。 @public */
export interface NodeStyleValidationIssue {
  /** 相对 style 根的字段路径。 */
  readonly path: readonly string[]
  /** 稳定错误码。 */
  readonly code: 'style.invalid'
  /** 面向开发者的错误说明。 */
  readonly message: string
}

/** 节点 style 校验结果。 @public */
export type NodeStyleValidationResult =
  | { readonly valid: true; readonly style: NodeStyle }
  | { readonly valid: false; readonly issues: readonly NodeStyleValidationIssue[] }

const transparentStyle: ResolvedNodeStyle = {
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
}

/**
 * 按节点 kind 使用的稳定 style 默认值。
 *
 * @public
 */
export const DEFAULT_NODE_STYLES: Readonly<Record<ComposeNode['kind'], ResolvedNodeStyle>> = {
  frame: {
    backgroundColor: '#f8fafc',
    borderColor: '#4a5667',
    borderWidth: 1,
    borderRadius: 0,
    opacity: 1,
    shadow: null,
  },
  group: transparentStyle,
  component: transparentStyle,
}

/**
 * 从关闭状态开始编辑单个 shadow 子字段时使用的稳定基线。
 *
 * @public
 */
export const DEFAULT_NODE_SHADOW: NodeShadow = {
  color: '#00000040',
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
}

const styleFields = new Set([
  'backgroundColor',
  'borderColor',
  'borderWidth',
  'borderRadius',
  'opacity',
  'shadow',
])
const shadowFields = new Set(['color', 'offsetX', 'offsetY', 'blur', 'spread'])

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function issue(
  issues: NodeStyleValidationIssue[],
  path: readonly string[],
  message: string,
) {
  issues.push({ code: 'style.invalid', path, message })
}

function validateColor(
  value: unknown,
  path: readonly string[],
  issues: NodeStyleValidationIssue[],
) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issue(issues, path, '颜色必须是非空字符串')
  }
}

function validateFinite(
  value: unknown,
  path: readonly string[],
  issues: NodeStyleValidationIssue[],
  minimum?: number,
  maximum?: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issue(issues, path, '样式数值必须是有限数字')
    return
  }
  if (minimum !== undefined && value < minimum) {
    issue(issues, path, `样式数值不得小于 ${minimum}`)
  }
  if (maximum !== undefined && value > maximum) {
    issue(issues, path, `样式数值不得大于 ${maximum}`)
  }
}

/**
 * 校验未知输入是否为严格、可序列化的部分 NodeStyle。
 *
 * @param input - 候选 style。
 * @returns 成功时保留输入引用；失败时返回相对 style 根的全部问题。
 * @public
 */
export function validateNodeStyle(input: unknown): NodeStyleValidationResult {
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ code: 'style.invalid', path: [], message: 'style 必须是普通对象' }],
    }
  }

  const issues: NodeStyleValidationIssue[] = []
  for (const key of Object.keys(input)) {
    if (!styleFields.has(key)) issue(issues, [key], `未知 style 字段 ${key}`)
  }
  if (hasOwn(input, 'backgroundColor')) {
    validateColor(input.backgroundColor, ['backgroundColor'], issues)
  }
  if (hasOwn(input, 'borderColor')) {
    validateColor(input.borderColor, ['borderColor'], issues)
  }
  if (hasOwn(input, 'borderWidth')) {
    validateFinite(input.borderWidth, ['borderWidth'], issues, 0)
  }
  if (hasOwn(input, 'borderRadius')) {
    validateFinite(input.borderRadius, ['borderRadius'], issues, 0)
  }
  if (hasOwn(input, 'opacity')) {
    validateFinite(input.opacity, ['opacity'], issues, 0, 1)
  }
  if (hasOwn(input, 'shadow') && input.shadow !== null) {
    if (!isRecord(input.shadow)) {
      issue(issues, ['shadow'], 'shadow 必须是结构化对象或 null')
    }
    else {
      for (const key of Object.keys(input.shadow)) {
        if (!shadowFields.has(key)) issue(issues, ['shadow', key], `未知 shadow 字段 ${key}`)
      }
      for (const field of shadowFields) {
        if (!(field in input.shadow)) issue(issues, ['shadow', field], `shadow 缺少 ${field}`)
      }
      validateColor(input.shadow.color, ['shadow', 'color'], issues)
      validateFinite(input.shadow.offsetX, ['shadow', 'offsetX'], issues)
      validateFinite(input.shadow.offsetY, ['shadow', 'offsetY'], issues)
      validateFinite(input.shadow.blur, ['shadow', 'blur'], issues, 0)
      validateFinite(input.shadow.spread, ['shadow', 'spread'], issues)
    }
  }

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, style: input as NodeStyle }
}

/**
 * 把节点的可选部分 style 解析为渲染端使用的完整稳定值。
 *
 * @param node - 只需要 kind 与可选 style 的节点。
 * @returns 不共享 shadow 引用的完整 style。
 * @public
 */
export function resolveNodeStyle(
  node: Pick<ComposeNode, 'kind' | 'style'>,
): ResolvedNodeStyle {
  const defaults = DEFAULT_NODE_STYLES[node.kind]
  const style = node.style
  const shadow = style?.shadow === undefined ? defaults.shadow : style.shadow
  return {
    backgroundColor: style?.backgroundColor ?? defaults.backgroundColor,
    borderColor: style?.borderColor ?? defaults.borderColor,
    borderWidth: style?.borderWidth ?? defaults.borderWidth,
    borderRadius: style?.borderRadius ?? defaults.borderRadius,
    opacity: style?.opacity ?? defaults.opacity,
    shadow: shadow ? { ...shadow } : null,
  }
}
