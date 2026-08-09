import * as ScriptRuntime from './index'
import { describe, expect, it } from 'vitest'

describe('OpenSpec: editor-workspace-layout / 页面 Setup JavaScript 智能编辑 / 编辑标准 Setup 导出', () => {
  it('公开与 Runtime Context 同步的隐藏类型声明', () => {
    const declarations = (ScriptRuntime as Readonly<Record<string, unknown>>)
      .COMPOSE_PAGE_SCRIPT_TYPE_DECLARATIONS

    expect(declarations).toBeTypeOf('string')
    expect(declarations).toContain('interface ComposeState<T>')
    expect(declarations).toContain('interface ComposeComputed<T>')
    expect(declarations).toContain('interface ComposePageScriptContext')
    expect(declarations).toContain('type ComposePageSetup')
    expect(declarations).toContain('state<T>(initial: T): ComposeState<T>')
    expect(declarations).toContain('computed<T>(read: () => T): ComposeComputed<T>')
    expect(declarations).toContain('effect(run: () => void | (() => void)): void')
    expect(declarations).toContain('创建可读写的响应式状态')
    expect(declarations).toContain('创建只读派生值')
    expect(declarations).toContain('注册响应式副作用')
    expect(declarations).toContain('示例：')
    expect(declarations).toContain('```javascript')
    expect(declarations).toContain('cleanup')
  })
})
