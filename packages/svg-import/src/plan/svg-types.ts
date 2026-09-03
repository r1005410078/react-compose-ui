import type { ComposeDocument, ComposeSize, JsonObject } from '@compose-ui/core'
import type { SvgDiagnostic } from '../parser/svg-diagnostics'

/**
 * 一份 Preset seed。
 *
 * @remarks
 * 结构化声明而不是从 `@compose-ui/component-registry` 引入：本包只依赖 `core`，Registry 的
 * `ComposeEntitySeed` 结构上可直接传进来。这与 `@compose-ui/dxf` 是同一条边界。
 *
 * @public
 */
export interface SvgEntitySeed {
  readonly name: string
  readonly components: Readonly<Record<string, JsonObject>>
}

/** 按 Preset id 取一份 seed；取不到时返回 `null`，该元素连同诊断一起跳过。 @public */
export type SvgCreateSeed = (presetId: string) => SvgEntitySeed | null

/**
 * 一份待写资源。
 *
 * @remarks
 * 内嵌 `data:` URI 的位图由计划**带出**而不是由本包写盘：纯函数包不产生外部副作用。宿主写完
 * 之后按 `entityId` 把资源引用回填进那个 Entity 的 Renderer props——这与「计划里不含组件实例
 * Entity，因为它需要写完文件才存在的引用与 revision」是同一条次序。
 *
 * @public
 */
export interface SvgPendingAsset {
  /** 要回填的 Entity；宿主写完资源后设置它的 `Renderer.props.asset`。 */
  readonly entityId: string
  /** 建议的文件名，已含扩展名。 */
  readonly fileName: string
  readonly mediaType: string
  /** 未解码的 base64 载荷，不含 `data:` 前缀。 */
  readonly base64: string
}

/** 一份 SVG 映射出的组件计划。 @public */
export interface SvgComponentPlan {
  /** 组件名；宿主用它作为文件名。 */
  readonly name: string
  /** 组件文档，根是 Frame。 */
  readonly document: ComposeDocument
  /** 根 Frame 的尺寸，取自 `viewBox`。 */
  readonly size: ComposeSize
}

/** 一次 SVG 导入的完整计划。 @public */
export interface SvgImportPlan {
  readonly component: SvgComponentPlan
  /** 待写资源；宿主写完后回填引用。空数组表示这份 SVG 里没有内嵌位图。 */
  readonly assets: readonly SvgPendingAsset[]
  readonly diagnostics: readonly SvgDiagnostic[]
}

/** {@link planSvgImport} 的参数。 @public */
export interface PlanSvgImportOptions {
  /**
   * 按 Preset id 取 seed。
   *
   * @remarks
   * Entity 需要 Preset 与 Renderer，而那些住在物料与 Registry 里——一个无 React 的格式包不该
   * 认识它们。
   */
  readonly createSeed: SvgCreateSeed
  readonly idFactory: () => string
  /** 组件名，通常取 `.svg` 的文件名。 */
  readonly name: string
}
