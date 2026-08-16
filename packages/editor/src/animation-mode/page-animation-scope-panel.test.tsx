import type { ComposeAssetProvider } from '@compose-ui/assets'
import type { ComposeAnimation, ComposePageAnimationReference } from '@compose-ui/core'
import { ComposePropertyPanelRoot } from '@compose-ui/property-panel'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageAnimationScopePanel } from './page-animation-scope-panel'

const animationEntry = {
  id: 'intro-file',
  parentId: 'root',
  name: 'Intro.animation.json',
  kind: 'file' as const,
  assetKey: 'animations/Intro.animation.json',
}

function providerFixture(): ComposeAssetProvider {
  return {
    id: 'memory',
    label: 'Assets',
    root: { id: 'root', parentId: null, name: 'Assets', kind: 'folder' },
    capabilities: {
      createFile: true,
      createFolder: false,
      rename: false,
      move: false,
      delete: false,
      write: true,
      reference: true,
    },
    list: vi.fn(async () => [animationEntry, {
      id: 'page',
      parentId: 'root',
      name: 'Home.page.json',
      kind: 'file' as const,
      assetKey: 'Home.page.json',
    }]),
    read: vi.fn(),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      assetKey: name,
      revision: '1',
    })),
    writeFile: vi.fn(),
  }
}

const boundReference: ComposePageAnimationReference = {
  providerId: 'memory',
  assetKey: 'animations/Intro.animation.json',
  scope: 'persistent',
}

const mirrorAnimation: ComposeAnimation = {
  id: 'intro',
  name: '入场',
  durationMs: 300,
  playbackMode: 'play-once',
}

function renderPanel({
  provider = providerFixture(),
  reference = null,
  animation = null,
}: {
  readonly provider?: ComposeAssetProvider
  readonly reference?: ComposePageAnimationReference | null
  readonly animation?: ComposeAnimation | null
} = {}) {
  const dispatch = vi.fn()
  const onAnimationChange = vi.fn(async () => undefined)
  const onError = vi.fn()
  let seq = 0
  // 组件是共享 Root 内的一个 Section：Root 提供分组 chrome、搜索与列宽。
  render(
    <ComposePropertyPanelRoot>
      <PageAnimationScopePanel
        animation={animation}
        dispatch={dispatch}
        idFactory={() => `id-${seq += 1}`}
        onAnimationChange={onAnimationChange}
        onError={onError}
        pageName="Home"
        pageParentId="root"
        provider={provider}
        reference={reference}
      />
    </ComposePropertyPanelRoot>,
  )
  return { dispatch, onAnimationChange, onError, provider }
}

afterEach(() => { cleanup() })

describe('PageAnimationScopePanel', () => {
  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 未绑定页面选择或快捷创建动画', async () => {
    const { onAnimationChange, provider } = renderPanel()

    const select = await screen.findByRole('combobox', { name: '动画文件' })
    expect(screen.getByText('未绑定')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Intro.animation.json' })).toBeInTheDocument()
    // 非动画后缀的条目不进入候选。
    expect(screen.queryByRole('option', { name: 'Home.page.json' })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'animations/Intro.animation.json' } })
    await waitFor(() => {
      expect(onAnimationChange).toHaveBeenCalledWith(boundReference)
    })

    fireEvent.click(screen.getByRole('button', { name: '快捷创建动画文件' }))
    await waitFor(() => {
      expect(provider.createFile).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 'root',
        name: 'Home.animation.json',
      }))
      expect(onAnimationChange).toHaveBeenLastCalledWith({
        providerId: 'memory',
        assetKey: 'Home.animation.json',
        scope: 'persistent',
      })
    })
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 已绑定页面编辑变量绑定', async () => {
    renderPanel({ reference: boundReference, animation: mirrorAnimation })

    // 已绑定：显示当前动画文件与播放控制绑定行。
    const select = await screen.findByRole('combobox', { name: '动画文件' })
    expect((select as HTMLSelectElement).value).toBe('animations/Intro.animation.json')
    expect(screen.getByText('播放')).toBeInTheDocument()
    expect(screen.getByText('当前时间')).toBeInTheDocument()
    expect(screen.queryByText('未绑定')).not.toBeInTheDocument()
  })

  it('OpenSpec: editor-workspace-layout / 画布动画绑定属性 / 取消关联不删除资源', async () => {
    const { onAnimationChange, provider } = renderPanel({
      reference: boundReference,
      animation: mirrorAnimation,
    })

    fireEvent.click(await screen.findByRole('button', { name: '更多动画绑定操作' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: '解除动画绑定' }))

    await waitFor(() => {
      expect(onAnimationChange).toHaveBeenCalledWith(null)
    })
    expect(provider.writeFile).not.toHaveBeenCalled()
  })

  it('OpenSpec: editor-workspace-layout / 空动画的创建引导 / 已绑定但镜像缺失时提示载入', async () => {
    renderPanel({ reference: boundReference, animation: null })
    expect(await screen.findByText('绑定的动画尚未载入')).toBeInTheDocument()
    expect(screen.queryByText('播放')).not.toBeInTheDocument()
  })
})
