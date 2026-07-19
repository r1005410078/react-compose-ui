import { COMPOSE_UI_CORE_PACKAGE } from '@compose-ui/core'
import type { HTMLAttributes } from 'react'

export type ComposePreviewProps = HTMLAttributes<HTMLElement>

export function ComposePreview({
  children = 'Compose Preview',
  ...props
}: ComposePreviewProps) {
  return (
    <section
      {...props}
      aria-label={props['aria-label'] ?? 'Compose preview'}
      data-compose-core={COMPOSE_UI_CORE_PACKAGE}
      data-compose-ui="preview"
    >
      {children}
    </section>
  )
}
