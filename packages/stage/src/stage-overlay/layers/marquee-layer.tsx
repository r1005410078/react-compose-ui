import type { StageOverlayContext } from '../overlay-types'

/** 框选矩形：实线表示 contain 判定，虚线表示 intersect。 */
export function MarqueeLayer({ marqueeHitTest, marqueeScreen }: StageOverlayContext) {  return (
    <>
      {marqueeScreen ? (
        <rect
          className="compose-stage__marquee"
          data-marquee-mode={marqueeHitTest ?? 'intersect'}
          data-testid="stage-marquee"
          height={marqueeScreen.height}
          width={marqueeScreen.width}
          x={marqueeScreen.x}
          y={marqueeScreen.y}
        />
      ) : null}
    </>
  )
}
