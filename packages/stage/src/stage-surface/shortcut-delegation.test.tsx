import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createComposeFrameEntity,
  createTransactionRuntime,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeStage } from './compose-stage'
import type { ComposeStageDispatch, ComposeStageProps } from '../types'

afterEach(cleanup)

const registry = createComposeEntityRegistry()

function entity(id: string) {
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: 'container',
        baseComponentKeys: [
          'Transform',
          'LayoutItem',
          'Visibility',
          'Lock',
          'Hierarchy',
          'Clip',
        ],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(100, 100),
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: [] },
      Clip: { enabled: false },
    },
  }
}

function fixture(): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame-root'],
    entities: {
      a: entity('a'),
      b: entity('b'),
      'frame-root': createComposeFrameEntity({ id: 'frame-root', childIds: ['a', 'b'] }),
    },
  }
}

const snapshot: ComposeLayoutSnapshot = {
  revision: 1,
  boxes: {
    'frame-root': { x: 0, y: 0, width: 1280, height: 720, positioning: 'absolute' },
    a: { x: 0, y: 0, width: 100, height: 100, positioning: 'absolute' },
    b: { x: 200, y: 0, width: 100, height: 100, positioning: 'absolute' },
  },
  diagnostics: [],
}

function renderStage(options: {
  onShortcutAction?: (action: string) => boolean
  onToolChange?: (tool: import('../types').ComposeStageTool) => void
  selectedIds?: readonly string[]
  shortcuts?: ComposeStageProps['shortcuts']
} = {}) {
  const value = fixture()
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
      layoutSnapshot={snapshot}
      onSelectedIdsChange={vi.fn()}
      onShortcutAction={options.onShortcutAction as never}
      onToolChange={options.onToolChange}
      onViewportChange={vi.fn()}
      registry={registry}
      selectedIds={options.selectedIds ?? ['a', 'b']}
      shortcuts={options.shortcuts}
      tool="select"
      viewport={{ x: 0, y: 0, zoom: 1 }}
    />,
  )
  return { dispatch: dispatchSpy, stage: screen.getByRole('application', { name: 'Stage' }) }
}

describe('ComposeStage 快捷键接管', () => {
  it('OpenSpec: stage / 宿主接管 Stage 快捷键动作 / 宿主接管编辑动作', () => {
    const onShortcutAction = vi.fn(() => true)
    const { dispatch, stage } = renderStage({ onShortcutAction })

    fireEvent.keyDown(stage, { code: 'KeyG', key: 'g', metaKey: true })

    expect(onShortcutAction).toHaveBeenCalledWith('edit.group')
    // 宿主接管后 Stage 不得自行规划或派发命令。
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / 宿主接管 Stage 快捷键动作 / 宿主拒绝接管', () => {
    const onShortcutAction = vi.fn(() => false)
    const { dispatch, stage } = renderStage({ onShortcutAction })

    fireEvent.keyDown(stage, { code: 'KeyG', key: 'g', metaKey: true })

    expect(onShortcutAction).toHaveBeenCalledWith('edit.group')
    // 拒绝接管时回退到内建实现，行为与未提供回调时一致。
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: 'entity.group' })
  })

  it('OpenSpec: stage / 宿主接管 Stage 快捷键动作 / 临时平移不受接管影响', () => {
    const onShortcutAction = vi.fn(() => true)
    const { stage } = renderStage({ onShortcutAction })

    fireEvent.keyDown(stage, { code: 'Space', key: ' ' })

    // 按住不放的手势始终由 Stage 自己处理，不询问宿主。
    expect(onShortcutAction).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / 宿主接管 Stage 快捷键动作 / 独立使用保持内建行为', () => {
    const onToolChange = vi.fn()
    const { dispatch, stage } = renderStage({ onToolChange })

    fireEvent.keyDown(stage, { code: 'KeyH', key: 'h' })
    expect(onToolChange).toHaveBeenCalledWith('pan')

    fireEvent.keyDown(stage, { code: 'KeyG', key: 'g', metaKey: true })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('OpenSpec: stage / 宿主接管 Stage 快捷键动作 / 接管会话动作', () => {
    const onShortcutAction = vi.fn(() => true)
    const onToolChange = vi.fn()
    const { stage } = renderStage({ onShortcutAction, onToolChange })

    fireEvent.keyDown(stage, { code: 'KeyH', key: 'h' })

    expect(onShortcutAction).toHaveBeenCalledWith('stage.panTool')
    // 接管后 Stage 不再自行切换工具，避免与宿主重复执行。
    expect(onToolChange).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / Stage 节点层级操作 / 使用 Figma 风格默认键位', () => {
    const onShortcutAction = vi.fn(() => true)
    const { dispatch, stage } = renderStage({ onShortcutAction, selectedIds: ['a'] })

    fireEvent.keyDown(stage, { code: 'BracketRight', key: ']' })
    expect(onShortcutAction).toHaveBeenCalledWith('edit.bringForward')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: stage / Stage 节点层级操作 / 独立 Stage 使用共享层级命令', () => {
    const { dispatch, stage } = renderStage({ selectedIds: ['a'] })

    fireEvent.keyDown(stage, { code: 'BracketRight', key: ']' })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'entity.move',
      payload: { entityIds: ['a'], parentId: 'frame-root', index: 2 },
    }))
  })

  it('OpenSpec: stage / Stage 节点层级操作 / 使用用户重绑键位', () => {
    const { dispatch, stage } = renderStage({
      selectedIds: ['a'],
      shortcuts: { 'edit.bringForward': [{ code: 'KeyP' }] },
    })

    fireEvent.keyDown(stage, { code: 'BracketRight', key: ']' })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.keyDown(stage, { code: 'KeyP', key: 'p' })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'entity.move',
      payload: { entityIds: ['a'], parentId: 'frame-root', index: 2 },
    }))
  })
})
