import { describe, expect, it } from 'vitest'
import {
  createDefaultComposeEditorPreferences,
  findComposeEditorShortcutConflict,
  formatComposeEditorKeybinding,
  isComposeEditorKeybindingMatch,
  isEditableKeyboardTarget,
  normalizeComposeEditorKeybinding,
  normalizeComposeEditorPreferences,
  normalizeComposeEditorWorkspacePreferences,
} from './preferences'
import type { ComposeEditorPreferences } from './preferences'

describe('editor preferences', () => {
  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 使用实例内默认偏好', () => {
    const first = createDefaultComposeEditorPreferences()
    const second = createDefaultComposeEditorPreferences()

    expect(first).toMatchObject({ theme: 'dark', locale: 'zh-CN' })
    expect(first.shortcuts['stage.temporaryPan']).toEqual([{ code: 'Space' }])
    expect(first.shortcuts['editor.settings']).toEqual([
      { code: 'Comma', primary: true },
    ])
    expect(first.shortcuts['edit.delete']).toEqual([
      { code: 'Delete' },
      { code: 'Backspace' },
    ])
    expect(first.shortcuts['history.redo']).toEqual([
      { code: 'KeyZ', primary: true, shift: true },
      { code: 'KeyY', control: true },
    ])
    expect(first.shortcuts).not.toBe(second.shortcuts)
    expect(first.shortcuts['stage.temporaryPan'])
      .not.toBe(second.shortcuts['stage.temporaryPan'])
  })

  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 旧形状的偏好按默认补齐', () => {
    const defaults = createDefaultComposeEditorPreferences()
    expect(defaults.workspace).toEqual({
      lastUsed: 'page',
      byDocument: {},
      layouts: {},
      toolbars: {},
      palettes: {},
      custom: [],
    })
    // 工作区动作默认不绑键。
    expect(defaults.shortcuts['workspace.next']).toEqual([])
    expect(defaults.shortcuts['workspace.saveAs']).toEqual([])

    const legacy = { theme: 'dark', locale: 'zh-CN', shortcuts: defaults.shortcuts } as unknown as ComposeEditorPreferences
    expect(normalizeComposeEditorPreferences(legacy).workspace).toEqual(defaults.workspace)

    // 引用了不存在工作区的条目保留、形状不对的条目丢掉。
    const normalized = normalizeComposeEditorWorkspacePreferences({
      lastUsed: 'gone',
      byDocument: { 'memory:a': 'gone', 'memory:b': 42 },
      layouts: { gone: { kind: 'snapshot', format: 'dockview@7', data: {} }, bad: { nope: true } },
      custom: [
        { id: 'c1', title: '变电站', layout: { kind: 'snapshot', format: 'dockview@7', data: {} }, session: {} },
        { id: '', title: 'x' },
      ],
    })
    expect(normalized.lastUsed).toBe('gone')
    expect(normalized.byDocument).toEqual({ 'memory:a': 'gone' })
    expect(Object.keys(normalized.layouts)).toEqual(['gone'])
    expect(normalized.custom.map((workspace) => workspace.id)).toEqual(['c1'])
  })

  it('OpenSpec: editor-preferences / 实例级编辑器偏好 / 另存来的工作区带着两条货架', () => {
    /*
     * 归一化逐字段重建 custom 条目，因此**每加一个字段都要在这里抄一遍**。漏掉 `toolbar` 时
     * 另存为当场看着是对的，直到偏好走一趟归一化——那个工作区的工具栏退回目录全集，既不是它
     * 另存时的样子，也不是任何一条内建货架。判别性在于两条货架**都**断，只断一条时另一条
     * 漏掉照样绿。
     */
    const normalized = normalizeComposeEditorWorkspacePreferences({
      custom: [{
        id: 'c1',
        title: '接线现场',
        layout: { kind: 'snapshot', format: 'dockview@7', data: {} },
        session: {},
        toolbar: ['select', 'grid', 'LINE'],
        palette: { title: '现场物料', sections: [{ kind: 'presets', id: 'basics' }] },
      }],
    })
    expect(normalized.custom[0]).toMatchObject({
      toolbar: ['select', 'grid', 'LINE'],
      palette: { title: '现场物料' },
    })
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 重新绑定动作', () => {
    expect(normalizeComposeEditorKeybinding({
      alt: false,
      code: 'KeyP',
      primary: true,
      shift: false,
    })).toEqual({ code: 'KeyP', primary: true })

    const defaults = createDefaultComposeEditorPreferences()
    const normalized = normalizeComposeEditorPreferences({
      ...defaults,
      shortcuts: {
        ...defaults.shortcuts,
        'stage.temporaryPan': [{ code: 'KeyP', shift: true }],
      },
    })

    expect(normalized.shortcuts['stage.temporaryPan']).toEqual([
      { code: 'KeyP', shift: true },
    ])
  })

  it('OpenSpec: editor-preferences / 可配置复制剪切粘贴快捷键 / 规范化旧偏好', () => {
    const defaults = createDefaultComposeEditorPreferences()
    const legacyShortcuts = { ...defaults.shortcuts } as Record<string, unknown>
    delete legacyShortcuts['edit.copy']
    delete legacyShortcuts['edit.cut']
    delete legacyShortcuts['edit.paste']
    const normalized = normalizeComposeEditorPreferences({
      ...defaults,
      shortcuts: legacyShortcuts as unknown as typeof defaults.shortcuts,
    })

    expect(normalized.shortcuts['edit.copy']).toEqual([{ code: 'KeyC', primary: true }])
    expect(normalized.shortcuts['edit.cut']).toEqual([{ code: 'KeyX', primary: true }])
    expect(normalized.shortcuts['edit.paste']).toEqual([{ code: 'KeyV', primary: true }])
  })

  it('OpenSpec: editor-preferences / 可配置层级动作 / 规范化旧快捷键偏好', () => {
    const defaults = createDefaultComposeEditorPreferences()
    const legacyShortcuts = { ...defaults.shortcuts } as Record<string, unknown>
    delete legacyShortcuts['edit.bringForward']
    delete legacyShortcuts['edit.sendBackward']
    delete legacyShortcuts['edit.bringToFront']
    delete legacyShortcuts['edit.sendToBack']
    const normalized = normalizeComposeEditorPreferences({
      ...defaults,
      shortcuts: legacyShortcuts as unknown as typeof defaults.shortcuts,
    })

    expect(normalized.shortcuts['edit.bringForward']).toEqual([{ code: 'BracketRight' }])
    expect(normalized.shortcuts['edit.sendBackward']).toEqual([{ code: 'BracketLeft' }])
    expect(normalized.shortcuts['edit.bringToFront']).toEqual([
      { code: 'BracketRight', primary: true },
    ])
    expect(normalized.shortcuts['edit.sendToBack']).toEqual([
      { code: 'BracketLeft', primary: true },
    ])
  })

  it('matches primary with Command or Control and requires exact modifiers', () => {
    const binding = { code: 'Comma', primary: true } as const
    expect(isComposeEditorKeybindingMatch({
      altKey: false,
      code: 'Comma',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
    }, binding, 'MacIntel')).toBe(true)
    expect(isComposeEditorKeybindingMatch({
      altKey: false,
      code: 'Comma',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }, binding, 'Win32')).toBe(true)
    expect(isComposeEditorKeybindingMatch({
      altKey: false,
      code: 'Comma',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }, binding, 'MacIntel')).toBe(true)
    expect(isComposeEditorKeybindingMatch({
      altKey: false,
      code: 'Comma',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
    }, binding, 'Win32')).toBe(false)
  })

  it('formats bindings with platform glyphs and readable key names', () => {
    const binding = { code: 'Equal', primary: true, shift: true } as const
    expect(formatComposeEditorKeybinding(binding, 'MacIntel')).toBe('⌘⇧=')
    expect(formatComposeEditorKeybinding(binding, 'Win32')).toBe('Ctrl+Shift+=')
    expect(formatComposeEditorKeybinding({ code: 'Space' }, 'MacIntel')).toBe('Space')
  })

  it('OpenSpec: editor-preferences / 可配置绘制与变换工具快捷键 / 容器工具默认 F', () => {
    const defaults = createDefaultComposeEditorPreferences()
    expect(defaults.shortcuts['stage.drawContainerTool']).toEqual([{ code: 'KeyF' }])
    expect(defaults.shortcuts['stage.fitSelection']).toEqual([{ code: 'Digit2', shift: true }])
    expect(defaults.shortcuts['stage.fitContainer']).toEqual([{ code: 'KeyF', shift: true }])
    // F 让位之后不得与任何既有 stage 动作撞车。
    expect(findComposeEditorShortcutConflict(
      defaults.shortcuts,
      'stage.drawContainerTool',
      { code: 'KeyF' },
    )).toBeNull()
  })

  it('OpenSpec: editor-preferences / 可配置单次快捷键 / 拒绝同作用域冲突', () => {
    const defaults = createDefaultComposeEditorPreferences()
    expect(findComposeEditorShortcutConflict(
      defaults.shortcuts,
      'stage.drawContainerTool',
      { code: 'KeyV' },
    )).toBe('stage.selectTool')
    expect(findComposeEditorShortcutConflict(
      defaults.shortcuts,
      'history.undo',
      { code: 'KeyV' },
    )).toBeNull()
    expect(findComposeEditorShortcutConflict(
      defaults.shortcuts,
      'edit.sendBackward',
      { code: 'BracketRight' },
    )).toBe('edit.bringForward')
  })

  it('OpenSpec: editor-preferences / 快捷键输入隔离 / 文本编辑期间按导航键', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    const button = document.createElement('button')

    expect(isEditableKeyboardTarget(input)).toBe(true)
    expect(isEditableKeyboardTarget(textarea)).toBe(true)
    expect(isEditableKeyboardTarget(editable)).toBe(true)
    expect(isEditableKeyboardTarget(button)).toBe(false)
  })

  describe('OpenSpec: editor-preferences / 物料面板排法是编辑器偏好', () => {
    it('默认网格', () => {
      expect(createDefaultComposeEditorPreferences().palette.mode).toBe('grid')
    })

    it('存量偏好里缺这一段时补成网格', () => {
      const legacy = { ...createDefaultComposeEditorPreferences() } as Partial<ComposeEditorPreferences>
      delete (legacy as Record<string, unknown>).palette
      expect(normalizeComposeEditorPreferences(legacy as ComposeEditorPreferences).palette.mode).toBe('grid')
    })

    it('只认识两个值，别的一律回落网格', () => {
      const withMode = (mode: unknown) => normalizeComposeEditorPreferences({
        ...createDefaultComposeEditorPreferences(),
        palette: { mode },
      } as unknown as ComposeEditorPreferences).palette.mode
      expect(withMode('list')).toBe('list')
      expect(withMode('gallery')).toBe('grid')
      expect(withMode(undefined)).toBe('grid')
    })
  })
})
