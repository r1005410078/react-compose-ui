import {
  createComposeGroupEntitySeed,
  createEmptyComposePageDocument,
  getComposeFrame,
  getComposeLayoutItem,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeResolvedComponentSnapshot,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { prepareComposeComponentInstance } from './prepare'

const reference: ComposeComponentReference = {
  kind: 'component',
  providerId: 'memory',
  assetKey: 'Components/Card.component.json',
  scope: 'persistent',
}
const KEY = 'memory:persistent:Components/Card.component.json'

function componentDocument(rootOffset = { x: 0, y: 0 }): ComposeDocument {
  const materials = createComposeBasicMaterials()
  const rectangleSeed = materials.registry.createSeed('rectangle')
  if (!rectangleSeed.ok) throw new Error(rectangleSeed.error.message)
  const group = createComposeGroupEntitySeed({
    id: 'root',
    name: 'Card',
    childIds: ['rectangle'],
    size: { width: 120, height: 80 },
  })
  return {
    ...createEmptyComposePageDocument(),
    rootIds: [group.id],
    entities: {
      [group.id]: {
        ...group,
        components: {
          ...group.components,
          LayoutItem: { ...getComposeLayoutItem(group), offset: rootOffset },
          Frame: { size: { width: 120, height: 80 }, guides: [] },
        },
      },
      rectangle: { id: 'rectangle', ...rectangleSeed.seed },
    },
  }
}

function snapshot(document = componentDocument()): ComposeResolvedComponentSnapshot {
  return {
    componentId: 'card',
    kind: 'base',
    revision: '1',
    document,
    appliedLineage: [{ reference, componentId: 'card', kind: 'base', revision: '1' }],
  }
}

function props(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { reference, resolvedSnapshot: snapshot(), propertyOverrides: {}, ...extra }
}

describe('OpenSpec: basic-materials / 组件实例准备管线是共享的纯函数', () => {
  it('快照无效时返回可判别的失败', () => {
    expect(prepareComposeComponentInstance({
      props: { reference },
      hostBox: null,
      ancestorKeys: [],
    })).toEqual({ ok: false, reason: 'invalid-snapshot' })
  })

  it('循环引用：组件引用已出现在祖先链里', () => {
    expect(prepareComposeComponentInstance({
      props: props(),
      hostBox: null,
      ancestorKeys: [KEY],
    })).toEqual({ ok: false, reason: 'cycle' })
  })

  it('祖先链达到嵌套上限时拒绝', () => {
    expect(prepareComposeComponentInstance({
      props: props(),
      hostBox: null,
      ancestorKeys: Array.from({ length: 8 }, (_, index) => `other:${index}`),
    })).toEqual({ ok: false, reason: 'too-deep' })
  })

  it('根锚到原点，layout 下根尺寸对齐被覆盖的 fixed LayoutItem', () => {
    const result = prepareComposeComponentInstance({
      props: props({
        resolvedSnapshot: snapshot(componentDocument({ x: 300, y: 40 })),
        instanceOverrides: {
          operations: [{
            id: 'width',
            kind: 'set-field',
            entityId: 'root',
            componentKey: 'LayoutItem',
            fieldPath: ['width', 'value'],
            value: 200,
          }],
        },
      }),
      hostBox: { width: 200, height: 80 },
      ancestorKeys: [],
    })
    if (!result.ok) throw new Error(result.reason)
    const root = result.document.entities.root
    expect(result.key).toBe(KEY)
    expect(getComposeLayoutItem(root).offset).toEqual({ x: 0, y: 0 })
    expect(getComposeFrame(root)?.size).toEqual({ width: 200, height: 80 })
    expect(result.contentScale).toEqual({ x: 1, y: 1 })
  })

  it('scale 下保持根自然尺寸并按盒求两轴比值；翻转给出 ±1', () => {
    const result = prepareComposeComponentInstance({
      props: props({ contentFit: 'scale', flip: 'x' }),
      hostBox: { width: 240, height: 40 },
      ancestorKeys: [],
    })
    if (!result.ok) throw new Error(result.reason)
    expect(result.contentFit).toBe('scale')
    expect(result.rootSize).toEqual({ width: 120, height: 80 })
    expect(result.contentScale).toEqual({ x: 2, y: 0.5 })
    expect(result.flipScale).toEqual({ x: -1, y: 1 })
  })
})
