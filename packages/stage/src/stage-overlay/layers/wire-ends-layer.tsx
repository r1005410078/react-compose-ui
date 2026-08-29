import { worldToScreen } from '@compose-ui/stage-engine'
import type { StageOverlayContext } from '../overlay-types'

/**
 * 端点记号的半径（屏幕像素）。
 *
 * @remarks
 * 比端口记号大一点：端口说「这里可以接」，端点说「这一端接上了没有」，而后者往往就画在前者
 * 上面。两个同样大小的圆叠在一起读不出是两个东西。
 */
const RADIUS = 4.5

/**
 * 导线两端的接线状态。
 *
 * @remarks
 * 不画的话，「端点画在端子上」与「真的绑到那个端口上」在屏幕上逐像素相同，唯一的判据是
 * **挪一下符号看它跟不跟**——用户为了确认一件事得先改一次文档再撤销。
 *
 * **哪些记号该出现由调用方算好**（选中的两端 + 全部失效端），本层只负责画：那条「问了才想
 * 知道 / 没问也必须知道」的判据读的是选择集与文档，而层拿不到也不该拿到它们。
 */
export function WireEndsLayer({ wireEnds, viewport }: StageOverlayContext) {
  return (
    <>
      {(wireEnds ?? []).map((end) => {
        const screen = worldToScreen(end.point, viewport)
        return (
          <circle
            className="compose-stage__wire-end"
            cx={screen.x}
            cy={screen.y}
            data-testid={`stage-wire-end-${end.state}`}
            data-wire-end={end.state}
            key={`${end.entityId}:${end.key}`}
            r={RADIUS}
          />
        )
      })}
    </>
  )
}
