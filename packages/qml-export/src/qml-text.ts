import type { JsonObject } from '@compose-ui/core'
import { qmlColor, qmlNumber, qmlString, type QmlObject } from './qml-writer'

/** 预览的文字缺省字号（`--compose-material-text-font-size`）。 */
const DEFAULT_FONT_SIZE = 24

const HORIZONTAL = {
  left: 'Text.AlignLeft',
  center: 'Text.AlignHCenter',
  right: 'Text.AlignRight',
  justify: 'Text.AlignJustify',
} as const

const CAPITALIZATION = {
  uppercase: 'Font.AllUppercase',
  lowercase: 'Font.AllLowercase',
  capitalize: 'Font.Capitalize',
  'small-caps': 'Font.SmallCaps',
} as const

/**
 * CSS 字体栈里的第一个字族。
 *
 * @remarks
 * QML 的 `font.family` 只收一个字族；栈里其余的字族是浏览器的回退，Qt 有自己的回退。
 */
export function primaryFontFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? ''
  return first.replace(/^['"]|['"]$/g, '')
}

function fontWeight(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value === 'bold') return 700
  if (value === 'normal') return 400
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function verticalAlignment(value: unknown): string {
  // 与预览一致：缺少该字段的旧文档垂直居中，新文字显式写入 top。
  if (value === 'top') return 'Text.AlignTop'
  if (value === 'bottom') return 'Text.AlignBottom'
  return 'Text.AlignVCenter'
}

/**
 * 整块文字相对盒顶的偏移，见 {@link textObjects} 里的半行距表。
 *
 * @remarks
 * 半行距的**取整方式照搬 Blink**：ascent 与 descent 各自四舍五入成整像素，多出的行距 L 拆成
 * 上 `floor(L/2)`、下 `ceil(L/2)`。顶对齐的字由上半份决定，底对齐的由下半份决定——两边取整
 * 方向不同，写成同一个取整会让奇数 L 的那一侧差一个像素。
 * 直接用 `FontMetrics.height`（带小数）算，16px 的 DejaVu Sans 在 22px 行高下是 1.69 而预览是
 * 1，整段文字每一行都低一个像素；28px 那一档两种算法碰巧相等，所以只拿一种字号做夹具看不出来。
 */
function halfLeadingOffset(lineHeight: number | null, metricsId: string, align: unknown): string {
  if (lineHeight === null) return '0'
  const leading = `(${qmlNumber(lineHeight)} - Math.round(${metricsId}.ascent) - Math.round(${metricsId}.descent))`
  if (align === 'top') return `Math.floor(${leading} / 2)`
  if (align === 'bottom') return `-Math.ceil(${leading} / 2)`
  return '0'
}

/**
 * 一段文字的 `Text`（必要时带一个量行距用的 `FontMetrics`）。
 *
 * @remarks
 * 盒写死为布局快照里的尺寸：Hug 文字的宽度是按预览量出来的，让 Qt 自己再量一遍会在两边
 * 字宽有出入时换行到不同的位置。
 *
 * 换行照搬预览的 `white-space: pre-wrap` + `overflow-wrap: anywhere`：先在词边界断，放不下
 * 才在任意字符处断，即 `WrapAtWordBoundaryOrAnywhere`。Hug 文字的盒正好装得下它，因此不会
 * 被断开。
 *
 * **行高要补半行距，补多少取决于垂直对齐。**CSS 把 `line-height` 多出来的部分上下各分一半
 * （半行距），每一行都是；Qt 的 `FixedHeight` 把字贴在每行的行顶，而且**最后一行不带多出的
 * 行距**，整块因此比 CSS 矮两个半行距。三种对齐的结果各不相同：
 *
 * | 对齐 | Qt 相对预览 | 补偿 |
 * | --- | --- | --- |
 * | 顶 | 字高半个行距 | 下移半个行距 |
 * | 居中 | 块矮两个半行距、居中后下沉一个，正好抵消 | 不补 |
 * | 底 | 块下沉两个半行距，字低半个行距 | 上移半个行距 |
 *
 * 用整块文字的 `y` 补，而不是 `topPadding`：后者会参与垂直居中的计算。不补（或一律按顶对齐
 * 补）的症状是整行字比预览高或低几个像素，而且只在某一种对齐上出现。
 *
 * @param id - 本段文字所属 Entity 的 QML id；`FontMetrics` 用它派生自己的 id
 */
export function textObjects(
  id: string,
  props: JsonObject,
  size: { readonly width: number; readonly height: number },
): { readonly objects: readonly QmlObject[]; readonly fontFamily: string | null } {
  const text = typeof props.text === 'string' || typeof props.text === 'number' ? String(props.text) : 'Text'
  const fontSize = typeof props.fontSize === 'number' ? props.fontSize : DEFAULT_FONT_SIZE
  const fontFamily = typeof props.fontFamily === 'string' ? primaryFontFamily(props.fontFamily) : null
  const weight = fontWeight(props.fontWeight)
  const lineHeight = typeof props.lineHeight === 'number' && props.lineHeight > 0 ? props.lineHeight : null
  const textId = `${id}_text`
  const metricsId = `${id}_metrics`
  const align = props.textAlign
  const capitalization = typeof props.textCase === 'string' && props.textCase in CAPITALIZATION
    ? CAPITALIZATION[props.textCase as keyof typeof CAPITALIZATION]
    : null

  const textObject: QmlObject = {
    type: 'Text',
    properties: [
      ['id', textId],
      ['y', halfLeadingOffset(lineHeight, metricsId, props.verticalAlign)],
      ['width', qmlNumber(size.width)],
      ['height', qmlNumber(size.height)],
      ['text', qmlString(text)],
      // 文档里的 text 是纯文本；不写的话 Qt 会按内容猜测是不是富文本。
      ['textFormat', 'Text.PlainText'],
      ['color', qmlColor(typeof props.color === 'string' ? props.color : '#ffffff')],
      ...(fontFamily ? [['font.family', qmlString(fontFamily)] as const] : []),
      // 像素字号，不用 pointSize：后者随屏幕 DPI 变。
      ['font.pixelSize', qmlNumber(fontSize)],
      ...(weight !== null && weight !== 400 ? [['font.weight', qmlNumber(weight)] as const] : []),
      ...(typeof props.letterSpacing === 'number' && props.letterSpacing !== 0
        ? [['font.letterSpacing', qmlNumber(props.letterSpacing)] as const]
        : []),
      ...(capitalization ? [['font.capitalization', capitalization] as const] : []),
      ...(props.textDecoration === 'underline' ? [['font.underline', 'true'] as const] : []),
      ...(props.textDecoration === 'line-through' ? [['font.strikeout', 'true'] as const] : []),
      ...(lineHeight === null
        ? []
        : [['lineHeightMode', 'Text.FixedHeight'] as const, ['lineHeight', qmlNumber(lineHeight)] as const]),
      ['horizontalAlignment', HORIZONTAL[align === 'center' || align === 'right' || align === 'justify' ? align : 'left']],
      ['verticalAlignment', verticalAlignment(props.verticalAlign)],
      ['wrapMode', 'Text.WrapAtWordBoundaryOrAnywhere'],
    ],
    children: [],
  }
  if (lineHeight === null || props.verticalAlign !== 'top' && props.verticalAlign !== 'bottom') {
    return { objects: [textObject], fontFamily }
  }
  const metrics: QmlObject = {
    type: 'FontMetrics',
    properties: [['id', metricsId], ['font', `${textId}.font`]],
    children: [],
  }
  return { objects: [metrics, textObject], fontFamily }
}
