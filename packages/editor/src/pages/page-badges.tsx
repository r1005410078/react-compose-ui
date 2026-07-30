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
