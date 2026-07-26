import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  createTransactionRuntime,
  type ComposeDocument,
  type TransactionRuntime,
} from '@compose-ui/core'
import {
  createStageInteractionController,
  type StageInteractionController,
} from '@compose-ui/stage-engine'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ComponentPalette, Stage } from './index'
import type { StageFramePreset } from './frame-preset'

type Registry = ReturnType<typeof createComponentRegistry>

afterEach(cleanup)

function document(): ComposeDocument {
  return {
    schemaVersion: 3,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['frame'],
    nodes: {
      frame: {
        id: 'frame',
        kind: 'frame',
        name: 'Page',
        visible: true,
        locked: false,
        transform: { x: 0, y: 0, width: 500, height: 400, rotation: 0 },
        childIds: [],
        clipContent: true,
      },
    },
  }
}

function registry() {
  return createComponentRegistry([{
    type: 'box',
    label: '方块',
    defaultSize: { width: 100, height: 50 },
    createDefaultProps: () => ({ color: 'blue' }),
    renderer: () => <span>Box</span>,
  }])
}

function Workspace({
  runtime,
  registry: definitions,
  controller,
  prefix,
  framePresets = [],
}: {
  runtime: TransactionRuntime
  registry: Registry
  controller: StageInteractionController
  prefix: string
  framePresets?: readonly StageFramePreset[]
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const [selection, setSelection] = useState<readonly string[]>([])
  return (
    <>
      <ComponentPalette
        aria-label={`${prefix} Palette`}
        interactionController={controller}
        framePresets={framePresets}
        registry={definitions}
      />
      <Stage
        aria-label={`${prefix} Stage`}
        dispatch={runtime.dispatch}
        document={state.document}
        interactionController={controller}
        framePresets={framePresets}
        idFactory={() => `${prefix}-box`}
        registry={definitions}
        selectedIds={selection}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onSelectedIdsChange={setSelection}
        onViewportChange={() => undefined}
      />
      <output aria-label={`${prefix} selection`}>{selection.join(',')}</output>
    </>
  )
}

function rect(element: HTMLElement) {
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  })
}

const framePreset: StageFramePreset = {
  id: 'desktop',
  label: 'Frame',
  name: 'Desktop Frame',
  defaultSize: { width: 300, height: 200 },
  defaultClipContent: true,
  createDefaultStyle: () => ({
    backgroundColor: '#ffffff',
    borderRadius: 8,
  }),
}

describe('ComponentPalette', () => {
  it('localizes built-in Palette chrome without changing registry labels', () => {
    const controller = createStageInteractionController()
    render(
      <ComponentPalette
        interactionController={controller}
        locale="zh-CN"
        registry={registry()}
      />,
    )

    expect(screen.getByRole('region', { name: '组件库' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加 方块' })).toBeInTheDocument()
    expect(screen.getByText('方块')).toBeInTheDocument()
  })

  it('OpenSpec: stage / Frame Palette 拖入 / 保持 Component 拖入兼容', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const definitions = registry()
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        prefix="one"
        registry={definitions}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    const item = screen.getByRole('button', { name: 'Add 方块' })
    fireEvent.pointerDown(item, { clientX: 700, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 120, clientY: 140, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 120, clientY: 140, pointerId: 1 })

    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.nodes['one-box']).toMatchObject({
      kind: 'component',
      componentType: 'box',
      props: { color: 'blue' },
      transform: { x: 70, y: 115, width: 100, height: 50 },
    })
    expect(screen.getByLabelText('one selection')).toHaveTextContent('one-box')
  })

  // OpenSpec: stage / ComponentPalette 拖入 / 拖到空白 Canvas
  it('OpenSpec: stage / 多 Frame 与输出边界 / 编辑输出边界外的根组件', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const events: string[] = []
    runtime.subscribeEvents((event) => events.push(event.type))
    const definitions = registry()
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        prefix="one"
        registry={definitions}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add 方块' }), {
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    })
    fireEvent.pointerUp(window, { clientX: 1500, clientY: 900, pointerId: 1 })

    expect(runtime.entries).toHaveLength(2)
    expect(runtime.document.rootIds).toEqual(['frame', 'one-box'])
    expect(runtime.document.nodes['one-box']).toMatchObject({
      kind: 'component',
      transform: { x: 1450, y: 875 },
    })
    expect(screen.getByTestId('stage-node-one-box')).toBeInTheDocument()
    expect(events).toContain('committed')
  })

  it('OpenSpec: stage / ComponentPalette 拖入 / 拖到嵌套 Frame', () => {
    const base = document()
    const rootFrame = base.nodes.frame
    if (rootFrame?.kind !== 'frame') throw new Error('fixture frame is missing')
    const nestedDocument: ComposeDocument = {
      ...base,
      nodes: {
        ...base.nodes,
        frame: {
          ...rootFrame,
          childIds: ['nested'],
        },
        nested: {
          id: 'nested',
          kind: 'frame',
          name: 'Nested',
          visible: true,
          locked: false,
          transform: { x: 100, y: 100, width: 200, height: 150, rotation: 0 },
          childIds: [],
          clipContent: false,
        },
      },
    }
    const runtime = createTransactionRuntime({ document: nestedDocument })
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        prefix="one"
        registry={registry()}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    const item = screen.getByRole('button', { name: 'Add 方块' })
    fireEvent.pointerDown(item, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 180, clientY: 160, pointerId: 1 })

    expect(runtime.document.nodes.nested).toMatchObject({
      childIds: ['one-box'],
    })
    expect(runtime.document.nodes['one-box']).toMatchObject({
      transform: { x: 30, y: 35, width: 100, height: 50 },
    })
  })

  it('OpenSpec: stage / ComponentPalette 拖入 / 隔离多个 Stage 实例', () => {
    const definitions = registry()
    const firstRuntime = createTransactionRuntime({ document: document() })
    const secondRuntime = createTransactionRuntime({ document: document() })
    const firstController = createStageInteractionController()
    const secondController = createStageInteractionController()
    render(
      <>
        <Workspace
          controller={firstController}
          prefix="first"
          registry={definitions}
          runtime={firstRuntime}
        />
        <Workspace
          controller={secondController}
          prefix="second"
          registry={definitions}
          runtime={secondRuntime}
        />
      </>,
    )
    rect(screen.getByRole('application', { name: 'first Stage' }))
    rect(screen.getByRole('application', { name: 'second Stage' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Add 方块' })[0]!)

    expect(firstRuntime.document.nodes['first-box']).toBeDefined()
    expect(secondRuntime.document.nodes['second-box']).toBeUndefined()
  })

  it('OpenSpec: stage / ComponentPalette 拖入 / 键盘新增路径', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const events: string[] = []
    runtime.subscribeEvents((event) => events.push(event.type))
    const definitions = registry()
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        prefix="one"
        registry={definitions}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    const item = screen.getByRole('button', { name: 'Add 方块' })
    fireEvent.pointerDown(item, { clientX: 250, clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 250, clientY: 200, pointerId: 1 })
    fireEvent.click(item)

    expect(events.filter((type) => type === 'committed')).toHaveLength(1)
    expect(events).not.toContain('rejected')
  })

  it('OpenSpec: stage / Frame Palette 拖入 / Pointer 居中创建根 Frame', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const definitions = registry()
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        framePresets={[framePreset]}
        prefix="one"
        registry={definitions}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Add Frame',
      'Add 方块',
    ])
    fireEvent.pointerDown(buttons[0]!, {
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    })
    fireEvent.pointerUp(window, { clientX: 650, clientY: 500, pointerId: 1 })

    expect(runtime.document.rootIds).toEqual(['frame', 'one-box'])
    expect(runtime.document.nodes['one-box']).toMatchObject({
      kind: 'frame',
      name: 'Desktop Frame',
      clipContent: true,
      style: { backgroundColor: '#ffffff', borderRadius: 8 },
      transform: { x: 500, y: 400, width: 300, height: 200, rotation: 0 },
    })
    expect(screen.getByLabelText('one selection')).toHaveTextContent('one-box')
  })

  it('OpenSpec: stage / Frame Palette 拖入 / 键盘新增 Frame', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const definitions = registry()
    const controller = createStageInteractionController()
    render(
      <Workspace
        controller={controller}
        framePresets={[framePreset]}
        prefix="one"
        registry={definitions}
        runtime={runtime}
      />,
    )
    rect(screen.getByRole('application', { name: 'one Stage' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add Frame' }))

    expect(runtime.document.nodes['one-box']).toMatchObject({
      kind: 'frame',
      // JSDOM 没有 ResizeObserver，键盘新增按 Stage 的 900×600 安全回退尺寸居中。
      transform: { x: 300, y: 200, width: 300, height: 200, rotation: 0 },
      clipContent: true,
    })
  })

  it('OpenSpec: stage-engine / 统一外部拖入 / factory 异常不泄漏到 Palette', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const controller = createStageInteractionController()
    const brokenPreset: StageFramePreset = {
      ...framePreset,
      id: 'broken',
      label: 'Broken Frame',
      createDefaultStyle: () => {
        throw new Error('factory exploded')
      },
    }
    render(
      <Workspace
        controller={controller}
        framePresets={[brokenPreset]}
        prefix="one"
        registry={registry()}
        runtime={runtime}
      />,
    )

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Broken Frame' }))
    }).not.toThrow()
    expect(runtime.document.nodes['one-box']).toBeUndefined()
    expect(runtime.entries).toHaveLength(1)
  })
})
