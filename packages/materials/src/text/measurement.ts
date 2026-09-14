import type { ComposeMeasuredSize } from '@compose-ui/core'
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

/**
 * 测量结果缓存。
 *
 * @remarks
 * 测量是**输入的纯函数**：同样的内容、字体与约束，量多少次都是同一个答案。而布局求解在
 * 手势期每帧跑一次，一张五千多个实体的真实图纸里有一千八百个文字——不缓存的话每一帧都要
 * 做一千八百次「建元素 → 追加进 `document.body` → 读 `getBoundingClientRect`」，而追加与
 * 读取交替**每次都强制整页同步回流**。实测拖动一个对象时 53% 的时间花在这一个调用上，
 * p95 帧时间 252ms、最长 1.4 秒。
 *
 * 缩放不进键：测量宿主是 `position: fixed` 且没有任何 transform 祖先，画布缩放量不到它。
 *
 * 字体加载会改变度量，因此 `subscribe` 里在 `invalidate` 之前清空缓存——少了这一步，
 * 回退字体量出来的尺寸会一直留着。
 */
const measurementCache = new Map<string, ComposeMeasuredSize | null>()

/**
 * 缓存条目上限。
 *
 * @remarks
 * 键含 `at-most` 的具体宽度，而拖动缩放手柄会一路产出不同的宽度，因此条目数没有天然上界。
 * 超限整个清空而不是逐条淘汰：这里没有「哪条更该留下」的依据，而重新量一遍只是回到没有
 * 缓存时的成本。
 */
const MEASUREMENT_CACHE_LIMIT = 4096

/** Text Renderer 使用的隔离 DOM 内容测量。 @internal */
export const TEXT_RENDERER_MEASUREMENT: ComposeRendererMeasurementDefinition = {
  // 文字会换行：拖窄后行数增加、内容变高，因此缩放时不能把 Hug 高度钉成 Fixed。
  heightDependsOnWidth: true,
  measure({ props, width, height }) {
    if (typeof document === 'undefined' || !document.body) return null
    const content = typeof props.text === 'string' || typeof props.text === 'number'
      ? String(props.text)
      : 'Text'
    // 点击创建的文字以空内容进入编辑。空串量出来是 0×0，会被判为无效尺寸，Hug 拿不到高度，
    // 光标无处落脚。用零宽空格占位即可量到真实行高，宽度再补一个光标位。
    const empty = content.length === 0
    const typography = textStyle(props)
    const cacheKey = JSON.stringify([
      content,
      typography,
      width.mode,
      width.mode === 'undefined' ? 0 : width.value,
      height.mode,
      height.mode === 'undefined' ? 0 : height.value,
    ])
    if (measurementCache.has(cacheKey)) return measurementCache.get(cacheKey) ?? null
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
      const measurement = contentWidth <= 0 || measuredHeight <= 0
        ? null
        : {
            width: contentWidth,
            height: measuredHeight,
            baseline: Math.min(measuredHeight, typography.fontSize * 0.8),
          }
      if (measurementCache.size >= MEASUREMENT_CACHE_LIMIT) measurementCache.clear()
      measurementCache.set(cacheKey, measurement)
      return measurement
    }
    finally {
      host.remove()
    }
  },
  subscribe({ invalidate }) {
    if (typeof document === 'undefined' || !document.fonts) return () => undefined
    let active = true
    // 字体变了，此前用回退字体量出来的每一条都不再作数。
    const onChange = () => {
      measurementCache.clear()
      if (active) invalidate()
    }
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
