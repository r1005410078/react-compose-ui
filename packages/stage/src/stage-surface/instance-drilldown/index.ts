/**
 * 双击逐层进入组件实例内部，含内部选中框的 DOM 测量。
 *
 * @remarks
 * 内部几何由嵌套 Runtime 决定，宿主既无 LayoutItem 也无场景索引条目，只能测量。
 */
export { useStageInstanceDrilldown } from './use-stage-instance-drilldown'
export type {
  StageInstanceDrilldown,
  StageInstanceDrilldownParams,
} from './use-stage-instance-drilldown'
