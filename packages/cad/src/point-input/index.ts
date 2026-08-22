/**
 * CAD 的点输入入口。
 *
 * @remarks
 * 坐标语法与求解管线是**共享实现**（`@compose-ui/core`），两块画布用同一份：语法是用户的
 * 肌肉记忆、管线里「键入坐标不被吸附改写」是一条不变量，各写一份必然在某处漂移。
 * 这里只保留 CAD 侧的既有名称别名，以免一次改名波及全部调用点。
 * @packageDocumentation
 */
export {
  parseComposeCoordinate as parseCadCoordinate,
  resolveComposePoint as resolveCadPoint,
  type ComposeCoordinateFailure as CadCoordinateFailure,
  type ComposeGridSettings as CadGridSettings,
  type ComposeInputPoint as CadInputPoint,
  type ComposePointContext as CadPointContext,
  type ComposePointSource as CadPointSource,
  type ParseComposeCoordinateResult as ParseCadCoordinateResult,
} from '@compose-ui/core'
