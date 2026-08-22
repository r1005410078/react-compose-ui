import type { ComposeEntity, DocumentValidationResultOf } from '@compose-ui/core'
import { CAD_COMPONENT_KEYS, type CadPoint } from './cad-entity'
import {
  type CadBlockDefinition,
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
    blocks: {},
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

function isFinitePoint(value: unknown): value is CadPoint {
  return isRecord(value)
    && typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y)
}

/**
 * 校验图元自身的 Component。
 *
 * @remarks
 * 只校验**已知**的 Component：未知 Key 原样保留，使新增图元种类不必同步改这里就能先落盘。
 * 但已知 Key 一旦出现就必须完整——半条直线比没有直线更难排查。
 */
function validateEntityComponents(
  entity: ComposeEntity,
  layerIds: ReadonlySet<string>,
  issues: CadDocumentIssue[],
  // 块内图元的错误路径要指向 blocks/<id>/entities/…，否则用户只看到一个孤零零的 Entity id。
  prefix: readonly (string | number)[] = [],
) {
  const placement = entity.components[CAD_COMPONENT_KEYS.placement]
  if (placement !== undefined) {
    const layerId = isRecord(placement) ? placement.layerId : undefined
    if (typeof layerId !== 'string' || !layerIds.has(layerId)) {
      issues.push(issue(
        'entity.missing-layer',
        [...prefix, 'entities', entity.id, CAD_COMPONENT_KEYS.placement],
        `图元所属图层不存在：${String(layerId)}`,
      ))
    }
  }
  const line = entity.components[CAD_COMPONENT_KEYS.line]
  if (line !== undefined) {
    if (!isRecord(line) || !isFinitePoint(line.start) || !isFinitePoint(line.end)) {
      issues.push(issue(
        'entity.invalid-geometry',
        [...prefix, 'entities', entity.id, CAD_COMPONENT_KEYS.line],
        '直线端点必须是有限数值',
      ))
    }
  }
}

function validateEntities(
  input: unknown,
  issues: CadDocumentIssue[],
  prefix: readonly (string | number)[] = [],
): Readonly<Record<string, ComposeEntity>> {
  if (!isRecord(input)) {
    issues.push(issue('document.invalid', [...prefix, 'entities'], 'entities 必须是对象'))
    return {}
  }
  const entities: Record<string, ComposeEntity> = {}
  for (const [key, candidate] of Object.entries(input)) {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || !isRecord(candidate.components)) {
      issues.push(issue('entity.invalid', [...prefix, 'entities', key], 'Entity 字段不完整或类型错误'))
      continue
    }
    if (candidate.id !== key) {
      issues.push(issue(
        'entity.id-mismatch',
        [...prefix, 'entities', key],
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
  const layerIds = new Set(layers.map(({ id }) => id))
  for (const entity of Object.values(entities)) {
    validateEntityComponents(entity, layerIds, issues)
  }

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

  // 顶层是平坦的（块内图元住在块表里，不进 rootIds），因此「可达」等价于「被 rootIds 引用」。
  for (const id of Object.keys(entities)) {
    if (!rootIds.includes(id)) {
      issues.push(issue('document.orphan-entity', ['entities', id], `Entity 未被任何根引用：${id}`))
    }
  }

  const blocks = validateBlocks(input.blocks, layerIds, issues)
  for (const entity of Object.values(entities)) {
    validateInsertReference(entity, blocks, issues)
  }

  if (issues.length > 0) return { valid: false, issues }
  return {
    valid: true,
    document: { schemaVersion: 1, units: 'px', layers, rootIds, entities, blocks },
  }
}

/**
 * 校验块表。
 *
 * @remarks
 * 字段缺失按空表处理：加一张空表不会让任何既有文档变得不可读，因此 `schemaVersion` 不必动。
 */
function validateBlocks(
  input: unknown,
  layerIds: ReadonlySet<string>,
  issues: CadDocumentIssue[],
): Readonly<Record<string, CadBlockDefinition>> {
  if (input === undefined) return {}
  if (!isRecord(input)) {
    issues.push(issue('block.invalid', ['blocks'], 'blocks 必须是对象'))
    return {}
  }

  const blocks: Record<string, CadBlockDefinition> = {}
  const names = new Set<string>()
  for (const [key, candidate] of Object.entries(input)) {
    if (!isRecord(candidate)) {
      issues.push(issue('block.invalid', ['blocks', key], `块定义必须是对象：${key}`))
      continue
    }
    if (candidate.id !== key) {
      issues.push(issue('block.id-mismatch', ['blocks', key, 'id'], `块 id 与键不一致：${key}`))
      continue
    }
    const name = candidate.name
    if (typeof name !== 'string' || name.trim().length === 0) {
      issues.push(issue('block.invalid', ['blocks', key, 'name'], `块名必须是非空字符串：${key}`))
      continue
    }
    // 块名是 INSERT 的查找键，重名会让「插哪一个」不可判定。
    if (names.has(name)) {
      issues.push(issue('block.duplicate-id', ['blocks', key, 'name'], `块名重复：${name}`))
      continue
    }
    names.add(name)

    const entities = validateEntities(candidate.entities, issues, ['blocks', key])
    for (const entity of Object.values(entities)) {
      validateEntityComponents(entity, layerIds, issues, ['blocks', key])
      // 嵌套块在示意图里极少用；显式拒绝好过让后来者以为它碰巧能用。
      if (entity.components[CAD_COMPONENT_KEYS.insert] !== undefined) {
        issues.push(issue(
          'block.nested-insert',
          ['blocks', key, 'entities', entity.id],
          `块内不得再插入块：${entity.id}`,
        ))
      }
    }

    const rootIds: string[] = []
    if (!Array.isArray(candidate.rootIds)) {
      issues.push(issue('block.invalid', ['blocks', key, 'rootIds'], 'rootIds 必须是数组'))
    }
    else {
      const seen = new Set<string>()
      candidate.rootIds.forEach((id, index) => {
        if (typeof id !== 'string' || !(id in entities)) {
          issues.push(issue(
            'block.missing-root',
            ['blocks', key, 'rootIds', index],
            `块内根引用不存在：${String(id)}`,
          ))
          return
        }
        if (seen.has(id)) {
          issues.push(issue(
            'block.duplicate-root',
            ['blocks', key, 'rootIds', index],
            `块内根引用重复：${id}`,
          ))
          return
        }
        seen.add(id)
        rootIds.push(id)
      })
    }
    for (const id of Object.keys(entities)) {
      if (!rootIds.includes(id)) {
        issues.push(issue(
          'block.orphan-entity',
          ['blocks', key, 'entities', id],
          `块内 Entity 未被引用：${id}`,
        ))
      }
    }

    blocks[key] = { id: key, name, rootIds, entities }
  }
  return blocks
}

/** 校验实例引用的块存在，以及插入参数是有限数值。 */
function validateInsertReference(
  entity: ComposeEntity,
  blocks: Readonly<Record<string, CadBlockDefinition>>,
  issues: CadDocumentIssue[],
) {
  const insert = entity.components[CAD_COMPONENT_KEYS.insert]
  if (insert === undefined) return
  const path = ['entities', entity.id, CAD_COMPONENT_KEYS.insert]
  if (!isRecord(insert)
    || !isFinitePoint(insert.position)
    || !isFinitePoint(insert.scale)
    || typeof insert.rotation !== 'number'
    || !Number.isFinite(insert.rotation)) {
    issues.push(issue('insert.invalid', path, '插入参数必须是有限数值'))
    return
  }
  if (typeof insert.blockId !== 'string' || !(insert.blockId in blocks)) {
    issues.push(issue('insert.unknown-block', path, `引用的块不存在：${String(insert.blockId)}`))
  }
}
