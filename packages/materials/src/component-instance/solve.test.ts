import {
  createComposeFrameEntity,
  createComposeGroupEntitySeed,
  createEmptyComposePageDocument,
  type ComposeComponentReference,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeResolvedComponentSnapshot,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'
import { solveComposeComponentInstances } from './solve'

const materials = createComposeBasicMaterials()

function reference(assetKey: string): ComposeComponentReference {
  return { kind: 'component', providerId: 'memory', assetKey, scope: 'persistent' }
}

function rectangle(id: string): ComposeEntity {
  const seed = materials.registry.createSeed('rectangle')
  if (!seed.ok) throw new Error(seed.error.message)
  return { id, ...seed.seed }
}

function instance(id: string, assetKey: string, document: ComposeDocument): ComposeEntity {
  const base = rectangle(id)
  const snapshot: ComposeResolvedComponentSnapshot = {
    componentId: assetKey,
    kind: 'base',
    revision: '1',
    document,
    appliedLineage: [{ reference: reference(assetKey), componentId: assetKey, kind: 'base', revision: '1' }],
  }
  return {
    ...base,
    components: {
      ...base.components,
      Renderer: {
        type: 'component-instance',
        props: { reference: reference(assetKey), resolvedSnapshot: snapshot, instanceOverrides: { operations: [] } } as unknown as JsonObject,
      },
    },
  }
}

function componentDocument(size: { width: number; height: number }, children: readonly ComposeEntity[]): ComposeDocument {
  const root = createComposeGroupEntitySeed({ id: 'root', name: 'C', childIds: children.map((child) => child.id), size })
  return {
    ...createEmptyComposePageDocument(),
    rootIds: ['root'],
    entities: Object.fromEntries([
      ['root', { ...root, components: { ...root.components, Frame: { size, guides: [] } } }],
      ...children.map((child) => [child.id, child]),
    ]),
  }
}

describe('OpenSpec: qml-export / 编辑器导出时逐实例准备与求解', () => {
  it('嵌套实例按「外层/内层」求解，隐藏的实例不求解', async () => {
    const chip = componentDocument({ width: 40, height: 20 }, [rectangle('dot')])
    const card = componentDocument({ width: 120, height: 80 }, [rectangle('body'), instance('inner', 'Chip', chip)])
    const shown = instance('shown', 'Card', card)
    const hidden = instance('hidden', 'Card', card)
    const page: ComposeDocument = {
      ...createEmptyComposePageDocument(),
      rootIds: ['scene'],
      entities: {
        scene: createComposeFrameEntity({ id: 'scene', childIds: ['shown', 'hidden'], size: { width: 320, height: 200 } }),
        shown,
        hidden: { ...hidden, components: { ...hidden.components, Visibility: { visible: false } } },
      },
    }
    const box = (width: number, height: number) => ({ x: 0, y: 0, width, height, positioning: 'absolute' as const })
    const solved = await solveComposeComponentInstances({
      document: page,
      snapshot: { revision: 1, diagnostics: [], boxes: { scene: box(320, 200), shown: box(120, 80), hidden: box(120, 80) } },
      rootId: 'scene',
      registry: materials.registry,
    })
    expect([...solved.keys()]).toEqual(['shown', 'shown/inner'])
    expect(Object.keys(solved.get('shown')!.snapshot.boxes).sort()).toEqual(['body', 'inner', 'root'])
    expect(solved.get('shown/inner')!.snapshot.boxes.dot).toBeDefined()
  })
})
