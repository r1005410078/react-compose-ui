/**
 * 被绑定的 Renderer prop 在 QML 里写成什么。
 *
 * @remarks
 * 第一期只有不牵动几何的两类：文字（`text`）与颜色（`color`）。线宽、字号这类改变箭头、虚线或
 * 文字度量的 prop 仍按静态值导出——它们的几何在导出时就算死了，动态化要连几何一起在运行时重算。
 */
export type QmlBindingKind = 'text' | 'color'

/**
 * 给一个 prop 的静态表达式，返回最终写进 QML 的表达式：没有绑定时原样返回，有绑定时返回带静态
 * 回退的 `page` 绑定。
 */
export type QmlBoundValue = (prop: string, kind: QmlBindingKind, staticExpression: string) => string

/** 不做任何绑定：没有页面脚本、或在组件实例内部（嵌套文档没有脚本作用域）。 */
export const STATIC_VALUE: QmlBoundValue = (_prop, _kind, staticExpression) => staticExpression
