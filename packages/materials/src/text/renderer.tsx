import type { ComposeRendererProps } from '@compose-ui/component-registry'
import type { CSSProperties } from 'react'

function textAlign(value: unknown): CSSProperties['textAlign'] {
  return value === 'center' || value === 'right' || value === 'justify' ? value : 'left'
}

function verticalAlign(value: unknown): CSSProperties['alignItems'] {
  // 缺少该字段的旧文档沿用旧 renderer 的垂直居中；新 Text 会显式写入 top。
  if (value === 'top') return 'flex-start'
  if (value === 'bottom') return 'flex-end'
  return 'center'
}

function textTransform(value: unknown): CSSProperties['textTransform'] {
  return value === 'uppercase' || value === 'lowercase' || value === 'capitalize'
    ? value
    : 'none'
}

function textDecoration(value: unknown): CSSProperties['textDecorationLine'] {
  return value === 'underline' || value === 'line-through' ? value : 'none'
}

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
        alignItems: verticalAlign(props.verticalAlign),
        color: typeof props.color === 'string' ? props.color : '#ffffff',
        fontFamily: typeof props.fontFamily === 'string' ? props.fontFamily : undefined,
        fontSize: typeof props.fontSize === 'number' ? props.fontSize : undefined,
        fontWeight,
        letterSpacing: typeof props.letterSpacing === 'number' ? props.letterSpacing : undefined,
        lineHeight: typeof props.lineHeight === 'number' ? `${props.lineHeight}px` : undefined,
        textAlign: textAlign(props.textAlign),
        textDecorationLine: textDecoration(props.textDecoration),
        textTransform: textTransform(props.textCase),
        fontVariantCaps: props.textCase === 'small-caps' ? 'small-caps' : 'normal',
      }}
    >
      <span className="compose-material--text-content">
        {typeof props.text === 'string' || typeof props.text === 'number' ? props.text : 'Text'}
      </span>
    </div>
  )
}
