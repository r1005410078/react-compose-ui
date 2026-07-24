type StageToolbarIconName =
  | 'create-frame'
  | 'fit-frame'
  | 'fit-selection'
  | 'pan'
  | 'select'
  | 'zoom-in'
  | 'zoom-out'

interface StageToolbarIconProps {
  name: StageToolbarIconName
}

/**
 * Stage 工具栏使用内联描边图标，避免把图标库变成 editor 的运行时依赖。
 *
 * @internal
 */
export function StageToolbarIcon({ name }: StageToolbarIconProps) {
  const content = {
    'create-frame': (
      <>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    'fit-frame': (
      <>
        <rect height="12" rx="1" width="14" x="5" y="6" />
        <path d="M2.5 8V3.5H7M17 3.5h4.5V8M21.5 16v4.5H17M7 20.5H2.5V16" />
      </>
    ),
    'fit-selection': (
      <>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </>
    ),
    pan: (
      <>
        <path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M11.5 9V4.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M14.5 9V6a1.5 1.5 0 0 1 3 0v5" />
        <path d="M17.5 9.5a1.5 1.5 0 0 1 3 0v4.25C20.5 18.3 17.8 21 13.25 21H12c-2.35 0-4.1-1.1-5.5-3L3.8 14.2a1.65 1.65 0 0 1 2.55-2.05L8.5 14.5" />
      </>
    ),
    select: (
      <>
        <path d="m5 3 13 9-6.2 1.35L9 19Z" />
        <path d="m12 13.35 4.5 6" />
      </>
    ),
    'zoom-in': (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
      </>
    ),
    'zoom-out': (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M7.5 10.5h6" />
      </>
    ),
  } satisfies Record<StageToolbarIconName, React.ReactNode>

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {content[name]}
    </svg>
  )
}
