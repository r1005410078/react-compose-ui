import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  createDefaultOutputSettings,
  type CommandDispatchResult,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import { createComposeEditorActions } from './action-catalog'
import { createDefaultComposeEditorPreferences } from '../editor-preferences/preferences'
import type { ComposeEditorActionContext } from './action-catalog'

function entity(id: string) {
  return {
    id,
    name: id,
    components: {
      Composition: {
        presetId: 'rectangle',
        baseComponentKeys: ['Transform', 'LayoutItem', 'Visibility', 'Lock'],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: createDefaultComposeLayoutItem(100, 100),
      Visibility: { visible: true },
      Lock: { locked: false },
    },
  }
}

function fixture(): ComposeDocument {
  return {
    schemaVersion: 6,
    canvas: createDefaultCanvasSettings(),
    output: createDefaultOutputSettings(),
    rootIds: ['a', 'b'],
    entities: { a: entity('a'), b: entity('b') },
  }
}

function snapshot(): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: {
      a: { x: 0, y: 0, width: 100, height: 100, positioning: 'absolute' },
      b: { x: 200, y: 0, width: 100, height: 100, positioning: 'absolute' },
    },
    diagnostics: [],
  }
}

function context(
  overrides: Partial<ComposeEditorActionContext> = {},
): ComposeEditorActionContext {
  return {
    document: fixture(),
    locale: 'zh-CN',
    shortcuts: createDefaultComposeEditorPreferences().shortcuts,
    selectedIds: [],
    layoutSnapshot: snapshot(),
    canUndo: false,
    canRedo: false,
    idFactory: () => 'generated-id',
    dispatch: dispatchSpy('noop'),
    setSelectedIds: () => {},
    setTool: () => {},
    zoomBy: () => {},
    zoomReset: () => {},
    fitSelection: () => {},
    fitContainer: () => {},
    toggleGridSnap: () => {},
    toggleSmartSnap: () => {},
    ...overrides,
  }
}

const byId = (actions: readonly { id: string }[]) => actions.map((action) => action.id)

/** 记录派发内容的 dispatch 替身；status 决定目录是否继续修正选区。 */
function dispatchSpy(status: CommandDispatchResult['status'] = 'committed') {
  return vi.fn(
    (command: EditorCommand): CommandDispatchResult =>
      ({ command, status } as CommandDispatchResult),
  )
}

describe('createComposeEditorActions', () => {
  it('OpenSpec: editor-preferences / 编辑器动作目录 / 排除临时手势动作', () => {
    const actions = createComposeEditorActions(context())
    // 按住不放的临时平移做成一次性列表项没有意义，必须整条缺席而不是以不可用形式出现。
    expect(byId(actions)).not.toContain('stage.temporaryPan')
    expect(byId(actions)).toContain('stage.panTool')
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 宿主未提供入口时省略动作', () => {
    expect(byId(createComposeEditorActions(context()))).not.toContain('editor.settings')

    const withSettings = createComposeEditorActions(context({ openSettings: () => {} }))
    expect(byId(withSettings)).toContain('editor.settings')
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 不可用动作说明原因', () => {
    const actions = createComposeEditorActions(context())
    const find = (id: string) => actions.find((action) => action.id === id)

    // 空选区下所有结构类动作都必须给出原因。
    expect(find('edit.delete')?.disabledReason).toBeTruthy()
    expect(find('edit.duplicate')?.disabledReason).toBeTruthy()
    expect(find('edit.group')?.disabledReason).toBeTruthy()
    expect(find('edit.ungroup')?.disabledReason).toBeTruthy()
    expect(find('history.undo')?.disabledReason).toBeTruthy()
    expect(find('history.redo')?.disabledReason).toBeTruthy()

    // 与选区无关的视口动作始终可用。
    expect(find('stage.zoomIn')?.disabledReason).toBeUndefined()
    expect(find('stage.selectTool')?.disabledReason).toBeUndefined()
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 选中两个对象后可编组', () => {
    const actions = createComposeEditorActions(context({ selectedIds: ['a', 'b'] }))
    const group = actions.find((action) => action.id === 'edit.group')

    expect(group?.disabledReason).toBeUndefined()
    // 单选无法编组，但可以删除与复制。
    const single = createComposeEditorActions(context({ selectedIds: ['a'] }))
    expect(single.find((action) => action.id === 'edit.group')?.disabledReason).toBeTruthy()
    expect(single.find((action) => action.id === 'edit.delete')?.disabledReason).toBeUndefined()
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 文档动作进入历史', () => {
    const dispatch = dispatchSpy()
    const actions = createComposeEditorActions(context({ dispatch, selectedIds: ['a'] }))

    actions.find((action) => action.id === 'edit.delete')?.run()

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'entity.delete',
      payload: { entityIds: ['a'] },
    })
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 视口动作不进入历史', () => {
    const dispatch = dispatchSpy('noop')
    const zoomBy = vi.fn()
    const setTool = vi.fn()
    const actions = createComposeEditorActions(context({ dispatch, setTool, zoomBy }))

    actions.find((action) => action.id === 'stage.zoomIn')?.run()
    actions.find((action) => action.id === 'stage.panTool')?.run()

    expect(zoomBy).toHaveBeenCalledTimes(1)
    expect(setTool).toHaveBeenCalledWith('pan')
    // 关键契约：视口与工具动作绝不派发命令，因此不会污染撤销栈。
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 动作携带本地化名称与键位', () => {
    const zh = createComposeEditorActions(context())
    expect(zh.find((action) => action.id === 'stage.zoomIn')?.title).toBe('放大')
    expect(zh.find((action) => action.id === 'edit.delete')?.category).toBeTruthy()
    expect(zh.find((action) => action.id === 'edit.group')?.shortcut?.length).toBeGreaterThan(0)

    const en = createComposeEditorActions(context({ locale: 'en-US' }))
    expect(en.find((action) => action.id === 'stage.zoomIn')?.title).toBe('Zoom in')
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 不可用动作不执行副作用', () => {
    const dispatch = dispatchSpy('noop')
    const actions = createComposeEditorActions(context({ dispatch }))

    // 面板本身会拦截不可用动作，但目录也不得在被直接调用时产生副作用。
    actions.find((action) => action.id === 'edit.delete')?.run()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
