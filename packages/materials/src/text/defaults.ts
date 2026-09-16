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

/**
 * 文字排版使用的 locale。
 *
 * @remarks
 * 中日韩字形回退**由 locale 决定而不由 `font-family` 决定**：同一条
 * `Inter, ui-sans-serif, system-ui, sans-serif` 在 `en` 下把「运行监控大屏」排成 159.95px、
 * 在 `ja` 下 165.33px、在 `zh-CN` 下 168px——三套字体、三种字宽，而样式表一个字节都没变。
 *
 * 而 locale 来自环境：渲染节点继承 Stage 根上的 `lang`（编辑器 UI 语言，默认 `zh-CN`），
 * 测量宿主挂在 `document.body` 上、继承的是**宿主页面**的 `<html lang>`。两者于是恒不相等，
 * 症状是 Hug 的中文文字量出来比渲染窄，而 `overflow-wrap: anywhere` 让每个汉字都是合法断点、
 * Hug 高度又只留一行、节点还 `overflow: hidden`——屏幕上只剩最后一个字。拉丁文字不中招，
 * 因为两种 locale 选中的是同一个字体。
 *
 * 因此渲染与测量**都不读环境**，共用这一个常量：同一份文档在 Stage、预览与导出页里
 * 逐像素相同，而 adapter 也不必去读 Scene DOM（那条是架构边界明令禁止的）。
 *
 * 取 `zh-CN` 而不是 `""`（`-webkit-locale: auto`）：Stage 今天就跑在 `zh-CN` 上，钉住它
 * 渲染一个像素不变、只有测量跟上；取 auto 会把每一块已经画好的中文大屏换成另一套字形。
 * 代价写在明处——英文文字也带上 `lang="zh-CN"`，屏幕阅读器会用中文读它；这在 Stage 里
 * 本来就是今天的样子，这条只是把预览与导出对齐到同一个答案。真正的解法是让 locale 成为
 * 文字自己的一个属性，那是协议改动。
 *
 * @internal
 */
export const COMPOSE_TEXT_LAYOUT_LOCALE = 'zh-CN'

/**
 * 行高在属性面板上被「打开」时的起始值。
 *
 * @remarks
 * **它不是缺席时的显示值**——行高缺席即 CSS `normal`，那个值由字体决定、算不出来，面板
 * 顶替一个数就是在写一件不成立的事（28px 上顶替 33.6，而真实行盒 40）。这个数只在用户
 * 显式勾上这一项时用一次，取排版上通行的 1.2 倍。
 *
 * @internal
 */
export function defaultTextLineHeight(fontSize: number): number {
  return Math.round(fontSize * 120) / 100
}
