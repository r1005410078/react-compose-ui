import type {
  ComposeDocument,
  ComposeEntity,
  ComposeFlexLayout,
  ComposeLayoutItem,
  DocumentValidationIssue,
  JsonObject,
} from './document-types'
import { validateComposeDocument } from './document'
import { createComposeEdges } from './layout'

type RecordValue = Record<string, unknown>

/** v5→v6 迁移的判别结果。 @public */
export type ComposeDocumentMigrationResult =
  | {
      readonly ok: true
      readonly document: ComposeDocument
      readonly warnings: readonly DocumentValidationIssue[]
    }
  | { readonly ok: false; readonly issues: readonly DocumentValidationIssue[] }

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0
}

function issue(
  path: readonly (string | number)[],
  message: string,
): DocumentValidationIssue {
  return { code: 'document.invalid', path, message }
}

function validateLegacyTransform(
  value: unknown,
  path: readonly (string | number)[],
  issues: DocumentValidationIssue[],
) {
  if (!record(value) || !record(value.position) || !record(value.size)) {
    issues.push(issue(path, 'v5 Transform 必须包含 position、size 与 rotation'))
    return
  }
  if (!finite(value.position.x) || !finite(value.position.y)) {
    issues.push(issue([...path, 'position'], 'v5 Transform position 必须是有限数'))
  }
  if (!positive(value.size.width) || !positive(value.size.height)) {
    issues.push(issue([...path, 'size'], 'v5 Transform size 必须是有限正数'))
  }
  if (!finite(value.rotation)) {
    issues.push(issue([...path, 'rotation'], 'v5 Transform rotation 必须是有限数'))
  }
}

function validateLegacyV5(input: unknown): readonly DocumentValidationIssue[] {
  const issues: DocumentValidationIssue[] = []
  if (!record(input)) return [issue([], 'ComposeDocument v5 必须是对象')]
  if (input.schemaVersion !== 5) {
    issues.push({
      code: 'document.unsupported-version',
      path: ['schemaVersion'],
      message: '迁移器只接受 ComposeDocument schemaVersion 5',
    })
  }
  if (!record(input.canvas) || !record(input.output)) {
    issues.push(issue([], 'v5 canvas 与 output 必须是对象'))
  }
  if (!Array.isArray(input.rootIds) || !input.rootIds.every((id) => typeof id === 'string')) {
    issues.push(issue(['rootIds'], 'v5 rootIds 必须是字符串数组'))
  }
  if (!record(input.entities)) {
    issues.push(issue(['entities'], 'v5 entities 必须是对象'))
    return issues
  }
  Object.entries(input.entities).forEach(([id, entity]) => {
    const path = ['entities', id] as const
    if (!record(entity) || entity.id !== id || typeof entity.name !== 'string' || !record(entity.components)) {
      issues.push(issue(path, 'v5 Entity 字段无效'))
      return
    }
    const components = entity.components
    for (const key of ['Composition', 'Transform', 'Visibility', 'Lock']) {
      if (!record(components[key])) issues.push(issue([...path, 'components', key], `v5 Entity 缺少 ${key}`))
    }
    validateLegacyTransform(components.Transform, [...path, 'components', 'Transform'], issues)
    if (!record(components.Renderer) && !record(components.Hierarchy)) {
      issues.push(issue([...path, 'components'], 'v5 Entity 必须具有 Renderer 或 Hierarchy'))
    }
    if (components.Hierarchy !== undefined) {
      const hierarchy = components.Hierarchy
      if (!record(hierarchy) || !Array.isArray(hierarchy.childIds)
        || !hierarchy.childIds.every((childId) => typeof childId === 'string')) {
        issues.push(issue([...path, 'components', 'Hierarchy'], 'v5 Hierarchy 无效'))
      }
    }
    if (components.Layout !== undefined) {
      const layout = components.Layout
      const enumsValid = record(layout)
        && layout.type === 'flex'
        && new Set(['row', 'row-reverse', 'column', 'column-reverse']).has(String(layout.flexDirection))
        && new Set(['nowrap', 'wrap', 'wrap-reverse']).has(String(layout.flexWrap))
        && finite(layout.gap)
        && layout.gap >= 0
      if (!enumsValid) issues.push(issue([...path, 'components', 'Layout'], 'v5 Layout 无效'))
    }
  })
  try {
    structuredClone(input)
  }
  catch {
    issues.push({ code: 'json.unsupported', path: [], message: 'v5 文档必须是可克隆的严格 JSON' })
  }
  return issues
}

function migrateLayout(value: RecordValue): ComposeFlexLayout {
  const gap = value.gap as number
  const alignContent = value.alignContent === 'normal' ? 'stretch' : value.alignContent
  const justifyContent = value.justifyContent === 'normal' ? 'flex-start' : value.justifyContent
  const alignItems = value.alignItems === 'normal' ? 'stretch' : value.alignItems
  return {
    type: 'flex',
    flexDirection: value.flexDirection as ComposeFlexLayout['flexDirection'],
    flexWrap: value.flexWrap as ComposeFlexLayout['flexWrap'],
    alignContent: alignContent as ComposeFlexLayout['alignContent'],
    justifyContent: justifyContent as ComposeFlexLayout['justifyContent'],
    alignItems: alignItems as ComposeFlexLayout['alignItems'],
    padding: createComposeEdges(),
    rowGap: gap,
    columnGap: gap,
  }
}

function migrateEntity(value: RecordValue): ComposeEntity {
  const sourceComponents = value.components as Record<string, JsonObject>
  const legacyTransform = sourceComponents.Transform as unknown as {
    readonly position: { readonly x: number; readonly y: number }
    readonly size: { readonly width: number; readonly height: number }
    readonly rotation: number
  }
  const constraints = sourceComponents.TransformConstraints as unknown as {
    readonly movable: boolean
    readonly resize: 'free' | 'preserve-aspect' | 'horizontal' | 'vertical' | 'none'
    readonly rotatable: boolean
    readonly minSize: { readonly width: number; readonly height: number }
    readonly maxSize: { readonly width: number; readonly height: number } | null
  } | undefined
  const layoutItem: ComposeLayoutItem = {
    positioning: 'absolute',
    offset: { ...legacyTransform.position },
    width: {
      mode: 'fixed',
      value: legacyTransform.size.width,
      min: constraints?.minSize.width ?? 1,
      max: constraints?.maxSize?.width ?? null,
    },
    height: {
      mode: 'fixed',
      value: legacyTransform.size.height,
      min: constraints?.minSize.height ?? 1,
      max: constraints?.maxSize?.height ?? null,
    },
    margin: createComposeEdges(),
    alignSelf: 'auto',
  }
  const components: Record<string, JsonObject> = {}
  Object.entries(sourceComponents).forEach(([key, component]) => {
    if (key === 'TransformConstraints') return
    if (key === 'Transform') components.Transform = { rotation: legacyTransform.rotation }
    else if (key === 'Layout' && record(component)) components.Layout = migrateLayout(component)
    else if (key === 'Composition' && record(component)) {
      const base = Array.isArray(component.baseComponentKeys)
        ? component.baseComponentKeys.filter((key): key is string => typeof key === 'string')
        : []
      const migratedBase = base
        .map((key) => key === 'TransformConstraints' ? 'GeometryConstraints' : key)
        .filter((key, index, all) => all.indexOf(key) === index)
      const transformIndex = migratedBase.indexOf('Transform')
      if (!migratedBase.includes('LayoutItem')) migratedBase.splice(transformIndex + 1, 0, 'LayoutItem')
      components.Composition = {
        ...component,
        baseComponentKeys: migratedBase,
      } as JsonObject
    }
    else components[key] = structuredClone(component)
  })
  components.LayoutItem = layoutItem
  if (constraints) {
    components.GeometryConstraints = {
      movable: constraints.movable,
      resize: constraints.resize,
      rotatable: constraints.rotatable,
    }
  }
  return {
    id: value.id as string,
    name: value.name as string,
    components,
  }
}

/**
 * 把一份合法 ComposeDocument v5 显式迁移为保持初始视觉的 v6。
 *
 * @remarks
 * 迁移不会修改输入；所有既有子项都先保持 Absolute，宿主可在加载边界决定何时保存 v6。
 *
 * @public
 */
export function migrateComposeDocumentV5ToV6(input: unknown): ComposeDocumentMigrationResult {
  const legacyIssues = validateLegacyV5(input)
  if (legacyIssues.length > 0) return { ok: false, issues: legacyIssues }
  const source = input as RecordValue
  const sourceEntities = source.entities as Record<string, RecordValue>
  const document = {
    schemaVersion: 6,
    canvas: structuredClone(source.canvas),
    output: structuredClone(source.output),
    rootIds: structuredClone(source.rootIds),
    entities: Object.fromEntries(
      Object.entries(sourceEntities).map(([id, entity]) => [id, migrateEntity(entity)]),
    ),
  }
  const validation = validateComposeDocument(document)
  return validation.valid
    ? { ok: true, document: validation.document, warnings: [] }
    : { ok: false, issues: validation.issues }
}

