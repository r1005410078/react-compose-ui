import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      {...props}
    />
  )
}

export function AddIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 6v12M6 12h12" /></IconBase>
}

export function ChevronIcon({ expanded, ...props }: IconProps & { expanded: boolean }) {
  return <IconBase {...props}><path d={expanded ? 'm7 9 5 5 5-5' : 'm9 7 5 5-5 5'} /></IconBase>
}

export function DocumentIcon(props: IconProps) {
  return <IconBase {...props}><path d="M6 3h8l4 4v14H6zM14 3v5h4" /></IconBase>
}

export function CubeIcon(props: IconProps) {
  return <IconBase {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /></IconBase>
}

export function EyeIcon({ hidden, ...props }: IconProps & { hidden: boolean }) {
  return (
    <IconBase {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden ? <path d="m4 4 16 16" /> : null}
    </IconBase>
  )
}

export function LockIcon({ locked, ...props }: IconProps & { locked: boolean }) {
  return (
    <IconBase {...props}>
      <rect height="9" rx="1.5" width="12" x="6" y="11" />
      <path d={locked ? 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3' : 'M15.5 11V8a3.5 3.5 0 0 0-7 0'} />
    </IconBase>
  )
}
