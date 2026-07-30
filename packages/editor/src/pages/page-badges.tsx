/** 首页标记。 @internal */
export function HomePageBadge({ label }: { readonly label: string }) {
  return (
    <svg
      aria-label={label}
      className="compose-editor__home-page-badge"
      role="img"
      viewBox="0 0 16 16"
    >
      <path
        d="M8 1.75 10 6l4.5.6-3.3 3.1.8 4.5L8 12.1l-4 2.1.8-4.5L1.5 6.6 6 6z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * 页面条目图标。
 *
 * @remarks
 * 页面的语义是「由若干组件组装成的一屏」，因此用外框加内部若干组装块表达，而不是普通文档
 * 图标。判定依据是 Provider 上报的媒体类型，因此重命名不会让它退回普通文件图标。
 *
 * `surface` 决定尺寸：目录网格的缩略图区域远大于文件树行，同一个 15px 图标在网格里会小到
 * 看不清。
 * @internal
 */
export function PageEntryIcon({
  label,
  surface,
}: {
  readonly label: string
  readonly surface: 'tree' | 'grid'
}) {
  return (
    <svg
      aria-label={label}
      className={`compose-editor__page-entry-icon compose-editor__page-entry-icon--${surface}`}
      role="img"
      viewBox="0 0 24 24"
    >
      {/* 外框：一屏的边界 */}
      <rect
        height="18"
        rx="2.5"
        stroke="currentColor"
        width="18"
        x="3"
        y="3"
        fill="none"
      />
      {/* 内部组装块：左上大块、右上小块、底部通栏 */}
      <rect fill="currentColor" height="6" opacity=".9" rx="1" width="7" x="6" y="6" />
      <rect fill="currentColor" height="6" opacity=".55" rx="1" width="5" x="14" y="6" />
      <rect fill="currentColor" height="4" opacity=".75" rx="1" width="13" x="6" y="14" />
    </svg>
  )
}
