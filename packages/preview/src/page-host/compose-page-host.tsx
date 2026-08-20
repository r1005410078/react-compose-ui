import type { ComposeNavigationPort, ComposePageDocumentLoader, ComposePageFile } from '@compose-ui/core'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { ComposePreview, type ComposePreviewProps } from '../compose-preview'

/** ComposePageHost 的可覆盖文案。 @public */
export interface ComposePageHostMessages {
  readonly loading: string
  readonly empty: string
  readonly loadFailed: string
  readonly navigationFailed: string
}

const DEFAULT_MESSAGES: ComposePageHostMessages = {
  loading: '正在加载页面…',
  empty: '未设置首页',
  loadFailed: '页面加载失败',
  navigationFailed: '跳转失败',
}

/** ComposePageHost 属性。 @public */
export interface ComposePageHostProps extends Omit<
  ComposePreviewProps,
  'defaultFrameId' | 'document' | 'navigation' | 'page'
> {
  /** 决定当前是哪一页的导航端口。 */
  readonly navigation: ComposeNavigationPort
  /** 按引用加载页面聚合的端口；宿主通常由页面 Store 派生。 */
  readonly pageLoader: ComposePageDocumentLoader
  /** 覆盖默认中文文案。 */
  readonly messages?: Partial<ComposePageHostMessages>
  /**
   * 当前页面变化回调。
   *
   * @remarks
   * 供需要读取当前页面文档的宿主使用（例如预览对话框要按当前页面列出场景）。
   * 加载中与失败时参数为 null。
   */
  readonly onPageChange?: (page: ComposePageFile | null, pageKey: string | null) => void
}

type PageState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly pageKey: string; readonly page: ComposePageFile }
  | { readonly status: 'error'; readonly error: unknown }

/**
 * 按导航会话渲染当前页面。
 *
 * @remarks
 * 宿主只做三件事：跟随导航端口决定当前页、用页面加载端口取回页面包装、把它交给
 * `ComposePreview` 渲染其 `activeFrameId` 指向的场景。它不持有返回栈，也不解析
 * `Interaction`——前者属于会话，后者由 `ComposePreview` 在渲染每个 Entity 时完成。
 *
 * 切页通过给 `ComposePreview` 换 `key` 实现整棵子树重挂载。这不是保险起见：页面 setup
 * 作用域按**脚本引用**去重，两个页面引用同一个 setup 脚本时不换 key 就会共享 State，
 * 违反"相同脚本资源不得隐式共享 State"。
 *
 * @public
 */
export function ComposePageHost({
  navigation,
  pageLoader,
  messages,
  onPageChange,
  ...previewProps
}: ComposePageHostProps) {
  const text = { ...DEFAULT_MESSAGES, ...messages }
  const snapshot = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot)
  const current = snapshot.current
  const [state, setState] = useState<PageState>({ status: 'idle' })
  // current 是每次发布都可能新建的对象；身份字符串才是"要不要重新加载"的判据。
  const requestKey = current ? `${current.providerId}:${current.assetKey}` : null
  // 渲染期 prev-adjust：目标一变就立刻进入 loading，不在 effect 里同步 setState，
  // 否则先渲染一帧仍然是旧页面的内容，再被 effect 推翻。
  const [requestedKey, setRequestedKey] = useState<string | null>(requestKey)
  if (requestedKey !== requestKey) {
    setRequestedKey(requestKey)
    setState(requestKey === null ? { status: 'idle' } : { status: 'loading' })
  }

  useEffect(() => {
    if (!current) return undefined
    const controller = new AbortController()
    let cancelled = false
    void pageLoader.load(current, controller.signal).then(
      (page) => {
        if (cancelled) return
        setState({ status: 'ready', pageKey: current.assetKey, page })
      },
      (error: unknown) => {
        if (cancelled) return
        setState({ status: 'error', error })
      },
    )
    return () => {
      cancelled = true
      controller.abort()
    }
    // requestKey 是目标的完整身份；会话因为别的原因发布快照时不应重新加载页面。
  }, [requestKey, pageLoader]) // eslint-disable-line react-hooks/exhaustive-deps

  const readyPage = state.status === 'ready' ? state.page : null
  const readyPageKey = state.status === 'ready' ? state.pageKey : null
  useEffect(() => {
    onPageChange?.(readyPage, readyPageKey)
    // onPageChange 由宿主提供，通常是内联函数；把它放进依赖会每次渲染都重跑。
  }, [readyPage, readyPageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 跳转失败是**非阻断**的：会话已经保证当前页面没有被换掉，因此这里继续渲染既有内容，
  // 只额外挂一条提示。把它做成整页错误会让一次点错的跳转吃掉用户正在看的画面。
  const issueBanner = snapshot.issue
    ? (
        <div data-testid="compose-page-host-navigation-issue" role="alert">
          {`${text.navigationFailed}：${snapshot.issue.message}`}
        </div>
      )
    : null

  if (state.status === 'idle') {
    return (
      <section data-testid="compose-page-host-empty" role="status">
        {issueBanner}
        {text.empty}
      </section>
    )
  }
  if (state.status === 'loading') {
    return (
      <section aria-busy="true" data-testid="compose-page-host-loading" role="status">
        {issueBanner}
        {text.loading}
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section data-testid="compose-page-host-error" role="alert">
        {issueBanner}
        {text.loadFailed}
      </section>
    )
  }
  return (
    <>
      {issueBanner}
      <ComposePreview
        {...previewProps}
        defaultFrameId={state.page.activeFrameId}
        document={state.page.document}
        key={state.pageKey}
        navigation={navigation}
        page={state.page}
        pageLoader={pageLoader}
      />
    </>
  )
}
