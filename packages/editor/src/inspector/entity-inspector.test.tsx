import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import { ComposePropertyPanel } from '@compose-ui/property-panel'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import * as v from 'valibot'
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
  it('OpenSpec: component-registry / 缺失 Component Inspector 协议 / 宿主缺失入口保持 action-only', () => {
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
    const addCapability = screen.getByRole('combobox', { name: '添加能力' })
    expect(addCapability.parentElement).toHaveClass(
      'compose-editor__entity-inspector-add-capability',
    )
    expect(addCapability.parentElement).toHaveTextContent('＋')
    expect(screen.getByText('布局').closest('.property-panel__group')).not.toHaveClass('property-panel__group-content')
    expect(screen.queryByRole('button', { name: '布局' })).not.toBeInTheDocument()
  })

  it('OpenSpec: component-registry / 缺失 Component Inspector 协议 / Hierarchy 缺少 Layout 时显示入口', () => {
    const registry = createComposeEntityRegistry({
      components: [{
        key: 'Layout',
        label: '布局',
        inspectorDefaultExpanded: true,
        createDefault: () => ({ type: 'flex' }),
        missingInspector: {
          isVisible: (candidate) => candidate.components.Hierarchy !== undefined,
          actions: () => <button aria-label="添加布局" type="button">+</button>,
          content: () => <div>使用自动布局</div>,
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

    const sectionButton = screen.getByRole('button', { name: '布局' })
    expect(sectionButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('使用自动布局')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加布局' })).toBeInTheDocument()
    fireEvent.click(sectionButton)
    expect(screen.queryByText('使用自动布局')).not.toBeInTheDocument()
    expect(sectionButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('OpenSpec: component-registry / Component Inspector 分组与默认展开协议 / 合并基础并应用默认展开状态', () => {
    const groupedEntity: ComposeEntity = {
      ...entity,
      components: {
        ...entity.components,
        HostGeometry: { rotation: 0 },
        HostLayout: { gap: 8 },
        HostState: { enabled: true },
        Renderer: { type: 'host-card', props: { title: 'Card' } },
      },
    }
    const groupedDocument: ComposeDocument = {
      ...document,
      entities: { [groupedEntity.id]: groupedEntity },
    }
    const registry = createComposeEntityRegistry({
      components: [
        {
          key: 'HostGeometry',
          label: '几何',
          order: 10,
          inspectorGroup: 'basic',
          createDefault: () => ({ rotation: 0 }),
          inspector: ({ value }) => (
            <ComposePropertyPanel
              schema={v.object({ rotation: v.pipe(v.number(), v.title('旋转')) })}
              value={{ rotation: Number(value.rotation) }}
            />
          ),
        },
        {
          key: 'HostLayout',
          label: '布局',
          order: 20,
          inspectorDefaultExpanded: true,
          createDefault: () => ({ gap: 0 }),
          inspector: ({ value }) => (
            <ComposePropertyPanel
              schema={v.object({ gap: v.pipe(v.number(), v.title('间距')) })}
              value={{ gap: Number(value.gap) }}
            />
          ),
        },
        {
          key: 'HostState',
          label: '状态',
          order: 30,
          createDefault: () => ({ enabled: true }),
          inspector: ({ value }) => (
            <ComposePropertyPanel
              schema={v.object({ enabled: v.pipe(v.boolean(), v.title('启用')) })}
              value={{ enabled: Boolean(value.enabled) }}
            />
          ),
        },
      ],
      renderers: [{
        type: 'host-card',
        label: '内容',
        renderer: () => null,
        inspector: ({ renderer }) => (
          <ComposePropertyPanel
            schema={v.object({ title: v.pipe(v.string(), v.title('标题')) })}
            value={{ title: String(renderer.props.title) }}
          />
        ),
      }],
    })

    render(
      <EntityInspector
        dispatch={vi.fn()}
        document={groupedDocument}
        entity={groupedEntity}
        idFactory={() => 'command-1'}
        registry={registry}
      />,
    )

    expect(screen.getByRole('button', { name: '基础' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('名称')).toBeInTheDocument()
    expect(screen.getByLabelText('旋转')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '几何' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '布局' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '状态' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: '内容' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('启用')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('标题')).not.toBeInTheDocument()
  })
})
