import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createComposeGroupEntitySeed,
  getComposeGeometryConstraints,
  getComposeLayoutItem,
  getComposeRenderer,
  type ComposeEntity,
  type ComposeBaseComponentAsset,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeComponentInstanceEntity } from './component-instance-entity'

/** 给组件根就地加上 Frame Component：组件文档的单根必须是 Frame。 */
function withFrame(entity: ComposeEntity, width: number, height: number): ComposeEntity {
  return {
    ...entity,
    components: {
      ...entity.components,
      Frame: { size: { width, height }, guides: [] },
    },
  }
}

function asset(): ComposeBaseComponentAsset {
  const root = createComposeGroupEntitySeed({ id: 'root', size: { width: 240, height: 120 } })
  return {
    schemaVersion: 2,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: {
      schemaVersion: 7,
      canvas: {
        grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
        smartSnap: { nodes: true, guides: true },
      },
      // 组件文档的单根必须是 Frame；这里给既有根就地加上 Frame Component。
      rootIds: ['root'],
      entities: { root: withFrame(root, 240, 120) },
    },
  }
}

function createRegistry() {
  return createComposeEntityRegistry({
    presets: [{
      id: 'component-instance',
      label: 'Component',
      defaultName: 'Component',
      paletteHidden: true,
      createComponents: () => ({
        Transform: { rotation: 0 },
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 0, y: 0 },
          width: { mode: 'fixed', value: 1, min: 1, max: null },
          height: { mode: 'fixed', value: 1, min: 1, max: null },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'component-instance', props: {} },
      }),
    }],
  })
}

const baseAsset = asset

const reference = {
  kind: 'component' as const,
  providerId: 'project',
  assetKey: 'Components/Card.component.json',
  scope: 'persistent' as const,
}

describe('OpenSpec: component-library / 关联实例实体', () => {
  it('从 Registry 隐藏 Preset 建立带引用和离线快照的结构叶子', () => {
    const registry = createComposeEntityRegistry({
      presets: [{
        id: 'component-instance',
        label: 'Component',
        defaultName: 'Component',
        paletteHidden: true,
        createComponents: () => ({
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: 1, min: 1, max: null },
            height: { mode: 'fixed', value: 1, min: 1, max: null },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            alignSelf: 'auto',
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Renderer: { type: 'component-instance', props: {} },
        }),
      }],
    })
    const result = createComposeComponentInstanceEntity({
      registry,
      id: 'instance',
      asset: asset(),
      reference: {
        kind: 'component',
        providerId: 'project',
        assetKey: 'Components/Card.component.json',
        scope: 'persistent',
      },
      revision: '3',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entity.name).toBe('Card')
    expect(getComposeRenderer(result.entity)).toMatchObject({
      type: 'component-instance',
      props: {
        reference: { assetKey: 'Components/Card.component.json' },
        resolvedSnapshot: { componentId: 'card', revision: '3' },
        instanceOverrides: { operations: [] },
      },
    })
    expect(getComposeLayoutItem(result.entity)).toMatchObject({
      width: { mode: 'hug', value: 240 },
      height: { mode: 'hug', value: 120 },
    })
    expect(getComposeGeometryConstraints(result.entity)).toEqual({
      movable: true,
      resize: 'free',
      rotatable: true,
    })
  })
})

describe('实例最外层 Resize', () => {
  it('页面实例始终 free，与组件根约束解耦', () => {
    const result = createComposeComponentInstanceEntity({
      registry: createRegistry(),
      id: 'instance',
      asset: baseAsset(),
      reference,
      revision: '1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 根默认无显式 GeometryConstraints 时 resolve 为 free；即使根为 none 也应 free。
    expect(getComposeGeometryConstraints(result.entity)).toMatchObject({
      movable: true,
      resize: 'free',
      rotatable: true,
    })
  })

  it('组件根 resize:none 时实例仍 free', () => {
    const registry = createRegistry()
    const asset = baseAsset()
    const root = asset.document.entities[asset.document.rootIds[0]!]!
    const withLockedRoot = {
      ...asset,
      document: {
        ...asset.document,
        entities: {
          ...asset.document.entities,
          [root.id]: {
            ...root,
            components: {
              ...root.components,
              GeometryConstraints: { movable: true, resize: 'none' as const, rotatable: false },
            },
          },
        },
      },
    }
    const result = createComposeComponentInstanceEntity({
      registry,
      id: 'instance',
      asset: withLockedRoot,
      reference,
      revision: '1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(getComposeGeometryConstraints(result.entity)).toMatchObject({ resize: 'free' })
  })
})
