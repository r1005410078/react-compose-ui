import { describe, expect, it } from 'vitest'
import { formatComposeKeybinding, formatComposeKeybindings } from './keybinding-format'

const MAC = 'MacIntel'
const WINDOWS = 'Win32'

describe('平台格式化', () => {
  it('OpenSpec: commands / 无 React 无 DOM 的命令与键位包 / 格式化不读取平台全局', () => {
    // platform 必填，因此在没有 navigator 的 node 环境中同样得到确定结果。
    expect(formatComposeKeybinding({ code: 'KeyG', primary: true }, MAC)).toBe('⌘G')
    expect(formatComposeKeybinding({ code: 'KeyG', primary: true }, WINDOWS)).toBe('Ctrl+G')
  })

  it('修饰键顺序在两个平台上各自固定', () => {
    const binding = { code: 'KeyZ', primary: true, shift: true, alt: true }
    expect(formatComposeKeybinding(binding, MAC)).toBe('⌘⌥⇧Z')
    expect(formatComposeKeybinding(binding, WINDOWS)).toBe('Ctrl+Alt+Shift+Z')
  })

  it('特殊键与数字键有可读名称', () => {
    expect(formatComposeKeybinding({ code: 'BracketRight' }, WINDOWS)).toBe(']')
    expect(formatComposeKeybinding({ code: 'Digit0', primary: true }, WINDOWS)).toBe('Ctrl+0')
    expect(formatComposeKeybinding({ code: 'Escape' }, WINDOWS)).toBe('Esc')
  })

  it('多个替代键位以斜杠分隔，空列表得到空串', () => {
    expect(formatComposeKeybindings(
      [{ code: 'Delete' }, { code: 'Backspace' }],
      WINDOWS,
    )).toBe('Delete / Backspace')
    expect(formatComposeKeybindings([], WINDOWS)).toBe('')
    expect(formatComposeKeybindings(undefined, WINDOWS)).toBe('')
  })
})
