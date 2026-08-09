import type { ComposeRendererProps } from '@compose-ui/component-registry'
import type { CSSProperties } from 'react'

/** Materials 内置 Text renderer。 @internal */
export function TextRenderer({ props }: ComposeRendererProps) {
  const fontWeight = typeof props.fontWeight === 'string' || typeof props.fontWeight === 'number'
    ? props.fontWeight as CSSProperties['fontWeight']
    : undefined
  return (
    <div
      className="compose-material compose-material--text"
      data-testid="compose-material-text"
      style={{
        color: typeof props.color === 'string' ? props.color : undefined,
        fontFamily: typeof props.fontFamily === 'string' ? props.fontFamily : undefined,
        fontSize: typeof props.fontSize === 'number' ? props.fontSize : undefined,
        fontWeight,
        letterSpacing: typeof props.letterSpacing === 'number' ? props.letterSpacing : undefined,
        lineHeight: typeof props.lineHeight === 'number' ? `${props.lineHeight}px` : undefined,
      }}
    >
      {typeof props.text === 'string' || typeof props.text === 'number' ? props.text : 'Text'}
    </div>
  )
}
