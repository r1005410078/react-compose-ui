import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const sharedProps = {
  'aria-hidden': true,
  fill: 'none',
  focusable: false,
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.7,
  viewBox: '0 0 24 24',
} as const

export function SearchIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  )
}

export function FilterIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M3.5 5h17l-6.4 7.3v5.6l-4.2 2v-7.6L3.5 5Z" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4M18.5 18.5l-1.4-1.4M6.9 6.9 5.5 5.5" />
      <circle cx="12" cy="12" r="7.2" />
    </svg>
  )
}

export function ChevronIcon({ expanded, ...props }: IconProps & { expanded: boolean }) {
  return (
    <svg {...sharedProps} {...props} viewBox="0 0 16 16">
      <path d={expanded ? 'm3.5 6 4.5 4.5L12.5 6' : 'm6 3.5 4.5 4.5L6 12.5'} />
    </svg>
  )
}

export function ResetIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M4.2 8.4V4.2l3.2 2.5" />
      <path d="M5.2 6.5A8 8 0 1 1 4 14" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ArrowIcon({ direction, ...props }: IconProps & { direction: 'up' | 'down' }) {
  return (
    <svg {...sharedProps} {...props}>
      <path d={direction === 'up' ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6'} />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}
