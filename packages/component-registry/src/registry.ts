import type { JsonObject } from '@compose-ui/core'
import {
  ComponentRegistryError,
  type ComponentDefinition,
  type ComponentRegistry,
  type ComponentSeedResult,
} from './types'

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

function propsIssue(value: unknown) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return '默认 props 必须是 JSON 对象'
  }
  return jsonIssue(value)
}

function createProps(
  definition: ComponentDefinition,
): { ok: true; props: JsonObject } | { ok: false; message: string } {
  try {
    const props = definition.createDefaultProps()
    const issue = propsIssue(props)
    if (issue) return { ok: false, message: `${definition.type} 默认 props 不是合法 JSON：${issue}` }
    // JSON 协议不保留对象身份；clone 同时保证每次创建不会共享嵌套引用。
    return { ok: true, props: structuredClone(props) }
  }
  catch (error) {
    return {
      ok: false,
      message: `${definition.type} 默认 props factory 失败：${
        error instanceof Error ? error.message : '未知错误'
      }`,
    }
  }
}

/**
 * 从宿主 definitions 创建隔离的只读组件注册表。
 *
 * @param definitions - 按 Palette 展示顺序提供的组件定义。
 * @returns 独立注册表实例。
 * @throws definition type、尺寸或首次默认 props 校验失败时抛出 ComponentRegistryError。
 * @public
 */
export function createComponentRegistry(
  definitions: readonly ComponentDefinition[],
): ComponentRegistry {
  const byType = new Map<string, ComponentDefinition>()
  const ordered: ComponentDefinition[] = []

  definitions.forEach((definition, index) => {
    if (definition.type.trim().length === 0) {
      throw new ComponentRegistryError(index, `definition ${index} 的 type 不能为空`)
    }
    if (byType.has(definition.type)) {
      throw new ComponentRegistryError(index, `definition type ${definition.type} 重复`)
    }
    for (const field of ['width', 'height'] as const) {
      const value = definition.defaultSize[field]
      if (!Number.isFinite(value) || value <= 0) {
        throw new ComponentRegistryError(
          index,
          `${definition.type} defaultSize.${field} 必须是有限正数`,
        )
      }
    }
    const initialProps = createProps(definition)
    if (!initialProps.ok) {
      throw new ComponentRegistryError(index, initialProps.message)
    }
    const normalized = Object.freeze({
      ...definition,
      defaultSize: Object.freeze({ ...definition.defaultSize }),
    })
    byType.set(normalized.type, normalized)
    ordered.push(normalized)
  })

  const snapshot = Object.freeze([...ordered])
  return Object.freeze({
    get(type: string) {
      return byType.get(type)
    },
    list() {
      return snapshot
    },
    createSeed(type: string): ComponentSeedResult {
      const definition = byType.get(type)
      if (!definition) {
        return {
          ok: false,
          error: {
            code: 'definition.unknown-type',
            message: `未注册组件类型 ${type}`,
          },
        }
      }
      const result = createProps(definition)
      if (!result.ok) {
        return {
          ok: false,
          error: {
            code: 'definition.invalid-props',
            message: result.message,
          },
        }
      }
      return {
        ok: true,
        seed: {
          componentType: definition.type,
          props: result.props,
          width: definition.defaultSize.width,
          height: definition.defaultSize.height,
        },
      }
    },
  })
}
