import { createComposeAssetResolver } from '@compose-ui/assets'
import {
  createComposeFrameEntity,
  createDefaultComposeLayoutItem,
  createEmptyComposePageDocument,
  type ComposeDocument,
  type ComposeEntity,
  type ComposePageReference,
  type JsonObject,
} from '@compose-ui/core'
import { createComposeBasicMaterials } from '@compose-ui/materials'
import { createComposePageDocumentLoader, createComposePageStore } from '@compose-ui/pages'
import { ComposePreview } from '@compose-ui/preview'
import { useMemo, useState } from 'react'
import { createDemoAssetProvider } from './demo-asset-provider'

const LEAF_PAGE_ID = 'deep-page-slot-leaf'
const MIDDLE_PAGE_ID = 'deep-page-slot-middle'

function reference(assetKey: string): ComposePageReference {
  return {
    kind: 'page',
    providerId: 'demo-memory',
    assetKey,
    scope: 'persistent',
  }
}

function entity(
  id: string,
  renderer: { readonly type: string; readonly props: JsonObject },
  offset = { x: 0, y: 0 },
): ComposeEntity {
  const componentKeys = ['Transform', 'LayoutItem', 'Visibility', 'Lock', 'Renderer']
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: renderer.type,
        baseComponentKeys: componentKeys,
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(280, 180, offset),
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: renderer,
    },
  }
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    ...createEmptyComposePageDocument(),
    // v7 的文档根只接受 Frame；示例内容统一挂在这块画板下。
    rootIds: ['frame-root'],
    entities: {
      'frame-root': createComposeFrameEntity({
        id: 'frame-root',
        name: '画板',
        childIds: entities.map(({ id }) => id),
      }),
      ...Object.fromEntries(entities.map((item) => [item.id, item])),
    },
  }
}

const leafDocument = documentWith([
  entity('deep-leaf-rectangle', { type: 'rectangle', props: {} }),
])

const middleDocument = documentWith([
  entity('deep-leaf-slot-1', {
    type: 'page-slot',
    props: { page: reference(LEAF_PAGE_ID) },
  }),
  entity('deep-leaf-slot-2', {
    type: 'page-slot',
    props: { page: reference(LEAF_PAGE_ID) },
  }, { x: 320, y: 0 }),
])

const homeDocument = documentWith([
  entity('deep-middle-slot', {
    type: 'page-slot',
    props: { page: reference(MIDDLE_PAGE_ID) },
  }),
])

/** A → B → Home Page Slot 冷加载集成场景，仅由示例应用的查询参数启用。 */
export function DeepPageSlotDemo() {
  const [provider] = useState(() => createDemoAssetProvider({
    pages: [
      { id: LEAF_PAGE_ID, name: 'DeepLeaf.page.json', document: leafDocument },
      { id: MIDDLE_PAGE_ID, name: 'DeepMiddle.page.json', document: middleDocument },
    ],
  }))
  const [store] = useState(() => createComposePageStore({ provider }))
  const registry = useMemo(() => createComposeBasicMaterials().registry, [])
  const assetResolver = useMemo(() => createComposeAssetResolver(provider), [provider])
  const pageLoader = useMemo(() => createComposePageDocumentLoader(store), [store])

  return (
    <main data-testid="deep-page-slot-demo" style={{ width: 1280, height: 720 }}>
      <ComposePreview
        assetResolver={assetResolver}
        document={homeDocument}
        pageLoader={pageLoader}
        registry={registry}
      />
    </main>
  )
}
