import {
  createComposeAnimationFile,
  getComposeAnimationFileFrame,
  serializeComposeAnimationFile,
  setComposeAnimationFileFrame,
} from '@compose-ui/animation'
import { ComposeAssetError, type ComposeAssetProvider } from '@compose-ui/assets'
import { describe, expect, it, vi } from 'vitest'
import {
  createPageAnimationFile,
  loadPageAnimation,
  writePageAnimationFile,
} from './animation-asset-store'

const SCENE_A = 'frame-root'
const SCENE_B = 'frame-2'

const animationEntry = {
  id: 'intro-file',
  parentId: 'root',
  name: 'Intro.animation.json',
  kind: 'file' as const,
  assetKey: 'animations/Intro.animation.json',
  revision: 'a1',
}

const fileText = serializeComposeAnimationFile(createComposeAnimationFile(SCENE_A, {
  id: 'intro',
  name: '入场',
  durationMs: 500,
  playbackMode: 'loop',
}))

function providerFixture(overrides: Partial<ComposeAssetProvider> = {}): ComposeAssetProvider {
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
    list: vi.fn(async () => [animationEntry]),
    read: vi.fn(async () => ({ blob: new Blob([fileText]), revision: 'a1' })),
    createFile: vi.fn(async ({ parentId, name }) => ({
      id: `created-${name}`,
      parentId,
      name,
      kind: 'file' as const,
      assetKey: name,
      revision: '1',
    })),
    writeFile: vi.fn(async ({ fileId }) => ({ ...animationEntry, id: fileId, revision: 'a2' })),
    ...overrides,
  }
}

describe('animation-asset-store', () => {
  it('按引用在页面同目录读取并解析动画文件', async () => {
    const provider = providerFixture()
    const snapshot = await loadPageAnimation(provider, 'root', {
      providerId: 'memory',
      assetKey: 'animations/Intro.animation.json',
      scope: 'persistent',
    })
    expect(snapshot.entryId).toBe('intro-file')
    expect(snapshot.revision).toBe('a1')
    expect(getComposeAnimationFileFrame(snapshot.file, SCENE_A)[0])
      .toMatchObject({ id: 'intro', durationMs: 500 })
  })

  it('动画文件缺失按 not-found 报告，内容不合法按 io 报告', async () => {
    const missing = providerFixture({ list: vi.fn(async () => []) })
    await expect(loadPageAnimation(missing, 'root', {
      providerId: 'memory',
      assetKey: 'animations/Intro.animation.json',
      scope: 'persistent',
    })).rejects.toMatchObject({ code: 'not-found' })

    const corrupt = providerFixture({
      read: vi.fn(async () => ({ blob: new Blob(['{not json']), revision: 'a1' })),
    })
    await expect(loadPageAnimation(corrupt, 'root', {
      providerId: 'memory',
      assetKey: 'animations/Intro.animation.json',
      scope: 'persistent',
    })).rejects.toMatchObject({ code: 'io' })
  })

  it('创建动画文件在名称冲突时追加序号重试', async () => {
    const createFile = vi.fn(async ({ parentId, name }: { parentId: string; name: string }) => {
      if (name === 'Home.animation.json') {
        throw new ComposeAssetError('conflict', 'exists')
      }
      return {
        id: `created-${name}`,
        parentId,
        name,
        kind: 'file' as const,
        assetKey: name,
        revision: '1',
      }
    })
    const provider = providerFixture({ createFile })
    const { entry, file } = await createPageAnimationFile(provider, 'root', 'Home', SCENE_B, {
      id: 'anim-1',
      name: '动画 1',
    })
    expect(entry.name).toBe('Home 2.animation.json')
    // 新建的清单落在指定场景的分区里。
    expect(getComposeAnimationFileFrame(file, SCENE_B)[0]?.id).toBe('anim-1')
    expect(getComposeAnimationFileFrame(file, SCENE_A)).toEqual([])
  })

  it('创建的动画文件缺少稳定 assetKey 时按 unsupported 报告', async () => {
    const provider = providerFixture({
      createFile: vi.fn(async ({ parentId, name }) => ({
        id: `created-${name}`,
        parentId,
        name,
        kind: 'file' as const,
      })),
    })
    await expect(createPageAnimationFile(provider, 'root', 'Home', SCENE_A, { id: 'a', name: 'A' }))
      .rejects.toMatchObject({ code: 'unsupported' })
  })

  it('回写整份文件使用乐观并发并保留其他场景的分区', async () => {
    const provider = providerFixture()
    const merged = setComposeAnimationFileFrame(
      createComposeAnimationFile(SCENE_A, {
        id: 'intro',
        name: '入场',
        durationMs: 800,
        playbackMode: 'loop',
      }),
      SCENE_B,
      [{ id: 'outro', name: '退场', durationMs: 400, playbackMode: 'play-once' }],
    )
    const result = await writePageAnimationFile(provider, 'intro-file', merged, 'a1')
    expect(result.revision).toBe('a2')
    const writeFile = provider.writeFile as ReturnType<typeof vi.fn>
    const input = writeFile.mock.calls[0]?.[0] as { expectedRevision: string; content: Blob }
    expect(input.expectedRevision).toBe('a1')
    const written = JSON.parse(await input.content.text()) as {
      kind: string
      frames: Record<string, { id: string }[]>
    }
    expect(written.kind).toBe('compose-animation')
    expect(written.frames[SCENE_A]?.[0]?.id).toBe('intro')
    expect(written.frames[SCENE_B]?.[0]?.id).toBe('outro')
  })
})
