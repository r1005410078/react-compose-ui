import {
  BUILTIN_COMMAND_TYPES,
  type ComposeDocument,
  type ComposeEntity,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeEntityRegistry } from './registry'
import type {
  ComposeCapabilityDefinition,
  ComposeComponentDefinition,
  ComposeEntityPreset,
} from './types'

const transform = {
  rotation: 0,
}

const layoutItem = {
  positioning: 'absolute',
  offset: { x: 0, y: 0 },
  width: { mode: 'fixed', value: 100, min: 1, max: null },
  height: { mode: 'fixed', value: 50, min: 1, max: null },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  alignSelf: 'auto',
}

function component(key: string): ComposeComponentDefinition {
  return {
    key,
    label: key,
    createDefault: (): JsonObject => {
      if (key === 'GeometryConstraints') {
        return {
          movable: true,
          resize: 'free',
          rotatable: true,
        }
      }
      return {}
    },
  }
}

function preset(id = 'rectangle'): ComposeEntityPreset {
  return {
    id,
    label: '矩形',
    createComponents: () => ({
      Transform: transform,
      LayoutItem: layoutItem,
      Visibility: { visible: true },
      Lock: { locked: false },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#2463eb' } },
      Renderer: { type: 'rectangle', props: {} },
    }),
  }
}

function capability(
  id: string,
  keys: readonly string[],
  options: Pick<ComposeCapabilityDefinition, 'requires' | 'conflicts'> = {},
): ComposeCapabilityDefinition {
  return {
    id,
    label: id,
    ...options,
    createComponents: () => Object.fromEntries(keys.map((key) => [
      key,
      key === 'Hierarchy'
        ? { childIds: [] }
        : key === 'Clip'
          ? { enabled: true }
          : component(key).createDefault(),
    ])) as Record<string, JsonObject>,
  }
}

function document(entity: ComposeEntity): ComposeDocument {
  return {
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
  }
}

function entityFromSeed(
  result: ReturnType<ReturnType<typeof createComposeEntityRegistry>['createSeed']>,
): ComposeEntity {
  if (!result.ok) throw new Error(result.error.message)
  return { id: 'entity-a', ...result.seed }
}

describe('ComposeEntityRegistry', () => {
  it('OpenSpec: Preset 创建 / 自动注入 Composition 并隔离默认值', () => {
    const registry = createComposeEntityRegistry({ presets: [preset()] })
    const first = registry.createSeed('rectangle')
    const second = registry.createSeed('rectangle')

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.seed.components.Composition).toEqual({
      presetId: 'rectangle',
      baseComponentKeys: [
        'Transform',
        'LayoutItem',
        'Visibility',
        'Lock',
        'Appearance',
        'Renderer',
      ],
      capabilityIds: [],
    })
    expect(first.seed.components).not.toBe(second.seed.components)
    expect(first.seed.components.Transform).not.toBe(second.seed.components.Transform)
  })

  it('OpenSpec: Capability 添加 / 依赖按顺序补齐并生成一个 batch', () => {
    let nextId = 0
    const registry = createComposeEntityRegistry({
      components: [
        component('Hierarchy'),
        component('Clip'),
        component('TransformConstraints'),
      ],
      presets: [preset()],
      capabilities: [
        capability('container', ['Hierarchy', 'Clip']),
        capability('geometry', ['TransformConstraints'], { requires: ['container'] }),
      ],
    })
    const entity = entityFromSeed(registry.createSeed('rectangle'))
    const result = registry.planAddCapability(
      document(entity),
      entity.id,
      'geometry',
      () => `command-${++nextId}`,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    expect(result.command.payload.commands).toEqual([
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.addComponent,
        payload: { entityId: entity.id, key: 'Hierarchy', value: { childIds: [] } },
      }),
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.addComponent,
        payload: { entityId: entity.id, key: 'Clip', value: { enabled: true } },
      }),
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.addComponent,
        payload: expect.objectContaining({ entityId: entity.id, key: 'TransformConstraints' }),
      }),
      expect.objectContaining({
        type: BUILTIN_COMMAND_TYPES.updateComponent,
        payload: {
          entityId: entity.id,
          key: 'Composition',
          value: expect.objectContaining({ capabilityIds: ['container', 'geometry'] }),
        },
      }),
    ])
  })

  it('OpenSpec: Capability 定义校验 / 拒绝重叠、循环和未知依赖', () => {
    const components = [component('Hierarchy'), component('Clip')]
    expect(() => createComposeEntityRegistry({
      components,
      capabilities: [
        capability('first', ['Hierarchy']),
        capability('second', ['Hierarchy']),
      ],
    })).toThrow(/Hierarchy/)
    expect(() => createComposeEntityRegistry({
      components,
      capabilities: [
        capability('first', ['Hierarchy'], { requires: ['second'] }),
        capability('second', ['Clip'], { requires: ['first'] }),
      ],
    })).toThrow(/循环/)
    expect(() => createComposeEntityRegistry({
      components,
      capabilities: [capability('first', ['Hierarchy'], { requires: ['missing'] })],
    })).toThrow(/missing/)
  })

  it('OpenSpec: Capability 移除 / 被依赖、基础项和含子项容器均不可移除', () => {
    const registry = createComposeEntityRegistry({
      components: [component('Hierarchy'), component('Clip'), component('TransformConstraints')],
      presets: [preset()],
      capabilities: [
        capability('container', ['Hierarchy', 'Clip']),
        capability('geometry', ['TransformConstraints'], { requires: ['container'] }),
      ],
    })
    const base = entityFromSeed(registry.createSeed('rectangle'))
    const attached: ComposeEntity = {
      ...base,
      components: {
        ...base.components,
        Composition: {
          presetId: 'rectangle',
          baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Appearance', 'Renderer'],
          capabilityIds: ['container', 'geometry'],
        },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        TransformConstraints: component('TransformConstraints').createDefault(),
      },
    }
    const required = registry.planRemoveCapability(
      document(attached),
      attached.id,
      'container',
      () => 'command',
    )
    expect(required).toMatchObject({
      ok: false,
      issue: { code: 'capability.required', relatedCapabilityIds: ['geometry'] },
    })

    const child = { ...base, id: 'child' }
    const withChild: ComposeEntity = {
      ...attached,
      components: {
        ...attached.components,
        Composition: {
          ...attached.components.Composition,
          capabilityIds: ['container'],
        },
        Hierarchy: { childIds: ['child'] },
      },
    }
    const childDocument = {
      ...document(withChild),
      entities: { [withChild.id]: withChild, child },
    }
    expect(registry.planRemoveCapability(
      childDocument,
      withChild.id,
      'container',
      () => 'command',
    )).toMatchObject({ ok: false, issue: { code: 'capability.has-children' } })
  })

  it('OpenSpec: Capability 状态 / availability 直接携带已附加项的移除可行性', () => {
    const registry = createComposeEntityRegistry({
      components: [component('Hierarchy'), component('Clip'), component('TransformConstraints')],
      presets: [preset()],
      capabilities: [
        capability('container', ['Hierarchy', 'Clip']),
        capability('geometry', ['TransformConstraints'], { requires: ['container'] }),
      ],
    })
    const base = entityFromSeed(registry.createSeed('rectangle'))
    const attached: ComposeEntity = {
      ...base,
      components: {
        ...base.components,
        Composition: {
          presetId: 'rectangle',
          baseComponentKeys: ['Transform', 'Visibility', 'Lock', 'Appearance', 'Renderer'],
          capabilityIds: ['container', 'geometry'],
        },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        TransformConstraints: component('TransformConstraints').createDefault(),
      },
    }

    const availability = registry.listCapabilityAvailability(attached)
    const container = availability.find((item) => item.capabilityId === 'container')
    const geometry = availability.find((item) => item.capabilityId === 'geometry')
    expect(container).toMatchObject({
      attached: true,
      disabled: true,
      issue: { code: 'capability.required', relatedCapabilityIds: ['geometry'] },
    })
    expect(geometry).toMatchObject({ attached: true, disabled: false })
    expect(geometry?.issue).toBeUndefined()

    const locked: ComposeEntity = {
      ...attached,
      components: { ...attached.components, Lock: { locked: true } },
    }
    for (const item of registry.listCapabilityAvailability(locked)) {
      expect(item).toMatchObject({ disabled: true, issue: { code: 'capability.locked' } })
    }

    const withChild: ComposeEntity = {
      ...attached,
      components: {
        ...attached.components,
        Composition: {
          ...attached.components.Composition,
          capabilityIds: ['container'],
        },
        Hierarchy: { childIds: ['child'] },
      },
    }
    const childItem = registry.listCapabilityAvailability(withChild)
      .find((item) => item.capabilityId === 'container')
    expect(childItem).toMatchObject({
      attached: true,
      disabled: true,
      issue: { code: 'capability.has-children' },
    })
  })
})
