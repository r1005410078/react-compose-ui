import type { ComposeLibraryPort, ComposeLibraryRecord } from '@compose-ui/library'
import type { ComposeLibraryMessages } from '../library-i18n'
import { useThumbnail } from './use-thumbnail'

function formatModified(modifiedAt: number, locale: string) {
  if (modifiedAt <= 0) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(modifiedAt))
}

/**
 * 缩略图还没生成时的占位。
 *
 * @remarks
 * 画一个空画板而不是留白或报错：缺一张图是**可见的降级**，而让保存因为一张缩略图失败是不可
 * 接受的，所以这一档一定会发生。它不带任何文字——那一格已经有标题了。
 * @internal
 */
function ThumbnailPlaceholder() {
  return (
    <svg
      aria-hidden="true"
      className="compose-library__tile-placeholder"
      preserveAspectRatio="none"
      viewBox="0 0 320 180"
    >
      <rect fill="currentColor" height="180" opacity="0.06" width="320" />
      <g fill="none" opacity="0.28" stroke="currentColor" strokeWidth="1.4">
        <rect height="64" rx="3" width="112" x="104" y="58" />
        <path d="M104 106l30-24 24 18 22-16 36 26" />
      </g>
    </svg>
  )
}

/**
 * 一块图。
 *
 * @remarks
 * **不套卡片。**这一屏里唯一有决定性的东西是图；再给它套一个盒、在盒下面留一块文字区，等于用
 * 两层 chrome 去托一张图。名称与「用过多少次」因此压在图的底边上，靠一层渐变压住线条——
 * 接线图是细红线，压不住时标题读不出来。
 *
 * **常驻只有名称与使用次数。**同一类里尺寸几乎总是一样，逐行 `1920 × 1080` 一字不差等于没写；
 * 它与修改时间退到 hover。使用次数为 0 时不写，那一行的空缺本身也是信息。
 *
 * 两颗按钮在静息时**透明且不吃指针**，但**仍在 Tab 序里**：用 `visibility: hidden` 会让它们
 * 根本聚焦不到，而键盘用户没有 hover 这条路。聚焦其中任何一颗都会让整块图进入 `:focus-within`，
 * 于是遮罩显形——与鼠标 hover 是同一条呈现。
 * @internal
 */
export function LibraryTile({
  record,
  port,
  messages,
  locale,
  onOpen,
  onUse,
}: {
  readonly record: ComposeLibraryRecord
  readonly port: ComposeLibraryPort
  readonly messages: ComposeLibraryMessages
  readonly locale: string
  readonly onOpen: (pageKey: string) => void
  readonly onUse: ((record: ComposeLibraryRecord) => void) | undefined
}) {
  const source = useThumbnail(port, record)
  const modified = formatModified(record.modifiedAt, locale)
  const size = record.width !== null && record.height !== null
    ? `${record.width} × ${record.height}`
    : ''
  const dim = [size, modified].filter((part) => part !== '').join(' · ')

  return (
    <li className="compose-library__tile">
      {source === null
        ? <ThumbnailPlaceholder />
        : <img alt="" className="compose-library__tile-image" src={source} />}

      <div className="compose-library__tile-cap">
        <b>{record.title}</b>
        {record.useCount > 0
          ? <span className="compose-library__tile-uses">{messages.usedTimes(record.useCount)}</span>
          : null}
      </div>

      <div className="compose-library__tile-veil">
        <div className="compose-library__tile-actions">
          {onUse === undefined ? null : (
            <button
              aria-label={messages.useNamed(record.title)}
              className="compose-library__button compose-library__button--primary"
              onClick={() => onUse(record)}
              type="button"
            >
              {messages.use}
            </button>
          )}
          <button
            aria-label={messages.openNamed(record.title)}
            className="compose-library__button"
            onClick={() => onOpen(record.pageKey)}
            type="button"
          >
            {messages.open}
          </button>
        </div>
        {dim === '' ? null : <span className="compose-library__tile-dim">{dim}</span>}
      </div>
    </li>
  )
}
