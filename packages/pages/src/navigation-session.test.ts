import { ComposeAssetError } from '@compose-ui/assets'
import type { ComposePageFile, ComposePageLoader, ComposePageReference } from '@compose-ui/core'
import { describe, expect, it, vi } from 'vitest'
import { createComposeNavigationSession } from './navigation-session'

const PROVIDER_ID = 'demo'

function reference(assetKey: string): ComposePageReference {
  return { kind: 'page', providerId: PROVIDER_ID, assetKey, scope: 'persistent' }
}

/** 只关心"能不能读到"，因此返回值用最小占位——会话不消费页面内容。 */
const PAGE = {} as ComposePageFile

function loaderOf(available: Iterable<string>, failures: Record<string, unknown> = {}): ComposePageLoader {
  const keys = new Set(available)
  return {
    async load(target) {
      const failure = failures[target.assetKey]
      if (failure !== undefined) throw failure
      if (!keys.has(target.assetKey)) {
        throw new ComposeAssetError('not-found', `缺少 ${target.assetKey}`)
      }
      return PAGE
    },
  }
}

describe('导航会话构造', () => {
  it('OpenSpec: 从首页起步 / 按首页起步', () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['home', 'detail']),
      providerId: PROVIDER_ID,
      homePageKey: 'home',
    })
    const snapshot = session.getSnapshot()
    expect(snapshot.currentPageKey).toBe('home')
    expect(snapshot.current).toEqual(reference('home'))
    expect(snapshot.canGoBack).toBe(false)
  })

  it('OpenSpec: 从首页起步 / 未设首页', () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['detail']),
      providerId: PROVIDER_ID,
      homePageKey: null,
    })
    expect(session.getSnapshot().currentPageKey).toBeNull()
    expect(session.getSnapshot().current).toBeNull()
  })

  it('宿主可用 initialPageKey 覆盖首页', () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['home', 'detail']),
      providerId: PROVIDER_ID,
      homePageKey: 'home',
      initialPageKey: 'detail',
    })
    expect(session.getSnapshot().currentPageKey).toBe('detail')
  })

  it('OpenSpec: 无 React 的导航会话 / 在无 DOM 环境构造会话', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['home', 'detail']),
      providerId: PROVIDER_ID,
      homePageKey: 'home',
    })
    await session.navigate(reference('detail'))
    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('home')
  })
})

describe('跳转与返回栈', () => {
  it('OpenSpec: 跳转与返回栈 / 跳转后返回', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'b']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('b'))
    expect(session.getSnapshot().currentPageKey).toBe('b')
    expect(session.getSnapshot().canGoBack).toBe(true)

    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('a')
    expect(session.getSnapshot().canGoBack).toBe(false)
  })

  it('OpenSpec: 跳转与返回栈 / 空栈返回', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const before = session.getSnapshot()
    await session.back()
    expect(session.getSnapshot()).toBe(before)
  })

  it('OpenSpec: 跳转与返回栈 / 跳转到当前页面', async () => {
    const load = vi.fn(async () => PAGE)
    const session = createComposeNavigationSession({
      loader: { load },
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const before = session.getSnapshot()
    await session.navigate(reference('a'))
    expect(session.getSnapshot()).toBe(before)
    expect(session.getSnapshot().canGoBack).toBe(false)
    // no-op 必须在验证之前短路，否则每次点同一个跳转都会读一次页面。
    expect(load).not.toHaveBeenCalled()
  })

  it('OpenSpec: 跳转与返回栈 / 返回栈有上限', async () => {
    const keys = ['p0', 'p1', 'p2', 'p3', 'p4']
    const session = createComposeNavigationSession({
      loader: loaderOf(keys),
      providerId: PROVIDER_ID,
      homePageKey: 'p0',
      backStackLimit: 2,
    })
    for (const key of ['p1', 'p2', 'p3', 'p4']) await session.navigate(reference(key))
    // 上限 2：栈里只剩最近两次离开的页面，最旧的被丢弃。
    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('p3')
    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('p2')
    expect(session.getSnapshot().canGoBack).toBe(false)
  })
})

describe('目标不可解析', () => {
  it('OpenSpec: 目标不可解析时的稳定失败 / 目标页面已被删除', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('gone'))
    const snapshot = session.getSnapshot()
    expect(snapshot.currentPageKey).toBe('a')
    expect(snapshot.issue?.code).toBe('navigation.target-missing')
    expect(snapshot.issue?.reference).toEqual(reference('gone'))
  })

  it('OpenSpec: 目标不可解析时的稳定失败 / 目标读取失败', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'broken'], { broken: new ComposeAssetError('io', '磁盘错误') }),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('broken'))
    const snapshot = session.getSnapshot()
    expect(snapshot.currentPageKey).toBe('a')
    expect(snapshot.issue?.code).toBe('navigation.load-failed')
  })

  it('成功跳转清空上一次的 issue', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'b']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('gone'))
    expect(session.getSnapshot().issue).not.toBeNull()
    await session.navigate(reference('b'))
    expect(session.getSnapshot().issue).toBeNull()
  })

  it('返回目标读不到时弹出该项，避免返回按钮永久卡住', async () => {
    const keys = new Set(['a', 'b', 'c'])
    const session = createComposeNavigationSession({
      loader: {
        async load(target) {
          if (!keys.has(target.assetKey)) {
            throw new ComposeAssetError('not-found', `缺少 ${target.assetKey}`)
          }
          return PAGE
        },
      },
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('b'))
    await session.navigate(reference('c'))
    keys.delete('b')

    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('c')
    expect(session.getSnapshot().issue?.code).toBe('navigation.target-missing')
    expect(session.getSnapshot().canGoBack).toBe(true)

    await session.back()
    expect(session.getSnapshot().currentPageKey).toBe('a')
  })
})

describe('订阅与生命周期', () => {
  it('OpenSpec: 无 React 的导航会话 / 订阅当前页面变化', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'b', 'c']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)
    await session.navigate(reference('b'))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().currentPageKey).toBe('b')

    unsubscribe()
    await session.navigate(reference('c'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('状态未变化时 getSnapshot 返回同一引用', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'b']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    expect(session.getSnapshot()).toBe(session.getSnapshot())
    await session.navigate(reference('b'))
    const after = session.getSnapshot()
    expect(session.getSnapshot()).toBe(after)
  })

  it('只有最后一次跳转的结果可以提交', async () => {
    const gates = new Map<string, () => void>()
    const session = createComposeNavigationSession({
      loader: {
        load: (target) => new Promise((resolve) => {
          gates.set(target.assetKey, () => resolve(PAGE))
        }),
      },
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const slow = session.navigate(reference('slow'))
    const fast = session.navigate(reference('fast'))
    gates.get('fast')!()
    await fast
    gates.get('slow')!()
    await slow
    // 慢的那次先发起、后完成，但它的结果必须被丢弃。
    expect(session.getSnapshot().currentPageKey).toBe('fast')
  })

  it('navigateHome 跳回当前首页', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a', 'b']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('b'))
    await session.navigateHome()
    expect(session.getSnapshot().currentPageKey).toBe('a')

    // 改首页不改变当前页面：用户正在看的页面不应该被别人的设置换掉。
    session.setHomePageKey('b')
    expect(session.getSnapshot().currentPageKey).toBe('a')
    await session.navigateHome()
    expect(session.getSnapshot().currentPageKey).toBe('b')
  })
})

describe('OpenSpec: 会话起点重置', () => {
  it('重置到正在编辑的页面', async () => {
    const load = vi.fn(async () => PAGE)
    const session = createComposeNavigationSession({
      loader: { load },
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('b'))
    await session.navigate(reference('c'))
    expect(session.getSnapshot().canGoBack).toBe(true)

    const before = load.mock.calls.length
    session.reset('editing')

    expect(session.getSnapshot().currentPageKey).toBe('editing')
    expect(session.getSnapshot().canGoBack).toBe(false)
    // 重置不是跳转：它不验证目标，因此不产生任何读取。
    expect(load.mock.calls).toHaveLength(before)
  })

  it('重置清空失败说明', async () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    await session.navigate(reference('gone'))
    expect(session.getSnapshot().issue).not.toBeNull()

    session.reset('a')
    expect(session.getSnapshot().issue).toBeNull()
  })

  it('已经就位时不发布', () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const listener = vi.fn()
    session.subscribe(listener)
    session.reset('a')
    // 宿主每次打开预览都会调用一次，无谓的发布会白白重挂一次内容。
    expect(listener).not.toHaveBeenCalled()

    session.reset('b')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('重置到 null 回到无当前页面', () => {
    const session = createComposeNavigationSession({
      loader: loaderOf(['a']),
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    session.reset(null)
    expect(session.getSnapshot().currentPageKey).toBeNull()
    expect(session.getSnapshot().current).toBeNull()
  })

  it('重置后正在飞行的跳转结果被丢弃', async () => {
    let release: (() => void) | undefined
    const session = createComposeNavigationSession({
      loader: { load: () => new Promise((resolve) => { release = () => resolve(PAGE) }) },
      providerId: PROVIDER_ID,
      homePageKey: 'a',
    })
    const pending = session.navigate(reference('slow'))
    session.reset('editing')
    release!()
    await pending

    expect(session.getSnapshot().currentPageKey).toBe('editing')
  })
})
