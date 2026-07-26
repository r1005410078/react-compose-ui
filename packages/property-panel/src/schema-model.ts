import * as v from 'valibot'
import type { PropertyPanelMetadata, PropertyPath } from './property-panel/compose-property-panel'

type RuntimeSchema = v.GenericSchema & {
  default?: unknown
  entries?: Readonly<Record<string, v.GenericSchema>>
  items?: readonly v.GenericSchema[]
  item?: v.GenericSchema
  literal?: unknown
  options?: readonly unknown[]
  pipe?: readonly RuntimePipeItem[]
  rest?: v.GenericSchema
  value?: v.GenericSchema
  wrapped?: v.GenericSchema
}

interface RuntimePipeItem {
  kind: string
  type: string
  requirement?: number | bigint
}

const OPTIONAL_TYPES = new Set(['optional', 'exact_optional', 'undefinedable'])
const NULLABLE_TYPES = new Set(['nullable'])
const NULLISH_TYPES = new Set(['nullish'])

function asRuntimeSchema(schema: v.GenericSchema): RuntimeSchema {
  return schema as RuntimeSchema
}

function readPropertyPanelMetadata(schema: v.GenericSchema): PropertyPanelMetadata {
  const metadata = v.getMetadata(schema) as Record<string, unknown>
  const propertyPanel = metadata.propertyPanel
  if (!propertyPanel || typeof propertyPanel !== 'object' || Array.isArray(propertyPanel)) return {}
  return propertyPanel as PropertyPanelMetadata
}

function readConstraints(schema: v.GenericSchema): NumericConstraints {
  const constraints: NumericConstraints = {}
  for (const item of asRuntimeSchema(schema).pipe ?? []) {
    if (item.type === 'min_value') constraints.min = item.requirement
    if (item.type === 'max_value') constraints.max = item.requirement
    if (item.type === 'multiple_of') constraints.step = item.requirement
  }
  return constraints
}

export interface NumericConstraints {
  min?: number | bigint
  max?: number | bigint
  step?: number | bigint
}

export interface InspectedSchema {
  schema: v.GenericSchema
  base: v.GenericSchema
  type: string
  title?: string
  description?: string
  metadata: PropertyPanelMetadata
  optional: boolean
  nullable: boolean
  constraints: NumericConstraints
}

export interface SchemaEntry {
  key: string
  path: PropertyPath
  info: InspectedSchema
}

export function inspectSchema(schema: v.GenericSchema): InspectedSchema {
  let base = schema
  let optional = false
  let nullable = false
  const visited = new Set<v.GenericSchema>()

  while (!visited.has(base)) {
    visited.add(base)
    const runtime = asRuntimeSchema(base)
    if (OPTIONAL_TYPES.has(base.type)) optional = true
    if (NULLABLE_TYPES.has(base.type)) nullable = true
    if (NULLISH_TYPES.has(base.type)) {
      optional = true
      nullable = true
    }
    if (!runtime.wrapped) break
    base = runtime.wrapped
  }

  return {
    schema,
    base,
    type: base.type,
    title: v.getTitle(schema),
    description: v.getDescription(schema),
    metadata: readPropertyPanelMetadata(schema),
    optional,
    nullable,
    constraints: readConstraints(schema),
  }
}

export function getObjectEntries(
  schema: v.GenericSchema,
  parentPath: PropertyPath = [],
): readonly SchemaEntry[] {
  const entries = asRuntimeSchema(inspectSchema(schema).base).entries
  if (!entries) return []
  return Object.entries(entries)
    .map(([key, entrySchema], sourceIndex) => ({
      key,
      path: [...parentPath, key],
      info: inspectSchema(entrySchema),
      sourceIndex,
    }))
    .sort((left, right) => {
      const leftOrder = left.info.metadata.order ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.info.metadata.order ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex
    })
    .map(({ key, path, info }) => ({ key, path, info }))
}

export function getValueAtPath(value: unknown, path: PropertyPath): unknown {
  let current = value
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[segment]
  }
  return current
}

export function setValueAtPath(
  value: unknown,
  path: PropertyPath,
  nextValue: unknown,
): unknown {
  if (path.length === 0) return nextValue
  const [segment, ...rest] = path
  if (Array.isArray(value)) {
    const clone = [...value]
    clone[Number(segment)] = setValueAtPath(clone[Number(segment)], rest, nextValue)
    return clone
  }
  const source = value !== null && typeof value === 'object'
    ? value as Record<string | number, unknown>
    : {}
  return {
    ...source,
    [segment]: setValueAtPath(source[segment], rest, nextValue),
  }
}

export function createInitialValue(schema: v.GenericSchema): unknown {
  const defaultValue = v.getDefaults(schema)
  if (v.safeParse(schema, defaultValue).success) return defaultValue

  const { base, nullable } = inspectSchema(schema)
  const runtime = asRuntimeSchema(base)
  switch (base.type) {
    case 'string': return ''
    case 'number': return 0
    case 'bigint': return 0n
    case 'boolean': return false
    case 'date': return new Date(0)
    case 'literal': return runtime.literal
    case 'picklist':
    case 'enum': return runtime.options?.[0]
    case 'array': return []
    case 'tuple':
    case 'loose_tuple':
    case 'strict_tuple':
    case 'tuple_with_rest': return runtime.items?.map(createInitialValue) ?? []
    case 'object':
    case 'loose_object':
    case 'strict_object':
    case 'object_with_rest':
      return Object.fromEntries(
        Object.entries(runtime.entries ?? {}).map(([key, entrySchema]) => [
          key,
          createInitialValue(entrySchema),
        ]),
      )
    case 'record': return {}
    case 'union':
    case 'variant':
      for (const option of runtime.options ?? []) {
        if (!option || typeof option !== 'object' || !('kind' in option)) continue
        const candidate = createInitialValue(option as v.GenericSchema)
        if (v.safeParse(option as v.GenericSchema, candidate).success) return candidate
      }
      return undefined
    default: return nullable ? null : undefined
  }
}
