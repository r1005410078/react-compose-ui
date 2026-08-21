import type { ComposeEntity, DocumentValidationResultOf } from '@compose-ui/core'
import {
  CAD_DEFAULT_LAYER_ID,
  type CadDocument,
  type CadDocumentIssue,
  type CadDocumentIssueCode,
  type CadLayer,
} from './cad-document-types'

/** 新建 CAD 文档的默认图层。 */
function defaultLayer(): CadLayer {
  return {
    id: CAD_DEFAULT_LAYER_ID,
    name: '0',
    color: '#d8e2f1',
    visible: true,
    locked: false,
  }
}

/**
 * 创建一份空的 CAD 文档。
 *
 * @remarks
 * 带默认图层 `0`：没有图层的 CAD 文档不成立，图元必须挂在某个图层上。
 * @public
 */
export function createEmptyCadDocument(): CadDocument {
  return {
    schemaVersion: 1,
    units: 'px',
    layers: [defaultLayer()],
    rootIds: [],
    entities: {},
  }
}

function issue(
  code: CadDocumentIssueCode,
  path: readonly (string | number)[],
  message: string,
): CadDocumentIssue {
  return { code, path, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateLayers(input: unknown, issues: CadDocumentIssue[]): readonly CadLayer[] {
  if (!Array.isArray(input) || input.length === 0) {
    issues.push(issue('layer.empty', ['layers'], 'CAD 文档至少需要一个图层'))
    return []
  }
  const seen = new Set<string>()
  const layers: CadLayer[] = []
  input.forEach((candidate, index) => {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string' || candidate.id.length === 0
      || typeof candidate.name !== 'string'
      || typeof candidate.color !== 'string'
      || typeof candidate.visible !== 'boolean'
      || typeof candidate.locked !== 'boolean') {
      issues.push(issue('layer.invalid', ['layers', index], '图层字段不完整或类型错误'))
      return
    }
    if (seen.has(candidate.id)) {
      issues.push(issue('layer.duplicate-id', ['layers', index], `图层 id 重复：${candidate.id}`))
      return
    }
    seen.add(candidate.id)
    layers.push({
      id: candidate.id,
      name: candidate.name,
      color: candidate.color,
      visible: candidate.visible,
      locked: candidate.locked,
    })
  })
  return layers
}

function validateEntities(
  input: unknown,
  issues: CadDocumentIssue[],
): Readonly<Record<string, ComposeEntity>> {
  if (!isRecord(input)) {
    issues.push(issue('document.invalid', ['entities'], 'entities 必须是对象'))
    return {}
  }
  const entities: Record<string, ComposeEntity> = {}
  for (const [key, candidate] of Object.entries(input)) {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || !isRecord(candidate.components)) {
      issues.push(issue('entity.invalid', ['entities', key], 'Entity 字段不完整或类型错误'))
      continue
    }
    if (candidate.id !== key) {
      issues.push(issue(
        'entity.id-mismatch',
        ['entities', key],
        `entities 的 key 与 Entity id 不一致：${key} ≠ ${candidate.id}`,
      ))
      continue
    }
    entities[key] = {
      id: candidate.id,
      name: candidate.name,
      components: candidate.components as ComposeEntity['components'],
    }
  }
  return entities
}

/**
 * 校验未知输入是否满足 CadDocument v1 协议。
 *
 * @remarks
 * 返回结构与 `validateComposeDocument` 同形，因此可以直接注入
 * `createDocumentTransactionRuntime`——事务、Patch 与 Undo/Redo 无需第二套实现。
 *
 * 合法时返回的是**规范化后**的文档：调用方 MUST 采用它而不是送入校验的那一份。
 *
 * @public
 */
export function validateCadDocument(
  input: unknown,
): DocumentValidationResultOf<CadDocument, CadDocumentIssue> {
  const issues: CadDocumentIssue[] = []
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [issue('document.invalid', [], 'CAD 文档必须是对象')],
    }
  }
  if (input.schemaVersion !== 1) {
    issues.push(issue(
      'document.unsupported-version',
      ['schemaVersion'],
      `不支持的 CAD 文档版本：${String(input.schemaVersion)}`,
    ))
  }
  if (input.units !== 'px') {
    issues.push(issue('document.invalid-units', ['units'], 'CAD 文档单位固定为 px'))
  }

  const layers = validateLayers(input.layers, issues)
  const entities = validateEntities(input.entities, issues)

  const rootIds: string[] = []
  if (!Array.isArray(input.rootIds)) {
    issues.push(issue('document.invalid', ['rootIds'], 'rootIds 必须是数组'))
  }
  else {
    const seen = new Set<string>()
    input.rootIds.forEach((id, index) => {
      if (typeof id !== 'string' || !(id in entities)) {
        issues.push(issue('document.missing-root', ['rootIds', index], `根引用不存在：${String(id)}`))
        return
      }
      if (seen.has(id)) {
        issues.push(issue('document.duplicate-root', ['rootIds', index], `根引用重复：${id}`))
        return
      }
      seen.add(id)
      rootIds.push(id)
    })
  }

  // 步骤 4 尚无图元词汇，因此「可达」等价于「被 rootIds 引用」。第一个图元落地时这里要
  // 跟着扩展成按层级遍历，否则子级会被误判成孤儿。
  for (const id of Object.keys(entities)) {
    if (!rootIds.includes(id)) {
      issues.push(issue('document.orphan-entity', ['entities', id], `Entity 未被任何根引用：${id}`))
    }
  }

  if (issues.length > 0) return { valid: false, issues }
  return {
    valid: true,
    document: { schemaVersion: 1, units: 'px', layers, rootIds, entities },
  }
}
