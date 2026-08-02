import { cleanup, render, screen } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntityInspector } from './entity-inspector'

const entity: ComposeEntity = {
  id: 'container-a',
  name: 'Container',
  components: {
    Composition: {
      presetId: 'container',
      baseComponentKeys: [
        'Transform',
        'LayoutItem',
        'Visibility',
        'Lock',
        'Hierarchy',
      ],
      capabilityIds: [],
    },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 320, min: 1, max: null },
      height: { mode: 'fixed', value: 180, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [] },
  },
}

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: createDefaultOutputSettings(),
  rootIds: [entity.id],
  entities: { [entity.id]: entity },
}

afterEach(cleanup)

describe('EntityInspector missing Component sections', () => {
  it('OpenSpec: 自动布局显式启用 / 缺少 Layout 时显示 action-only 布局分组', () => {
    const registry = createComposeEntityRegistry({
      components: [{
        key: 'Layout',
        label: '布局',
        createDefault: () => ({ type: 'flex' }),
        missingInspector: {
          isVisible: (candidate) => candidate.components.Hierarchy !== undefined,
          actions: ({ readOnly }) => (
            <button disabled={readOnly} type="button" aria-label="添加布局">+</button>
          ),
        },
      }],
    })

    render(
      <EntityInspector
        dispatch={vi.fn()}
        document={document}
        entity={entity}
        idFactory={() => 'command-1'}
        registry={registry}
      />,
    )

    expect(screen.getByRole('button', { name: '添加布局' })).toBeInTheDocument()
    expect(screen.getByText('布局').closest('.property-panel__group')).not.toHaveClass('property-panel__group-content')
    expect(screen.queryByRole('button', { name: '布局' })).not.toBeInTheDocument()
  })
})
