import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

/**
 * Text 的 Hug 首帧回退尺寸。完成 isolated measurement 后，Layout Runtime 会用真实内容尺寸替换它。
 * @internal
 */
export const DEFAULT_TEXT_SIZE = Object.freeze({ width: 28, height: 16 })

/** Text 内置节点样式。 @internal */
export const DEFAULT_TEXT_APPEARANCE: ComposeAppearance = Object.freeze({
  backgroundPaint: { kind: 'solid', color: 'transparent' },
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  opacity: 1,
  shadow: null,
} satisfies ComposeAppearance)

/** Text 内置文字 props。 @internal */
export const DEFAULT_TEXT_PROPS: JsonObject = Object.freeze({
  text: 'Text',
  color: '#ffffff',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 400,
  letterSpacing: 0,
  textAlign: 'left',
  verticalAlign: 'top',
  textCase: 'original',
  textDecoration: 'none',
})

/** Text 新建节点的排版基线；lineHeight 缺失即代表浏览器的 Auto 行高。 @internal */
export const DEFAULT_TEXT_TYPOGRAPHY_PROPS = Object.freeze({
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontWeight: 400,
  letterSpacing: 0,
  textAlign: 'left',
  verticalAlign: 'top',
  textCase: 'original',
  textDecoration: 'none',
})

/** 未显式设置行高时按字号推导的显示值。 @internal */
export function defaultTextLineHeight(fontSize: number): number {
  return Math.round(fontSize * 120) / 100
}
