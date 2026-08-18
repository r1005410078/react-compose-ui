import {
  BUILTIN_COMMAND_TYPES,
  createComposeFrameEntity,
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
  // v7 的文档根必须是 Frame；被测 Entity 挂在它下面。
  const frame = createComposeFrameEntity({
    id: 'frame-root',
    childIds: [entity.id],
    backgroundPaint: { kind: 'solid', color: '#111827' },
  })
  return {
    schemaVersion: 7,
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
    },
    rootIds: [frame.id],
    entities: { [entity.id]: entity, [frame.id]: frame },
  }
}

function entityFromSeed(
  result: ReturnType<ReturnType<typeof createComposeEntityRegistry>['createSeed']>,
): ComposeEntity {
  if (!result.ok) throw new Error(result.error.message)
  return { id: 'entity-a', ...result.seed }
}

/** 只带 Renderer 的最小 Entity；`type` 为 null 时连 Renderer 都不挂。 */
function rendererEntity(type: string | null): ComposeEntity {
  return {
    id: `entity-${type ?? 'none'}`,
    name: type ?? 'none',
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: transform,
      LayoutItem: layoutItem,
      Visibility: { visible: true },
      Lock: { locked: false },
      ...(type === null ? {} : { Renderer: { type, props: {} } }),
    },
  }
}

describe('ComposeEntityRegistry', () => {
  it('OpenSpec: component-registry / Renderer Prop Contract / 注册值与事件方法 Props', () => {
    const validate = (value: unknown) => typeof value === 'number' || '必须是 number'
    const registry = createComposeEntityRegistry({
      renderers: [{
        type: 'counter',
        label: '计数器',
        renderer: () => null,
        propContracts: [
          { name: 'count', kind: 'value', label: '数值', validate },
          { name: 'onAdd', kind: 'method', label: '增加', role: 'event-handler' },
        ],
      }],
    })

    expect(registry.listRendererPropContracts('counter')).toEqual([
      expect.objectContaining({ name: 'count', kind: 'value', validate }),
      expect.objectContaining({ name: 'onAdd', kind: 'method', role: 'event-handler' }),
    ])
    expect(registry.listRendererPropContracts('missing')).toEqual([])
  })

  it('OpenSpec: component-registry / Renderer Prop Contract / 拒绝重复和非法定义', () => {
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'counter',
        label: '计数器',
        renderer: () => null,
        propContracts: [
          { name: 'count', kind: 'value', label: '数值', validate: () => true },
          { name: 'count', kind: 'method', label: '增加', role: 'event-handler' },
        ],
      }],
    })).toThrow(/count.*重复/u)
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'counter',
        label: '计数器',
        renderer: () => null,
        propContracts: [{
          name: '',
          kind: 'value',
          label: '数值',
          validate: () => true,
        }],
      }],
    })).toThrow(/Prop.*不能为空/u)
  })

  it('OpenSpec: component-registry / Renderer Prop Contract / 校验 Inspector 内联 Prop', () => {
    const valueContract = {
      name: 'count', kind: 'value' as const, label: '数值', validate: () => true as const,
    }
    const methodContract = {
      name: 'onAdd', kind: 'method' as const, label: '增加', role: 'event-handler' as const,
    }
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'counter', label: '计数器', renderer: () => null,
        inspector: () => null,
        inspectorPropNames: ['onAdd'],
        propContracts: [valueContract, methodContract],
      }],
    })).toThrow(/onAdd.*value/u)
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'counter', label: '计数器', renderer: () => null,
        inspector: () => null,
        inspectorPropNames: ['missing'],
        propContracts: [valueContract],
      }],
    })).toThrow(/missing.*Contract/u)
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'counter', label: '计数器', renderer: () => null,
        inspectorPropNames: ['count'],
        propContracts: [valueContract],
      }],
    })).toThrow(/Inspector/u)
  })

  it('OpenSpec: component-registry / Renderer 原地文字编辑契约 / 声明并查询可编辑文本 Prop', () => {
    const registry = createComposeEntityRegistry({
      renderers: [
        {
          type: 'text',
          label: 'Text',
          renderer: () => null,
          editableTextPropName: 'text',
          propContracts: [{ name: 'text', kind: 'value', label: '文本', validate: () => true }],
        },
        { type: 'rectangle', label: '矩形', renderer: () => null },
      ],
    })

    expect(registry.getEditableTextPropName(rendererEntity('text'))).toBe('text')
    expect(registry.getEditableTextPropName(rendererEntity('rectangle'))).toBeNull()
    expect(registry.getEditableTextPropName(rendererEntity('unregistered'))).toBeNull()
    expect(registry.getEditableTextPropName(rendererEntity(null))).toBeNull()
  })

  it('OpenSpec: component-registry / Renderer 原地文字编辑契约 / 拒绝非法的编辑契约', () => {
    const valueContract = {
      name: 'text', kind: 'value' as const, label: '文本', validate: () => true as const,
    }
    const methodContract = {
      name: 'onInput', kind: 'method' as const, label: '输入', role: 'event-handler' as const,
    }

    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'text', label: 'Text', renderer: () => null,
        editableTextPropName: 'onInput',
        propContracts: [valueContract, methodContract],
      }],
    })).toThrow(/onInput.*value/u)
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'text', label: 'Text', renderer: () => null,
        editableTextPropName: 'missing',
        propContracts: [valueContract],
      }],
    })).toThrow(/missing.*Contract/u)
    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'text', label: 'Text', renderer: () => null,
        editableTextPropName: '  ',
        propContracts: [valueContract],
      }],
    })).toThrow(/不能为空/u)

    // 非法 Definition 被拒绝后，同批其他合法 Definition 仍可注册。
    const registry = createComposeEntityRegistry({
      renderers: [
        {
          type: 'text', label: 'Text', renderer: () => null,
          editableTextPropName: 'text',
          propContracts: [valueContract],
        },
        { type: 'rectangle', label: '矩形', renderer: () => null },
      ],
    })
    expect(registry.listRenderers()).toHaveLength(2)
  })

  it('OpenSpec: component-registry / Renderer Props 分类 / 校验分类定义与 Contract 归属', () => {
    const registry = createComposeEntityRegistry({
      renderers: [{
        type: 'text',
        label: 'Text',
        renderer: () => null,
        propCategories: [
          { id: 'content', label: '文本' },
          { id: 'typography', label: '排版', inspectorDefaultExpanded: true },
        ],
        propContracts: [{
          name: 'fontSize',
          kind: 'value',
          label: '字号',
          category: 'typography',
          validate: () => true,
        }],
      }],
    })

    expect(registry.getRenderer('text')?.propCategories).toEqual([
      { id: 'content', label: '文本' },
      { id: 'typography', label: '排版', inspectorDefaultExpanded: true },
    ])
    expect(registry.listRendererPropContracts('text')[0]).toMatchObject({
      name: 'fontSize',
      category: 'typography',
    })

    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'bad',
        label: 'Bad',
        renderer: () => null,
        propCategories: [{ id: 'base', label: '基础' }],
        propContracts: [{
          name: 'value',
          kind: 'value',
          label: '值',
          category: 'missing',
          validate: () => true,
        }],
      }],
    })).toThrow(/分类.*missing/u)

    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'duplicate-category',
        label: 'Duplicate category',
        renderer: () => null,
        propCategories: [
          { id: 'base', label: '基础' },
          { id: 'base', label: '重复基础' },
        ],
      }],
    })).toThrow(/分类.*base.*重复/u)

    expect(() => createComposeEntityRegistry({
      renderers: [{
        type: 'empty-category',
        label: 'Empty category',
        renderer: () => null,
        propCategories: [{ id: '', label: '空' }],
      }],
    })).toThrow(/分类 ID.*不能为空/u)
  })

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
