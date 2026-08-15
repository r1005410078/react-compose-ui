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

export function CurveIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="M2.25 12.75C4.1 12.75 4.75 3.25 8.1 3.25c2.3 0 2.15 4.95 5.65 4.95" /></svg>
}

export function ChevronIcon(props: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" {...props}><path d="m5.5 3.5 5 4.5-5 4.5" /></svg>
}
