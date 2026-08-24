import { describe, expect, it } from 'vitest'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposePageStore } from '@compose-ui/pages'
import { getEditorMessages } from '../editor-i18n'
import { createDxfContextMenuItems } from './dxf-context-menu'

const messages = getEditorMessages('zh-CN')

function createItems(capabilities: { createFile: boolean }) {
  const provider = {
    capabilities: { ...capabilities },
    createFile: () => {},
  } as unknown as ComposeAssetProvider
  return createDxfContextMenuItems({
    componentStore: {} as ComposeComponentStore,
    idFactory: () => 'id',
    messages,
    onError: () => {},
    onNotice: () => {},
    onPageCreated: () => {},
    pageStore: {} as ComposePageStore,
    provider,
    registry: {} as ComposeEntityRegistry,
  })
}

describe('OpenSpec: dxf-import / 资源浏览器上的导入为页面', () => {
  it('只在 .dxf 上出现', () => {
    const [item] = createItems({ createFile: true })
    expect(item?.isVisible?.({ entry: { name: 'Topology.dxf' } } as never)).toBe(true)
    // 这一项对别的文件毫无意义，常驻只会让菜单更长。
    expect(item?.isVisible?.({ entry: { name: 'Home.page.json' } } as never)).toBe(false)
    expect(item?.isVisible?.({} as never)).toBe(false)
  })

  it('目录不支持创建文件时禁用而不是消失', () => {
    const [item] = createItems({ createFile: false })
    // 消失会让用户以为编辑器不支持 DXF，而实际原因是当前 Provider 只读。
    expect(item?.isDisabled?.({} as never)).toBe(true)
  })

  it('缺少任一 Store 时不提供菜单项', () => {
    expect(createDxfContextMenuItems({
      componentStore: null,
      idFactory: () => 'id',
      messages,
      onError: () => {},
      onNotice: () => {},
      onPageCreated: () => {},
      pageStore: {} as ComposePageStore,
      provider: { capabilities: {} } as unknown as ComposeAssetProvider,
      registry: {} as ComposeEntityRegistry,
    })).toHaveLength(0)
  })
})
