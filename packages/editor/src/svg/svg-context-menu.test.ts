import { describe, expect, it } from 'vitest'
import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeComponentStore } from '@compose-ui/component-library'
import type { ComposeEntityRegistry } from '@compose-ui/component-registry'
import { getEditorMessages } from '../editor-i18n'
import { createSvgContextMenuItems } from './svg-context-menu'

const messages = getEditorMessages('zh-CN')

function createItems(capabilities: { createFile: boolean }) {
  const provider = {
    capabilities: { ...capabilities },
    createFile: () => {},
  } as unknown as ComposeAssetProvider
  return createSvgContextMenuItems({
    componentStore: {} as ComposeComponentStore,
    idFactory: () => 'id',
    messages,
    onComponentCreated: () => {},
    onError: () => {},
    onNotice: () => {},
    provider,
    registry: {} as ComposeEntityRegistry,
  })
}

describe('OpenSpec: svg-import / 资源浏览器上的导入为组件', () => {
  it('只在 .svg 上出现', () => {
    const [item] = createItems({ createFile: true })
    expect(item?.isVisible?.({ entry: { name: 'disconnector.svg' } } as never)).toBe(true)
    // 这一项对别的文件毫无意义，常驻只会让菜单更长。
    expect(item?.isVisible?.({ entry: { name: 'Topology.dxf' } } as never)).toBe(false)
    expect(item?.isVisible?.({} as never)).toBe(false)
  })

  it('目录不支持创建文件时禁用而不是消失', () => {
    const [item] = createItems({ createFile: false })
    // 消失会让用户以为编辑器不支持 SVG，而实际原因是当前 Provider 只读。
    expect(item?.isDisabled?.({} as never)).toBe(true)
  })

  it('缺少组件 Store 时不提供菜单项', () => {
    expect(createSvgContextMenuItems({
      componentStore: null,
      idFactory: () => 'id',
      messages,
      onComponentCreated: () => {},
      onError: () => {},
      onNotice: () => {},
      provider: { capabilities: {} } as unknown as ComposeAssetProvider,
      registry: {} as ComposeEntityRegistry,
    })).toHaveLength(0)
  })
})
