/** Stage SVG 覆盖层：按注册表铺开的可替换呈现层。 */
export {
  createStageOverlayRegistry,
  STAGE_OVERLAY_CONTRIBUTIONS,
} from './overlay-registry'
export { StageOverlay } from './stage-overlay'
export type {
  StageOverlayContext,
  StageOverlayContribution,
  StageOverlayProps,
} from './overlay-types'
