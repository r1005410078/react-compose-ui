import type { ComposeComponentRendererProps } from '@compose-ui/component-registry'
import type { CSSProperties } from 'react'

/** Materials 内置 Rectangle renderer。 @internal */
export function RectangleRenderer({ node, props }: ComposeComponentRendererProps) {
  const legacy = node.style === undefined
  const style: CSSProperties | undefined = legacy ? {
    backgroundColor: typeof props.color === 'string' ? props.color : undefined,
    borderRadius: typeof props.cornerRadius === 'number' ? props.cornerRadius : 12,
    opacity: typeof props.opacity === 'number' ? props.opacity : 1,
  } : {
    backgroundColor: 'transparent',
  }
  return (
    <div
      className={`compose-material compose-material--rectangle ${
        legacy ? 'is-legacy' : 'is-standard'
      }`}
      data-testid="compose-material-rectangle"
      style={style}
    >
      Rectangle
    </div>
  )
}
