import * as v from 'valibot'
import type {
  PropertyPanelBinding,
  PropertyPanelBindingAddress,
  PropertyPanelBindingIssue,
  PropertyPanelBindingTarget,
  PropertyPanelRenderer,
  PropertyPanelRendererBindingTargetDescriptor,
  PropertyPanelResolvedBindingTarget,
  PropertyPanelVariable,
  PropertyPath,
} from './index'
import { getValueAtPath, inspectSchema, setValueAtPath } from './schema-model'

type RuntimeSchema = v.GenericSchema & {
  entries?: Readonly<Record<string, v.GenericSchema>>
  item?: v.GenericSchema
  items?: readonly v.GenericSchema[]
  options?: readonly unknown[]
  rest?: v.GenericSchema
  value?: v.GenericSchema
}

/** `resolvePropertyBindings` 的参数。 */
export interface ResolvePropertyBindingsOptions<TSchema extends v.GenericSchema> {
  /** 完整属性值的同步 Valibot Schema。 */
  schema: TSchema
  /** 未应用变量的字面 input。 */
  value: v.InferInput<TSchema>
  /** 当前组件实例保存的绑定。 */
  bindings: readonly PropertyPanelBinding[]
  /** 宿主变量的当前快照。 */
  variables: readonly PropertyPanelVariable[]
  /** 与属性面板相同的实例级 renderer registry。 */
  renderers?: readonly PropertyPanelRenderer[]
  /** 可选的宿主级绑定授权。 */
  canBind?: (target: PropertyPanelBindingTarget, variable: PropertyPanelVariable) => boolean
}

/** 应用变量绑定后的完整解析结果。 */
export interface ResolvePropertyBindingsResult<TSchema extends v.GenericSchema> {
  /** 已应用有效绑定、错误目标回退字面值的 input。 */
  value: v.InferInput<TSchema>
  /** 完整根 Schema 解析成功后的 output。 */
  output?: v.InferOutput<TSchema>
  /** 按地址稳定排序的已绑定目标状态。 */
  targets: readonly PropertyPanelResolvedBindingTarget[]
  /** 所有缺失、类型或根 Schema 问题。 */
  issues: readonly PropertyPanelBindingIssue[]
}

interface ResolvedTargetDescriptor {
  target: PropertyPanelBindingTarget
  descriptor?: PropertyPanelRendererBindingTargetDescriptor
  literalFieldValue: unknown
  literalValue: unknown
}

export type PropertyBindingMutation =
  | { type: 'array-move'; path: PropertyPath; from: number; to: number }
  | { type: 'array-remove'; path: PropertyPath; index: number }
  | { type: 'record-rename'; path: PropertyPath; from: string; to: string }
  | { type: 'record-remove'; path: PropertyPath; key: string }
  | { type: 'clear-descendants'; path: PropertyPath }

/**
 * 把独立绑定应用到字面属性 input，并为失败目标保留安全回退。
 *
 * @remarks
 * 函数不会修改传入值，也不会缓存最后有效变量值；变量异常时只回退对应目标。
 *
 * @param options - 根 Schema、字面值、绑定、变量与 renderer registry。
 * @returns effective input、parsed output、逐目标状态和结构化问题。
 * @public
 */
export function resolvePropertyBindings<TSchema extends v.GenericSchema>(
  options: ResolvePropertyBindingsOptions<TSchema>,
): ResolvePropertyBindingsResult<TSchema> {
  const variables = new Map(options.variables.map((variable) => [variable.id, variable]))
  let effectiveValue: unknown = options.value
  const targets: PropertyPanelResolvedBindingTarget[] = []
  const issues: PropertyPanelBindingIssue[] = []

  for (const binding of [...options.bindings].sort(compareBindings)) {
    const descriptor = resolveTargetDescriptor(
      options.schema,
      options.value,
      binding.target,
      options.renderers ?? [],
    )
    if (!descriptor) {
      pushFailure('unknown-target', '绑定目标已不存在', binding, undefined, undefined)
      continue
    }
    const variable = variables.get(binding.variableId)
    if (!variable) {
      pushFailure('missing-variable', '绑定变量已不存在', binding, descriptor, undefined)
      continue
    }
    if (!matchesSemanticScope(descriptor.target, variable)
      || options.canBind?.(descriptor.target, variable) === false
      || !v.safeParse(descriptor.target.schema, variable.value).success) {
      pushFailure('invalid-variable', '变量值与绑定目标不兼容', binding, descriptor, variable)
      continue
    }

    const candidateField = descriptor.descriptor
      ? descriptor.descriptor.setValue(
          getValueAtPath(effectiveValue, binding.target.path),
          variable.value,
        )
      : variable.value
    const candidate = setValueAtPath(effectiveValue, binding.target.path, candidateField)
    const rootResult = v.safeParse(options.schema, candidate)
    if (!rootResult.success) {
      pushFailure('invalid-root', '变量值使完整属性不符合 Schema', binding, descriptor, variable)
      continue
    }
    effectiveValue = candidate
    targets.push({
      ...descriptor.target,
      binding,
      variable,
      literalValue: descriptor.literalValue,
      effectiveValue: variable.value,
      status: 'resolved',
    })
  }

  const result = v.safeParse(options.schema, effectiveValue)
  return {
    value: effectiveValue as v.InferInput<TSchema>,
    output: result.success ? result.output : undefined,
    targets,
    issues,
  }

  function pushFailure(
    code: PropertyPanelBindingIssue['code'],
    message: string,
    binding: PropertyPanelBinding,
    descriptor: ResolvedTargetDescriptor | undefined,
    variable: PropertyPanelVariable | undefined,
  ) {
    const target = descriptor?.target ?? {
      address: binding.target,
      label: binding.target.targetId,
      schema: options.schema,
    }
    targets.push({
      ...target,
      binding,
      variable,
      literalValue: descriptor?.literalValue,
      effectiveValue: descriptor?.literalValue,
      status: code,
      message,
    })
    issues.push({ target: binding.target, code, message })
  }
}

/** 判断变量是否满足目标的 Schema、语义范围和宿主规则。 */
export function canBindPropertyVariable(
  target: PropertyPanelBindingTarget,
  variable: PropertyPanelVariable,
  canBind?: (target: PropertyPanelBindingTarget, variable: PropertyPanelVariable) => boolean,
): boolean {
  return matchesSemanticScope(target, variable)
    && v.safeParse(target.schema, variable.value).success
    && canBind?.(target, variable) !== false
}

/** 生成用于地址比较和 Map 查询的稳定 key。 */
export function createBindingAddressKey(address: PropertyPanelBindingAddress): string {
  return `${address.path.map((segment) => `${typeof segment}:${String(segment)}`).join('/')}:${address.targetId}`
}

export function remapPropertyBindings(
  bindings: readonly PropertyPanelBinding[],
  mutation: PropertyBindingMutation,
): readonly PropertyPanelBinding[] {
  const next: PropertyPanelBinding[] = []
  let changed = false
  for (const binding of bindings) {
    if (!isPathAtOrBelow(binding.target.path, mutation.path)) {
      next.push(binding)
      continue
    }
    if (mutation.type === 'clear-descendants') {
      changed = true
      continue
    }
    const segment = binding.target.path[mutation.path.length]
    if (mutation.type === 'array-remove' && typeof segment === 'number') {
      if (segment === mutation.index) {
        changed = true
        continue
      }
      if (segment > mutation.index) {
        next.push(replaceAddressSegment(binding, mutation.path.length, segment - 1))
        changed = true
        continue
      }
    }
    if (mutation.type === 'array-move' && typeof segment === 'number') {
      let nextIndex = segment
      if (segment === mutation.from) nextIndex = mutation.to
      else if (mutation.from < mutation.to && segment > mutation.from && segment <= mutation.to) nextIndex -= 1
      else if (mutation.from > mutation.to && segment >= mutation.to && segment < mutation.from) nextIndex += 1
      if (nextIndex !== segment) {
        next.push(replaceAddressSegment(binding, mutation.path.length, nextIndex))
        changed = true
        continue
      }
    }
    if (mutation.type === 'record-remove' && segment === mutation.key) {
      changed = true
      continue
    }
    if (mutation.type === 'record-rename' && segment === mutation.from) {
      next.push(replaceAddressSegment(binding, mutation.path.length, mutation.to))
      changed = true
      continue
    }
    next.push(binding)
  }
  return changed ? next : bindings
}

function compareBindings(left: PropertyPanelBinding, right: PropertyPanelBinding): number {
  return createBindingAddressKey(left.target).localeCompare(createBindingAddressKey(right.target))
}

function replaceAddressSegment(
  binding: PropertyPanelBinding,
  index: number,
  segment: string | number,
): PropertyPanelBinding {
  const path = [...binding.target.path]
  path[index] = segment
  return { ...binding, target: { ...binding.target, path } }
}

function isPathAtOrBelow(candidate: PropertyPath, ancestor: PropertyPath): boolean {
  return ancestor.every((segment, index) => Object.is(candidate[index], segment))
}

function matchesSemanticScope(
  target: PropertyPanelBindingTarget,
  variable: PropertyPanelVariable,
): boolean {
  return !target.semanticScope || variable.semanticScopes?.includes(target.semanticScope) === true
}

function resolveTargetDescriptor(
  rootSchema: v.GenericSchema,
  rootValue: unknown,
  address: PropertyPanelBindingAddress,
  renderers: readonly PropertyPanelRenderer[],
): ResolvedTargetDescriptor | undefined {
  const fieldSchema = getSchemaAtPath(rootSchema, rootValue, address.path)
  if (!fieldSchema) return undefined
  const info = inspectSchema(fieldSchema)
  const literalFieldValue = getValueAtPath(rootValue, address.path)
  const renderer = info.metadata.editor
    ? renderers.find((candidate) => candidate.id === info.metadata.editor)
    : renderers.find((candidate) => candidate.matches?.(info.base, info.metadata))
  const descriptors = renderer?.bindingTargets?.({
    path: address.path,
    schema: fieldSchema,
    metadata: info.metadata,
    value: literalFieldValue,
  }) ?? []
  const descriptor = descriptors.find((candidate) => candidate.id === address.targetId)
  if (descriptor) {
    return {
      target: {
        address,
        label: descriptor.label,
        schema: descriptor.schema,
        semanticScope: descriptor.semanticScope ?? info.metadata.binding?.semanticScope,
      },
      descriptor,
      literalFieldValue,
      literalValue: descriptor.getValue(literalFieldValue),
    }
  }
  if (address.targetId !== 'value' || renderer || !isBindableBuiltIn(info.type)) return undefined
  return {
    target: {
      address,
      label: info.title ?? humanizePath(address.path),
      schema: fieldSchema,
      semanticScope: info.metadata.binding?.semanticScope,
    },
    literalFieldValue,
    literalValue: literalFieldValue,
  }
}

function getSchemaAtPath(
  schema: v.GenericSchema,
  value: unknown,
  path: PropertyPath,
): v.GenericSchema | undefined {
  if (path.length === 0) return schema
  const info = inspectSchema(schema)
  const runtime = info.base as RuntimeSchema
  if (info.type === 'union' || info.type === 'variant') {
    const active = runtime.options?.find((option): option is v.GenericSchema => (
      Boolean(option && typeof option === 'object' && 'kind' in option)
      && v.safeParse(option as v.GenericSchema, value).success
    ))
    return active ? getSchemaAtPath(active, value, path) : undefined
  }
  const [segment, ...rest] = path
  if (runtime.entries && typeof segment === 'string') {
    const nextSchema = runtime.entries[segment]
    return nextSchema
      ? getSchemaAtPath(nextSchema, getValueAtPath(value, [segment]), rest)
      : undefined
  }
  if (info.type === 'array' && runtime.item) {
    return getSchemaAtPath(runtime.item, getValueAtPath(value, [segment]), rest)
  }
  if (info.type.includes('tuple')) {
    const index = Number(segment)
    const nextSchema = runtime.items?.[index] ?? runtime.rest
    return nextSchema
      ? getSchemaAtPath(nextSchema, getValueAtPath(value, [segment]), rest)
      : undefined
  }
  if (info.type === 'record' && runtime.value) {
    return getSchemaAtPath(runtime.value, getValueAtPath(value, [segment]), rest)
  }
  return undefined
}

function isBindableBuiltIn(type: string): boolean {
  return ['string', 'number', 'bigint', 'boolean', 'date', 'picklist', 'enum'].includes(type)
}

function humanizePath(path: PropertyPath): string {
  return String(path[path.length - 1] ?? 'Value')
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .replace(/^./u, (character) => character.toUpperCase())
}
