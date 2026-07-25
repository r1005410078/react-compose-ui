import { createComponentRegistry } from '@compose-ui/component-registry'
import {
  createTransactionRuntime,
  type ComposeDocument,
  type TransactionRuntime,
} from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import * as stagePackage from './index'

type DragController = unknown
type Registry = ReturnType<typeof createComponentRegistry>
type FramePreset = {
  readonly id: string
  readonly label: string
  readonly name: string
  readonly defaultSize: { readonly width: number; readonly height: number }
  readonly createDefaultStyle: () => {
    readonly backgroundColor: string
    readonly borderRadius: number
  }
}

const api = stagePackage as unknown as {
  createStageDragController(): DragController
  ComponentPalette(props: {
    registry: Registry
    dragController: DragController
    framePresets?: readonly FramePreset[]
    'aria-label'?: string
  }): React.ReactNode
  Stage(props: {
    document: ComposeDocument
    registry: Registry
    dispatch: TransactionRuntime['dispatch']
    viewport: { x: number; y: number; zoom: number }
    onViewportChange(value: { x: number; y: number; zoom: number }): void
    tool: 'select' | 'pan'
    selectedIds: readonly string[]
    onSelectedIdsChange(ids: readonly string[]): void
    activeFrameId: string | null
    onActiveFrameIdChange(id: string | null): void
    dragController: DragController
    idFactory(): string
    'aria-label'?: string
  }): React.ReactNode
}

afterEach(cleanup)

function document(): ComposeDocument {
  return {
    schemaVersion: 1,
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
  controller: DragController
  prefix: string
  framePresets?: readonly FramePreset[]
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [activeFrame, setActiveFrame] = useState<string | null>('frame')
  return (
    <>
      <api.ComponentPalette
        aria-label={`${prefix} Palette`}
        dragController={controller}
        framePresets={framePresets}
        registry={definitions}
      />
      <api.Stage
        activeFrameId={activeFrame}
        aria-label={`${prefix} Stage`}
        dispatch={runtime.dispatch}
        document={state.document}
        dragController={controller}
        idFactory={() => `${prefix}-box`}
        registry={definitions}
        selectedIds={selection}
        tool="select"
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onActiveFrameIdChange={setActiveFrame}
        onSelectedIdsChange={setSelection}
        onViewportChange={() => undefined}
      />
      <output aria-label={`${prefix} selection`}>{selection.join(',')}</output>
      <output aria-label={`${prefix} active frame`}>{activeFrame}</output>
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

const framePreset: FramePreset = {
  id: 'desktop',
  label: 'Frame',
  name: 'Desktop Frame',
  defaultSize: { width: 300, height: 200 },
  createDefaultStyle: () => ({
    backgroundColor: '#ffffff',
    borderRadius: 8,
  }),
}

describe('ComponentPalette', () => {
  it('OpenSpec: stage / Frame Palette 拖入 / 保持 Component 拖入兼容', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const definitions = registry()
    const controller = api.createStageDragController()
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

  it('OpenSpec: stage / ComponentPalette 拖入 / 拖到 Frame 外', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const events: string[] = []
    runtime.subscribeEvents((event) => events.push(event.type))
    const definitions = registry()
    const controller = api.createStageDragController()
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
    fireEvent.pointerUp(window, { clientX: 700, clientY: 500, pointerId: 1 })

    expect(runtime.entries).toHaveLength(1)
    expect(events).toContain('rejected')
  })

  it('OpenSpec: stage / ComponentPalette 拖入 / 隔离多个 Stage 实例', () => {
    const definitions = registry()
    const firstRuntime = createTransactionRuntime({ document: document() })
    const secondRuntime = createTransactionRuntime({ document: document() })
    const firstController = api.createStageDragController()
    const secondController = api.createStageDragController()
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
    const controller = api.createStageDragController()
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
    const controller = api.createStageDragController()
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
      style: { backgroundColor: '#ffffff', borderRadius: 8 },
      transform: { x: 500, y: 400, width: 300, height: 200, rotation: 0 },
    })
    expect(screen.getByLabelText('one selection')).toHaveTextContent('one-box')
    expect(screen.getByLabelText('one active frame')).toHaveTextContent('one-box')
  })

  it('OpenSpec: stage / Frame Palette 拖入 / 键盘新增 Frame', () => {
    const runtime = createTransactionRuntime({ document: document() })
    const definitions = registry()
    const controller = api.createStageDragController()
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
      transform: { x: 250, y: 200, width: 300, height: 200, rotation: 0 },
    })
    expect(screen.getByLabelText('one active frame')).toHaveTextContent('one-box')
  })
})
