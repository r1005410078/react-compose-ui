import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function PlayIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="m4 2.8 8.5 5.2L4 13.2V2.8Z" /></svg>
}

export function PauseIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="M4.5 3v10M11.5 3v10" /></svg>
}

export function DiamondIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="m8 1.75 6.25 6.25L8 14.25 1.75 8 8 1.75Z" /></svg>
}

export function LoopIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="M13 5.5V2.75m0 0h-2.75M3 10.5v2.75m0 0h2.75M3.5 5.4A5 5 0 0 1 11.2 3M12.5 10.6A5 5 0 0 1 4.8 13" /></svg>
}

/** 播放一次：单向右箭头（Rive 风格播放模式图标） */
export function PlayOnceIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M3 8h9.5M9.5 4.5 13 8l-3.5 3.5" />
    </svg>
  )
}

/** 往返：左右双向箭头 */
export function PingPongIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M6 4.5 2.5 8 6 11.5M10 4.5 13.5 8 10 11.5" />
    </svg>
  )
}

export function CurveIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="M2.25 12.75C4.1 12.75 4.75 3.25 8.1 3.25c2.3 0 2.15 4.95 5.65 4.95" /></svg>
}

export function ChevronIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="m5.5 3.5 5 4.5-5 4.5" /></svg>
}

/** 物体行左侧方框标记（Rive 式） */
export function ObjectMarkIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <rect height="10" rx="1.5" width="10" x="3" y="3" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <rect height="7" rx="1.2" width="9" x="3.5" y="7" />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

/** Solo / 隔离：空心圆 */
export function SoloIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <circle cx="8" cy="8" r="3.5" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M1.8 8s2.4-4 6.2-4 6.2 4 6.2 4-2.4 4-6.2 4-6.2-4-6.2-4Z" />
      <circle cx="8" cy="8" r="1.8" />
    </svg>
  )
}
