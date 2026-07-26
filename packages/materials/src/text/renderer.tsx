import type { ComposeComponentRendererProps } from '@compose-ui/component-registry'

/** Materials 内置 Text renderer。 @internal */
export function TextRenderer({ props }: ComposeComponentRendererProps) {
  return (
    <div
      className="compose-material compose-material--text"
      data-testid="compose-material-text"
      style={{
        color: typeof props.color === 'string' ? props.color : undefined,
        fontSize: typeof props.fontSize === 'number' ? props.fontSize : undefined,
      }}
    >
      {typeof props.text === 'string' ? props.text : 'Text'}
    </div>
  )
}
