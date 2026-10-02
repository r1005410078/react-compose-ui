import type { ComposeDocument, ComposeLayoutSnapshot } from '@compose-ui/core'

/**
 * 导出诊断的稳定机器码。
 *
 * @remarks
 * 不能表达的内容**降级导出并报告**，元素不丢：整份拒绝不合理，静默丢弃又会让用户拿结果与
 * 预览一对、发现少了东西却没有解释。
 *
 * @public
 */
export type ComposeQmlExportDiagnosticCode =
  /** 渐变背景按中位色标降级为纯色。 */
  | 'paint.gradient-degraded'
  /** 图片背景不导出。 */
  | 'paint.image-unsupported'
  /** 阴影不导出。 */
  | 'appearance.shadow-ignored'
  /** 滚动容器按裁剪导出，不带滚动能力。 */
  | 'overflow.scroll-unsupported'
  /** 只在一个轴上裁剪的容器，在 Qt 中两个轴一起裁剪。 */
  | 'overflow.axis-mixed'
  /** 带圆角的裁剪容器在 Qt 中按矩形裁剪子级。 */
  | 'overflow.rounded-clip'
  /** 图片、SVG、图表、组件实例与未知 Renderer 导出为同尺寸占位。 */
  | 'renderer.placeholder'
  /** 字体栈里只有第一个字族被写进 QML。 */
  | 'text.font-stack'
  /** 被数据绑定的 Renderer 属性按文档中的当前值静态导出。 */
  | 'binding.static-value'
  /** 带动画轨道的对象按文档中的静态姿态导出。 */
  | 'animation.static-pose'

/** 一条导出诊断。 @public */
export interface ComposeQmlExportDiagnostic {
  readonly code: ComposeQmlExportDiagnosticCode
  /** 诊断针对的 Entity；用于在编辑器里定位对象。 */
  readonly entityId: string
  /** 面向用户的说明（中文）。 */
  readonly message: string
}

/** {@link exportComposeSceneToQml} 的输入。 @public */
export interface ComposeQmlExportInput {
  /**
   * **已解算**的文档。
   *
   * @remarks
   * 必须是布局 Runtime 交出来的那一份而不是送进去求解的那一份：导线端点与填充跟随都是在
   * 求解里写回几何的，用错一份会让导出的线停在符号挪走之前的位置。
   */
  readonly document: ComposeDocument
  /** 与 {@link ComposeQmlExportInput.document} 成对的布局快照。 */
  readonly snapshot: ComposeLayoutSnapshot
  /** 要导出的场景（根 Frame）。 */
  readonly frameId: string
}

/** {@link exportComposeSceneToQml} 的结果。 @public */
export interface ComposeQmlExportResult {
  /** 完整的 `.qml` 文本；同一输入逐字节相同。 */
  readonly qml: string
  readonly diagnostics: readonly ComposeQmlExportDiagnostic[]
  /**
   * 产物用到的字族，按首次出现排序。
   *
   * @remarks
   * 字体不随产物打包：部署方据此在目标机上安装字体。缺字体时 Qt 静默回退，文字盒是按预览
   * 量出来写死的，回退字体会被截断或提前换行。
   */
  readonly fontFamilies: readonly string[]
}
