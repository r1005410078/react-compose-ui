import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/** 吸附参考线：手势中出现的瞬时对齐提示，渲染在最上层。 */
export function SnapGuidesLayer({ snapGuides, viewport }: StageOverlayContext) {  return (
    <>
      {snapGuides.map((guide) => guide.axis === 'x' ? (
        <line
          className="compose-stage__guide"
          data-testid="stage-snap-guide-x"
          key={`x:${guide.value}`}
          x1={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
          x2={worldToScreen({ x: guide.value, y: 0 }, viewport).x}
          y1="0"
          y2="100%"
        />
      ) : (
        <line
          className="compose-stage__guide"
          data-testid="stage-snap-guide-y"
          key={`y:${guide.value}`}
          x1="0"
          x2="100%"
          y1={worldToScreen({ x: 0, y: guide.value }, viewport).y}
          y2={worldToScreen({ x: 0, y: guide.value }, viewport).y}
        />
      ))}
    </>
  )
}
