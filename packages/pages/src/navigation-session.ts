import { ComposeAssetError } from '@compose-ui/assets'
import type {
  ComposeNavigationIssue,
  ComposeNavigationPort,
  ComposeNavigationSnapshot,
  ComposePageLoader,
  ComposePageReference,
  JsonObject,
} from '@compose-ui/core'

/**
 * 返回栈上限。
 *
 * @remarks
 * 大屏运行时可能连续跳转数小时，无上限的栈会一直增长；50 足以覆盖任何真实的返回诉求，
 * 又把最坏情况的常驻引用数量限制在可忽略的规模。
 * @public
 */
export const COMPOSE_NAVIGATION_BACK_STACK_LIMIT = 50

/** {@link createComposeNavigationSession} 的输入。 @public */
export interface CreateComposeNavigationSessionOptions {
  /**
   * 页面加载端口。
   *
   * @remarks
   * 会话在提交切换**之前**用它验证目标可读，因此当前页面变化时目标一定已经可用，
   * 宿主不会先渲染一个空页再回退。加载本身仍然由端口承担，会话不读 Provider。
   */
  readonly loader: ComposePageLoader
  /** 构造页面引用时使用的 Provider ID。 */
  readonly providerId: string
  /** 构造页面引用时使用的持久性 scope。 @defaultValue 'persistent' */
  readonly scope?: ComposePageReference['scope']
  /** 应用清单中的首页 key；null 表示未设首页。 */
  readonly homePageKey?: string | null
  /** 覆盖首页的初始页面 key；宿主需要从非首页起步时使用。 */
  readonly initialPageKey?: string | null
  /** @defaultValue {@link COMPOSE_NAVIGATION_BACK_STACK_LIMIT} */
  readonly backStackLimit?: number
}

/** 可被宿主管理生命周期的导航会话。 @public */
export interface ComposeNavigationSession extends ComposeNavigationPort {
  /**
   * 更新首页指向。
   *
   * @remarks
   * 只影响后续构造，不改变当前页面——用户正在看的页面不应该因为别人改了首页而被换掉。
   */
  setHomePageKey(pageKey: string | null): void
  /** 跳转到当前首页；未设首页时是 no-op。 */
  navigateHome(): Promise<void>
  /** 停止接受后续跳转并清空订阅。 */
  dispose(): void
}

function sameTarget(left: ComposePageReference | null, right: ComposePageReference): boolean {
  return left !== null
    && left.providerId === right.providerId
    && left.assetKey === right.assetKey
}

function issueFor(reference: ComposePageReference, error: unknown): ComposeNavigationIssue {
  // Provider 的 not-found 是唯一能确定"目标不存在"的信号；其余一律算读取失败，
  // 因为把 IO 抖动报成"页面不存在"会诱导用户去改一个其实正确的引用。
  const missing = error instanceof ComposeAssetError && error.code === 'not-found'
  return {
    code: missing ? 'navigation.target-missing' : 'navigation.load-failed',
    reference,
    message: missing
      ? `找不到页面 ${reference.assetKey}`
      : `页面 ${reference.assetKey} 读取失败`,
    cause: error,
  }
}

/**
 * 创建无 React、无 DOM 的页面导航会话。
 *
 * @remarks
 * 会话只决定"当前应该是哪一页"：它不渲染、不执行脚本、不持有文档。声明式 `Interaction`
 * 与页面脚本的 `navigate` 必须共用同一个会话实例，否则两条路径会各自维护一份返回栈。
 *
 * @example
 * ```ts
 * const session = createComposeNavigationSession({
 *   loader: createComposePageLoader(store),
 *   providerId: store.providerId,
 *   homePageKey: catalog.homePageKey,
 * })
 * ```
 * @public
 */
export function createComposeNavigationSession(
  options: CreateComposeNavigationSessionOptions,
): ComposeNavigationSession {
  const { loader, providerId } = options
  const scope = options.scope ?? 'persistent'
  const backStackLimit = options.backStackLimit ?? COMPOSE_NAVIGATION_BACK_STACK_LIMIT
  const listeners = new Set<() => void>()

  let homePageKey = options.homePageKey ?? null
  let backStack: readonly ComposePageReference[] = []
  let current: ComposePageReference | null = null
  let issue: ComposeNavigationIssue | null = null
  let disposed = false
  // 单调递增的令牌：连续跳转时只有最后一次的结果可以提交，避免慢的那次覆盖快的那次。
  let token = 0

  const referenceOf = (pageKey: string): ComposePageReference => ({
    kind: 'page',
    providerId,
    assetKey: pageKey,
    scope,
  })

  const initialPageKey = options.initialPageKey ?? homePageKey
  if (initialPageKey !== null && initialPageKey.length > 0) {
    current = referenceOf(initialPageKey)
  }

  // 快照对象只在 publish 中重建，使状态未变化时 getSnapshot 返回同一引用。
  let snapshot: ComposeNavigationSnapshot = {
    currentPageKey: current?.assetKey ?? null,
    current,
    canGoBack: false,
    issue: null,
  }

  function publish() {
    snapshot = {
      currentPageKey: current?.assetKey ?? null,
      current,
      canGoBack: backStack.length > 0,
      issue,
    }
    listeners.forEach((listener) => listener())
  }

  function pushBack(reference: ComposePageReference) {
    const next = [...backStack, reference]
    backStack = next.length > backStackLimit ? next.slice(next.length - backStackLimit) : next
  }

  async function verify(reference: ComposePageReference): Promise<ComposeNavigationIssue | null> {
    try {
      await loader.load(reference)
      return null
    }
    catch (error) {
      return issueFor(reference, error)
    }
  }

  async function navigate(reference: ComposePageReference, _params?: JsonObject): Promise<void> {
    // params 是协议预留字段，v1 不消费；显式忽略以免读者以为漏了实现。
    void _params
    if (disposed) return
    if (sameTarget(current, reference)) return
    const ticket = ++token
    const failure = await verify(reference)
    if (disposed || ticket !== token) return
    if (failure) {
      issue = failure
      publish()
      return
    }
    if (current) pushBack(current)
    current = reference
    issue = null
    publish()
  }

  async function back(): Promise<void> {
    if (disposed || backStack.length === 0) return
    const ticket = ++token
    const target = backStack[backStack.length - 1]!
    const failure = await verify(target)
    if (disposed || ticket !== token) return
    if (failure) {
      // 弹出读不到的那一项：留着它会让返回按钮永久卡在同一个失败上，用户没有别的出路。
      backStack = backStack.slice(0, -1)
      issue = failure
      publish()
      return
    }
    backStack = backStack.slice(0, -1)
    current = target
    issue = null
    publish()
  }

  return {
    getSnapshot: () => snapshot,
    navigate,
    back,
    referenceFor: referenceOf,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setHomePageKey(pageKey) {
      homePageKey = pageKey
    },
    async navigateHome() {
      if (homePageKey === null || homePageKey.length === 0) return
      await navigate(referenceOf(homePageKey))
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
