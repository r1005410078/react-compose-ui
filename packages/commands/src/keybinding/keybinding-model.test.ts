import { describe, expect, it } from 'vitest'
import {
  findComposeKeybindingConflict,
  matchesComposeKeybinding,
  normalizeComposeKeybinding,
  normalizeComposeKeybindingMap,
  resolveComposeKeybindingAction,
  serializeComposeKeybinding,
} from './keybinding-model'
import type { ComposeKeyboardEventShape } from './keybinding-types'

function press(overrides: Partial<ComposeKeyboardEventShape> = {}): ComposeKeyboardEventShape {
  return {
    altKey: false,
    code: 'KeyG',
    ctrlKey: false,
    key: 'g',
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

describe('归一化与序列化', () => {
  it('OpenSpec: commands / 单一权威的键位定义 / 归一化拒绝非法组合', () => {
    expect(() => normalizeComposeKeybinding({ code: '  ' })).toThrow(/must not be empty/)
    expect(() => normalizeComposeKeybinding({ code: 'KeyZ', primary: true, control: true }))
      .toThrow(/primary and explicit Control/)
  })

  it('剔除假值修饰键，使书写差异不影响相等判定', () => {
    const withFalse = normalizeComposeKeybinding({ code: 'KeyG', shift: false, alt: false })
    const bare = normalizeComposeKeybinding({ code: 'KeyG' })
    expect(withFalse).toEqual(bare)
    expect(serializeComposeKeybinding(withFalse)).toBe(serializeComposeKeybinding(bare))
  })
})

describe('事件匹配', () => {
  it('primary 命中平台主修饰键，且不接受 Ctrl 与 Meta 同时按下', () => {
    const binding = { code: 'KeyG', primary: true }
    expect(matchesComposeKeybinding(press({ metaKey: true }), binding)).toBe(true)
    expect(matchesComposeKeybinding(press({ ctrlKey: true }), binding)).toBe(true)
    expect(matchesComposeKeybinding(press({ ctrlKey: true, metaKey: true }), binding)).toBe(false)
    expect(matchesComposeKeybinding(press(), binding)).toBe(false)
  })

  it('未要求 primary 时 Meta 必须为假', () => {
    // 否则 macOS 上的 ⌘G 会误命中无修饰键的 G。
    expect(matchesComposeKeybinding(press({ metaKey: true }), { code: 'KeyG' })).toBe(false)
    expect(matchesComposeKeybinding(press(), { code: 'KeyG' })).toBe(true)
  })

  it('缺少 code 的事件回退到按 key 推导键码', () => {
    expect(matchesComposeKeybinding(press({ code: '', key: 'g' }), { code: 'KeyG' })).toBe(true)
    expect(matchesComposeKeybinding(press({ code: '', key: '7' }), { code: 'Digit7' })).toBe(true)
    expect(matchesComposeKeybinding(press({ code: '', key: ' ' }), { code: 'Space' })).toBe(true)
  })
})

describe('动作到键位的共享映射', () => {
  const map = {
    'edit.group': [{ code: 'KeyG', primary: true }],
    'edit.ungroup': [{ code: 'KeyG', primary: true, shift: true }],
    'edit.delete': [{ code: 'Delete' }, { code: 'Backspace' }],
    'edit.disabled': [],
  } as const
  const order = ['edit.group', 'edit.ungroup', 'edit.delete', 'edit.disabled'] as const

  it('OpenSpec: commands / 动作到键位的共享映射 / 冲突检测', () => {
    expect(findComposeKeybindingConflict(
      map,
      'edit.delete',
      { code: 'KeyG', primary: true, shift: false },
      order,
    )).toBe('edit.group')
    // 自身不算冲突。
    expect(findComposeKeybindingConflict(map, 'edit.group', { code: 'KeyG', primary: true }, order))
      .toBeNull()
    // 候选集合表达作用域：不在集合里的动作不参与判定。
    expect(findComposeKeybindingConflict(map, 'edit.delete', { code: 'KeyG', primary: true }, ['edit.delete']))
      .toBeNull()
  })

  it('命中解析按给定顺序，先者胜出', () => {
    expect(resolveComposeKeybindingAction(map, press({ metaKey: true }), order)).toBe('edit.group')
    expect(resolveComposeKeybindingAction(map, press({ metaKey: true, shiftKey: true }), order))
      .toBe('edit.ungroup')
    expect(resolveComposeKeybindingAction(map, press({ code: 'Backspace', key: 'Backspace' }), order))
      .toBe('edit.delete')
    expect(resolveComposeKeybindingAction(map, press({ code: 'KeyQ', key: 'q' }), order)).toBeNull()
  })

  it('整表归一化会按序列化结果去重，且不修改入参', () => {
    const input = { 'edit.group': [{ code: 'KeyG', shift: false }, { code: 'KeyG' }] }
    const normalized = normalizeComposeKeybindingMap(input)
    expect(normalized['edit.group']).toEqual([{ code: 'KeyG' }])
    expect(input['edit.group']).toHaveLength(2)
  })
})
