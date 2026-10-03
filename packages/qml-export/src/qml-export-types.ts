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
  /** 图片、SVG、图表与未知 Renderer 导出为同尺寸占位。 */
  | 'renderer.placeholder'
  /** 组件实例没有对应的嵌套求解结果（未提供或准备失败），导出为同尺寸占位。 */
  | 'instance.unresolved'
  /** 字体栈里只有第一个字族被写进 QML。 */
  | 'text.font-stack'
  /** 被数据绑定的 Renderer 属性按文档中的当前值静态导出。 */
  | 'binding.static-value'
  /** 带动画轨道的对象按文档中的静态姿态导出。 */
  | 'animation.static-pose'

/** 一条导出诊断。 @public */
export interface ComposeQmlExportDiagnostic {
  readonly code: ComposeQmlExportDiagnosticCode
  /**
   * 诊断针对的 Entity；用于在编辑器里定位对象。
   *
   * @remarks
   * 组件实例内部的对象写复合地址（`实例ID/内部ID`），与编辑器下钻选中的寻址相同。
   */
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
  /**
   * 组件实例的嵌套求解结果，按实例的复合地址索引。
   *
   * @remarks
   * 顶层实例的地址就是它自己的 id，嵌套实例是 `外层/内层`。本包不依赖物料包与布局引擎，
   * 因此实例的准备（覆盖、采样、根尺寸对齐）与嵌套求解都由调用方完成——预览走的是同一份
   * 准备管线（`@compose-ui/materials` 的 `prepareComposeComponentInstance`）。缺某个地址时
   * 该实例导出为同尺寸占位并给出 `instance.unresolved` 诊断。
   */
  readonly instances?: ReadonlyMap<string, ComposeQmlInstanceContent>
  /**
   * 页面 setup 脚本；提供时导出 `page` 对象与动态绑定，产物变成多文件。
   *
   * @remarks
   * 两段都是**已经可在 V4 中运行**的 ES 模块文本：本包不编译、不打包，只把它们放进产物。
   * 降级编译由调用方完成（目标与全局清单见 `@compose-ui/script-runtime` 的
   * `COMPOSE_PORTABLE_SCRIPT_TARGET` / `COMPOSE_PORTABLE_GLOBALS`），setup 对全局的引用须已改写为
   * 对 `./ComposeRuntime/globals.mjs` 的导入。缺席时绑定按静态值导出，与没有脚本的页面相同。
   */
  readonly pageScript?: ComposeQmlPageScript
}

/**
 * 导出产物里的页面脚本两段。
 *
 * @public
 */
export interface ComposeQmlPageScript {
  /** 降级后的页面 setup 模块，导出名为 `setup` 的函数；写到 `page.setup.mjs`。 */
  readonly setupModule: string
  /** `@compose-ui/script-runtime` 的 `COMPOSE_PORTABLE_RUNTIME_SOURCE`；写到 `ComposeRuntime/script-runtime.mjs`。 */
  readonly runtimeModule: string
}

/** 产物中的一个文件；路径相对产物根目录、用 `/` 分隔。 @public */
export interface ComposeQmlExportFile {
  readonly path: string
  readonly content: string
}

/**
 * 一个组件实例的嵌套求解结果。
 *
 * @remarks
 * 字段与预览的实例渲染器一一对应：嵌套文档按自身快照绝对定位，外层先绕实例盒中心翻转，
 * `scale` 时再按根的自然尺寸摆放、以原点为基准整体缩放。
 *
 * @public
 */
export interface ComposeQmlInstanceContent {
  /** 准备好并已解算的嵌套文档（单根）。 */
  readonly document: ComposeDocument
  /** 与 {@link ComposeQmlInstanceContent.document} 成对的布局快照。 */
  readonly snapshot: ComposeLayoutSnapshot
  readonly contentFit: 'layout' | 'scale'
  /** 组件根的自然尺寸；`scale` 时内容按它摆放。 */
  readonly rootSize: { readonly width: number; readonly height: number } | null
  /** `scale` 时的两轴比值。 */
  readonly contentScale: { readonly x: number; readonly y: number }
  /** 翻转的两轴 ±1，绕实例盒中心作用。 */
  readonly flipScale: { readonly x: number; readonly y: number }
}

/** {@link exportComposeSceneToQml} 的结果。 @public */
export interface ComposeQmlExportResult {
  /** 场景的 `.qml` 文本；同一输入逐字节相同。 */
  readonly qml: string
  /**
   * 完整产物。没有页面脚本时只有场景本身（`Scene.qml`）；有脚本时还有 setup 模块与
   * `ComposeRuntime/` 运行时目录——产物自包含，`qml Scene.qml` 即可运行，不需要配置 import path。
   */
  readonly files: readonly ComposeQmlExportFile[]
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
