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
  createComposeFrameEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeImmediateCommand } from '@compose-ui/commands'
import { createComposePageScriptScope, type ComposeState } from '@compose-ui/script-runtime'
import { ComposeStage } from './compose-stage'
import { entityFromDrawingSeed } from './entity-creation'
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

const ROOT_FRAME_ID = 'frame-root'

/** v7 的顶层 Entity 是根 Frame 的子级；断言"根顺序"就是断言它的 childIds。 */
function rootChildIds(value: ComposeDocument): readonly string[] {
  const hierarchy = value.entities[ROOT_FRAME_ID]?.components.Hierarchy as
    { childIds?: readonly string[] } | undefined
  return hierarchy?.childIds ?? []
}

function document(
  entities: readonly ComposeEntity[] = [entity('a')],
  rootIds: readonly string[] = entities.map(({ id }) => id),
): ComposeDocument {
  // v7 的根层级只接受 Frame；夹具把给定的顶层 Entity 包进一块 1280×720 的画板。
  const frame = createComposeFrameEntity({
    id: ROOT_FRAME_ID,
    childIds: rootIds,
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
    rootIds: [ROOT_FRAME_ID],
    entities: {
      ...Object.fromEntries(entities.map((item) => [item.id, item])),
      [ROOT_FRAME_ID]: frame,
    },
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

/** 绘图模式创建的是曲线，因此测试 Registry 必须能给出 `curve` seed。 */
const curvePreset: ComposeEntityPreset = {
  id: 'curve',
  label: '线',
  createComponents: () => ({
    ...preset.createComponents(),
    Renderer: { type: 'curve', props: {} },
    Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
  }),
}

const registry = createComposeEntityRegistry({
  renderers: [{
    type: 'test',
    label: '测试',
    renderer: ({ props }) => <span>{String(props.text)}</span>,
  }, {
    type: 'curve',
    label: '曲线',
    renderer: () => null,
  }],
  presets: [preset, curvePreset],
})

function curveEntity(id = 'curve-a'): ComposeEntity {
  const base = entity(id)
  return {
    ...base,
    components: {
      ...base.components,
      Renderer: { type: 'curve', props: { stroke: '#d8e2f1', strokeWidth: 1 } },
      Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
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
    viewport?: { readonly x: number; readonly y: number; readonly zoom: number }
    commands?: import('../types').ComposeStageProps['commands']
    showCrosshair?: boolean
  } = {},
) {
  const runtime = createTransactionRuntime({ document: value })
  const dispatchSpy = vi.fn()
  const selectionSpy = vi.fn()
  const dispatch: ComposeStageDispatch = (command) => {
    dispatchSpy(command)
    return runtime.dispatch(command)
  }
  const view = render(
    <ComposeStage
      commands={options.commands}
      showCrosshair={options.showCrosshair}
      document={value}
      layoutSnapshot={options.snapshot ?? layoutSnapshot(value)}
      onSelectedIdsChange={selectionSpy}
      onCreateComponentIntent={options.onCreateComponentIntent}
      onViewportChange={vi.fn()}
      policy={{
        gridVisible: options.gridVisible,
        marqueeMode: options.marqueeMode,
      }}
      scriptScope={options.scope}
      services={{ dispatch, registry: options.registry ?? registry }}
      paintEditing={options.paintEditing}
      selectedIds={options.selectedIds ?? []}
      tool={options.tool ?? 'select'}
      viewport={options.viewport ?? { x: 0, y: 0, zoom: 1 }}
    />,
  )
  return { container: view.container, dispatch: dispatchSpy, runtime, selection: selectionSpy }
}

/**
 * 渲染一个可以改选择集的 Stage。
 *
 * @remarks
 * 绘图命令等待选择对象时读的是宿主的选择集，因此必须能在命令进行中把它换掉——这正是
 * 「选择集归宿主、会话只是镜像」这条设计要钉住的行为。
 */
function renderStageWithRerender(value: ComposeDocument) {
  const runtime = createTransactionRuntime({ document: value })
  const dispatch: ComposeStageDispatch = (command) => runtime.dispatch(command)
  const view = (selectedIds: readonly string[]) => (
    <ComposeStage
      document={value}
      layoutSnapshot={layoutSnapshot(value)}
      onSelectedIdsChange={vi.fn()}
      onViewportChange={vi.fn()}
      services={{ dispatch, registry }}
      selectedIds={selectedIds}
      tool="select"
      viewport={{ x: 0, y: 0, zoom: 1 }}
    />
  )
  const result = render(view([]))
  return { runtime, rerender: (ids: readonly string[]) => { result.rerender(view(ids)) } }
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

  it('OpenSpec: 受控工具模式与专属选区反馈 / 选择工具保留四角控点且不显示移动 gizmo', () => {
    renderStage(document(), { selectedIds: ['a'], tool: 'select' })

    // free：仅四角可见；边方向靠透明 hit，不渲染中点方块。
    for (const handle of ['ne', 'se', 'sw', 'nw'] as const) {
      expect(screen.getByTestId(`stage-resize-${handle}`)).toBeInTheDocument()
    }
    for (const handle of ['n', 'e', 's', 'w'] as const) {
      expect(screen.queryByTestId(`stage-resize-${handle}`)).not.toBeInTheDocument()
      expect(screen.getByTestId(`stage-resize-edge-${handle}`)).toBeInTheDocument()
    }
  })

  it('OpenSpec: 曲线几何编辑会话 / 双击曲线显形夹点并让位盒手柄', () => {
    renderStage(document([curveEntity()]), { selectedIds: ['curve-a'], tool: 'select' })

    fireEvent.pointerDown(screen.getByTestId('stage-entity-curve-a'), {
      pointerId: 1,
      button: 0,
      detail: 2,
      clientX: 30,
      clientY: 40,
    })

    expect(screen.getByTestId('stage-editable-path')).toBeInTheDocument()
    expect(screen.getByTestId('stage-path-vertex-hit-start')).toBeInTheDocument()
    expect(screen.getByTestId('stage-path-vertex-hit-end')).toBeInTheDocument()
    // 直线的第三个夹点在中点上：拖它平移整条线。
    expect(screen.getByTestId('stage-path-vertex-hit-move')).toBeInTheDocument()
    // 盒的角手柄与角顶点几乎压在同一个像素上，两个含义叠在一起谁也点不准。
    expect(screen.queryByTestId('stage-resize-se')).not.toBeInTheDocument()
    // 选区盒一并让位：盒不是曲线的轮廓，而拖夹点时它还停在拖动之前的位置。
    expect(screen.queryByTestId('stage-selection-bounds')).not.toBeInTheDocument()
  })

  it('OpenSpec: 曲线几何编辑会话 / 拖中点夹点平移整条线', () => {
    const { dispatch } = renderStage(document([curveEntity()]), {
      selectedIds: ['curve-a'],
      tool: 'select',
    })
    fireEvent.pointerDown(screen.getByTestId('stage-entity-curve-a'), {
      pointerId: 1, button: 0, detail: 2, clientX: 30, clientY: 40,
    })

    const surface = screen.getByTestId('stage-surface')
    fireEvent.pointerDown(screen.getByTestId('stage-path-vertex-hit-move'), {
      pointerId: 2, button: 0, clientX: 60, clientY: 40,
    })
    fireEvent.pointerMove(surface, { pointerId: 2, buttons: 1, clientX: 100, clientY: 80 })
    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 100, clientY: 80 })

    const written = dispatch.mock.calls
      .map(([command]) => command)
      .filter((command) => command.type === BUILTIN_COMMAND_TYPES.setCurve)
    expect(written).toHaveLength(1)
    // 中点落在网格吸附后的 (104,80)，两端因此各加 (34,25)：起点 (20,30)→(54,55)、
    // 终点 (120,80)→(154,105)。差向量仍是 (100,50)——长度与方向一个都没变，这正是它与
    // 端点夹点的区别。
    expect(written[0]!.payload).toMatchObject({
      entityId: 'curve-a',
      curve: { kind: 'line', start: { x: 54, y: 55 }, end: { x: 154, y: 105 } },
    })
  })

  it('OpenSpec: 曲线几何编辑会话 / 拖夹点派发一条 entity.curve.set 并按 parent 局部坐标写入', () => {
    const { dispatch } = renderStage(document([curveEntity()]), {
      selectedIds: ['curve-a'],
      tool: 'select',
    })
    fireEvent.pointerDown(screen.getByTestId('stage-entity-curve-a'), {
      pointerId: 1, button: 0, detail: 2, clientX: 30, clientY: 40,
    })

    const surface = screen.getByTestId('stage-surface')
    fireEvent.pointerDown(screen.getByTestId('stage-path-vertex-hit-end'), {
      pointerId: 2, button: 0, clientX: 100, clientY: 50,
    })
    fireEvent.pointerMove(surface, { pointerId: 2, buttons: 1, clientX: 140, clientY: 90 })
    // 移动阶段只更新预览：文档要等松手才动。
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: BUILTIN_COMMAND_TYPES.setCurve }),
    )

    fireEvent.pointerUp(surface, { pointerId: 2, clientX: 140, clientY: 90 })
    const written = dispatch.mock.calls
      .map(([command]) => command)
      .filter((command) => command.type === BUILTIN_COMMAND_TYPES.setCurve)
    expect(written).toHaveLength(1)
    // 载荷是 parent 局部坐标（盒局部加 `LayoutItem.offset`），起点因此是 (20,30) 而不是原点。
    // 终点落在 (144,88) 而不是指针的 (140,90)：夹点拖动与绘图命令走同一条解算，网格吸附
    // 因此照常生效——这正是「不要第二份落点解算」要钉住的行为。
    expect(written[0]!.payload).toMatchObject({
      entityId: 'curve-a',
      curve: { kind: 'line', start: { x: 20, y: 30 }, end: { x: 144, y: 88 } },
    })
  })

  it('OpenSpec: 曲线几何编辑会话 / 退出后恢复盒手柄', () => {
    renderStage(document([curveEntity()]), { selectedIds: ['curve-a'], tool: 'select' })
    fireEvent.pointerDown(screen.getByTestId('stage-entity-curve-a'), {
      pointerId: 1, button: 0, detail: 2, clientX: 30, clientY: 40,
    })
    expect(screen.getByTestId('stage-editable-path')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('application', { name: 'Stage' }), { key: 'Escape' })

    expect(screen.queryByTestId('stage-editable-path')).not.toBeInTheDocument()
    expect(screen.getByTestId('stage-resize-se')).toBeInTheDocument()
    expect(screen.getByTestId('stage-selection-bounds')).toBeInTheDocument()
  })

  it('OpenSpec: 画布可编辑路径覆盖层 / 宿主传入路径时不进入几何编辑', () => {
    const value = document([curveEntity()])
    render(
      <ComposeStage
        document={value}
        editablePath={{
          entityId: 'curve-a',
          polyline: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          dots: [],
          vertices: [
            { id: 'k0', point: { x: 0, y: 0 }, inTangent: null, outTangent: null, mode: 'corner' },
          ],
        }}
        layoutSnapshot={layoutSnapshot(value)}
        selectedIds={['curve-a']}
        services={{ dispatch: vi.fn() as never, registry }}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    )
    fireEvent.pointerDown(screen.getByTestId('stage-entity-curve-a'), {
      pointerId: 1, button: 0, detail: 2, clientX: 30, clientY: 40,
    })

    // 覆盖层至多渲染一条路径：宿主那条还在，几何编辑的夹点没有出现。
    expect(screen.getByTestId('stage-path-vertex-hit-k0')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-path-vertex-hit-start')).not.toBeInTheDocument()
  })

  it('OpenSpec: 物料统一 / 曲线单选走通用矩形选区与盒手柄', () => {
    renderStage(document([curveEntity()]), { selectedIds: ['curve-a'], tool: 'select' })

    // 线状节点仍不以包围盒拦截指针，但选区回到通用那一套：两点直线的端点就在盒的对角，
    // 拖盒角手柄与拖端点落点相同，因此不再有第二套端点 UI。
    expect(screen.getByTestId('stage-entity-curve-a')).toHaveClass('is-segment')
    expect(screen.getByTestId('stage-selection-bounds')).toBeInTheDocument()
    expect(screen.getByTestId('stage-resize-se')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-line-selection')).not.toBeInTheDocument()
  })

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
        geometryEditing={false}
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
      geometryEditing: false,
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
        document={value}
        layoutSnapshot={layoutSnapshot(value)}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        services={{
          dispatch: vi.fn(),
          layoutRuntime: { setMeasurementPort },
          registry,
        }}
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

  it('OpenSpec: stage / Stage Frame 背景 Paint / 编辑渐变 Frame 背景', () => {
    const value = document()
    const frame = value.entities[ROOT_FRAME_ID]!
    renderStage({
      ...value,
      entities: {
        ...value.entities,
        [ROOT_FRAME_ID]: {
          ...frame,
          components: {
            ...frame.components,
            Appearance: {
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
          },
        },
      },
    })

    // Frame 是普通 Entity，背景由场景层按 Appearance 渲染，不再有独立的输出 Paint 层。
    expect(screen.getByTestId(`stage-frame-boundary-${ROOT_FRAME_ID}`)).toBeInTheDocument()
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
    // free 仅四角可见；边缘 hit 区仅 n/e/s/w（角由手柄本身命中）。
    ['free', ['ne', 'se', 'sw', 'nw'], ['n', 'e', 's', 'w']],
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

  it('OpenSpec: stage-engine / Auto Layout 容器内原地重排 / Flow nudge 不脱流零事务', () => {
    const child = flowEntity('a', true)
    const parent = autoLayoutContainer('parent', ['a'])
    const value = document([parent, child], ['parent'])
    const snapshot: ComposeLayoutSnapshot = {
      revision: 2,
      boxes: {
        [ROOT_FRAME_ID]: { x: 0, y: 0, width: 1280, height: 720, positioning: 'absolute' as const },
        parent: { x: 20, y: 30, width: 400, height: 200, positioning: 'absolute' },
        a: { x: 12, y: 16, width: 260, height: 50, positioning: 'flow' },
      },
      diagnostics: [],
    }
    // Flow 子级的位置由布局决定，方向键平移无可见效果；不再隐式转 Absolute。
    const { dispatch, runtime } = renderStage(value, { selectedIds: ['a'], snapshot })
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
    expect(dispatch).not.toHaveBeenCalled()
    expect(getComposeLayoutItem(runtime.document.entities.a!)).toMatchObject({
      positioning: 'flow',
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
    expect(rootChildIds(runtime.document)).toHaveLength(2)
    expect(rootChildIds(runtime.document)[0]).toBe('a')
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
    const copyId = rootChildIds(runtime.document).find((id) => id !== 'a')
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
    expect(rootChildIds(runtime.document)).toEqual(['b', 'a'])

    const afterCut = rootChildIds(runtime.document)
    fireEvent.contextMenu(stage, { clientX: 10, clientY: 10 })
    expect(screen.getByRole('menuitem', { name: /^粘贴/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(rootChildIds(runtime.document)).toEqual(afterCut)
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
    expect(rootChildIds(runtime.document)).toEqual(['a'])
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
    expect(rootChildIds(runtime.document)).toEqual(['b', 'a'])
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
        document={value}
        layoutSnapshot={snapshot}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        services={{ dispatch: vi.fn(), registry: countingRegistry }}
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
        document={probed}
        layoutSnapshot={snapshot}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        services={{ dispatch: vi.fn(), registry }}
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
        document={emptyDocument}
        layoutSnapshot={layoutSnapshot(emptyDocument)}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
        services={{ dispatch, registry: editableRegistry }}
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

  it('OpenSpec: 选择与框选 / select 从空白处起框', () => {
    // 独立的框选工具已删除：`select` 在空白处拖拽本来就是框选，两者完全重复，
    // 而多一个工具位意味着用户要先想「我在用哪个」。
    const { dispatch, selection } = renderStage(document(), { tool: 'select' })
    const surface = screen.getByTestId('stage-surface')
    dragMarquee({ x: 30, y: 40 }, { x: 200, y: 200 }, surface)
    releaseMarquee({ x: 200, y: 200 }, surface)
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

describe('OpenSpec: stage / 画布可编辑路径覆盖层与手势上报', () => {
  afterEach(cleanup)

  const overlayBase = {
    canvasGuides: [],
    drawing: null,
    dropIndicator: null,
    editableSelection: false,
    textEditing: false,
    geometryEditing: false,
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
  const editablePath = {
    entityId: 'a',
    polyline: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 40 }],
    // 等时采样点：段两端密、中间疏（缓入缓出），由宿主算好后 Overlay 原样呈现。
    dots: [{ x: 0, y: 0 }, { x: 6, y: 2 }, { x: 94, y: 38 }, { x: 100, y: 40 }],
    vertices: [
      {
        id: 'k0',
        point: { x: 0, y: 0 },
        inTangent: null,
        outTangent: { x: 30, y: 10 },
        mode: 'smooth' as const,
      },
      {
        id: 'k1',
        point: { x: 100, y: 40 },
        inTangent: { x: 70, y: 30 },
        outTangent: null,
        mode: 'corner' as const,
      },
    ],
  }

  it('OpenSpec: stage / 画布可编辑路径覆盖层 / 显示轨迹与速度', () => {
    render(<StageOverlay {...overlayBase} editablePath={editablePath} />)
    expect(screen.getByTestId('stage-editable-path-line'))
      .toHaveAttribute('points', '0,0 50,20 100,40')
    expect(screen.getAllByTestId('stage-editable-path-dot')).toHaveLength(4)
    // 顶点菱形与时间线关键帧同形：旋转 45° 的方块。
    expect(screen.getByTestId('stage-path-vertex-k0'))
      .toHaveAttribute('transform', 'rotate(45 0 0)')
  })

  it('OpenSpec: stage / 画布可编辑路径覆盖层 / 切线手柄的显示条件', () => {
    const view = render(<StageOverlay {...overlayBase} editablePath={editablePath} />)
    // 无活动顶点：只有 smooth 顶点 k0 显示切线手柄。
    expect(screen.getByTestId('stage-path-tangent-k0-out')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-path-tangent-k1-in')).not.toBeInTheDocument()
    // corner 顶点 k1 被激活后也显示切线手柄。
    view.rerender(
      <StageOverlay {...overlayBase} activePathVertexId="k1" editablePath={editablePath} />,
    )
    expect(screen.getByTestId('stage-path-tangent-k1-in')).toBeInTheDocument()
  })

  it('OpenSpec: stage / 画布可编辑路径覆盖层 / 未传入路径时不变', () => {
    render(<StageOverlay {...overlayBase} />)
    expect(screen.queryByTestId('stage-editable-path')).not.toBeInTheDocument()
  })

  it('OpenSpec: stage / 画布路径编辑手势上报 / 顶点按下产生 path-handle 命中', () => {
    const onInteraction = vi.fn()
    render(
      <StageOverlay
        {...overlayBase}
        editablePath={editablePath}
        onInteraction={onInteraction}
      />,
    )
    fireEvent.pointerDown(screen.getByTestId('stage-path-vertex-hit-k0'), {
      pointerId: 1,
      button: 0,
    })
    expect(onInteraction).toHaveBeenCalledWith(
      { kind: 'path-handle', handle: 'vertex', vertexId: 'k0' },
      expect.anything(),
    )
  })

  it('OpenSpec: stage / 画布路径编辑手势上报 / 双击顶点上报切换', () => {
    // 双击判定走引擎 clickCount（DOM dblclick 在指针捕获下无法可靠合成）。
    const value = document()
    const onToggle = vi.fn()
    render(
      <ComposeStage
        document={value}
        editablePath={editablePath}
        layoutSnapshot={layoutSnapshot(value)}
        selectedIds={['a']}
        services={{ dispatch: vi.fn() as never, registry }}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onEditablePathVertexToggle={onToggle}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    )
    fireEvent.pointerDown(screen.getByTestId('stage-path-vertex-hit-k0'), {
      pointerId: 1,
      button: 0,
      detail: 2,
    })
    expect(onToggle).toHaveBeenCalledWith('k0')
  })

  it('OpenSpec: stage / 画布路径编辑手势上报 / 拖动顶点上报世界坐标', () => {
    const value = document()
    const changes: import('../types').ComposeStageEditablePathChange[] = []
    const dispatchSpy = vi.fn()
    render(
      <ComposeStage
        document={value}
        editablePath={{ ...editablePath, entityId: 'a' }}
        layoutSnapshot={layoutSnapshot(value)}
        selectedIds={['a']}
        services={{
          dispatch: (command) => {
            dispatchSpy(command)
            return { status: 'noop', command } as never
          },
          registry,
        }}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onEditablePathChange={(change) => changes.push(change)}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={vi.fn()}
      />,
    )
    const hit = screen.getByTestId('stage-path-vertex-hit-k0')
    fireEvent.pointerDown(hit, { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, buttons: 1, clientX: 40, clientY: 25, shiftKey: true })
    fireEvent.pointerUp(window, { pointerId: 1, button: 0, buttons: 0, clientX: 40, clientY: 25 })

    // 阶段序列：一次开始、至少一次移动、一次结束（同点位移会被指针会话归并）。
    expect(changes[0]!.phase).toBe('start')
    expect(changes[changes.length - 1]!.phase).toBe('end')
    expect(changes.filter((change) => change.phase === 'move').length).toBeGreaterThanOrEqual(1)
    expect(changes[0]).toMatchObject({ vertexId: 'k0', handle: 'vertex' })
    // 移动阶段携带修饰键；结束回调携带最终世界坐标。
    expect(changes[1]!.modifiers.shift).toBe(true)
    expect(changes[changes.length - 1]!.worldPoint).toEqual({ x: 40, y: 25 })
    // Stage 自身没有因路径编辑派发任何命令。
    expect(dispatchSpy).not.toHaveBeenCalled()
  })
})

describe('OpenSpec: stage / 场景视口适配', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * jsdom 里所有元素的 rect 恒为 0，surface 量不到尺寸就不会触发首次适配。
   * 这里替身出一块 1000×800 的可视区域，让测量分支走通。
   */
  function measureSurfaceAs(width: number, height: number) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      toJSON: () => ({}),
    } as DOMRect)
  }

  function renderFitStage(options: { autoFitActiveFrame?: boolean } = {}) {
    const value = document([entity('a')])
    const runtime = createTransactionRuntime({ document: value })
    const dispatchSpy = vi.fn()
    const viewportSpy = vi.fn()
    const dispatch: ComposeStageDispatch = (command) => {
      dispatchSpy(command)
      return runtime.dispatch(command)
    }
    render(
      <ComposeStage
        activeFrameId={ROOT_FRAME_ID}
        autoFitActiveFrame={options.autoFitActiveFrame}
        document={value}
        layoutSnapshot={layoutSnapshot(value)}
        selectedIds={[]}
        services={{ dispatch, registry }}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onSelectedIdsChange={vi.fn()}
        onViewportChange={viewportSpy}
      />,
    )
    return { dispatch: dispatchSpy, viewport: viewportSpy }
  }

  it('首次布局就绪后把视口适配到激活场景', () => {
    measureSurfaceAs(1000, 800)
    const { viewport } = renderFitStage()
    // 1280×720 的场景放进 1000×800：更紧的是宽轴，缩放 = 1000 / 1280 * 0.85。
    expect(viewport).toHaveBeenCalledTimes(1)
    expect(viewport.mock.calls[0]![0].zoom).toBeCloseTo(0.6640625)
    expect(viewport.mock.calls[0]![0].x).toBeCloseTo(75)
  })

  it('关闭自动适配时不改变受控视口', () => {
    measureSurfaceAs(1000, 800)
    const { viewport } = renderFitStage({ autoFitActiveFrame: false })
    expect(viewport).not.toHaveBeenCalled()
  })

  it('surface 尚未量到真实尺寸时不适配', () => {
    const { viewport } = renderFitStage()
    expect(viewport).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / 场景尺寸弹框 / 提交尺寸并按新尺寸适配', () => {
    measureSurfaceAs(1000, 800)
    const { dispatch, viewport } = renderFitStage()
    viewport.mockClear()
    fireEvent.doubleClick(screen.getByTestId(`stage-scene-size-${ROOT_FRAME_ID}`))
    fireEvent.click(screen.getByTestId('stage-scene-size-preset-1920x1080'))
    fireEvent.click(screen.getByTestId('stage-scene-size-confirm'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.setFrameSize,
      payload: { entityId: ROOT_FRAME_ID, size: { width: 1920, height: 1080 } },
    }))
    // 适配必须按刚提交的 1920×1080 算，而不是本帧快照里的 1280×720。
    expect(viewport).toHaveBeenCalledTimes(1)
    expect(viewport.mock.calls[0]![0].zoom).toBeCloseTo(1000 / 1920 * 0.85)
  })
})

describe('绘图模式', () => {
  afterEach(cleanup)

  function surfacePoint(x: number, y: number) {
    return { clientX: x, clientY: y, pointerId: 1, button: 0, bubbles: true }
  }

  /** 十字线画在绘图覆盖层里；覆盖层不存在就等于一条都没画。 */
  function crosshairLines() {
    return screen.queryByTestId('stage-drafting-overlay')
      ?.querySelectorAll('[data-stage-crosshair-line]') ?? []
  }

  function startLine() {
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: 'L' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    return input
  }

  it('OpenSpec: stage / 绘图能力恒开 / 命令行常驻，十字线只在取点时出现', () => {
    renderStage(document())
    // 命令行常驻：不进模式就看不见命令行，正是「能力不可发现」那条毛病。
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('命令：')
    // 没有命令在跑时图面是常规光标，十字线不画。
    expect(screen.queryByTestId('stage-drafting-overlay')).toBeNull()

    startLine()
    expect(screen.getByTestId('stage-drafting-overlay')).toBeInTheDocument()
  })

  it('OpenSpec: stage / Stage 十字光标 / 三形态与隐藏系统光标的标记', () => {
    const { container } = renderStage(document(), { selectedIds: ['a'] })
    const root = container.querySelector('.compose-stage')!
    const surface = screen.getByTestId('stage-surface')
    const lines = () => crosshairLines()
    const hover = (pointerType = 'mouse') => {
      fireEvent.pointerMove(surface, { clientX: 120, clientY: 90, pointerId: 1, pointerType })
    }

    // 空闲什么都不画：页面编辑器的静息光标是箭头。
    hover()
    expect(lines()).toHaveLength(0)
    expect(root.hasAttribute('data-crosshair')).toBe(false)

    // 等待取点：四条线（两轴各两个方向），没有拾取框，系统光标被收走。
    startLine()
    hover()
    expect(lines()).toHaveLength(4)
    expect(screen.queryByTestId('stage-pickbox')).toBeNull()
    expect(root.hasAttribute('data-crosshair')).toBe(true)

    // 触摸既不画也不隐藏系统光标。
    hover('touch')
    expect(lines()).toHaveLength(0)
    expect(root.hasAttribute('data-crosshair')).toBe(false)
  })

  it('OpenSpec: stage / Stage 十字光标 / 等待选择对象时只有拾取框', () => {
    renderStage(document())
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: 'ERASE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('选择对象')

    fireEvent.pointerMove(screen.getByTestId('stage-surface'), {
      clientX: 120, clientY: 90, pointerId: 1, pointerType: 'mouse',
    })
    expect(crosshairLines()).toHaveLength(0)
    expect(screen.getByTestId('stage-pickbox')).toBeInTheDocument()
  })

  it('OpenSpec: stage / Stage 十字光标 / 宿主可以关闭', () => {
    const { container } = renderStage(document(), { showCrosshair: false })
    startLine()
    fireEvent.pointerMove(screen.getByTestId('stage-surface'), {
      clientX: 120, clientY: 90, pointerId: 1, pointerType: 'mouse',
    })
    expect(crosshairLines()).toHaveLength(0)
    expect(container.querySelector('.compose-stage')!.hasAttribute('data-crosshair')).toBe(false)
  })

  it('OpenSpec: stage-engine / 绘图命令 / L↵ 后两次取点画出一条线', () => {
    const { dispatch, runtime } = renderStage(document())
    startLine()
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定第一点')

    const surface = screen.getByTestId('stage-surface')
    fireEvent.pointerDown(surface, surfacePoint(100, 100))
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定下一点')
    // 第一点只是起点，还没有东西落地。
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.pointerDown(surface, surfacePoint(300, 200))
    const created = Object.values(runtime.document.entities)
      .filter((candidate) => candidate.components.Curve !== undefined)
    expect(created).toHaveLength(1)
    // 会话继续等待下一点——连续画线是这条命令的语义。
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定下一点')
  })

  it('OpenSpec: stage / 键入坐标与指针取点共用同一条求解 / 键入坐标不被吸附改写', () => {
    const value = document()
    const { runtime } = renderStage(value)
    const input = startLine()
    // 网格步长 8 时 100,50 与 260,130 都不在网格点上；键入的坐标必须原样落地。
    for (const text of ['100,50', '260,130']) {
      fireEvent.change(input, { target: { value: text } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    const curve = Object.values(runtime.document.entities)
      .find((candidate) => candidate.components.Curve !== undefined)
    expect(curve).toBeDefined()
    const item = curve!.components.LayoutItem as { readonly offset: { x: number; y: number } }
    expect(item.offset).toEqual({ x: 100, y: 50 })
  })

  it('未知命令给出提示且不开始会话', () => {
    renderStage(document())
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: 'NOPE' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('未知命令')
  })

  it('OpenSpec: stage / 绘图模式 / 画布上按 Enter 正常结束 LINE', () => {
    const { runtime } = renderStage(document())
    startLine()
    const surface = screen.getByTestId('stage-surface')
    fireEvent.pointerDown(surface, surfacePoint(100, 100))
    fireEvent.pointerDown(surface, surfacePoint(300, 200))

    // 焦点在图面上，不是命令行输入框——真实操作里用户取完点手还在画布上。
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })

    // 回到空闲提示。断言的是「不是已取消」：正常结束与中止都留住已画的线，两者只能靠
    // 提示文案区分，而回 cancelled 时这里会是「已取消」。
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('命令：')
    expect(Object.values(runtime.document.entities)
      .filter((candidate) => candidate.components.Curve !== undefined)).toHaveLength(1)
  })

  it('OpenSpec: stage / 绘图模式 / 画布上按 Esc 中止 LINE', () => {
    renderStage(document())
    startLine()
    fireEvent.pointerDown(screen.getByTestId('stage-surface'), surfacePoint(100, 100))
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' })
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('已取消')
  })

  it('命令行输入框里的 Enter 不被图面再消费一次', () => {
    const { runtime } = renderStage(document())
    const input = startLine()
    // 事件从输入框冒到 Stage 根节点。根上再推进一次的话，第二个坐标会被当成第三点，
    // 落地的曲线会变成两条。
    for (const text of ['100,50', '260,130']) {
      fireEvent.change(input, { target: { value: text } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    expect(Object.values(runtime.document.entities)
      .filter((candidate) => candidate.components.Curve !== undefined)).toHaveLength(1)
  })

  it('Esc 中止命令且不写入文档', () => {
    const { dispatch } = renderStage(document())
    const input = startLine()
    fireEvent.pointerDown(screen.getByTestId('stage-surface'), surfacePoint(100, 100))
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('已取消')
    expect(dispatch).not.toHaveBeenCalled()
  })

  function runCommand(name: string) {
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: name } })
    fireEvent.keyDown(input, { key: 'Enter' })
    return input
  }

  it('OpenSpec: stage / 绘图模式的编辑命令 / 先选后执行的 MOVE 直接问基点', () => {
    const value = document()
    const before = (value.entities.a!.components.LayoutItem as {
      readonly offset: { x: number; y: number }
    }).offset
    const { dispatch, runtime } = renderStage(value, {
      selectedIds: ['a'],
    })
    const input = runCommand('M')
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定基点')

    for (const text of ['0,0', '30,20']) {
      fireEvent.change(input, { target: { value: text } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }

    // 一条命令等于一步撤销。
    expect(dispatch).toHaveBeenCalledTimes(1)
    const item = runtime.document.entities.a!.components.LayoutItem as {
      readonly offset: { x: number; y: number }
    }
    // 键入的位移不被网格吸附改写：30 与 20 都不在步长 8 的网格上。
    expect(item.offset).toEqual({ x: before.x + 30, y: before.y + 20 })
  })

  it('OpenSpec: stage / 绘图命令消费宿主的选择集 / 选择集变化后作用范围同步', () => {
    const { rerender } = renderStageWithRerender(document())
    runCommand('M')
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('选择对象')
    // 命令进行中宿主的选择集变了：会话必须跟着变，否则它会作用在用户已经移出的对象上。
    rerender(['a'])
    expect(screen.getByTestId('stage-drafting-selection-count')).toHaveTextContent('已选 1')
  })

  it('OpenSpec: stage / 绘图模式的编辑命令 / 先选后执行的 ERASE 当场删除并清空选择集', () => {
    const { runtime, selection } = renderStage(document(), {
      selectedIds: ['a'],
    })

    runCommand('E')

    expect(runtime.document.entities.a).toBeUndefined()
    expect(selection).toHaveBeenCalledWith([])
  })

  it('OpenSpec: stage / 编辑命令显示作用对象的轮廓预览 / 取消后预览消失', () => {
    renderStage(document(), { selectedIds: ['a'] })
    const input = runCommand('M')
    expect(screen.queryAllByTestId('stage-drafting-outline')).toHaveLength(0)

    fireEvent.change(input, { target: { value: '0,0' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryAllByTestId('stage-drafting-outline')).toHaveLength(1)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryAllByTestId('stage-drafting-outline')).toHaveLength(0)
  })

  it('没有命令在跑时 Esc 交回既有键位级联', () => {
    const { selection } = renderStage(document(), { selectedIds: ['a'] })

    // 绘图只在命令进行中吃 Esc。继续吃下去会抢在文字编辑的退出分支之前——用户在画布上
    // 改完字按 Esc 会变成清空选择集而不是提交。
    fireEvent.keyDown(screen.getByRole('application', { name: 'Stage' }), { key: 'Escape' })

    expect(selection).not.toHaveBeenCalled()
  })

  it('F8 切换正交，F3 切换对象捕捉', () => {
    renderStage(document())
    expect(screen.getByTestId('stage-drafting-ortho-state')).toHaveTextContent('正交 关')
    expect(screen.getByTestId('stage-drafting-snap-state')).toHaveAttribute('data-active')

    fireEvent.keyDown(screen.getByRole('application', { name: 'Stage' }), { key: 'F8' })
    expect(screen.getByTestId('stage-drafting-ortho-state')).toHaveTextContent('正交 开')
    fireEvent.keyDown(screen.getByRole('application', { name: 'Stage' }), { key: 'F3' })
    // 二态标记关闭时也要显示——只在开启时渲染会让用户无法确认它现在是关的。
    expect(screen.getByTestId('stage-drafting-snap-state')).toHaveTextContent('对象捕捉 关')
  })
})

describe('命令词汇表合并', () => {
  afterEach(cleanup)

  function typeCommand(text: string) {
    const input = screen.getByRole('textbox', { name: '命令行' })
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
    return input
  }

  it('OpenSpec: stage / 宿主注入的命令与内建命令同属一份词汇表 / 键入宿主动作名执行该动作', () => {
    const run = vi.fn()
    renderStage(document(), {
      commands: [createComposeImmediateCommand({
        id: 'history.undo',
        aliases: ['UNDO', 'U'],
        title: '撤销',
        run,
      })],
    })

    typeCommand('UNDO')
    expect(run).toHaveBeenCalledTimes(1)

    // 别名与全名共用同一个大小写无关的命名空间，宿主命令不例外。
    typeCommand('u')
    expect(run).toHaveBeenCalledTimes(2)

    // 内建命令的解析不受影响。
    typeCommand('L')
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定第一点')
  })

  it('OpenSpec: stage / 宿主注入的命令与内建命令同属一份词汇表 / 不可用的命令给出原因而不是静默', () => {
    const run = vi.fn()
    renderStage(document(), {
      commands: [createComposeImmediateCommand({
        id: 'edit.group',
        aliases: ['GROUP'],
        title: '编组',
        disabledReason: '请至少选中两个对象',
        run,
      })],
    })

    typeCommand('GROUP')

    expect(run).not.toHaveBeenCalled()
    // 三种拒绝互相可分：这里给的是缺什么，而不是「未知命令」，更不是什么都不显示。
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('请至少选中两个对象')

    typeCommand('NOPE')
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('未知命令')
  })

  it('OpenSpec: stage / 命令行历史与重复上一条 / 空确认重复上一条命令', () => {
    const run = vi.fn()
    renderStage(document(), {
      commands: [createComposeImmediateCommand({ id: 'history.undo', aliases: ['UNDO'], title: '撤销', run })],
    })

    typeCommand('UNDO')
    expect(run).toHaveBeenCalledTimes(1)

    // 空闲时的空确认重复上一条命令；没有命令跑过时它什么也不做。
    typeCommand('')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('OpenSpec: stage / 命令行历史与重复上一条 / 取过点之后重复的仍是命令', () => {
    const { runtime } = renderStage(document())
    const input = screen.getByRole('textbox', { name: '命令行' })

    fireEvent.change(input, { target: { value: 'L' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    for (const text of ['100,50', '260,130']) {
      fireEvent.change(input, { target: { value: text } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
    fireEvent.keyDown(input, { key: 'Escape' })

    const before = Object.values(runtime.document.entities)
      .filter((candidate) => candidate.components.Curve !== undefined).length
    expect(before).toBe(1)

    // 重的是 `LINE` 而不是最后键入的那行坐标——后者不是命令名。
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定第一点')
  })

  it('OpenSpec: stage / 命令行历史与重复上一条 / 会话进行中的空确认不变', () => {
    const run = vi.fn()
    renderStage(document(), {
      commands: [createComposeImmediateCommand({ id: 'history.undo', aliases: ['UNDO'], title: '撤销', run })],
    })

    typeCommand('UNDO')
    typeCommand('L')
    expect(screen.getByTestId('stage-drafting-command-prompt')).toHaveTextContent('指定第一点')

    // 会话进行中的空确认按既有语义推进一步（一个点都没取的 LINE 就此结束），不重启 UNDO。
    typeCommand('')
    expect(run).toHaveBeenCalledTimes(1)
  })
})
