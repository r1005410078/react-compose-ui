import { COMPOSE_UI_CORE_PACKAGE } from '@compose-ui/core'
import type { HTMLAttributes } from 'react'

export type ComposeEditorProps = HTMLAttributes<HTMLElement>

export function ComposeEditor({
  children = 'Compose Editor',
  ...props
}: ComposeEditorProps) {
  return (
    <section
      {...props}
      aria-label={props['aria-label'] ?? 'Compose editor'}
      data-compose-core={COMPOSE_UI_CORE_PACKAGE}
      data-compose-ui="editor"
    >
      {children}
    </section>
  )
}
