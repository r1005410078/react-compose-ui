import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createComposeEntityRegistry,
  type ComposeEntityPreset,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  createTransactionRuntime,
  getComposeComposition,
  getComposeLayoutItem,
  getComposeRenderer,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposePageScriptScope, type ComposeState } from '@compose-ui/script-runtime'
import { ComposeStage } from './compose-stage'
import { entityFromDrawingSeed } from './drawing-entity'
import type { ComposeStageDispatch } from '../types'
import { StageOverlay } from '../stage-overlay'

function entity(
  id: string,
  options: {
    childIds?: readonly string[]
    overflow?: { readonly horizontal: 'visible' | 'clip' | 'scroll'; readonly vertical: 'visible' | 'clip' | 'scroll' }
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
            Clip: options.overflow
              ? { enabled: true, ...options.overflow }
              : { enabled: true },
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
  }, {
    type: 'shape',
    label: '线条',
    renderer: () => null,
  }],
  presets: [preset],
})

function lineEntity(id = 'line', kind: 'line' | 'arrow' = 'line'): ComposeEntity {
  const base = entity(id)
  return {
    ...base,
    components: {
      ...base.components,
      Renderer: {
        type: 'shape',
        props: {
          kind,
          direction: { x: 1, y: 1 },
          stroke: '#d8e2f1',
          strokeWidth: 2,
        },
      },
    },
  }
}

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
    gridVisible?: boolean
    selectedIds?: readonly string[]
    paintEditing?: { readonly entityId: string }
    snapshot?: ComposeLayoutSnapshot
    scope?: import('@compose-ui/script-runtime').ComposePageScriptScope
    registry?: ReturnType<typeof createComposeEntityRegistry>
    onCreateComponentIntent?: (entityIds: readonly string[]) => void
    tool?: import('../types').ComposeStageTool
    marqueeMode?: import('../types').ComposeStageMarqueeMode
  } = {},
) {
  const runtime = createTransactionRuntime({ document: value })
  const dispatchSpy = vi.fn()
  const selectionSpy = vi.fn()
  const dispatch: ComposeStageDispatch = (command) => {
    dispatchSpy(command)
    return runtime.dispatch(command)
  }
  render(
    <ComposeStage
      dispatch={dispatch}
      document={value}
      gridVisible={options.gridVisible}
      layoutSnapshot={options.snapshot ?? layoutSnapshot(value)}
      marqueeMode={options.marqueeMode}
      onSelectedIdsChange={selectionSpy}
      onCreateComponentIntent={options.onCreateComponentIntent}
      onViewportChange={vi.fn()}
      registry={options.registry ?? registry}
      scriptScope={options.scope}
      paintEditing={options.paintEditing}
      selectedIds={options.selectedIds ?? []}
      tool={options.tool ?? 'select'}
      viewport={{ x: 0, y: 0, zoom: 1 }}
    />,
  )
  return { dispatch: dispatchSpy, runtime, selection: selectionSpy }
}

describe('ComposeStage ECS', () => {
  afterEach(cleanup)

  function switcherDocument(activeIndex = 0) {
    const first = entity('first')
    const second = entity('second', { childIds: ['leaf'] })
    const leaf = entity('leaf')
    const base = entity('switcher', { childIds: ['first', 'second'] })
    const switcher: ComposeEntity = {
      ...base,
      components: { ...base.components, WidgetSwitcher: { activeIndex } },
    }
    return document([switcher, first, second, leaf], ['switcher'])
  }

  it('OpenSpec: Stage 只渲染 WidgetSwitcher 的活动子项 / 只显示活动子项', () => {
    const value = switcherDocument(0)
    const snapshot = layoutSnapshot(value)
    renderStage(value, { snapshot })

    expect(screen.getByTestId('stage-entity-first')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-entity-leaf')).not.toBeInTheDocument()
    // 非活动分支仍参与布局求解，box 不受切换影响。
    expect(snapshot.boxes.second).toBeDefined()
  })

  it('OpenSpec: 选中 WidgetSwitcher 后代时临时预览该分支 / 选中非活动子项', () => {
    const value = switcherDocument(0)
    const { dispatch } = renderStage(value, { selectedIds: ['leaf'] })

    expect(screen.getByTestId('stage-entity-leaf')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-entity-first')).not.toBeInTheDocument()
    // 预览是表示层派生，不得产生任何文档事务。
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: 选中 WidgetSwitcher 后代时临时预览该分支 / 取消选择后回到活动索引', () => {
    const value = switcherDocument(0)
    renderStage(value, { selectedIds: [] })

    expect(screen.getByTestId('stage-entity-first')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-entity-leaf')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / 直接绘制 Preset / 点击或拖拽绘制文字', () => {
    const textSeed: ComposeEntityPreset['createComponents'] extends () => infer Components
      ? { readonly name: string; readonly components: Components }
      : never = {
      name: 'Text',
      components: {
        Transform: { rotation: 0 },
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 0, y: 0 },
          width: { mode: 'hug', value: 28, min: 1, max: null },
          height: { mode: 'hug', value: 16, min: 1, max: null },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
        Renderer: { type: 'text', props: { text: 'Text' } },
      },
    }
    const clicked = entityFromDrawingSeed(
      textSeed,
      'clicked-text',
      { x: 40, y: 50, width: 0, height: 0 },
      undefined,
      { preserveHugSizing: true },
    )
    const dragged = entityFromDrawingSeed(
      textSeed,
      'dragged-text',
      { x: 40, y: 50, width: 160, height: 48 },
    )

    expect(getComposeLayoutItem(clicked)).toMatchObject({
      offset: { x: 40, y: 50 },
      width: { mode: 'hug', value: 28 },
      height: { mode: 'hug', value: 16 },
    })
    expect(getComposeLayoutItem(dragged)).toMatchObject({
      offset: { x: 40, y: 50 },
      width: { mode: 'fixed', value: 160 },
      height: { mode: 'fixed', value: 48 },
    })

    // 点击创建的文字直接进入编辑，光标应当落在空内容上，而不是先删掉占位文案。
    const emptied = entityFromDrawingSeed(
      textSeed,
      'clicked-empty-text',
      { x: 40, y: 50, width: 0, height: 0 },
      undefined,
      { preserveHugSizing: true, emptyTextPropName: 'text' },
    )
    expect(getComposeRenderer(emptied)?.props).toMatchObject({ text: '' })
    // 拖拽创建固定尺寸文字保持原样，不受影响。
    expect(getComposeRenderer(dragged)?.props).toMatchObject({ text: 'Text' })
  })

  it('OpenSpec: 受控工具模式与专属选区反馈 / 仅移动工具显示轴向 gizmo，网格可独立隐藏', () => {
    const value = document()
    renderStage(value, { gridVisible: false, selectedIds: ['a'], tool: 'move' })

    expect(screen.getByTestId('stage-move-gizmo')).toBeInTheDocument()
    expect(screen.getByTestId('stage-move-axis-x')).toBeInTheDocument()
    expect(screen.getByTestId('stage-move-axis-y')).toBeInTheDocument()
    expect(screen.getByTestId('stage-grid')).toHaveStyle({ display: 'none' })
  })

  it('OpenSpec: 受控工具模式与专属选区反馈 / 选择工具保留 8 控点且不显示移动 gizmo', () => {
    renderStage(document(), { selectedIds: ['a'], tool: 'select' })

    expect(screen.queryByTestId('stage-move-gizmo')).not.toBeInTheDocument()
    // free：4 角 + 4 边可见控点，便于组合缩放。
    for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const) {
      expect(screen.getByTestId(`stage-resize-${handle}`)).toBeInTheDocument()
    }
  })

  it('OpenSpec: 线段端点选择 / Line 与 Arrow 单选仅显示首尾控制点而不显示矩形框', () => {
    renderStage(document([lineEntity()]), { selectedIds: ['line'], tool: 'select' })

    expect(screen.getByTestId('stage-entity-line')).toHaveClass('is-segment')
    expect(screen.getByTestId('stage-line-selection')).toBeInTheDocument()
    expect(screen.getByTestId('stage-line-selection-start')).toHaveAttribute('r', '10')
    expect(screen.getByTestId('stage-line-selection-end')).toHaveAttribute('r', '10')
    expect(screen.getByTestId('stage-line-selection-start')).toHaveStyle({ cursor: 'nwse-resize' })
    expect(screen.getByTestId('stage-line-selection-start-handle')).toHaveAttribute(
      'transform',
      expect.stringMatching(/^rotate\(26\.565/),
    )
    expect(screen.getByTestId('stage-line-selection-dimensions')).toHaveTextContent('× 0')
    expect(screen.queryByTestId('stage-selection-bounds')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-resize-nw')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stage-resize-ne')).not.toBeInTheDocument()
  })

  it.each(['start', 'end'] as const)(
    'OpenSpec: 线段端点选择 / %s 端点命中后拖动并提交一次事务',
    (endpoint) => {
      const { dispatch } = renderStage(
        document([lineEntity()]),
        { selectedIds: ['line'], tool: 'select' },
      )
      const handle = screen.getByTestId(`stage-line-selection-${endpoint}`)

      fireEvent.pointerDown(handle, {
        pointerId: 1,
        button: 0,
        buttons: 1,
        clientX: endpoint === 'start' ? 20 : 120,
        clientY: endpoint === 'start' ? 30 : 80,
      })
      fireEvent.pointerUp(window, {
        pointerId: 1,
        button: 0,
        buttons: 0,
        clientX: endpoint === 'start' ? 44 : 144,
        clientY: endpoint === 'start' ? 54 : 104,
      })

      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'transaction.batch',
        meta: expect.objectContaining({ mergeKey: 'stage:segment:line' }),
      }))
    },
  )

  it('OpenSpec: 绘制工具 / 空闲即为十字光标，并以实际形状预览替代框选虚线', () => {
    renderStage(document(), { selectedIds: ['a'], tool: 'draw-circle' })

    expect(screen.getByRole('application', { name: 'Stage' })).toHaveAttribute(
      'data-interaction-cursor',
      'crosshair',
    )
    expect(screen.queryByTestId('stage-selection-bounds')).not.toBeInTheDocument()

    const preview = render(
      <StageOverlay
        canvasGuides={[]}
        drawing={{
          tool: 'draw-arrow',
          bounds: { x: 16, y: 20, width: 80, height: 40 },
          start: { x: 16, y: 20 },
          end: { x: 96, y: 60 },
        }}
        dropIndicator={null}
        editableSelection={false}
        textEditing={false}
        handlePoints={null}
        label="Editing overlay"
        marqueeHitTest={null}
        marqueeScreen={null}
        paintHandles={[]}
        paintSample={null}
        resizeHandles={[]}
        rotatable={false}
        screenBounds={null}
        snapGuides={[]}
        tool="draw-arrow"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        visibleResizeHandles={[]}
        onInteraction={vi.fn()}
      />,
    )
    expect(screen.getByTestId('stage-drawing-preview')).toHaveAttribute('data-drawing-tool', 'draw-arrow')
    expect(preview.container.querySelector('.compose-stage__drawing-preview path')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-marquee')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / 画布拖拽落点反馈 / reparent 高亮容器且不改动手柄呈现', () => {
    const overlayProps = {
      canvasGuides: [],
      drawing: null,
      editableSelection: true,
      textEditing: false,
      handlePoints: null,
      label: 'Editing overlay',
      marqueeHitTest: null,
      marqueeScreen: null,
      paintHandles: [],
      paintSample: null,
      resizeHandles: [],
      rotatable: false,
      screenBounds: null,
      snapGuides: [],
      tool: 'select' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      visibleResizeHandles: [],
      onInteraction: vi.fn(),
    }
    const view = render(
      <StageOverlay
        {...overlayProps}
        dropIndicator={{
          kind: 'reparent',
          bounds: { x: 10, y: 20, width: 100, height: 50 },
        }}
      />,
    )
    const highlight = view.getByTestId('stage-drop-container')
    expect(highlight).toHaveAttribute('x', '10')
    expect(highlight).toHaveAttribute('width', '100')
    expect(view.queryByTestId('stage-drop-line')).not.toBeInTheDocument()

    view.rerender(
      <StageOverlay
        {...overlayProps}
        dropIndicator={{ kind: 'reorder', start: { x: 40, y: 0 }, end: { x: 40, y: 80 } }}
      />,
    )
    const line = view.getByTestId('stage-drop-line')
    expect(line).toHaveAttribute('x1', '40')
    expect(line).toHaveAttribute('y2', '80')
    expect(view.queryByTestId('stage-drop-container')).not.toBeInTheDocument()

    // 落点清除后两种反馈都消失。
    view.rerender(<StageOverlay {...overlayProps} dropIndicator={null} />)
    expect(view.queryByTestId('stage-drop-container')).not.toBeInTheDocument()
    expect(view.queryByTestId('stage-drop-line')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / Stage 页面 setup 值预览 / 响应式值刷新且方法为 no-op', async () => {
    let count!: ComposeState<number>
    const onAdd = vi.fn(() => { count.value += 1 })
    const scope = createComposePageScriptScope((ctx) => {
      count = ctx.state(0)
      return { count, onAdd }
    })
    const boundRegistry = createComposeEntityRegistry({
      renderers: [{
        type: 'test',
        label: '测试',
        renderer: ({ props }) => (
          <button
            type="button"
            onClick={typeof props.onClick === 'function'
              ? props.onClick as () => void
              : undefined}
          >
            {String(props.text)}
          </button>
        ),
        propContracts: [
          {
            name: 'text',
            kind: 'value',
            label: '文本',
            validate: (value) => typeof value === 'number' || 'number required',
          },
          { name: 'onClick', kind: 'method', label: '点击', role: 'event-handler' },
        ],
      }],
    })
    const target = entity('bound')
    const value = document([{
      ...target,
      components: {
        ...target.components,
        Bindings: {
          version: 1,
          rendererProps: {
            fields: {
              text: { scope: 'page', exportName: 'count' },
              onClick: { scope: 'page', exportName: 'onAdd' },
            },
          },
        },
      },
    }])
    renderStage(value, { registry: boundRegistry, scope })

    expect(screen.getByRole('button', { name: '0' })).toBeInTheDocument()
    count.value = 5
    await waitFor(() => { expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument() })
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(onAdd).not.toHaveBeenCalled()
    expect(count.value).toBe(5)
  })

  it('OpenSpec: hug-content-layout / Stage measurement attachment / 挂接并卸载同会话端口', () => {
    const value = document()
    const setMeasurementPort = vi.fn()
    const view = render(
      <ComposeStage
        dispatch={vi.fn()}
        document={value}
        layoutRuntime={{ setMeasurementPort }}
        layoutSnapshot={layoutSnapshot(value)}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        registry={registry}
        selectedIds={[]}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
      />,
    )

    expect(setMeasurementPort).toHaveBeenCalledWith(expect.objectContaining({
      measure: expect.any(Function),
    }))
    view.unmount()
    expect(setMeasurementPort).toHaveBeenLastCalledWith(undefined)
  })

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

  it('OpenSpec: Stage 滚动配置提示 / 显示不可交互的纵向提示', () => {
    const container = entity('container', {
      childIds: [],
      overflow: { horizontal: 'clip', vertical: 'scroll' },
    })
    const { runtime } = renderStage(document([container], ['container']))

    expect(screen.queryByTestId('stage-overflow-indicator-x')).not.toBeInTheDocument()
    const indicator = screen.getByTestId('stage-overflow-indicator-y')
    expect(indicator.parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(getComputedStyle(indicator.parentElement!)).toHaveProperty('pointer-events', 'none')
    fireEvent.wheel(screen.getByTestId('stage-container'), { deltaY: 120 })
    expect(runtime.document).toEqual(document([container], ['container']))
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
    // 可见手柄可含角与边；边缘 hit 区仅 n/e/s/w（角由手柄本身命中）。
    ['free', ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'], ['n', 'e', 's', 'w']],
    ['horizontal', ['e', 'w'], ['e', 'w']],
    ['vertical', ['n', 's'], ['n', 's']],
    ['preserve-aspect', ['ne', 'se', 'sw', 'nw'], []],
    ['none', [], []],
  ] as const)('OpenSpec: 受控工具模式与专属选区反馈 / %s 使用可见控点与边缘命中', (mode, visualHandles, edgeHandles) => {
    renderStage(document([entity('a', { resize: mode })]), { selectedIds: ['a'] })
    const all = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
    all.forEach((handle) => {
      const query = screen.queryByTestId(`stage-resize-${handle}`)
      if ((visualHandles as readonly string[]).includes(handle)) expect(query).toBeInTheDocument()
      else expect(query).not.toBeInTheDocument()
      const edge = screen.queryByTestId(`stage-resize-edge-${handle}`)
      if ((edgeHandles as readonly string[]).includes(handle)) expect(edge).toBeInTheDocument()
      else expect(edge).not.toBeInTheDocument()
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

  it('OpenSpec: stage / Stage 复制剪切粘贴 / 使用平台主修饰键', () => {
    const { runtime } = renderStage(document(), { selectedIds: ['a'] })
    const stage = screen.getByRole('application')
    fireEvent.keyDown(stage, { code: 'KeyC', key: 'c', ctrlKey: true })
    fireEvent.keyDown(stage, { code: 'KeyV', key: 'v', ctrlKey: true })
    expect(runtime.document.rootIds).toHaveLength(2)
    expect(runtime.document.rootIds[0]).toBe('a')
  })

  it('OpenSpec: stage / Stage 复制剪切粘贴 / 从画布菜单复制并粘贴', () => {
    const { runtime, selection } = renderStage(document(), { selectedIds: ['a'] })
    const stage = screen.getByRole('application')

    fireEvent.contextMenu(screen.getByTestId('stage-entity-a'), {
      clientX: 40,
      clientY: 50,
    })
    const copy = screen.getByRole('menuitem', { name: /^复制/ })
    const paste = screen.getByRole('menuitem', { name: /^粘贴/ })
    expect(copy).toHaveTextContent(/(?:⌘|Ctrl\+)C/)
    expect(paste).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(copy)

    fireEvent.contextMenu(stage, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByRole('menuitem', { name: /^粘贴/ }))
    const copyId = runtime.document.rootIds.find((id) => id !== 'a')
    expect(copyId).toBeDefined()
    expect(runtime.document.entities[copyId!]).toBeDefined()
    expect(selection).toHaveBeenLastCalledWith([copyId])
  })

  it('OpenSpec: stage / Stage 复制剪切粘贴 / 剪切后粘贴清空剪贴板', () => {
    const value = document([entity('a'), entity('b')], ['a', 'b'])
    const { runtime } = renderStage(value, { selectedIds: ['a'] })
    const stage = screen.getByRole('application')

    fireEvent.contextMenu(screen.getByTestId('stage-entity-a'), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: /^剪切/ }))
    fireEvent.contextMenu(stage, { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByRole('menuitem', { name: /^粘贴/ }))
    expect(runtime.document.rootIds).toEqual(['b', 'a'])

    const afterCut = runtime.document.rootIds
    fireEvent.contextMenu(stage, { clientX: 10, clientY: 10 })
    expect(screen.getByRole('menuitem', { name: /^粘贴/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(runtime.document.rootIds).toEqual(afterCut)
  })

  it('OpenSpec: stage / Stage 复制剪切粘贴 / 可编辑目标保留系统剪贴板', () => {
    const { runtime } = renderStage(document(), { selectedIds: ['a'] })
    const input = globalThis.document.createElement('input')
    screen.getByRole('application').append(input)
    fireEvent.keyDown(input, { code: 'KeyC', key: 'c', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('application'), {
      code: 'KeyV',
      key: 'v',
      ctrlKey: true,
    })
    expect(runtime.document.rootIds).toEqual(['a'])
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

  it('OpenSpec: stage / 创建组件菜单 / 把规范化选区交给宿主命名流程', () => {
    const onCreateComponentIntent = vi.fn()
    renderStage(document(), { selectedIds: ['a'], onCreateComponentIntent })
    fireEvent.contextMenu(screen.getByTestId('stage-entity-a'), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: '创建组件…' }))
    expect(onCreateComponentIntent).toHaveBeenCalledWith(['a'])
  })

  it('OpenSpec: stage / Stage 节点层级操作 / 从画布菜单调整前景节点', () => {
    const value = document([entity('a'), entity('b')], ['a', 'b'])
    const { runtime } = renderStage(value, { selectedIds: ['a'] })

    fireEvent.contextMenu(screen.getByTestId('stage-entity-a'), {
      clientX: 40,
      clientY: 50,
    })

    const layerOrder = screen.getByRole('menuitem', { name: /^层级/ })
    fireEvent.keyDown(layerOrder, { code: 'ArrowRight', key: 'ArrowRight' })
    const bringToFront = screen.getByRole('menuitem', { name: /置于顶层/ })
    const sendToBack = screen.getByRole('menuitem', { name: /置于底层/ })

    expect(bringToFront).toHaveTextContent(/(?:⌘|Ctrl\+)\]/)
    expect(bringToFront).not.toHaveAttribute('aria-disabled', 'true')
    expect(sendToBack).toHaveAttribute('aria-disabled', 'true')
    expect(sendToBack).toHaveAttribute('title', '选中对象已位于目标层级或不可移动')
    fireEvent.click(bringToFront)
    expect(runtime.document.rootIds).toEqual(['b', 'a'])
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

  it('平移视口只更新场景变换，不重渲 Entity 渲染器', () => {
    const renderCounts = new Map<string, number>()
    const countingRegistry = createComposeEntityRegistry({
      renderers: [{
        type: 'test',
        label: '测试',
        renderer: ({ props }) => {
          const text = String(props.text)
          renderCounts.set(text, (renderCounts.get(text) ?? 0) + 1)
          return <span>{text}</span>
        },
      }],
      presets: [preset],
    })
    const value = document([entity('a'), entity('b')])
    const snapshot = layoutSnapshot(value)
    const stage = (viewport: { x: number; y: number; zoom: number }) => (
      <ComposeStage
        dispatch={vi.fn()}
        document={value}
        layoutSnapshot={snapshot}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        registry={countingRegistry}
        selectedIds={[]}
        tool="select"
        viewport={viewport}
      />
    )
    const view = render(stage({ x: 0, y: 0, zoom: 1 }))
    const beforePan = new Map(renderCounts)
    expect(beforePan.size).toBe(2)

    view.rerender(stage({ x: 120, y: 80, zoom: 1 }))

    expect(screen.getByTestId('stage-scene-layer')).toHaveStyle({
      transform: 'translate(120px, 80px) scale(1)',
    })
    expect(Object.fromEntries(renderCounts)).toEqual(Object.fromEntries(beforePan))
  })

  it('平移视口不再遍历全部 Entity 计算内容边界', () => {
    // 用 Proxy 观察真实文档的整表枚举次数：内容边界只在引擎尚未给出滚动范围时才需要，
    // 平移帧不应为此重新遍历全场景。
    let enumerations = 0
    const value = document([entity('a'), entity('b')])
    const probed: ComposeDocument = {
      ...value,
      entities: new Proxy(value.entities, {
        ownKeys(target) {
          enumerations += 1
          return Reflect.ownKeys(target)
        },
      }),
    }
    const snapshot = layoutSnapshot(value)
    const stage = (viewport: { x: number; y: number; zoom: number }) => (
      <ComposeStage
        dispatch={vi.fn()}
        document={probed}
        layoutSnapshot={snapshot}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        registry={registry}
        selectedIds={[]}
        tool="select"
        viewport={viewport}
      />
    )
    const view = render(stage({ x: 0, y: 0, zoom: 1 }))
    const beforePan = enumerations

    view.rerender(stage({ x: 120, y: 80, zoom: 1 }))

    expect(enumerations).toBe(beforePan)
  })
})

describe('ComposeStage 画布内原地文字编辑', () => {
  afterEach(cleanup)

  const editableRegistry = createComposeEntityRegistry({
    renderers: [{
      type: 'test',
      label: '测试',
      editableTextPropName: 'text',
      propContracts: [{ name: 'text', kind: 'value', label: '文本', validate: () => true }],
      renderer: ({ props, textEditing }) => (
        textEditing
          ? (
              <span
                contentEditable
                data-testid="editable-text"
                suppressContentEditableWarning
                onInput={(event) => textEditing.onChange(event.currentTarget.textContent ?? '')}
              >
                {String(props.text)}
              </span>
            )
          : <span>{String(props.text)}</span>
      ),
    }, {
      type: 'shape',
      label: '线条',
      renderer: () => null,
    }],
    presets: [preset],
  })

  function enterEditing(selectedIds: readonly string[] = ['a']) {
    const rendered = renderStage(document(), { registry: editableRegistry, selectedIds })
    fireEvent.pointerDown(screen.getByTestId('stage-entity-a'), {
      pointerId: 1,
      button: 0,
      detail: 2,
      clientX: 30,
      clientY: 40,
    })
    return rendered
  }

  it('OpenSpec: 按约束显示变换手柄 / 编辑态不显示变换手柄', () => {
    enterEditing()

    expect(screen.getByTestId('stage-text-editing-bounds')).toBeInTheDocument()
    for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
      expect(screen.queryByTestId(`stage-resize-${handle}`)).not.toBeInTheDocument()
      expect(screen.queryByTestId(`stage-resize-edge-${handle}`)).not.toBeInTheDocument()
    }
    expect(screen.queryByTestId('stage-rotation-handle')).not.toBeInTheDocument()
  })

  it('OpenSpec: 画布内原地文字编辑 / 双击改写后提交为一条事务', () => {
    const { dispatch } = enterEditing()
    const editable = screen.getByTestId('editable-text')
    editable.textContent = 'Hello world'
    fireEvent.input(editable)
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' })

    const commands = dispatch.mock.calls.map(([command]) => command)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.setRendererProps,
      payload: { entityId: 'a', props: { text: 'Hello world' } },
    })
  })

  it('OpenSpec: 画布内原地文字编辑 / 焦点在编辑目标上时 Esc 仍能提交退出', () => {
    const { dispatch } = enterEditing()
    const editable = screen.getByTestId('editable-text')
    editable.textContent = 'Hello world'
    fireEvent.input(editable)

    // 编辑目标本身是 contentEditable，键盘事件从它冒泡上来；Stage 不能把它当成
    // 「宿主输入框」而跳过处理，否则会话再也退不出去。
    fireEvent.keyDown(editable, { key: 'Escape', bubbles: true })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('editable-text')).not.toBeInTheDocument()
  })

  it('OpenSpec: 画布内原地文字编辑 / 空内容退出时删除文字', () => {
    const { dispatch } = enterEditing()
    const editable = screen.getByTestId('editable-text')
    editable.textContent = ''
    fireEvent.input(editable)
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' })

    const commands = dispatch.mock.calls.map(([command]) => command)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.deleteEntity,
      payload: { entityIds: ['a'] },
    })
  })

  it('OpenSpec: 画布内原地文字编辑 / 内容本就为空时退出即删除实体', () => {
    const emptyDocument = document([{
      ...entity('a'),
      components: {
        ...entity('a').components,
        Renderer: { type: 'test', props: { text: '' } },
      },
    }])
    const runtime = createTransactionRuntime({ document: emptyDocument })
    const dispatchSpy = vi.fn()
    const dispatch: ComposeStageDispatch = (command) => {
      dispatchSpy(command)
      return runtime.dispatch(command)
    }
    render(
      <ComposeStage
        dispatch={dispatch}
        document={emptyDocument}
        layoutSnapshot={layoutSnapshot(emptyDocument)}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        registry={editableRegistry}
        selectedIds={['a']}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
      />,
    )
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
    expect(screen.getByTestId('editable-text')).toBeInTheDocument()

    // 一个字都没敲就退出：内容为空的规则优先于「未变化不产生事务」，
    // 否则点击创建后立刻按 Esc 会在文档里留下一个看不见也选不中的空文字。
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' })
    const commands = dispatchSpy.mock.calls.map(([command]) => command)
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: BUILTIN_COMMAND_TYPES.deleteEntity,
      payload: { entityIds: ['a'] },
    })
  })

  it('OpenSpec: 画布内原地文字编辑 / 内容未变化不产生事务', () => {
    const { dispatch } = enterEditing()
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: 无 DOM 文字编辑会话 / 单选可编辑 Entity 时 Enter 进入编辑', () => {
    renderStage(document(), { registry: editableRegistry, selectedIds: ['a'] })
    expect(screen.queryByTestId('editable-text')).not.toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
    expect(screen.getByTestId('editable-text')).toBeInTheDocument()
  })
})

describe('ComposeStage 框选判定模式', () => {
  afterEach(cleanup)

  /** 夹具 Entity 占世界 20..120 x 30..80，zoom 为 1 时与屏幕坐标一致。 */
  function dragMarquee(
    from: { readonly x: number; readonly y: number },
    to: { readonly x: number; readonly y: number },
    target: HTMLElement,
  ) {
    fireEvent.pointerDown(target, {
      pointerId: 1,
      button: 0,
      clientX: from.x,
      clientY: from.y,
    })
    // buttons 必须非 0，否则 Stage 会把这一下当作按键已松开而直接结束手势。
    fireEvent.pointerMove(target, { pointerId: 1, buttons: 1, clientX: to.x, clientY: to.y })
  }

  function releaseMarquee(
    to: { readonly x: number; readonly y: number },
    target: HTMLElement,
  ) {
    fireEvent.pointerUp(target, { pointerId: 1, clientX: to.x, clientY: to.y })
  }

  /** pointermove 经过 rAF 合帧，marquee 的 Overlay 属性要等下一帧才可读。 */
  async function marqueeHitTest() {
    return await waitFor(
      () => screen.getByTestId('stage-marquee').getAttribute('data-marquee-mode'),
    )
  }

  it('OpenSpec: 选择与框选 / 包含模式排除只被压住一半的节点', () => {
    const surface = () => screen.getByTestId('stage-surface')
    const contained = renderStage(document(), { marqueeMode: 'contain' })
    dragMarquee({ x: 0, y: 0 }, { x: 60, y: 100 }, surface())
    releaseMarquee({ x: 60, y: 100 }, surface())
    expect(contained.selection).toHaveBeenLastCalledWith([])

    cleanup()
    const intersected = renderStage(document(), { marqueeMode: 'intersect' })
    dragMarquee({ x: 0, y: 0 }, { x: 60, y: 100 }, surface())
    releaseMarquee({ x: 60, y: 100 }, surface())
    expect(intersected.selection).toHaveBeenLastCalledWith(['a'])
  })

  it('OpenSpec: 选择与框选 / 包含模式选中被完整框住的节点', () => {
    const surface = () => screen.getByTestId('stage-surface')
    const { selection } = renderStage(document(), { marqueeMode: 'contain' })
    dragMarquee({ x: 0, y: 0 }, { x: 200, y: 200 }, surface())
    releaseMarquee({ x: 200, y: 200 }, surface())
    expect(selection).toHaveBeenLastCalledWith(['a'])
  })

  it('OpenSpec: 选择与框选 / 使用框选工具从节点上起框', () => {
    const { dispatch, selection } = renderStage(document(), { tool: 'marquee' })
    const entity = screen.getByTestId('stage-entity-a')
    dragMarquee({ x: 30, y: 40 }, { x: 200, y: 200 }, entity)
    releaseMarquee({ x: 200, y: 200 }, entity)
    // 起框而非移动：不得产生任何事务。
    expect(dispatch).not.toHaveBeenCalled()
    expect(selection).toHaveBeenLastCalledWith(['a'])
  })

  it('OpenSpec: 选择与框选 / Overlay 区分判定模式', async () => {
    const surface = () => screen.getByTestId('stage-surface')
    for (const [marqueeMode, expected] of [
      ['intersect', 'intersect'],
      ['contain', 'contain'],
    ] as const) {
      renderStage(document(), { marqueeMode })
      dragMarquee({ x: 0, y: 0 }, { x: 60, y: 100 }, surface())
      expect(await marqueeHitTest()).toBe(expected)
      releaseMarquee({ x: 60, y: 100 }, surface())
      cleanup()
    }

    // 方向决定模式下同一个框按拖拽方向切换判定。
    renderStage(document(), { marqueeMode: 'directional' })
    dragMarquee({ x: 0, y: 0 }, { x: 60, y: 100 }, surface())
    expect(await marqueeHitTest()).toBe('contain')
    releaseMarquee({ x: 60, y: 100 }, surface())
    cleanup()

    renderStage(document(), { marqueeMode: 'directional' })
    dragMarquee({ x: 60, y: 100 }, { x: 0, y: 0 }, surface())
    expect(await marqueeHitTest()).toBe('intersect')
    releaseMarquee({ x: 0, y: 0 }, surface())
  })
})
