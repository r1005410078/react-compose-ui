import { STAGE_OVERLAY_CONTRIBUTIONS } from './overlay-registry'
import type { StageOverlayContribution, StageOverlayProps } from './overlay-types'

interface StageOverlayComponentProps extends StageOverlayProps {
  /**
   * 覆盖默认的层注册表。
   *
   * @remarks
   * 留给新文档类型（例如 CAD）贡献自己的层；缺省即第一方全套。
   */
  readonly contributions?: readonly StageOverlayContribution[]
}

/**
 * 渲染 engine snapshot 的 SVG 编辑覆盖层，不持有手势状态。
 *
 * @remarks
 * 本组件只负责挂载 `<svg>` 与按顺序铺开各层——每一层是什么、画在第几层，全部由注册表决定。
 * 层之间不共享派生值：各自从同一份上下文里取自己需要的字段并自行换算，重复几次
 * `worldToScreen` 的代价远小于维护一个谁都在读、谁都不敢改的共享派生包。
 *
 * @public
 */
export function StageOverlay({
  contributions = STAGE_OVERLAY_CONTRIBUTIONS,
  ...context
}: StageOverlayComponentProps) {
  return (
    <svg
      aria-label={context.label}
      className="compose-stage__overlay"
      role="img"
    >
      {contributions.map(({ id, Layer }) => <Layer key={id} {...context} />)}
    </svg>
  )
}
