import { describe, expect, it } from 'vitest'
import {
  formatComposeKeybinding,
  formatComposeKeybindings,
} from './keybinding'

describe('Compose context menu keybinding formatting', () => {
  it('formats primary modifiers for macOS and other platforms', () => {
    const binding = { code: 'Equal', primary: true, shift: true }

    expect(formatComposeKeybinding(binding, 'MacIntel')).toBe('⌘⇧=')
    expect(formatComposeKeybinding(binding, 'Win32')).toBe('Ctrl+Shift+=')
  })

  it('keeps every active alternative and hides an empty shortcut list', () => {
    expect(formatComposeKeybindings([
      { code: 'KeyZ', primary: true, shift: true },
      { code: 'KeyY', control: true },
    ], 'Win32')).toBe('Ctrl+Shift+Z / Ctrl+Y')
    expect(formatComposeKeybindings([], 'MacIntel')).toBe('')
    expect(formatComposeKeybindings(undefined, 'MacIntel')).toBe('')
  })
})
