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
 * 与普通文件图标区分：页面是一份可编辑的文档，而不是任意资源。判定依据是 Provider 上报的
 * 媒体类型，因此重命名不会让它退回普通文件图标。
 * @internal
 */
export function PageEntryIcon({ label }: { readonly label: string }) {
  return (
    <svg
      aria-label={label}
      className="compose-editor__page-entry-icon"
      role="img"
      viewBox="0 0 16 16"
    >
      <path d="M3 1.75h7l3 3v9.5H3z" fill="none" stroke="currentColor" />
      <path d="M10 1.75v3h3" fill="none" stroke="currentColor" />
      <path d="M5 7.5h6M5 10h4" fill="none" stroke="currentColor" opacity=".75" />
    </svg>
  )
}
