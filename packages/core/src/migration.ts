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

/** 文档协议显式迁移的判别结果。 @public */
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
 * 把一份合法 v5 文档提升为 v6 形状。
 *
 * @remarks
 * v6 自身已不再是受支持的持久化版本，因此这里只产出中间形状，由
 * {@link migrateComposeDocumentV5ToV7} 接力到 v7 后统一校验。
 */
function toV6Shape(source: RecordValue): RecordValue {
  const sourceEntities = source.entities as Record<string, RecordValue>
  return {
    schemaVersion: 6,
    canvas: structuredClone(source.canvas),
    output: structuredClone(source.output),
    rootIds: structuredClone(source.rootIds),
    entities: Object.fromEntries(
      Object.entries(sourceEntities).map(([id, entity]) => [id, migrateEntity(entity)]),
    ),
  }
}

function validateLegacyV6(input: unknown): readonly DocumentValidationIssue[] {
  const issues: DocumentValidationIssue[] = []
  if (!record(input)) return [issue([], 'ComposeDocument v6 必须是对象')]
  if (input.schemaVersion !== 6) {
    issues.push({
      code: 'document.unsupported-version',
      path: ['schemaVersion'],
      message: '迁移器只接受 ComposeDocument schemaVersion 6',
    })
  }
  if (!record(input.canvas)) issues.push(issue(['canvas'], 'v6 canvas 必须是对象'))
  if (!record(input.output)) issues.push(issue(['output'], 'v6 output 必须是对象'))
  else if (!positive(input.output.width) || !positive(input.output.height)) {
    issues.push(issue(['output'], 'v6 output 尺寸必须是有限正数'))
  }
  if (!Array.isArray(input.rootIds) || !input.rootIds.every((id) => typeof id === 'string')) {
    issues.push(issue(['rootIds'], 'v6 rootIds 必须是字符串数组'))
  }
  if (!record(input.entities)) issues.push(issue(['entities'], 'v6 entities 必须是对象'))
  try {
    structuredClone(input)
  }
  catch {
    issues.push({ code: 'json.unsupported', path: [], message: 'v6 文档必须是可克隆的严格 JSON' })
  }
  return issues
}

/**
 * 为迁移产物挑一个不与既有 Entity 冲突的稳定根 Frame ID。
 *
 * @remarks
 * 优先使用固定名，使同一输入总是得到同一份输出（迁移必须是确定性纯函数）；只有在极少数
 * 命名冲突时才追加数字后缀。
 */
function allocateRootFrameId(entities: Record<string, unknown>): string {
  const base = 'frame-root'
  if (entities[base] === undefined) return base
  let index = 2
  while (entities[`${base}-${index}`] !== undefined) index += 1
  return `${base}-${index}`
}

/**
 * 把一份合法 ComposeDocument v6 显式迁移为等价的 v7。
 *
 * @remarks
 * 迁移不修改输入，且对同一输入产生确定结果：新建唯一根 Frame，把 `output` 的尺寸与背景、
 * `animations` 清单与 `canvas.guides` 全部搬到该 Frame 上，原 rootIds 按原顺序成为它的子级。
 * 因为 v6 的输出原点固定为世界 `(0,0)`，guides 的坐标变换是恒等的，无需重算。
 *
 * 所有既有 Entity 的 ID、Components 与动画轨道逐字段保持不变。
 *
 * @public
 */
export function migrateComposeDocumentV6ToV7(input: unknown): ComposeDocumentMigrationResult {
  const legacyIssues = validateLegacyV6(input)
  if (legacyIssues.length > 0) return { ok: false, issues: legacyIssues }
  const source = structuredClone(input) as RecordValue
  const entities = source.entities as Record<string, unknown>
  const output = source.output as RecordValue
  const canvas = source.canvas as RecordValue
  const rootIds = source.rootIds as readonly string[]
  const guides = Array.isArray(canvas.guides) ? canvas.guides : []
  const animations = Array.isArray(source.animations) ? source.animations : []
  const size = { width: output.width as number, height: output.height as number }
  const rootId = allocateRootFrameId(entities)

  const frameComponents: Record<string, JsonObject> = {
    Composition: {
      presetId: 'frame',
      baseComponentKeys: [
        'Composition',
        'Transform',
        'LayoutItem',
        'Visibility',
        'Lock',
        'Hierarchy',
        'Frame',
        'Appearance',
      ],
      capabilityIds: [],
    },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: size.width, min: 1, max: null },
      height: { mode: 'fixed', value: size.height, min: 1, max: null },
      margin: createComposeEdges(),
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [...rootIds] },
    Frame: { size, guides },
    Appearance: { backgroundPaint: output.backgroundPaint as JsonObject },
  }
  if (animations.length > 0) {
    frameComponents.Animations = { items: animations } as unknown as JsonObject
    ;(frameComponents.Composition as RecordValue).baseComponentKeys = [
      ...(frameComponents.Composition as { baseComponentKeys: string[] }).baseComponentKeys,
      'Animations',
    ]
  }

  const { grid, smartSnap } = canvas as { grid: unknown; smartSnap: unknown }
  const document = {
    schemaVersion: 7,
    canvas: { grid, smartSnap },
    rootIds: [rootId],
    entities: {
      ...entities,
      [rootId]: { id: rootId, name: '场景', components: frameComponents },
    },
  }
  const validation = validateComposeDocument(document)
  return validation.valid
    ? { ok: true, document: validation.document, warnings: [] }
    : { ok: false, issues: validation.issues }
}

/**
 * 把一份合法 ComposeDocument v5 显式迁移为保持初始视觉的 v7。
 *
 * @remarks
 * 迁移不会修改输入；所有既有子项都先保持 Absolute，宿主可在加载边界决定何时保存 v7。
 * v6 只作为不可见的中间形状存在，调用方不会拿到它。
 *
 * @public
 */
export function migrateComposeDocumentV5ToV7(input: unknown): ComposeDocumentMigrationResult {
  const legacyIssues = validateLegacyV5(input)
  if (legacyIssues.length > 0) return { ok: false, issues: legacyIssues }
  return migrateComposeDocumentV6ToV7(toV6Shape(input as RecordValue))
}

