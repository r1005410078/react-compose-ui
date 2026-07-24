import type {
  ComposeDocument,
  ComposeNode,
  DocumentValidationIssue,
  DocumentValidationIssueCode,
  DocumentValidationResult,
} from './document-types'

type Path = readonly (string | number)[]
type MutableRecord = Record<string, unknown>

function isRecord(value: unknown): value is MutableRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function addIssue(
  issues: DocumentValidationIssue[],
  code: DocumentValidationIssueCode,
  path: Path,
  message: string,
) {
  issues.push({ code, path, message })
}

function validateJsonValue(
  value: unknown,
  path: Path,
  issues: DocumentValidationIssue[],
  ancestors: WeakSet<object>,
) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      addIssue(issues, 'json.non-finite-number', path, 'JSON 数字必须是有限值')
    }
    return
  }
  if (typeof value !== 'object') {
    addIssue(issues, 'json.unsupported', path, `JSON 不支持 ${typeof value}`)
    return
  }
  if (ancestors.has(value)) {
    addIssue(issues, 'json.cycle', path, 'JSON 值不得包含循环引用')
    return
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    addIssue(issues, 'json.unsupported', path, 'JSON 对象必须是普通对象')
    return
  }

  ancestors.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(
      item,
      [...path, index],
      issues,
      ancestors,
    ))
  }
  else {
    for (const [key, item] of Object.entries(value)) {
      validateJsonValue(item, [...path, key], issues, ancestors)
    }
  }
  ancestors.delete(value)
}

function validateTransform(
  value: unknown,
  path: Path,
  kind: string,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) {
    addIssue(issues, 'node.invalid-field', path, 'transform 必须是对象')
    return
  }
  for (const field of ['x', 'y', 'width', 'height', 'rotation'] as const) {
    const candidate = value[field]
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      addIssue(
        issues,
        'transform.non-finite',
        [...path, field],
        `${field} 必须是有限数字`,
      )
    }
  }
  for (const field of ['width', 'height'] as const) {
    const candidate = value[field]
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate <= 0) {
      addIssue(
        issues,
        'transform.invalid-size',
        [...path, field],
        `${field} 必须大于零`,
      )
    }
  }
  if (
    kind === 'frame'
    && typeof value.rotation === 'number'
    && Number.isFinite(value.rotation)
    && value.rotation !== 0
  ) {
    addIssue(
      issues,
      'transform.frame-rotation',
      [...path, 'rotation'],
      'Frame rotation 必须为零',
    )
  }
}

function validateNode(
  key: string,
  value: unknown,
  issues: DocumentValidationIssue[],
): value is ComposeNode {
  const path = ['nodes', key] as const
  if (!isRecord(value)) {
    addIssue(issues, 'node.invalid', path, '节点必须是对象')
    return false
  }
  if (value.id !== key) {
    addIssue(issues, 'node.id-mismatch', [...path, 'id'], '节点 ID 必须与 nodes key 相同')
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    addIssue(issues, 'node.invalid-field', [...path, 'id'], '节点 ID 必须是非空字符串')
  }
  if (typeof value.name !== 'string') {
    addIssue(issues, 'node.invalid-field', [...path, 'name'], '节点名称必须是字符串')
  }
  if (typeof value.visible !== 'boolean') {
    addIssue(issues, 'node.invalid-field', [...path, 'visible'], 'visible 必须是 boolean')
  }
  if (typeof value.locked !== 'boolean') {
    addIssue(issues, 'node.invalid-field', [...path, 'locked'], 'locked 必须是 boolean')
  }

  const kind = value.kind
  if (kind !== 'frame' && kind !== 'group' && kind !== 'component') {
    addIssue(issues, 'node.invalid-field', [...path, 'kind'], '节点 kind 不受支持')
    return false
  }
  validateTransform(value.transform, [...path, 'transform'], kind, issues)

  if (kind === 'component') {
    if (typeof value.componentType !== 'string' || value.componentType.trim().length === 0) {
      addIssue(
        issues,
        'component.empty-type',
        [...path, 'componentType'],
        'Component type 必须是非空字符串',
      )
    }
    if (!isRecord(value.props)) {
      addIssue(issues, 'node.invalid-field', [...path, 'props'], 'Component props 必须是 JSON 对象')
    }
    else {
      validateJsonValue(value.props, [...path, 'props'], issues, new WeakSet())
    }
  }
  else if (!Array.isArray(value.childIds)) {
    addIssue(issues, 'node.invalid-field', [...path, 'childIds'], '容器节点必须提供 childIds')
  }
  else {
    value.childIds.forEach((childId, index) => {
      if (typeof childId !== 'string' || childId.length === 0) {
        addIssue(
          issues,
          'node.invalid-field',
          [...path, 'childIds', index],
          'child ID 必须是非空字符串',
        )
      }
    })
  }

  return true
}

function validateTopology(
  rootIds: readonly string[],
  nodes: Record<string, ComposeNode>,
  issues: DocumentValidationIssue[],
) {
  const roots = new Set<string>()
  const parentById = new Map<string, string>()
  const reached = new Set<string>()

  for (const [index, rootId] of rootIds.entries()) {
    if (roots.has(rootId)) {
      addIssue(
        issues,
        'document.duplicate-root',
        ['rootIds', index],
        `Frame ${rootId} 在 rootIds 中重复`,
      )
      continue
    }
    roots.add(rootId)
    const root = nodes[rootId]
    if (!root) {
      addIssue(
        issues,
        'document.invalid-root',
        ['rootIds', index],
        `根节点 ${rootId} 不存在`,
      )
      continue
    }
    if (root.kind !== 'frame') {
      addIssue(
        issues,
        'document.invalid-root-kind',
        ['rootIds', index],
        `根节点 ${rootId} 必须是 Frame`,
      )
    }
  }

  const visit = (nodeId: string, ancestors: ReadonlySet<string>) => {
    const node = nodes[nodeId]
    if (!node) return
    reached.add(nodeId)
    if (node.kind === 'component') return

    const nextAncestors = new Set(ancestors)
    nextAncestors.add(nodeId)
    node.childIds.forEach((childId, index) => {
      const childPath = ['nodes', nodeId, 'childIds', index] as const
      const child = nodes[childId]
      if (!child) {
        addIssue(
          issues,
          'document.missing-child',
          childPath,
          `子节点 ${childId} 不存在`,
        )
        return
      }
      if (child.kind === 'frame') {
        addIssue(
          issues,
          'document.invalid-child-kind',
          childPath,
          'Frame 只能位于 rootIds',
        )
      }
      const previousParent = parentById.get(childId)
      if (previousParent !== undefined) {
        addIssue(
          issues,
          'document.multiple-parents',
          childPath,
          `节点 ${childId} 已属于 ${previousParent}`,
        )
      }
      else {
        parentById.set(childId, nodeId)
      }
      if (nextAncestors.has(childId)) {
        addIssue(
          issues,
          'document.cycle',
          childPath,
          `节点 ${childId} 形成循环`,
        )
        return
      }
      if (!reached.has(childId)) visit(childId, nextAncestors)
    })
  }

  for (const rootId of rootIds) {
    if (nodes[rootId]) visit(rootId, new Set())
  }
  for (const nodeId of Object.keys(nodes)) {
    if (!reached.has(nodeId)) {
      addIssue(
        issues,
        'document.orphan-node',
        ['nodes', nodeId],
        `节点 ${nodeId} 未从任何 Frame 可达`,
      )
    }
  }
}

/**
 * 校验未知输入是否满足 ComposeDocument v1 的 JSON、节点和拓扑约束。
 *
 * @param input - 可能来自宿主持久化层或网络边界的未知值。
 * @returns 成功时保留原文档引用；失败时返回全部可定位问题。
 * @public
 */
export function validateComposeDocument(input: unknown): DocumentValidationResult {
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{
        code: 'document.invalid',
        path: [],
        message: 'ComposeDocument 必须是对象',
      }],
    }
  }
  if (input.schemaVersion !== 1) {
    return {
      valid: false,
      issues: [{
        code: 'document.unsupported-version',
        path: ['schemaVersion'],
        message: `不支持文档版本 ${String(input.schemaVersion)}`,
      }],
    }
  }

  const issues: DocumentValidationIssue[] = []
  if (!Array.isArray(input.rootIds) || input.rootIds.some((id) => typeof id !== 'string')) {
    addIssue(issues, 'document.invalid', ['rootIds'], 'rootIds 必须是字符串数组')
  }
  if (!isRecord(input.nodes)) {
    addIssue(issues, 'document.invalid', ['nodes'], 'nodes 必须是对象')
  }
  if (issues.length > 0) return { valid: false, issues }

  const nodes: Record<string, ComposeNode> = {}
  for (const [key, node] of Object.entries(input.nodes as MutableRecord)) {
    if (validateNode(key, node, issues)) nodes[key] = node
  }
  validateTopology(input.rootIds as string[], nodes, issues)

  return issues.length === 0
    ? { valid: true, document: input as unknown as ComposeDocument }
    : { valid: false, issues }
}
