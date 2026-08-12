import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createComposeGroupEntitySeed,
  getComposeGeometryConstraints,
  getComposeLayoutItem,
  getComposeRenderer,
  type ComposeBaseComponentAsset,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeComponentInstanceEntity } from './component-instance-entity'

function asset(): ComposeBaseComponentAsset {
  const root = createComposeGroupEntitySeed({ id: 'root', size: { width: 240, height: 120 } })
  return {
    schemaVersion: 1,
    kind: 'base',
    componentId: 'card',
    name: 'Card',
    document: {
      schemaVersion: 6,
      canvas: {
        grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: true },
        smartSnap: { nodes: true, guides: true },
        guides: [],
      },
      output: { width: 240, height: 120, backgroundPaint: { kind: 'solid', color: 'transparent' } },
      rootIds: ['root'],
      entities: { root },
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
      resize: 'none',
      rotatable: true,
    })
  })
})

describe('实例几何跟随组件根', () => {
  it('从组件根派生 Resize 能力', () => {
    const registry = createRegistry()
    const asset = baseAsset()
    // 组件根是可自由缩放的容器，实例应当同样允许 Resize。
    const root = asset.document.entities[asset.document.rootIds[0]!]!
    const withResizableRoot = {
      ...asset,
      document: {
        ...asset.document,
        entities: {
          ...asset.document.entities,
          [root.id]: {
            ...root,
            components: {
              ...root.components,
              GeometryConstraints: { movable: true, resize: 'free', rotatable: false },
            },
          },
        },
      },
    }
    const result = createComposeComponentInstanceEntity({
      registry,
      id: 'instance',
      asset: withResizableRoot,
      reference,
      revision: '1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(getComposeGeometryConstraints(result.entity)).toMatchObject({ resize: 'free' })
  })

  it('组件根不可缩放时实例同样不可缩放', () => {
    const result = createComposeComponentInstanceEntity({
      registry: createRegistry(),
      id: 'instance',
      asset: baseAsset(),
      reference,
      revision: '1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(getComposeGeometryConstraints(result.entity)).toMatchObject({ resize: 'none' })
  })
})
