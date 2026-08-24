/**
 * DXF 导入：把一份 ASCII DXF 规划成页面场景与组件资产。
 *
 * @remarks
 * 无 React、无 DOM，只依赖 `@compose-ui/core`。Entity 的 Preset seed 由调用方注入，因此本包
 * 不认识 Registry、物料或任何 UI。
 *
 * 分词层与记录层认识的是 DXF 的组码结构，与产出什么文档无关；被重写的只有映射层。
 *
 * @packageDocumentation
 */
export {
  createDxfDiagnosticCollector,
  type DxfDiagnostic,
  type DxfDiagnosticCode,
} from './parser/dxf-diagnostics'
export {
  allValues,
  firstValue,
  groupDxfRecords,
  numberValue,
  tokenizeDxf,
  type DxfRecord,
} from './parser/dxf-parser'
export {
  assembleDxfDocument,
  planDxfImport,
  DXF_TEXT_ADVANCE_RATIO,
  DXF_TEXT_ASCENT_RATIO,
  type PlanDxfImportOptions,
} from './plan/dxf-plan'
export type {
  DxfComponentPlan,
  DxfCreateSeed,
  DxfEntitySeed,
  DxfImportPlan,
  DxfInstancePlan,
  DxfScenePlan,
} from './plan/dxf-types'
