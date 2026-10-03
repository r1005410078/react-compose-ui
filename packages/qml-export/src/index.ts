/**
 * 把编辑器里的场景导出成 Qt Quick 能直接加载的 `.qml`。
 *
 * @remarks
 * 无 React、无 DOM 的纯函数包，只依赖 `@compose-ui/core`；不求解布局、不读写文件。
 *
 * 输入是布局 Runtime 交出来的「已解算文档 + 布局快照」——也就是预览正在渲染的那一对——产出
 * 是 QML 文本与诊断。导出的是**求解之后的结果**：每个对象绝对定位，不把 Auto Layout 翻译成
 * Qt 的布局类型。几何与外观照搬预览的渲染规则，验收方式是与预览逐像素比较
 * （见仓库的 `native/qt/`）。
 *
 * 覆盖静态基础图形（场景、容器、Group、曲线、文字、旋转）与组件实例的内联展开（嵌套求解
 * 结果由调用方提供）；脚本绑定、动画、图片等降级为静态值或占位，并逐项给出诊断。
 *
 * @packageDocumentation
 */
export { ComposeQmlExportError, exportComposeSceneToQml } from './qml-export'
export type {
  ComposeQmlExportDiagnostic,
  ComposeQmlExportDiagnosticCode,
  ComposeQmlExportInput,
  ComposeQmlExportResult,
  ComposeQmlInstanceContent,
} from './qml-export-types'

/** `@compose-ui/qml-export` 的稳定包标识。 @public */
export const COMPOSE_UI_QML_EXPORT_PACKAGE = '@compose-ui/qml-export' as const
