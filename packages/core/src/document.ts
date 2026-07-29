import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  type ComposeAppearance,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeTransform,
  type ComposeTransformConstraints,
  type DocumentValidationIssue,
  type DocumentValidationIssueCode,
  type DocumentValidationResult,
  type JsonObject,
} from './document-types'
import { isComposeComponentKey } from './entity'

type Path = readonly (string | number)[]
type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
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

function validateJson(
  value: unknown,
  path: Path,
  issues: DocumentValidationIssue[],
  ancestors = new WeakSet<object>(),
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
    addIssue(issues, 'json.cycle', path, 'JSON 不得包含循环引用')
    return
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    addIssue(issues, 'json.unsupported', path, 'JSON 对象必须是普通对象')
    return
  }
  ancestors.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJson(item, [...path, index], issues, ancestors))
  }
  else {
    Object.entries(value).forEach(([key, item]) =>
      validateJson(item, [...path, key], issues, ancestors))
  }
  ancestors.delete(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0
}

function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function rejectUnknownFields(
  value: UnknownRecord,
  allowed: readonly string[],
  path: Path,
  issues: DocumentValidationIssue[],
  code: DocumentValidationIssueCode,
) {
  const known = new Set(allowed)
  Object.keys(value).forEach((key) => {
    if (!known.has(key)) addIssue(issues, code, [...path, key], `未知字段 ${key}`)
  })
}

function validateOutput(
  value: unknown,
  issues: DocumentValidationIssue[],
) {
  const path = ['output'] as const
  if (!isRecord(value)) {
    addIssue(issues, 'output.invalid', path, 'output 必须是对象')
    return
  }
  if (!positive(value.width)) {
    addIssue(issues, 'output.invalid-size', [...path, 'width'], '输出宽度必须是有限正数')
  }
  if (!positive(value.height)) {
    addIssue(issues, 'output.invalid-size', [...path, 'height'], '输出高度必须是有限正数')
  }
  if (!nonEmpty(value.backgroundColor)) {
    addIssue(
      issues,
      'output.invalid-background',
      [...path, 'backgroundColor'],
      '输出背景色必须是非空字符串',
    )
  }
}

function validateCanvas(
  value: unknown,
  issues: DocumentValidationIssue[],
) {
  const path = ['canvas'] as const
  if (!isRecord(value) || !isRecord(value.grid) || !isRecord(value.smartSnap)) {
    addIssue(issues, 'canvas.invalid', path, 'canvas、grid 和 smartSnap 必须是对象')
    return
  }
  const { grid, smartSnap } = value
  for (const key of ['stepX', 'stepY'] as const) {
    if (!positive(grid[key])) {
      addIssue(issues, 'canvas.invalid-step', [...path, 'grid', key], `${key} 必须是有限正数`)
    }
  }
  for (const key of ['offsetX', 'offsetY'] as const) {
    if (!finite(grid[key])) {
      addIssue(issues, 'canvas.invalid-offset', [...path, 'grid', key], `${key} 必须是有限数`)
    }
  }
  if (
    typeof grid.primaryLineEvery !== 'number'
    || !Number.isInteger(grid.primaryLineEvery)
    || grid.primaryLineEvery <= 0
  ) {
    addIssue(
      issues,
      'canvas.invalid-primary-interval',
      [...path, 'grid', 'primaryLineEvery'],
      'primaryLineEvery 必须是正整数',
    )
  }
  if (typeof grid.snapEnabled !== 'boolean') {
    addIssue(
      issues,
      'canvas.invalid',
      [...path, 'grid', 'snapEnabled'],
      'snapEnabled 必须是 boolean',
    )
  }
  for (const key of ['nodes', 'guides'] as const) {
    if (typeof smartSnap[key] !== 'boolean') {
      addIssue(
        issues,
        'canvas.invalid',
        [...path, 'smartSnap', key],
        `${key} 必须是 boolean`,
      )
    }
  }
  if (!Array.isArray(value.guides)) {
    addIssue(issues, 'canvas.invalid-guide', [...path, 'guides'], 'guides 必须是数组')
    return
  }
  const ids = new Set<string>()
  value.guides.forEach((guide, index) => {
    const guidePath = [...path, 'guides', index] as const
    if (
      !isRecord(guide)
      || !nonEmpty(guide.id)
      || (guide.axis !== 'x' && guide.axis !== 'y')
      || !finite(guide.position)
    ) {
      addIssue(issues, 'canvas.invalid-guide', guidePath, 'guide 字段无效')
      return
    }
    const id = guide.id as string
    if (ids.has(id)) {
      addIssue(
        issues,
        'canvas.duplicate-guide',
        [...guidePath, 'id'],
        `guide ID ${id} 重复`,
      )
    }
    ids.add(id)
  })
}

function validateSize(
  value: unknown,
  path: Path,
  issues: DocumentValidationIssue[],
  code: DocumentValidationIssueCode,
) {
  if (!isRecord(value)) {
    addIssue(issues, code, path, 'Size 必须是对象')
    return false
  }
  rejectUnknownFields(value, ['width', 'height'], path, issues, code)
  let valid = true
  for (const key of ['width', 'height'] as const) {
    if (!positive(value[key])) {
      addIssue(issues, code, [...path, key], `${key} 必须是有限正数`)
      valid = false
    }
  }
  return valid
}

function validateTransform(
  value: JsonObject,
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  rejectUnknownFields(value, ['position', 'size', 'rotation'], path, issues, 'transform.invalid')
  if (!isRecord(value.position)) {
    addIssue(issues, 'transform.invalid', [...path, 'position'], 'position 必须是对象')
  }
  else {
    rejectUnknownFields(
      value.position,
      ['x', 'y'],
      [...path, 'position'],
      issues,
      'transform.invalid',
    )
    for (const key of ['x', 'y'] as const) {
      if (!finite(value.position[key])) {
        addIssue(
          issues,
          'transform.invalid',
          [...path, 'position', key],
          `${key} 必须是有限数`,
        )
      }
    }
  }
  validateSize(value.size, [...path, 'size'], issues, 'transform.invalid-size')
  if (!finite(value.rotation)) {
    addIssue(issues, 'transform.invalid', [...path, 'rotation'], 'rotation 必须是有限数')
  }
}

function validateTransformConstraints(
  value: JsonObject,
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  rejectUnknownFields(
    value,
    ['movable', 'resize', 'rotatable', 'minSize', 'maxSize'],
    path,
    issues,
    'transform-constraints.invalid',
  )
  if (typeof value.movable !== 'boolean') {
    addIssue(
      issues,
      'transform-constraints.invalid',
      [...path, 'movable'],
      'movable 必须是 boolean',
    )
  }
  if (typeof value.rotatable !== 'boolean') {
    addIssue(
      issues,
      'transform-constraints.invalid',
      [...path, 'rotatable'],
      'rotatable 必须是 boolean',
    )
  }
  const resizeModes = new Set(['free', 'preserve-aspect', 'horizontal', 'vertical', 'none'])
  if (typeof value.resize !== 'string' || !resizeModes.has(value.resize)) {
    addIssue(
      issues,
      'transform-constraints.invalid',
      [...path, 'resize'],
      'resize 模式无效',
    )
  }
  const minValid = validateSize(
    value.minSize,
    [...path, 'minSize'],
    issues,
    'transform-constraints.invalid',
  )
  let maxValid = true
  if (value.maxSize !== null) {
    maxValid = validateSize(
      value.maxSize,
      [...path, 'maxSize'],
      issues,
      'transform-constraints.invalid',
    )
  }
  if (
    minValid
    && maxValid
    && isRecord(value.minSize)
    && isRecord(value.maxSize)
    && (
      (value.maxSize.width as number) < (value.minSize.width as number)
      || (value.maxSize.height as number) < (value.minSize.height as number)
    )
  ) {
    addIssue(
      issues,
      'transform-constraints.invalid',
      [...path, 'maxSize'],
      'maxSize 不得小于 minSize',
    )
  }
}

function validateComposition(
  value: JsonObject,
  components: Readonly<Record<string, JsonObject>>,
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  rejectUnknownFields(
    value,
    ['presetId', 'baseComponentKeys', 'capabilityIds'],
    path,
    issues,
    'composition.invalid',
  )
  if (value.presetId !== null && !nonEmpty(value.presetId)) {
    addIssue(
      issues,
      'composition.invalid',
      [...path, 'presetId'],
      'presetId 必须是非空字符串或 null',
    )
  }
  const validateUniqueStrings = (
    items: unknown,
    key: 'baseComponentKeys' | 'capabilityIds',
    componentKeys: boolean,
  ) => {
    if (!Array.isArray(items) || !items.every(nonEmpty)) {
      addIssue(issues, 'composition.invalid', [...path, key], `${key} 必须是非空字符串数组`)
      return
    }
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const id = item as string
      if (seen.has(id)) {
        addIssue(
          issues,
          'composition.invalid',
          [...path, key, index],
          `${key} 不得重复`,
        )
      }
      seen.add(id)
      if (componentKeys && !isComposeComponentKey(id)) {
        addIssue(
          issues,
          'composition.invalid',
          [...path, key, index],
          `${id} 不是合法 Component Key`,
        )
      }
      if (componentKeys && components[id] === undefined) {
        addIssue(
          issues,
          'composition.invalid',
          [...path, key, index],
          `基础 Component ${id} 不存在`,
        )
      }
    })
  }
  validateUniqueStrings(value.baseComponentKeys, 'baseComponentKeys', true)
  validateUniqueStrings(value.capabilityIds, 'capabilityIds', false)
}

function validateAppearance(
  value: JsonObject,
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  const allowed = [
    'backgroundColor',
    'borderColor',
    'borderWidth',
    'borderRadius',
    'opacity',
    'shadow',
  ]
  rejectUnknownFields(value, allowed, path, issues, 'appearance.invalid')
  for (const key of ['backgroundColor', 'borderColor'] as const) {
    if (key in value && !nonEmpty(value[key])) {
      addIssue(issues, 'appearance.invalid', [...path, key], `${key} 必须是非空字符串`)
    }
  }
  for (const [key, min, max] of [
    ['borderWidth', 0, undefined],
    ['borderRadius', 0, undefined],
    ['opacity', 0, 1],
  ] as const) {
    const candidate = value[key]
    if (
      key in value
      && (
        !finite(candidate)
        || candidate < min
        || (max !== undefined && candidate > max)
      )
    ) {
      addIssue(issues, 'appearance.invalid', [...path, key], `${key} 数值无效`)
    }
  }
  if ('shadow' in value && value.shadow !== null) {
    if (!isRecord(value.shadow)) {
      addIssue(issues, 'appearance.invalid', [...path, 'shadow'], 'shadow 必须是对象或 null')
    }
    else {
      rejectUnknownFields(
        value.shadow,
        ['color', 'offsetX', 'offsetY', 'blur', 'spread'],
        [...path, 'shadow'],
        issues,
        'appearance.invalid',
      )
      if (!nonEmpty(value.shadow.color)) {
        addIssue(
          issues,
          'appearance.invalid',
          [...path, 'shadow', 'color'],
          'shadow.color 必须是非空字符串',
        )
      }
      for (const key of ['offsetX', 'offsetY', 'blur', 'spread'] as const) {
        if (!finite(value.shadow[key]) || (key === 'blur' && value.shadow[key] < 0)) {
          addIssue(
            issues,
            'appearance.invalid',
            [...path, 'shadow', key],
            `shadow.${key} 数值无效`,
          )
        }
      }
    }
  }
}

function validateRenderer(
  value: JsonObject,
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  rejectUnknownFields(value, ['type', 'props'], path, issues, 'renderer.invalid')
  if (!nonEmpty(value.type)) {
    addIssue(issues, 'renderer.invalid', [...path, 'type'], 'Renderer type 必须是非空字符串')
  }
  if (!isRecord(value.props)) {
    addIssue(issues, 'renderer.invalid', [...path, 'props'], 'Renderer props 必须是 JsonObject')
  }
}

function validateBooleanComponent(
  value: JsonObject,
  field: 'visible' | 'locked' | 'enabled',
  path: Path,
  issues: DocumentValidationIssue[],
) {
  if (!isRecord(value)) return
  rejectUnknownFields(value, [field], path, issues, 'component.invalid-value')
  if (typeof value[field] !== 'boolean') {
    addIssue(
      issues,
      'component.invalid-value',
      [...path, field],
      `${field} 必须是 boolean`,
    )
  }
}

function validateEntity(
  entityKey: string,
  value: unknown,
  issues: DocumentValidationIssue[],
): ComposeEntity | null {
  const path = ['entities', entityKey] as const
  if (!isRecord(value)) {
    addIssue(issues, 'entity.invalid', path, 'Entity 必须是对象')
    return null
  }
  if (value.id !== entityKey) {
    addIssue(issues, 'entity.id-mismatch', [...path, 'id'], 'Entity ID 必须与 entities Key 相同')
  }
  if (!nonEmpty(value.id)) {
    addIssue(issues, 'entity.invalid-field', [...path, 'id'], 'Entity ID 必须是非空字符串')
  }
  if (typeof value.name !== 'string') {
    addIssue(issues, 'entity.invalid-field', [...path, 'name'], 'Entity 名称必须是字符串')
  }
  if (!isRecord(value.components)) {
    addIssue(issues, 'entity.invalid-field', [...path, 'components'], 'components 必须是对象')
    return null
  }
  const components = value.components as Readonly<Record<string, JsonObject>>
  Object.entries(value.components).forEach(([key, component]) => {
    const componentPath = [...path, 'components', key] as const
    if (!isComposeComponentKey(key)) {
      addIssue(issues, 'component.invalid-key', componentPath, `${key} 不是 PascalCase`)
    }
    if (!isRecord(component)) {
      addIssue(issues, 'component.invalid-value', componentPath, 'Component 必须是 JsonObject')
      return
    }
    validateJson(component, componentPath, issues)
  })
  const requireComponent = (key: string) => {
    if (!isRecord(components[key])) {
      addIssue(
        issues,
        'component.missing',
        [...path, 'components', key],
        `Entity 缺少 ${key}`,
      )
      return false
    }
    return true
  }
  const hasComposition = requireComponent(COMPOSE_BUILTIN_COMPONENT_KEYS.composition)
  const hasTransform = requireComponent(COMPOSE_BUILTIN_COMPONENT_KEYS.transform)
  const hasVisibility = requireComponent(COMPOSE_BUILTIN_COMPONENT_KEYS.visibility)
  const hasLock = requireComponent(COMPOSE_BUILTIN_COMPONENT_KEYS.lock)
  const hasHierarchy = isRecord(components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy])
  const hasRenderer = isRecord(components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer])
  const hasClip = isRecord(components[COMPOSE_BUILTIN_COMPONENT_KEYS.clip])
  if (!hasHierarchy && !hasRenderer) {
    addIssue(
      issues,
      'component.invalid-combination',
      [...path, 'components'],
      'Entity 必须拥有 Renderer 或 Hierarchy',
    )
  }
  if (hasClip && !hasHierarchy) {
    addIssue(
      issues,
      'component.invalid-combination',
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.clip],
      'Clip 必须与 Hierarchy 组合',
    )
  }
  if (hasComposition) {
    validateComposition(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.composition]!,
      components,
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.composition],
      issues,
    )
  }
  if (hasTransform) {
    validateTransform(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.transform]!,
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.transform],
      issues,
    )
  }
  if (hasVisibility) {
    validateBooleanComponent(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.visibility]!,
      'visible',
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.visibility],
      issues,
    )
  }
  if (hasLock) {
    validateBooleanComponent(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.lock]!,
      'locked',
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.lock],
      issues,
    )
  }
  if (hasHierarchy) {
    const hierarchy = components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy]!
    const hierarchyPath = [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy] as const
    rejectUnknownFields(hierarchy, ['childIds'], hierarchyPath, issues, 'component.invalid-value')
    if (!Array.isArray(hierarchy.childIds) || !hierarchy.childIds.every(nonEmpty)) {
      addIssue(
        issues,
        'component.invalid-value',
        [...hierarchyPath, 'childIds'],
        'childIds 必须是非空字符串数组',
      )
    }
  }
  if (hasClip) {
    validateBooleanComponent(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.clip]!,
      'enabled',
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.clip],
      issues,
    )
  }
  const constraints = components[COMPOSE_BUILTIN_COMPONENT_KEYS.transformConstraints]
  if (isRecord(constraints)) {
    validateTransformConstraints(
      constraints,
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.transformConstraints],
      issues,
    )
  }
  const appearance = components[COMPOSE_BUILTIN_COMPONENT_KEYS.appearance]
  if (isRecord(appearance)) {
    validateAppearance(
      appearance as ComposeAppearance,
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.appearance],
      issues,
    )
  }
  if (hasRenderer) {
    validateRenderer(
      components[COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]!,
      [...path, 'components', COMPOSE_BUILTIN_COMPONENT_KEYS.renderer],
      issues,
    )
  }
  return value as unknown as ComposeEntity
}

function hierarchyChildren(entity: ComposeEntity | undefined): readonly string[] {
  const hierarchy = entity?.components[COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy]
  return hierarchy && Array.isArray(hierarchy.childIds)
    ? hierarchy.childIds.filter((id): id is string => typeof id === 'string')
    : []
}

function validateTopology(
  rootIds: unknown,
  entities: Readonly<Record<string, ComposeEntity>>,
  issues: DocumentValidationIssue[],
) {
  if (!Array.isArray(rootIds) || !rootIds.every((id) => typeof id === 'string')) {
    addIssue(issues, 'document.invalid-root', ['rootIds'], 'rootIds 必须是字符串数组')
    return
  }
  const parentById = new Map<string, string | null>()
  rootIds.forEach((id, index) => {
    if (!entities[id]) {
      addIssue(issues, 'document.invalid-root', ['rootIds', index], `根 Entity ${id} 不存在`)
      return
    }
    if (parentById.has(id)) {
      addIssue(issues, 'document.duplicate-root', ['rootIds', index], `根 Entity ${id} 重复`)
      return
    }
    parentById.set(id, null)
  })
  Object.entries(entities).forEach(([parentId, entity]) => {
    const children = hierarchyChildren(entity)
    const seen = new Set<string>()
    children.forEach((childId, index) => {
      const childPath = [
        'entities',
        parentId,
        'components',
        COMPOSE_BUILTIN_COMPONENT_KEYS.hierarchy,
        'childIds',
        index,
      ] as const
      if (seen.has(childId)) {
        addIssue(issues, 'document.multiple-parents', childPath, `子 Entity ${childId} 重复`)
        return
      }
      seen.add(childId)
      if (!entities[childId]) {
        addIssue(issues, 'document.missing-child', childPath, `子 Entity ${childId} 不存在`)
        return
      }
      if (parentById.has(childId)) {
        addIssue(
          issues,
          'document.multiple-parents',
          childPath,
          `Entity ${childId} 出现在多个位置`,
        )
        return
      }
      parentById.set(childId, parentId)
    })
  })

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const walk = (id: string) => {
    if (visiting.has(id)) {
      addIssue(issues, 'document.cycle', ['entities', id], `Entity ${id} 形成层级循环`)
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    hierarchyChildren(entities[id]).forEach(walk)
    visiting.delete(id)
    visited.add(id)
  }
  rootIds.forEach(walk)
  Object.keys(entities).forEach((id) => {
    if (!visited.has(id)) {
      addIssue(issues, 'document.orphan-entity', ['entities', id], `Entity ${id} 不可达`)
    }
  })
}

/** 校验未知输入是否满足 ComposeDocument v4 ECS 协议。 @public */
export function validateComposeDocument(input: unknown): DocumentValidationResult {
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ code: 'document.invalid', path: [], message: 'ComposeDocument 必须是对象' }],
    }
  }
  const issues: DocumentValidationIssue[] = []
  validateJson(input, [], issues)
  if (input.schemaVersion !== 4) {
    addIssue(
      issues,
      'document.unsupported-version',
      ['schemaVersion'],
      '只支持 ComposeDocument schemaVersion 4',
    )
  }
  validateCanvas(input.canvas, issues)
  validateOutput(input.output, issues)
  if (!isRecord(input.entities)) {
    addIssue(issues, 'document.invalid', ['entities'], 'entities 必须是对象')
  }
  else {
    const entities: Record<string, ComposeEntity> = {}
    Object.entries(input.entities).forEach(([id, entity]) => {
      const validated = validateEntity(id, entity, issues)
      if (validated) entities[id] = validated
    })
    validateTopology(input.rootIds, entities, issues)
  }
  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, document: input as unknown as ComposeDocument }
}

/** 供命令和 Registry 校验单个 Transform 候选。 @public */
export function isValidComposeTransform(value: unknown): value is ComposeTransform {
  const issues: DocumentValidationIssue[] = []
  if (!isRecord(value)) return false
  validateTransform(value as unknown as JsonObject, [], issues)
  return issues.length === 0
}

/** 供命令和 Registry 校验单个 TransformConstraints 候选。 @public */
export function isValidComposeTransformConstraints(
  value: unknown,
): value is ComposeTransformConstraints {
  const issues: DocumentValidationIssue[] = []
  if (!isRecord(value)) return false
  validateTransformConstraints(value as unknown as JsonObject, [], issues)
  return issues.length === 0
}
