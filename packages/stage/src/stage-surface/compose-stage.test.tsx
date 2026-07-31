import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createComposeEntityRegistry,
  type ComposeEntityPreset,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeComposition,
  getComposeLayoutItem,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeStage } from './compose-stage'
import type { ComposeStageDispatch } from '../types'

function entity(
  id: string,
  options: {
    childIds?: readonly string[]
    resize?: 'free' | 'preserve-aspect' | 'horizontal' | 'vertical' | 'none'
    rotatable?: boolean
  } = {},
): ComposeEntity {
  const hierarchy = options.childIds !== undefined
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: null,
        baseComponentKeys: [
          'Transform',
          'LayoutItem',
          'Visibility',
          'Lock',
          ...(hierarchy ? ['Hierarchy', 'Clip'] : ['Renderer']),
          ...(options.resize ? ['GeometryConstraints'] : []),
        ],
        capabilityIds: [],
      },
      Transform: {
        rotation: 0,
      },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 20, y: 30 },
        width: { mode: 'fixed', value: 100, min: 1, max: null },
        height: { mode: 'fixed', value: 50, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#2463eb' } },
      ...(hierarchy
        ? {
            Hierarchy: { childIds: [...(options.childIds ?? [])] },
            Clip: { enabled: true },
          }
        : { Renderer: { type: 'test', props: { text: id } } }),
      ...(options.resize
        ? {
            GeometryConstraints: {
              movable: true,
              resize: options.resize,
              rotatable: options.rotatable ?? true,
            },
          }
        : {}),
    },
  }
}

function document(
  entities: readonly ComposeEntity[] = [entity('a')],
  rootIds: readonly string[] = entities.map(({ id }) => id),
): ComposeDocument {
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
    rootIds,
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}

const preset: ComposeEntityPreset = {
  id: 'rectangle',
  label: '矩形',
  createComponents: () => ({
    Transform: {
      rotation: 0,
    },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 100, min: 1, max: null },
      height: { mode: 'fixed', value: 50, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: { backgroundPaint: { kind: 'solid', color: '#2463eb' } },
    Renderer: { type: 'test', props: { text: 'seed' } },
  }),
}

const registry = createComposeEntityRegistry({
  renderers: [{
    type: 'test',
    label: '测试',
    renderer: ({ props }) => <span>{String(props.text)}</span>,
  }],
  presets: [preset],
})

function layoutSnapshot(value: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.values(value.entities).map((item) => {
      const layoutItem = getComposeLayoutItem(item)
      return [item.id, {
        x: layoutItem.offset.x,
        y: layoutItem.offset.y,
        width: layoutItem.width.value,
        height: layoutItem.height.value,
        positioning: layoutItem.positioning,
      }]
    })),
    diagnostics: [],
  }
}

function autoLayoutContainer(id: string, childIds: readonly string[]): ComposeEntity {
  const base = entity(id, { childIds })
  return {
    ...base,
    components: {
      ...base.components,
      Composition: {
        ...base.components.Composition,
        baseComponentKeys: [...getComposeComposition(base).baseComponentKeys, 'Layout'],
      },
      Layout: {
        type: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignContent: 'stretch',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        rowGap: 0,
        columnGap: 0,
      },
    },
  }
}

function flowEntity(id: string, fillWidth = false): ComposeEntity {
  const base = entity(id)
  return {
    ...base,
    components: {
      ...base.components,
      LayoutItem: {
        ...base.components.LayoutItem,
        positioning: 'flow',
        width: {
          ...(base.components.LayoutItem?.width as object),
          mode: fillWidth ? 'fill' : 'fixed',
        },
      },
    },
  }
}

function renderStage(
  value: ComposeDocument,
  options: {
    selectedIds?: readonly string[]
    paintEditing?: { readonly entityId: string }
    snapshot?: ComposeLayoutSnapshot
  } = {},
) {
  const runtime = createTransactionRuntime({ document: value })
  const dispatchSpy = vi.fn()
  const dispatch: ComposeStageDispatch = (command) => {
    dispatchSpy(command)
    return runtime.dispatch(command)
  }
  render(
    <ComposeStage
      dispatch={dispatch}
      document={value}
      layoutSnapshot={options.snapshot ?? layoutSnapshot(value)}
      onSelectedIdsChange={vi.fn()}
      onViewportChange={vi.fn()}
      registry={registry}
      paintEditing={options.paintEditing}
      selectedIds={options.selectedIds ?? []}
      tool="select"
      viewport={{ x: 0, y: 0, zoom: 1 }}
    />,
  )
  return { dispatch: dispatchSpy, runtime }
}

describe('ComposeStage ECS', () => {
  afterEach(cleanup)

  it('OpenSpec: stage / Stage 输出背景 Paint / 编辑渐变输出背景', () => {
    const value = document()
    renderStage({
      ...value,
      output: {
        ...value.output,
        backgroundPaint: {
          kind: 'linear-gradient',
          start: { x: 0, y: 0.5 },
          end: { x: 1, y: 0.5 },
          stops: [
            { id: 'start', position: 0, color: '#0cdeab' },
            { id: 'end', position: 1, color: '#06785c' },
          ],
        },
      },
    })

    expect(screen.getByTestId('stage-output-paint')).toHaveAttribute('data-compose-output-paint', 'linear-gradient')
  })

  it('OpenSpec: Renderer + Hierarchy / 先渲染自身 Renderer 再渲染子项', () => {
    const child = entity('child')
    const container = {
      ...entity('container', { childIds: ['child'] }),
      components: {
        ...entity('container', { childIds: ['child'] }).components,
        Renderer: { type: 'test', props: { text: 'container-content' } },
      },
    }
    renderStage(document([container, child], ['container']))
    expect(screen.getByText('container-content')).toBeInTheDocument()
    expect(screen.getByText('child')).toBeInTheDocument()
    expect(screen.getByTestId('stage-container')).toContainElement(
      screen.getByTestId('stage-entity-child'),
    )
  })

  it('OpenSpec: basic-materials / Stage 暂时忽略 Layout 并保留子项 Transform', () => {
    const child = entity('child')
    const baseContainer = entity('container', { childIds: ['child'] })
    const container: ComposeEntity = {
      ...baseContainer,
      components: {
        ...baseContainer.components,
        Composition: {
          ...baseContainer.components.Composition!,
          baseComponentKeys: [
            ...(baseContainer.components.Composition!.baseComponentKeys as readonly string[]),
            'Layout',
          ],
        },
        Layout: {
          type: 'flex',
          flexDirection: 'column',
          flexWrap: 'wrap',
          alignContent: 'center',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          rowGap: 24,
          columnGap: 24,
        },
      },
    }
    renderStage(document([container, child], ['container']))

    expect(screen.getByTestId('stage-container').style.display).toBe('')
    expect(screen.getByTestId('stage-entity-child')).toHaveStyle({
      position: 'absolute',
      left: '20px',
      top: '30px',
    })
  })

  it('OpenSpec: 共享渲染语义 / 边框覆盖层位于图片 Paint 与 Renderer 之后', () => {
    const bordered = {
      ...entity('bordered'),
      components: {
        ...entity('bordered').components,
        Appearance: {
          backgroundPaint: { kind: 'solid' as const, color: '#2463eb' },
          borderColor: '#ef4444',
          borderWidth: 9,
          borderRadius: 12,
        },
      },
    }
    renderStage(document([bordered]))

    const node = screen.getByTestId('stage-entity-bordered')
    expect(node.lastElementChild).toHaveAttribute('data-compose-entity-border')
  })

  it.each([
    ['horizontal', ['e', 'w']],
    ['vertical', ['n', 's']],
    ['preserve-aspect', ['ne', 'se', 'sw', 'nw']],
    ['none', []],
  ] as const)('OpenSpec: Resize handles / %s 只显示允许手柄', (mode, handles) => {
    renderStage(document([entity('a', { resize: mode })]), { selectedIds: ['a'] })
    const all = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
    all.forEach((handle) => {
      const query = screen.queryByTestId(`stage-resize-${handle}`)
      if ((handles as readonly string[]).includes(handle)) expect(query).toBeInTheDocument()
      else expect(query).not.toBeInTheDocument()
    })
  })

  it('OpenSpec: Transform command / 方向键派发 ECS move operation', () => {
    const { dispatch } = renderStage(document(), { selectedIds: ['a'] })
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.setTransform,
      payload: {
        operation: 'move',
        updates: [{
          entityId: 'a',
          transform: {
            position: { x: 21, y: 30 },
            size: { width: 100, height: 50 },
            rotation: 0,
          },
        }],
      },
    }))
  })

  it('OpenSpec: auto-layout-interactions / Flow nudge / 用 Snapshot 转 Absolute 并烘焙 Fill', () => {
    const child = flowEntity('a', true)
    const parent = autoLayoutContainer('parent', ['a'])
    const value = document([parent, child], ['parent'])
    const snapshot: ComposeLayoutSnapshot = {
      revision: 2,
      boxes: {
        parent: { x: 20, y: 30, width: 400, height: 200, positioning: 'absolute' },
        a: { x: 12, y: 16, width: 260, height: 50, positioning: 'flow' },
      },
      diagnostics: [],
    }
    const { dispatch, runtime } = renderStage(value, { selectedIds: ['a'], snapshot })
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.setTransform,
      payload: {
        operation: 'move',
        updates: [{
          entityId: 'a',
          transform: {
            position: { x: 13, y: 16 },
            size: { width: 260, height: 50 },
            rotation: 0,
          },
        }],
      },
    }))
    expect(getComposeLayoutItem(runtime.document.entities.a!)).toMatchObject({
      positioning: 'absolute',
      offset: { x: 13, y: 16 },
      width: { mode: 'fixed', value: 260 },
    })
  })

  it('OpenSpec: auto-layout-interactions / Flow Group / 菜单与快捷键共享禁用原因', () => {
    const first = flowEntity('first')
    const second = flowEntity('second')
    const parent = autoLayoutContainer('parent', ['first', 'second'])
    const value = document([parent, first, second], ['parent'])
    const { dispatch } = renderStage(value, { selectedIds: ['first', 'second'] })
    const application = screen.getByRole('application')
    fireEvent.contextMenu(screen.getByTestId('stage-entity-first'), {
      clientX: 40,
      clientY: 50,
    })
    const group = screen.getByRole('menuitem', { name: /^编组/ })
    expect(group).toHaveAttribute(
      'title',
      '自动布局 Flow 子项不能参与 Group；请先转为 Absolute',
    )
    expect(group).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(application, {
      code: 'KeyG',
      key: 'g',
      ctrlKey: true,
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: Context menu / Entity 删除使用新命令并显示快捷键', () => {
    const { dispatch } = renderStage(document(), { selectedIds: ['a'] })
    fireEvent.contextMenu(screen.getByTestId('stage-entity-a'), {
      clientX: 40,
      clientY: 50,
    })
    const remove = screen.getByRole('menuitem', { name: /删除/ })
    expect(remove).toHaveTextContent(/Delete|Backspace/)
    fireEvent.click(remove)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.deleteEntity,
      payload: { entityIds: ['a'] },
    }))
  })

  it('OpenSpec: stage-paint-tools / 打开单选背景填充时以 Paint 控制柄替换普通 resize 控制柄', () => {
    const painted: ComposeEntity = {
      ...entity('a'),
      components: {
        ...entity('a').components,
        Appearance: {
          backgroundPaint: {
            kind: 'linear-gradient',
            start: { x: 0, y: 0.5 },
            end: { x: 1, y: 0.5 },
            stops: [
              { id: 'start', position: 0, color: '#ef4444' },
              { id: 'end', position: 1, color: '#3b82f6' },
            ],
          },
        },
      },
    }
    renderStage(document([painted]), { paintEditing: { entityId: 'a' }, selectedIds: ['a'] })
    expect(screen.getByTestId('stage-paint-handles')).toBeInTheDocument()
    expect(screen.getByTestId('stage-paint-linear-start')).toBeInTheDocument()
    expect(screen.getByTestId('stage-paint-linear-end')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-resize-se')).not.toBeInTheDocument()
  })
})
