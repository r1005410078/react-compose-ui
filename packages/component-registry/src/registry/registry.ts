import {
  BUILTIN_COMMAND_TYPES,
  createComposeBatchCommand,
  getComposeComposition,
  getComposeHierarchy,
  getComposeLock,
  getComposeRenderer,
  isComposeComponentKey,
  validateComposeDocument,
  type ComposeComposition,
  type ComposeDocument,
  type ComposeEntity,
  type EditorCommand,
  type JsonObject,
} from '@compose-ui/core'
import {
  ComposeEntityRegistryError,
  type ComposeCapabilityAvailability,
  type ComposeCapabilityDefinition,
  type ComposeCapabilityIssue,
  type ComposeCapabilityPlanResult,
  type ComposeComponentDefinition,
  type ComposeEntityAssetDropInput,
  type ComposeEntityPreset,
  type ComposeEntityRegistry,
  type ComposeEntityRegistryOptions,
  type ComposeEntitySeed,
  type ComposeEntitySeedResult,
} from './types'

type DefinitionCategory = ComposeEntityRegistryError['category']

function jsonIssue(value: unknown, ancestors = new WeakSet<object>()): string | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'JSON 数字必须是有限值'
  if (typeof value !== 'object') return `JSON 不支持 ${typeof value}`
  if (ancestors.has(value)) return 'JSON 不得包含循环引用'
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return 'JSON 对象必须是普通对象'
  }
  ancestors.add(value)
  const entries = Array.isArray(value) ? value.entries() : Object.entries(value)
  for (const [, item] of entries) {
    const issue = jsonIssue(item, ancestors)
    if (issue) {
      ancestors.delete(value)
      return issue
    }
  }
  ancestors.delete(value)
  return null
}

function componentsIssue(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'Component 组合必须是对象'
  }
  for (const [key, component] of Object.entries(value)) {
    if (!isComposeComponentKey(key)) return `${key} 不是 PascalCase Component Key`
    if (component === null || typeof component !== 'object' || Array.isArray(component)) {
      return `${key} 必须是 JsonObject`
    }
    const issue = jsonIssue(component)
    if (issue) return `${key} 不是合法 JSON：${issue}`
  }
  return null
}

function cloneComponents(
  value: Readonly<Record<string, JsonObject>>,
): Readonly<Record<string, JsonObject>> {
  return structuredClone(value)
}

function callComponentsFactory(
  category: 'component' | 'preset' | 'capability',
  index: number,
  label: string,
  factory: () => Readonly<Record<string, JsonObject>>,
): Readonly<Record<string, JsonObject>> {
  try {
    const components = factory()
    const issue = componentsIssue(components)
    if (issue) throw new Error(issue)
    return cloneComponents(components)
  }
  catch (error) {
    throw new ComposeEntityRegistryError(
      category,
      index,
      `${label} 默认 Component 无效：${error instanceof Error ? error.message : '未知错误'}`,
    )
  }
}

function callComponentFactory(
  definition: ComposeComponentDefinition,
  index: number,
): JsonObject {
  const result = callComponentsFactory(
    'component',
    index,
    definition.key,
    () => ({ [definition.key]: definition.createDefault() }),
  )
  const value = result[definition.key]!
  if (definition.validate) {
    let verdict: boolean | string
    try {
      verdict = definition.validate(value)
    }
    catch (error) {
      throw new ComposeEntityRegistryError(
        'component',
        index,
        `${definition.key} 校验器失败：${error instanceof Error ? error.message : '未知错误'}`,
      )
    }
    if (verdict !== true) {
      throw new ComposeEntityRegistryError(
        'component',
        index,
        `${definition.key} 默认值未通过校验：${
          typeof verdict === 'string' ? verdict : 'validate 返回 false'
        }`,
      )
    }
  }
  return value
}

function normalizeDefinitions<T>(
  category: DefinitionCategory,
  definitions: readonly T[],
  idOf: (definition: T) => string,
  validate: (definition: T, index: number) => void,
): { readonly ordered: readonly T[]; readonly byId: ReadonlyMap<string, T> } {
  const byId = new Map<string, T>()
  const ordered = definitions.map((definition, index) => {
    const id = idOf(definition)
    if (id.trim().length === 0) {
      throw new ComposeEntityRegistryError(category, index, `${category} 标识不能为空`)
    }
    if (byId.has(id)) {
      throw new ComposeEntityRegistryError(category, index, `${category} 标识 ${id} 重复`)
    }
    validate(definition, index)
    const normalized = Object.freeze({ ...definition }) as T
    byId.set(id, normalized)
    return normalized
  })
  return { ordered: Object.freeze(ordered), byId }
}

function validatePresetSeed(preset: ComposeEntityPreset, components: Record<string, JsonObject>) {
  if ('Composition' in components) return 'Preset 不得自行写入 Composition'
  const baseComponentKeys = Object.keys(components)
  const entity: ComposeEntity = {
    id: '__preset__',
    name: preset.defaultName ?? preset.label,
    components: {
      ...components,
      Composition: {
        presetId: preset.id,
        baseComponentKeys,
        capabilityIds: [],
      },
    },
  }
  const result = validateComposeDocument({
    schemaVersion: 6,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 5,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    output: { width: 1280, height: 720, backgroundPaint: { kind: 'solid', color: '#111827' } },
    rootIds: [entity.id],
    entities: { [entity.id]: entity },
  })
  return result.valid ? null : result.issues[0]?.message ?? 'Preset Entity 无效'
}

function createPresetSeed(
  preset: ComposeEntityPreset,
  index: number,
  value?: ComposeEntitySeed,
): ComposeEntitySeed {
  const name = value?.name ?? preset.defaultName ?? preset.label
  if (name.trim().length === 0) {
    throw new ComposeEntityRegistryError('preset', index, `${preset.id} 默认名称不能为空`)
  }
  const raw = value?.components ?? callComponentsFactory(
    'preset',
    index,
    preset.id,
    preset.createComponents,
  )
  const components = cloneComponents(raw) as Record<string, JsonObject>
  const issue = validatePresetSeed(preset, components)
  if (issue) throw new ComposeEntityRegistryError('preset', index, `${preset.id}：${issue}`)
  const baseComponentKeys = Object.keys(components)
  return {
    name,
    components: {
      ...components,
      Composition: {
        presetId: preset.id,
        baseComponentKeys,
        capabilityIds: [],
      },
    },
  }
}

function issue(
  code: ComposeCapabilityIssue['code'],
  message: string,
  relatedCapabilityIds?: readonly string[],
): ComposeCapabilityPlanResult {
  return {
    ok: false,
    issue: { code, message, ...(relatedCapabilityIds ? { relatedCapabilityIds } : {}) },
  }
}

function command(
  idFactory: () => string,
  type: string,
  payload: JsonObject,
  entityId: string,
): EditorCommand {
  return {
    id: idFactory(),
    type,
    payload,
    meta: { source: 'entity-registry', targetIds: [entityId] },
  }
}

function validateCapabilityGraph(
  capabilities: readonly ComposeCapabilityDefinition[],
  capabilityById: ReadonlyMap<string, ComposeCapabilityDefinition>,
) {
  capabilities.forEach((definition, index) => {
    for (const dependency of definition.requires ?? []) {
      if (!capabilityById.has(dependency)) {
        throw new ComposeEntityRegistryError(
          'capability',
          index,
          `${definition.id} 依赖未注册能力 ${dependency}`,
        )
      }
    }
    for (const conflict of definition.conflicts ?? []) {
      if (!capabilityById.has(conflict)) {
        throw new ComposeEntityRegistryError(
          'capability',
          index,
          `${definition.id} 冲突能力 ${conflict} 未注册`,
        )
      }
    }
  })
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id)) {
      const index = capabilities.findIndex((item) => item.id === id)
      throw new ComposeEntityRegistryError('capability', index, `能力依赖图包含循环：${id}`)
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of capabilityById.get(id)?.requires ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  capabilities.forEach(({ id }) => visit(id))
}

/**
 * 从四类宿主定义创建隔离的 Entity Registry。
 *
 * @param options - Renderer、Component、Preset 与 Capability 定义。
 * @returns 独立只读 Registry。
 * @throws 定义重复、默认值非法或能力图无效时抛出 ComposeEntityRegistryError。
 * @public
 */
export function createComposeEntityRegistry(
  options: ComposeEntityRegistryOptions = {},
): ComposeEntityRegistry {
  const rendererDefinitions = (options.renderers ?? []).map((definition) => ({
    ...definition,
    ...(definition.propContracts
      ? { propContracts: Object.freeze(definition.propContracts.map((item) => Object.freeze({ ...item }))) }
      : {}),
    ...(definition.propCategories
      ? { propCategories: Object.freeze(definition.propCategories.map((item) => Object.freeze({ ...item }))) }
      : {}),
    ...(definition.inspectorPropNames
      ? { inspectorPropNames: Object.freeze([...definition.inspectorPropNames]) }
      : {}),
    ...(definition.measurement
      ? { measurement: Object.freeze({ ...definition.measurement }) }
      : {}),
  }))
  const renderers = normalizeDefinitions(
    'renderer',
    rendererDefinitions,
    ({ type }) => type,
    (definition, index) => {
      const categoryIds = new Set<string>()
      for (const category of definition.propCategories ?? []) {
        if (category.id.trim().length === 0) {
          throw new ComposeEntityRegistryError('renderer', index, 'Renderer Prop 分类 ID 不能为空')
        }
        if (categoryIds.has(category.id)) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop 分类 ${category.id} 重复`,
          )
        }
        if (category.label.trim().length === 0) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop 分类 ${category.id} label 不能为空`,
          )
        }
        categoryIds.add(category.id)
      }
      const propNames = new Set<string>()
      for (const contract of definition.propContracts ?? []) {
        if (contract.name.trim().length === 0) {
          throw new ComposeEntityRegistryError('renderer', index, 'Renderer Prop 名称不能为空')
        }
        if (propNames.has(contract.name)) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop ${contract.name} 重复`,
          )
        }
        propNames.add(contract.name)
        if (contract.label.trim().length === 0) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop ${contract.name} label 不能为空`,
          )
        }
        if (contract.category !== undefined && !categoryIds.has(contract.category)) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop ${contract.name} 引用了未知分类 ${contract.category}`,
          )
        }
        if (contract.kind === 'value' && typeof contract.validate !== 'function') {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop ${contract.name} validate 必须是函数`,
          )
        }
        if (contract.kind === 'method' && contract.role !== 'event-handler') {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Prop ${contract.name} 只支持 event-handler`,
          )
        }
      }
      const inspectorPropNames = new Set<string>()
      for (const propName of definition.inspectorPropNames ?? []) {
        if (inspectorPropNames.has(propName)) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Inspector Prop ${propName} 重复`,
          )
        }
        inspectorPropNames.add(propName)
        const contract = definition.propContracts?.find((item) => item.name === propName)
        if (!contract) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Inspector Prop ${propName} 缺少 Contract`,
          )
        }
        if (contract.kind !== 'value') {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Inspector Prop ${propName} 必须是 value Contract`,
          )
        }
        if (!definition.inspector) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer Inspector Prop ${propName} 必须提供 Inspector`,
          )
        }
      }
      // 契约只是一个 Prop 名，注册时就必须钉死它指向真实的 value Contract：Stage 在编辑
      // 提交阶段直接按这个名字写 Prop，等到那时才发现名字是错的已经来不及了。
      const editableTextPropName = definition.editableTextPropName
      if (editableTextPropName !== undefined) {
        if (editableTextPropName.trim().length === 0) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            'Renderer 可编辑文本 Prop 名称不能为空',
          )
        }
        const contract = definition.propContracts
          ?.find((item) => item.name === editableTextPropName)
        if (!contract) {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer 可编辑文本 Prop ${editableTextPropName} 缺少 Contract`,
          )
        }
        if (contract.kind !== 'value') {
          throw new ComposeEntityRegistryError(
            'renderer',
            index,
            `Renderer 可编辑文本 Prop ${editableTextPropName} 必须是 value Contract`,
          )
        }
      }

      const measurement = definition.measurement
      if (!measurement) return
      if (typeof measurement.measure !== 'function') {
        throw new ComposeEntityRegistryError(
          'renderer',
          index,
          `${definition.type} measurement.measure 必须是函数`,
        )
      }
      if (measurement.prepare !== undefined && typeof measurement.prepare !== 'function') {
        throw new ComposeEntityRegistryError(
          'renderer',
          index,
          `${definition.type} measurement.prepare 必须是函数`,
        )
      }
      if (measurement.subscribe !== undefined && typeof measurement.subscribe !== 'function') {
        throw new ComposeEntityRegistryError(
          'renderer',
          index,
          `${definition.type} measurement.subscribe 必须是函数`,
        )
      }
    },
  )
  const components = normalizeDefinitions(
    'component',
    options.components ?? [],
    ({ key }) => key,
    (definition, index) => {
      if (!isComposeComponentKey(definition.key)) {
        throw new ComposeEntityRegistryError(
          'component',
          index,
          `${definition.key} 不是 PascalCase Component Key`,
        )
      }
      callComponentFactory(definition, index)
    },
  )
  const presets = normalizeDefinitions(
    'preset',
    options.presets ?? [],
    ({ id }) => id,
    (definition, index) => {
      createPresetSeed(definition, index)
    },
  )
  const capabilities = normalizeDefinitions(
    'capability',
    options.capabilities ?? [],
    ({ id }) => id,
    (definition, index) => {
      const owned = callComponentsFactory(
        'capability',
        index,
        definition.id,
        definition.createComponents,
      )
      for (const key of Object.keys(owned)) {
        if (!components.byId.has(key)) {
          throw new ComposeEntityRegistryError(
            'capability',
            index,
            `${definition.id} 使用了未注册 Component ${key}`,
          )
        }
      }
    },
  )

  const ownerByKey = new Map<string, string>()
  capabilities.ordered.forEach((definition, index) => {
    const owned = callComponentsFactory(
      'capability',
      index,
      definition.id,
      definition.createComponents,
    )
    Object.keys(owned).forEach((key) => {
      const previous = ownerByKey.get(key)
      if (previous) {
        throw new ComposeEntityRegistryError(
          'capability',
          index,
          `Component ${key} 已由能力 ${previous} 拥有，不能再由 ${definition.id} 拥有`,
        )
      }
      ownerByKey.set(key, definition.id)
    })
  })
  validateCapabilityGraph(capabilities.ordered, capabilities.byId)

  const presetIndexes = new Map(presets.ordered.map((definition, index) => [definition.id, index]))
  const capabilityIndexes = new Map(
    capabilities.ordered.map((definition, index) => [definition.id, index]),
  )

  const addPlan = (
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult => {
    const entity = document.entities[entityId]
    if (!entity) return issue('capability.entity-missing', `Entity ${entityId} 不存在`)
    if (getComposeLock(entity).locked) return issue('capability.locked', '锁定 Entity 不可添加能力')
    const target = capabilities.byId.get(capabilityId)
    if (!target) return issue('capability.unknown', `能力 ${capabilityId} 未注册`)
    const composition = getComposeComposition(entity)
    if (composition.capabilityIds.includes(capabilityId)) {
      return issue('capability.already-attached', `能力 ${capabilityId} 已附加`)
    }

    const attached = new Set(composition.capabilityIds)
    const planned: ComposeCapabilityDefinition[] = []
    const collect = (definition: ComposeCapabilityDefinition): ComposeCapabilityIssue | null => {
      if (attached.has(definition.id) || planned.some(({ id }) => id === definition.id)) return null
      for (const dependencyId of definition.requires ?? []) {
        const dependency = capabilities.byId.get(dependencyId)!
        const dependencyIssue = collect(dependency)
        if (dependencyIssue) return dependencyIssue
      }
      const active = new Set([...attached, ...planned.map(({ id }) => id)])
      const conflict = (definition.conflicts ?? []).find((id) => active.has(id))
        ?? [...active].find((id) =>
          capabilities.byId.get(id)?.conflicts?.includes(definition.id))
      if (conflict) {
        return {
          code: 'capability.conflict',
          message: `能力 ${definition.id} 与 ${conflict} 冲突`,
          relatedCapabilityIds: [conflict],
        }
      }
      planned.push(definition)
      return null
    }
    const collectIssue = collect(target)
    if (collectIssue) return { ok: false, issue: collectIssue }

    const children: EditorCommand[] = []
    const existingKeys = new Set(Object.keys(entity.components))
    for (const definition of planned) {
      const index = capabilityIndexes.get(definition.id)!
      const owned = callComponentsFactory(
        'capability',
        index,
        definition.id,
        definition.createComponents,
      )
      for (const [key, value] of Object.entries(owned)) {
        if (existingKeys.has(key)) {
          return issue(
            'capability.component-exists',
            `能力 ${definition.id} 需要的 Component ${key} 已存在`,
          )
        }
        existingKeys.add(key)
        children.push(command(
          idFactory,
          BUILTIN_COMMAND_TYPES.addComponent,
          { entityId, key, value },
          entityId,
        ))
      }
    }
    const nextComposition: ComposeComposition = {
      ...composition,
      capabilityIds: [...composition.capabilityIds, ...planned.map(({ id }) => id)],
    }
    children.push(command(
      idFactory,
      BUILTIN_COMMAND_TYPES.updateComponent,
      { entityId, key: 'Composition', value: nextComposition },
      entityId,
    ))
    return {
      ok: true,
      command: createComposeBatchCommand({
        id: idFactory(),
        commands: children,
        meta: { source: 'entity-registry', targetIds: [entityId] },
      }),
    }
  }

  // 已附加能力的移除前置检查；planRemoveCapability 与 listCapabilityAvailability 必须
  // 使用同一套阻塞规则，避免 UI 状态与实际规划结果不一致。锁定检查由调用方先行处理，
  // 因为两个入口对锁定的报告顺序不同。
  const removalBlocker = (
    entity: ComposeEntity,
    capabilityId: string,
  ):
    | { readonly issue: ComposeCapabilityIssue }
    | { readonly owned: Readonly<Record<string, JsonObject>> } => {
    const composition = getComposeComposition(entity)
    const target = capabilities.byId.get(capabilityId)
    if (!target) {
      return {
        issue: {
          code: 'capability.unknown',
          message: `能力 ${capabilityId} 的定义缺失，无法安全移除`,
        },
      }
    }
    const dependants = composition.capabilityIds.filter((id) =>
      capabilities.byId.get(id)?.requires?.includes(capabilityId))
    if (dependants.length) {
      return {
        issue: {
          code: 'capability.required',
          message: `能力 ${capabilityId} 正被 ${dependants.join('、')} 依赖`,
          relatedCapabilityIds: dependants,
        },
      }
    }
    const index = capabilityIndexes.get(target.id)!
    const owned = callComponentsFactory('capability', index, target.id, target.createComponents)
    const protectedKey = Object.keys(owned).find((key) =>
      composition.baseComponentKeys.includes(key))
    if (protectedKey) {
      return {
        issue: {
          code: 'capability.protected',
          message: `基础 Component ${protectedKey} 不可移除`,
        },
      }
    }
    if (owned.Hierarchy && getComposeHierarchy(entity)?.childIds.length) {
      return {
        issue: {
          code: 'capability.has-children',
          message: '容器仍有子项，不能移除容器能力',
        },
      }
    }
    return { owned }
  }

  const removePlan = (
    document: ComposeDocument,
    entityId: string,
    capabilityId: string,
    idFactory: () => string,
  ): ComposeCapabilityPlanResult => {
    const entity = document.entities[entityId]
    if (!entity) return issue('capability.entity-missing', `Entity ${entityId} 不存在`)
    if (getComposeLock(entity).locked) return issue('capability.locked', '锁定 Entity 不可移除能力')
    const composition = getComposeComposition(entity)
    if (!composition.capabilityIds.includes(capabilityId)) {
      return issue('capability.not-attached', `能力 ${capabilityId} 未附加`)
    }
    const blocker = removalBlocker(entity, capabilityId)
    if ('issue' in blocker) return { ok: false, issue: blocker.issue }
    const { owned } = blocker
    const children = Object.keys(owned).reverse().map((key) => command(
      idFactory,
      BUILTIN_COMMAND_TYPES.removeComponent,
      { entityId, key },
      entityId,
    ))
    const nextComposition: ComposeComposition = {
      ...composition,
      capabilityIds: composition.capabilityIds.filter((id) => id !== capabilityId),
    }
    children.push(command(
      idFactory,
      BUILTIN_COMMAND_TYPES.updateComponent,
      { entityId, key: 'Composition', value: nextComposition },
      entityId,
    ))
    return {
      ok: true,
      command: createComposeBatchCommand({
        id: idFactory(),
        commands: children,
        meta: { source: 'entity-registry', targetIds: [entityId] },
      }),
    }
  }

  return Object.freeze({
    getRenderer: (type: string) => renderers.byId.get(type),
    listRenderers: () => renderers.ordered,
    listRendererPropContracts: (type: string) => renderers.byId.get(type)?.propContracts ?? [],
    getEditableTextPropName: (entity: ComposeEntity) => {
      const renderer = getComposeRenderer(entity)
      if (!renderer) return null
      return renderers.byId.get(renderer.type)?.editableTextPropName ?? null
    },
    getComponent: (key: string) => components.byId.get(key),
    listComponents: () => [...components.ordered].sort((left, right) =>
      (left.order ?? 0) - (right.order ?? 0)),
    getPreset: (id: string) => presets.byId.get(id),
    listPresets: () => presets.ordered,
    getCapability: (id: string) => capabilities.byId.get(id),
    listCapabilities: () => capabilities.ordered,
    createSeed(presetId: string): ComposeEntitySeedResult {
      const preset = presets.byId.get(presetId)
      if (!preset) {
        return {
          ok: false,
          error: { code: 'preset.unknown', message: `未注册 Preset ${presetId}` },
        }
      }
      try {
        return {
          ok: true,
          seed: createPresetSeed(preset, presetIndexes.get(presetId)!),
        }
      }
      catch (error) {
        return {
          ok: false,
          error: {
            code: 'preset.invalid',
            message: error instanceof Error ? error.message : 'Preset 创建失败',
          },
        }
      }
    },
    async createAssetSeed(input: ComposeEntityAssetDropInput): Promise<ComposeEntitySeedResult> {
      const preset = presets.ordered.find((candidate) => {
        try {
          return candidate.assetDrop?.accepts({
            name: input.name,
            mediaType: input.resolved.mediaType,
          }) === true
        }
        catch {
          return false
        }
      })
      if (!preset?.assetDrop) {
        return {
          ok: false,
          error: {
            code: 'preset.asset-unsupported',
            message: `没有 Preset 支持资源 ${input.name}`,
          },
        }
      }
      try {
        const raw = await preset.assetDrop.createSeed(input)
        return {
          ok: true,
          seed: createPresetSeed(preset, presetIndexes.get(preset.id)!, raw),
        }
      }
      catch (error) {
        return {
          ok: false,
          error: {
            code: 'preset.asset-factory-failed',
            message: `${preset.id} 资源 factory 失败：${
              error instanceof Error ? error.message : '未知错误'
            }`,
          },
        }
      }
    },
    listCapabilityAvailability(entity: ComposeEntity): readonly ComposeCapabilityAvailability[] {
      const composition = getComposeComposition(entity)
      const attached = new Set(composition.capabilityIds)
      const locked = getComposeLock(entity).locked
      const known = capabilities.ordered.map((definition) => {
        const isAttached = attached.has(definition.id)
        if (isAttached) {
          const blocker = locked
            ? { issue: { code: 'capability.locked' as const, message: '锁定 Entity 不可移除能力' } }
            : removalBlocker(entity, definition.id)
          const itemIssue = 'issue' in blocker ? blocker.issue : undefined
          return {
            definition,
            capabilityId: definition.id,
            attached: true,
            disabled: Boolean(itemIssue),
            ...(itemIssue ? { issue: itemIssue } : {}),
          }
        }
        const conflict = (definition.conflicts ?? []).find((id) => attached.has(id))
          ?? [...attached].find((id) =>
            capabilities.byId.get(id)?.conflicts?.includes(definition.id))
        const itemIssue: ComposeCapabilityIssue | undefined = locked
          ? { code: 'capability.locked', message: '锁定 Entity 不可添加能力' }
          : conflict
            ? {
                code: 'capability.conflict',
                message: `与 ${conflict} 冲突`,
                relatedCapabilityIds: [conflict],
              }
            : undefined
        return {
          definition,
          capabilityId: definition.id,
          attached: false,
          disabled: Boolean(itemIssue),
          ...(itemIssue ? { issue: itemIssue } : {}),
        }
      })
      const unknown = composition.capabilityIds
        .filter((id) => !capabilities.byId.has(id))
        .map((capabilityId) => ({
          capabilityId,
          attached: true,
          disabled: true,
          issue: {
            code: 'capability.unknown' as const,
            message: `能力 ${capabilityId} 的 Registry 定义缺失`,
          },
        }))
      return [...known, ...unknown]
    },
    planAddCapability: addPlan,
    planRemoveCapability: removePlan,
  })
}
