/**
 * SVG 导入：把一份 SVG 规划成组件资产。
 *
 * @remarks
 * 无 React、无 DOM，只依赖 `@compose-ui/core`。Entity 的 Preset seed 由调用方注入，因此本包
 * 不认识 Registry、物料或任何 UI。
 *
 * 三层里，解析层与归一化层认识的是 XML 的结构与 CSS，与产出什么文档无关；换目标时被重写的
 * 只有映射层。第三方库（`fast-xml-parser` 与 `svgpath`）只在包内使用，不出现在公共 API 的
 * 类型里——那条边界与 `@compose-ui/layout-engine` 不让 Yoga 类型进公共 API 是同一条。
 *
 * @packageDocumentation
 */
export {
  createSvgDiagnosticCollector,
  type SvgDiagnostic,
  type SvgDiagnosticCode,
} from './parser/svg-diagnostics'
export { parseSvg, type SvgNode } from './parser/svg-parser'
export {
  collectSvgStyleRules,
  computeSvgStyle,
  parseSvgStyleRules,
  type SvgComputedStyle,
} from './parser/svg-style'
export { SVG_SHAPE_TAGS, pathDataToCurve, svgShapeToCurve } from './plan/svg-geometry'
export { normalizeSvgColor, resolveSvgPaint, styleNumber } from './plan/svg-paint'
export {
  planSvgImport,
  SVG_TEXT_ADVANCE_RATIO,
  SVG_TEXT_ASCENT_RATIO,
} from './plan/svg-plan'
export {
  applySvgMatrix,
  isUniformSvgMatrix,
  multiplySvgMatrix,
  parseSvgTransform,
  svgStrokeScale,
  SVG_IDENTITY,
  type SvgMatrix,
} from './plan/svg-transform'
export type {
  PlanSvgImportOptions,
  SvgComponentPlan,
  SvgCreateSeed,
  SvgEntitySeed,
  SvgImportPlan,
  SvgPendingAsset,
} from './plan/svg-types'
