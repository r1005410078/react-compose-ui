import { formatComposeNumber } from '@compose-ui/core'

/**
 * 一个 QML 对象声明。
 *
 * @remarks
 * 属性值是**已经写好的 QML 表达式文本**或嵌套对象（`transform: Rotation { … }`）。模型刻意
 * 只有这一层：导出器自己产出全部属性，没有解析 QML 的需求，多一层类型系统只会让「这个属性
 * 该写成什么字面量」散落到两处。
 */
export interface QmlObject {
  readonly type: string
  readonly properties: readonly (readonly [string, string | QmlObject])[]
  readonly children: readonly QmlObject[]
}

const INDENT = '    '

/** 数值统一走核心的几何格式化：最多两位小数、整数不补零，与属性面板读到的数一致。 */
export function qmlNumber(value: number): string {
  return formatComposeNumber(value)
}

/** QML 的字符串字面量与 JavaScript 相同，`JSON.stringify` 的转义对它成立。 */
export function qmlString(value: string): string {
  return JSON.stringify(value)
}

/**
 * 文档颜色到 QML 颜色字面量。
 *
 * @remarks
 * 文档里带透明度的颜色是 CSS 的 `#rrggbbaa`，而 QML 读 `#aarrggbb`——原样写过去不会报错，
 * 只会让每一个半透明的颜色变成另一个颜色，因此换算只在这一处。
 */
export function qmlColor(value: string): string {
  const color = value.trim()
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return qmlString(`#${color.slice(7, 9)}${color.slice(1, 7)}`.toLowerCase())
  }
  if (/^#[0-9a-fA-F]{4}$/.test(color)) {
    const [, r, g, b, a] = color
    return qmlString(`#${a}${a}${r}${r}${g}${g}${b}${b}`.toLowerCase())
  }
  return qmlString(color.toLowerCase())
}

function writeObject(object: QmlObject, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  const inner = INDENT.repeat(depth + 1)
  const lines = [`${pad}${object.type} {`]
  for (const [name, value] of object.properties) {
    if (typeof value === 'string') {
      lines.push(`${inner}${name}: ${value}`)
      continue
    }
    const nested = writeObject(value, depth + 1)
    lines.push(`${inner}${name}: ${nested[0]!.trimStart()}`, ...nested.slice(1))
  }
  for (const child of object.children) {
    lines.push('', ...writeObject(child, depth + 1))
  }
  lines.push(`${pad}}`)
  return lines
}

/** 把一棵对象树写成完整的 `.qml` 文本（含 import 行，末尾换行）。 */
export function writeQmlDocument(root: QmlObject, imports: readonly string[]): string {
  return [
    ...imports.map((module) => `import ${module}`),
    '',
    ...writeObject(root, 0),
    '',
  ].join('\n')
}
