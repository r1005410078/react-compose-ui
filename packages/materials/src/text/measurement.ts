import type { ComposeRendererMeasurementDefinition } from '@compose-ui/component-registry'

function numeric(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function textTransform(value: unknown) {
  return value === 'uppercase' || value === 'lowercase' || value === 'capitalize'
    ? value
    : 'none'
}

function textStyle(props: Readonly<Record<string, unknown>>) {
  const fontSize = numeric(props.fontSize, 24)
  const lineHeight = typeof props.lineHeight === 'number' && Number.isFinite(props.lineHeight)
    ? props.lineHeight
    : null
  return {
    fontFamily: typeof props.fontFamily === 'string'
      ? props.fontFamily
      : 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize,
    fontWeight: typeof props.fontWeight === 'string' || typeof props.fontWeight === 'number'
      ? String(props.fontWeight)
      : '400',
    letterSpacing: numeric(props.letterSpacing, 0),
    lineHeight,
    textTransform: textTransform(props.textCase),
    fontVariantCaps: props.textCase === 'small-caps' ? 'small-caps' : 'normal',
  }
}

/** 空文字保留的光标宽度，使编辑边框可见且节点仍可命中。 @internal */
const EMPTY_TEXT_CARET_WIDTH = 1

/** Text Renderer 使用的隔离 DOM 内容测量。 @internal */
export const TEXT_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  measure({ props, width, height }) {
    if (typeof document === 'undefined' || !document.body) return null
    const content = typeof props.text === 'string' || typeof props.text === 'number'
      ? String(props.text)
      : 'Text'
    // 点击创建的文字以空内容进入编辑。空串量出来是 0×0，会被判为无效尺寸，Hug 拿不到高度，
    // 光标无处落脚。用零宽空格占位即可量到真实行高，宽度再补一个光标位。
    const empty = content.length === 0
    const typography = textStyle(props)
    const host = document.createElement('span')
    host.dataset.composeMeasurementHost = 'text'
    host.setAttribute('aria-hidden', 'true')
    Object.assign(host.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      contain: 'layout style paint',
      boxSizing: 'border-box',
      display: 'inline-block',
      margin: '0',
      padding: '0',
      border: '0',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      fontFamily: typography.fontFamily,
      fontSize: `${typography.fontSize}px`,
      fontWeight: typography.fontWeight,
      letterSpacing: `${typography.letterSpacing}px`,
      lineHeight: typography.lineHeight === null ? 'normal' : `${typography.lineHeight}px`,
      textTransform: typography.textTransform,
      fontVariantCaps: typography.fontVariantCaps,
    })
    if (width.mode === 'exactly') host.style.width = `${width.value}px`
    else if (width.mode === 'at-most') host.style.maxWidth = `${width.value}px`
    if (height.mode === 'exactly') host.style.height = `${height.value}px`
    else if (height.mode === 'at-most') host.style.maxHeight = `${height.value}px`
    host.textContent = empty ? '\u200b' : content
    document.body.append(host)
    try {
      const rect = host.getBoundingClientRect()
      const measuredWidth = width.mode === 'exactly'
        ? width.value
        : width.mode === 'at-most'
          ? Math.min(rect.width, width.value)
          : rect.width
      const measuredHeight = height.mode === 'exactly'
        ? height.value
        : height.mode === 'at-most'
          ? Math.min(rect.height, height.value)
          : rect.height
      // 空内容保留一个光标宽度：编辑边框才可见，空文字也仍能被指针命中。
      const contentWidth = empty ? Math.max(measuredWidth, EMPTY_TEXT_CARET_WIDTH) : measuredWidth
      if (contentWidth <= 0 || measuredHeight <= 0) return null
      return {
        width: contentWidth,
        height: measuredHeight,
        baseline: Math.min(measuredHeight, typography.fontSize * 0.8),
      }
    }
    finally {
      host.remove()
    }
  },
  subscribe({ invalidate }) {
    if (typeof document === 'undefined' || !document.fonts) return () => undefined
    let active = true
    const onChange = () => { if (active) invalidate() }
    document.fonts.addEventListener('loadingdone', onChange)
    document.fonts.addEventListener('loadingerror', onChange)
    void document.fonts.ready.then(onChange)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', onChange)
      document.fonts.removeEventListener('loadingerror', onChange)
    }
  },
}
