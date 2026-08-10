import type { ComposeAppearance, JsonObject } from '@compose-ui/core'

/** Text 内置尺寸。 @internal */
export const DEFAULT_TEXT_SIZE = Object.freeze({ width: 280, height: 72 })

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
  color: '#172033',
  fontSize: 24,
})

/*
 * 排版 props 不写入 Preset：未设置时由渲染端继承浏览器默认。Inspector 需要一组确定值同时
 * 作为显示回退和重置基线，两者必须一致，否则重置会把属性恢复到面板从未展示过的值。
 */
export const DEFAULT_TEXT_TYPOGRAPHY_PROPS = Object.freeze({
  fontFamily: 'sans-serif',
  fontWeight: 400,
  letterSpacing: 0,
})

/** 未显式设置行高时按字号推导的显示值。 @internal */
export function defaultTextLineHeight(fontSize: number): number {
  return Math.round(fontSize * 120) / 100
}
