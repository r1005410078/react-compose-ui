/**
 * 左栏上段那四个图标。
 *
 * @remarks
 * 只有**去处**有图标：四个不同性质的地方，图标回答「这是哪一类地方」。下段那八个是同一性质的
 * 八个值，给它们八个图标就是八个要学的记号，而名字与计数已经够了。
 *
 * 线宽 1.6、`viewBox` 24——与编辑器 chrome 里的 lucide 一致，两边切换时图标不换一套画法。
 * @internal
 */
function Icon({ children }: { readonly children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="compose-library__icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

/** @internal */
export function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.8" /></Icon>
}

/** @internal */
export function BriefcaseIcon() {
  return (
    <Icon>
      <rect height="12" rx="2" width="18" x="3" y="7" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12h18" />
    </Icon>
  )
}

/** @internal */
export function TemplateIcon() {
  return (
    <Icon>
      <rect height="7" rx="1.4" width="7" x="3.5" y="3.5" />
      <rect height="7" rx="1.4" width="7" x="13.5" y="3.5" />
      <rect height="7" rx="1.4" width="7" x="3.5" y="13.5" />
      <rect height="7" rx="1.4" width="7" x="13.5" y="13.5" />
    </Icon>
  )
}

/** @internal */
export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7" />
      <path d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
    </Icon>
  )
}
