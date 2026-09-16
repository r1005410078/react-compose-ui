import type { ComposeLibraryRecord } from '@compose-ui/library'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { InstantiateDialog } from '../instantiate-dialog'
import { LibraryDemoScreen } from '../demo-screen'
import { getLibraryMessages } from '../library-i18n'
import { LibraryRail } from '../library-rail'
import { LibraryToolbar } from '../library-toolbar'
import { LibraryWall, sectionizeLibraryRecords } from '../library-wall'
import type { ComposeLibraryBrowserProps } from './library-browser-types'
import { useLibraryView } from './use-library-view'

/**
 * 页面库。
 *
 * @remarks
 * 应用的入口那一屏。它回答的是**「这东西该怎么画」**——主区并排摆着同一类场景已经画过的各种
 * 画法，而真正的用法是当着客户翻：客户指中哪一张，就以那一张为底开始改。
 *
 * 布局是**它自己的**，不照抄编辑器：不分卡、不留沟槽、不设面板头，左栏与主区之间只有一条竖线，
 * 整屏带边框的东西只剩图自己。编辑器那套密度（每块一张卡、6px 沟槽、30px 卡头）是给同屏七八个
 * 面板抢空间用的，而首页只有两块内容、都不可停靠——照搬过来就是两块内容画四条边框。
 *
 * 与编辑器共享的只有**顶栏与配色**，那两样承担的是「这仍然是同一个应用」；左栏宽度不承担
 * 这句话。
 * @public
 */
export function ComposeLibraryBrowser({
  port,
  onOpenPage,
  onNewPage,
  pageSize = 48,
  renderPage,
  className,
}: ComposeLibraryBrowserProps & {
  /**
   * 把一页渲染成真实画面，用于全屏演示。
   *
   * @remarks
   * **由宿主注入**：它就是既有的只读 Preview。缺席即不提供演示入口——一个按下去什么都不发生的
   * 按钮比没有更差。
   */
  readonly renderPage?: (record: ComposeLibraryRecord) => ReactNode
}) {
  const i18n = useComposeI18nContext()
  const locale = i18n?.locale ?? 'zh-CN'
  const messages = getLibraryMessages(locale)
  const { state, patch, load, items, loadMore, retry } = useLibraryView(port, pageSize)
  const [instantiating, setInstantiating] = useState<ComposeLibraryRecord | null>(null)
  const [demoIndex, setDemoIndex] = useState<number | null>(null)

  const sections = useMemo(() => sectionizeLibraryRecords({
    items,
    categories: load.categories,
    categoryCounts: load.categoryCounts,
    uncategorizedLabel: messages.uncategorized,
    // 已经筛到某一类之后再画一个只有一段的段头，是同一句话说两遍。
    grouped: state.category === undefined && state.location !== 'recent',
  }), [items, load.categories, load.categoryCounts, messages.uncategorized, state.category, state.location])

  const onUse = port.instantiate === undefined
    ? undefined
    : (record: ComposeLibraryRecord) => setInstantiating(record)

  const empty = load.status === 'ready' && items.length === 0

  return (
    <div className={['compose-library', className].filter(Boolean).join(' ')}>
      <LibraryRail
        categories={load.categories}
        category={state.category}
        categoryCounts={load.categoryCounts}
        location={state.location}
        locationCounts={load.locationCounts}
        messages={messages}
        onCategoryChange={(category) => patch({ category })}
        onLocationChange={(location) => patch({ location, category: undefined })}
      />

      <div className="compose-library__main">
        <LibraryToolbar
          messages={messages}
          onDemo={renderPage === undefined || items.length === 0
            ? undefined
            : () => setDemoIndex(0)}
          onNewPage={onNewPage}
          onSearchChange={(search) => patch({ search })}
          onSortChange={(sort) => patch({ sort })}
          onViewChange={(view) => patch({ view })}
          search={state.search}
          sort={state.sort}
          view={state.view}
        />

        <div className="compose-library__scroll" data-view={state.view}>
          {load.status === 'failed' ? (
            <div className="compose-library__state" role="alert">
              <p>{messages.loadFailed}</p>
              <button className="compose-library__button" onClick={retry} type="button">
                {messages.retry}
              </button>
            </div>
          ) : empty ? (
            <p className="compose-library__state">
              {state.location === 'trash' ? messages.emptyTrash : messages.empty}
            </p>
          ) : (
            <>
              <LibraryWall
                locale={locale}
                messages={messages}
                onOpen={onOpenPage}
                onSeeAll={(category) => patch({ category })}
                onUse={onUse}
                port={port}
                sections={sections}
              />
              {load.nextCursor === null ? null : (
                <div className="compose-library__more">
                  <button
                    className="compose-library__button"
                    disabled={load.status === 'loading'}
                    onClick={loadMore}
                    type="button"
                  >
                    {load.status === 'loading' ? messages.loading : messages.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {instantiating === null ? null : (
        <InstantiateDialog
          messages={messages}
          onClose={() => setInstantiating(null)}
          onDone={(created) => {
            setInstantiating(null)
            setDemoIndex(null)
            // 落地即打开：客户就在旁边等着，多一步「去库里找到它再点开」没有任何信息。
            onOpenPage(created.pageKey)
          }}
          port={port}
          source={instantiating}
        />
      )}

      {demoIndex === null || renderPage === undefined ? null : (
        <LibraryDemoScreen
          index={Math.min(demoIndex, Math.max(0, items.length - 1))}
          messages={messages}
          onExit={() => setDemoIndex(null)}
          onIndexChange={setDemoIndex}
          onUse={onUse}
          records={items}
          renderPage={renderPage}
        />
      )}
    </div>
  )
}
