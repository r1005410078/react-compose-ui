import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultCanvasSettings,
  createDefaultComposeLayoutItem,
  type CommandDispatchResult,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import { createComposeCommandRegistry } from '@compose-ui/commands'
import { createStageDraftingCommands } from '@compose-ui/stage-engine'
import {
  COMPOSE_EDITOR_COMMAND_ALIASES,
  createComposeEditorActionHandlers,
  createComposeEditorActions,
  createComposeEditorCommands,
} from './action-catalog'
import { createDefaultComposeEditorPreferences } from '../editor-preferences/preferences'
import type {
  ComposeEditorActionContext,
  ComposeEditorActionHandlerContext,
} from './action-catalog'

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
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
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
    expect(byId(actions)).toContain('stage.selectTool')
    // pan 工具已删除：临时平移（空格/中键）已经覆盖它，而工具是有状态的。
    expect(byId(actions)).not.toContain('stage.panTool')
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 宿主未提供入口时省略动作', () => {
    expect(byId(createComposeEditorActions(context()))).not.toContain('editor.settings')
    expect(byId(createComposeEditorActions(context()))).not.toContain('edit.createComponent')

    const withSettings = createComposeEditorActions(context({ openSettings: () => {} }))
    expect(byId(withSettings)).toContain('editor.settings')
  })

  it('OpenSpec: editor-workspace-layout / 创建组件命令 / 命令目录打开同一命名流程', () => {
    const createComponent = vi.fn()
    const actions = createComposeEditorActions(context({
      createComponent,
      selectedIds: ['a'],
    }))
    const action = actions.find((candidate) => candidate.id === 'edit.createComponent')

    expect(action).toMatchObject({ title: '创建组件…', disabledReason: undefined })
    action?.run()
    expect(createComponent).toHaveBeenCalledOnce()
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 不可用动作说明原因', () => {
    const actions = createComposeEditorActions(context())
    const find = (id: string) => actions.find((action) => action.id === id)

    // 空选区下所有结构类动作都必须给出原因。
    expect(find('edit.delete')?.disabledReason).toBeTruthy()
    expect(find('edit.duplicate')?.disabledReason).toBeTruthy()
    expect(find('edit.copy')?.disabledReason).toBeTruthy()
    expect(find('edit.paste')?.disabledReason).toBe('剪贴板为空')
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

  it('OpenSpec: editor-preferences / 可配置层级动作 / 命令面板执行层级动作', () => {
    const dispatch = dispatchSpy()
    const actions = createComposeEditorActions(context({ dispatch, selectedIds: ['a'] }))
    const bringForward = actions.find((action) => action.id === 'edit.bringForward')

    expect(bringForward?.title).toBe('前移一层')
    expect(bringForward?.disabledReason).toBeUndefined()
    bringForward?.run()
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'entity.move',
      payload: { entityIds: ['a'], parentId: null, index: 2 },
    }))

    const boundary = createComposeEditorActions(context({ selectedIds: ['b'] }))
      .find((action) => action.id === 'edit.bringForward')
    expect(boundary?.disabledReason).toBe('选中对象已位于目标层级或不可移动')
    const englishBoundary = createComposeEditorActions(context({
      locale: 'en-US',
      selectedIds: ['b'],
    })).find((action) => action.id === 'edit.bringForward')
    expect(englishBoundary?.title).toBe('Bring forward')
    expect(englishBoundary?.disabledReason).toBe(
      'Selected objects are already at the requested layer boundary or cannot be reordered',
    )
  })

  it('OpenSpec: editor-preferences / 编辑器动作目录 / 视口动作不进入历史', () => {
    const dispatch = dispatchSpy('noop')
    const zoomBy = vi.fn()
    const setTool = vi.fn()
    const actions = createComposeEditorActions(context({ dispatch, setTool, zoomBy }))

    actions.find((action) => action.id === 'stage.zoomIn')?.run()
    actions.find((action) => action.id === 'stage.drawContainerTool')?.run()

    expect(zoomBy).toHaveBeenCalledTimes(1)
    expect(setTool).toHaveBeenCalledWith('draw-container')
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

describe('createComposeEditorActionHandlers', () => {
  /**
   * 执行层只需要上下文的一个子集；完整上下文结构上满足它，多余字段不会被读取。
   * 这正是「执行不依赖界面语言」的形态化表达。
   */
  function handlerContext(
    overrides: Partial<ComposeEditorActionContext> = {},
  ): ComposeEditorActionHandlerContext {
    return context(overrides)
  }

  it('OpenSpec: editor-preferences / 动作执行与呈现分层 / 执行层不依赖界面语言', () => {
    const handlers = createComposeEditorActionHandlers(handlerContext())

    // 不可用状态用稳定标识表达，而不是本地化文案。
    expect(handlers['edit.group'].disabled).toBe('needsTwoEntities')
    expect(handlers['edit.delete'].disabled).toBe('noSelection')
    expect(handlers['history.undo'].disabled).toBe('nothingToUndo')
    expect(handlers['stage.zoomIn'].disabled).toBeUndefined()
  })

  it('OpenSpec: editor-preferences / 动作执行与呈现分层 / 呈现层复用执行层结论', () => {
    const shared = handlerContext({ selectedIds: ['a', 'b'] })
    const handlers = createComposeEditorActionHandlers(shared)
    const actions = createComposeEditorActions(context({ selectedIds: ['a', 'b'] }))

    const group = actions.find((action) => action.id === 'edit.group')
    expect(handlers['edit.group'].disabled).toBeUndefined()
    expect(group?.disabledReason).toBeUndefined()

    const single = createComposeEditorActionHandlers(handlerContext({ selectedIds: ['a'] }))
    expect(single['edit.group'].disabled).toBe('needsTwoEntities')
  })

  it('OpenSpec: editor-preferences / 动作执行与呈现分层 / 不可用动作不执行副作用', () => {
    const dispatch = dispatchSpy('noop')
    const handlers = createComposeEditorActionHandlers(handlerContext({ dispatch }))

    handlers['edit.delete'].run()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-preferences / 可配置复制剪切粘贴快捷键 / 使用默认平台复制键', () => {
    const copySelection = vi.fn()
    const pasteSelection = vi.fn()
    const actions = createComposeEditorActions(context({
      selectedIds: ['a'],
      canCopy: true,
      canCut: true,
      canPaste: true,
      copySelection,
      pasteSelection,
    }))
    const copy = actions.find((action) => action.id === 'edit.copy')
    const paste = actions.find((action) => action.id === 'edit.paste')

    expect(copy?.disabledReason).toBeUndefined()
    expect(copy?.shortcut).toEqual([{ code: 'KeyC', primary: true }])
    copy?.run()
    expect(copySelection).toHaveBeenCalledOnce()
    paste?.run()
    expect(pasteSelection).toHaveBeenCalledOnce()
  })

  it('OpenSpec: editor-preferences / 动作执行与呈现分层 / 键盘与命令面板共用执行', () => {
    const zoomBy = vi.fn()
    const handlers = createComposeEditorActionHandlers(handlerContext({ zoomBy }))

    handlers['stage.zoomIn'].run()
    expect(zoomBy).toHaveBeenCalledWith(1.2)
  })
})

describe('OpenSpec: editor-preferences / 编辑器动作可在命令行键入', () => {
  /** 目录里所有动作的 id，含宿主入口才产出的那两条。 */
  const catalogIds = () => byId(createComposeEditorActions(context({
    createComponent: () => {},
    openSettings: () => {},
    // 工作区动作只在接入了工作区会话时列出，与设置、创建组件同一条规则。
    workspace: {
      items: [{ id: 'page', title: '页面' }],
      currentId: 'page',
      switchTo: () => {},
      next: () => {},
      previous: () => {},
      focusCanvas: () => {},
      saveAs: () => {},
      reset: () => {},
    },
  })))

  it('键入别名执行动作', () => {
    const undo = vi.fn()
    const commands = createComposeEditorCommands(context({ canUndo: true, undo }))
    const registry = createComposeCommandRegistry(commands)

    const definition = registry.resolve('undo')
    expect(definition?.id).toBe('history.undo')
    // 退化会话：没有提示，一次确认就执行。
    const session = definition!.start({ messages: draftingMessages(), selection: [] })
    expect(session.prompt).toBeNull()
    session.advance({ kind: 'accept' })
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('不可用的动作把原因带进定义', () => {
    const commands = createComposeEditorCommands(context({ canUndo: false }))
    const undo = commands.find((command) => command.id === 'history.undo')
    expect(undo?.disabledReason).toBe('没有可撤销的操作')
  })

  it('别名不随界面语言改变，只有显示名改变', () => {
    const zh = createComposeEditorCommands(context({ locale: 'zh-CN' }))
    const en = createComposeEditorCommands(context({ locale: 'en-US' }))
    const pick = (list: typeof zh, id: string) => list.find((command) => command.id === id)

    expect(pick(zh, 'edit.group')?.aliases).toEqual(pick(en, 'edit.group')?.aliases)
    expect(pick(zh, 'edit.group')?.title).not.toBe(pick(en, 'edit.group')?.title)
  })

  it('不与画布命令抢词：工具切换与 edit.delete 不声明别名', () => {
    const commands = createComposeEditorCommands(context({ createComponent: () => {} }))
    /*
     * 这九条已经有等价的画布命令：八个工具切换与绘图命令是同一能力的两个入口
     * （`RECTANGLE` 这个词属于命令），`edit.delete` 则被 `ERASE`/`E` 严格覆盖——后者没选中
     * 时会提示选择对象。断言写在这里是为了挡住后来者顺手补上第二个词。
     */
    const withoutAlias = [
      'stage.selectTool',
      'stage.scaleTool',
      'stage.rotateTool',
      'stage.drawContainerTool',
      'stage.drawTextTool',
      'edit.delete',
    ]
    for (const id of withoutAlias) {
      expect(commands.find((command) => command.id === id)?.aliases).toBeUndefined()
    }
  })

  it('别名表只覆盖目录里真实存在的动作', () => {
    const ids = catalogIds()
    for (const id of Object.keys(COMPOSE_EDITOR_COMMAND_ALIASES)) {
      expect(ids).toContain(id)
    }
  })

  it('与内建绘图命令不重名，因此可以合成一份注册表', () => {
    const commands = createComposeEditorCommands(context({
      createComponent: () => {},
      openSettings: () => {},
    }))
    // 重名会让 `createComposeCommandRegistry` 抛错。这条断言把那次崩溃从「用户敲下那个词」
    // 提前到构建期。
    expect(() => createComposeCommandRegistry([
      ...createStageDraftingCommands(draftingMessages()),
      ...commands,
    ])).not.toThrow()
  })
})

/** 绘图命令只用到文案，这里给一份占位即可。 */
function draftingMessages() {
  return new Proxy({}, { get: (_target, key) => String(key) }) as never
}

describe('OpenSpec: editor-preferences / 文档级动作进入目录', () => {
  it('宿主未接文档会话时两条都整条省略', () => {
    const ids = byId(createComposeEditorActions(context()))
    expect(ids).not.toContain('document.save')
    expect(ids).not.toContain('document.toggleAnimationMode')
  })

  it('保存列出且可执行', () => {
    const saveDocument = vi.fn()
    const actions = createComposeEditorActions(context({
      saveDocument,
      canSaveDocument: true,
    }))
    const save = actions.find((action) => action.id === 'document.save')

    expect(save).toMatchObject({ title: '保存文档', disabledReason: undefined })
    save?.run()
    expect(saveDocument).toHaveBeenCalledOnce()
  })

  it('没有可保存的文档时说明原因，且 run 不产生副作用', () => {
    // 「列出来但按下没反应」与「敲错字」在屏幕上无法区分，因此这一档必须带原因。
    const saveDocument = vi.fn()
    const actions = createComposeEditorActions(context({
      saveDocument,
      canSaveDocument: false,
    }))
    const save = actions.find((action) => action.id === 'document.save')

    expect(save?.disabledReason).toBe('没有打开的文档')
    save?.run()
    expect(saveDocument).not.toHaveBeenCalled()
  })

  it('模式切换列出且可执行', () => {
    const toggleAnimationMode = vi.fn()
    const actions = createComposeEditorActions(context({ toggleAnimationMode }))
    const toggle = actions.find((action) => action.id === 'document.toggleAnimationMode')

    expect(toggle).toMatchObject({ title: '切换动画模式', disabledReason: undefined })
    toggle?.run()
    expect(toggleAnimationMode).toHaveBeenCalledOnce()
  })

  it('保存默认绑 Cmd/Ctrl+S，模式切换默认不绑键', () => {
    /*
     * 这一条钉的是「删掉标签条上那颗保存按钮」的前提：键位从硬接改成读键位表之后，默认值
     * 必须仍是 Cmd/Ctrl+S，否则用户会在没有任何提示的情况下失去保存。
     */
    const shortcuts = createDefaultComposeEditorPreferences().shortcuts
    expect(shortcuts['document.save']).toEqual([{ code: 'KeyS', primary: true }])
    expect(shortcuts['document.toggleAnimationMode']).toEqual([])
  })
})
