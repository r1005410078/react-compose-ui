import { describe, expect, it } from 'vitest'
import { getEditorMessages } from '../editor-i18n'
import { createDwgContextMenuItems } from './dwg-context-menu'

const messages = getEditorMessages('zh-CN')

function createItems(onNotice: (message: string) => void = () => {}) {
  return createDwgContextMenuItems({ messages, onNotice })
}

describe('OpenSpec: dwg-import / `.dwg` 不静默', () => {
  it('只在 .dwg 上出现', () => {
    const [item] = createItems()
    expect(item?.isVisible?.({ entry: { name: 'Feeder.dwg' } } as never)).toBe(true)
    // 这一项对别的文件毫无意义，常驻只会让菜单更长。
    expect(item?.isVisible?.({ entry: { name: 'Feeder.dxf' } } as never)).toBe(false)
    expect(item?.isVisible?.({} as never)).toBe(false)
  })

  it('不依赖任何 Store、Registry 或 Provider', () => {
    // 这一项在解码器缺席时始终是正确行为，因此不受任何能力缺失影响——它正是 DXF 那条
    // 「缺少 Store 就不提供菜单项」的反面。
    const [item] = createItems()
    expect(item).toBeDefined()
    expect(item?.isDisabled?.({} as never)).toBeFalsy()
  })

  it('选中之后给出可执行的下一步，而不只是声明不支持', () => {
    const notices: string[] = []
    const [item] = createItems((message) => notices.push(message))
    item?.onSelect({} as never)
    expect(notices).toHaveLength(1)
    // 用户此刻需要的不是导入，是知道下一步往哪走。
    expect(notices[0]).toContain('DXF')
    expect(notices[0]).toContain('ODA File Converter')
  })
})
