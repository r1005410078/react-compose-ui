/**
 * 网格容器格线的渲染。
 *
 * @remarks
 * 画在 **Scene 之下**而不是覆盖层里：它是底纹不是标注，压在卡片上会让每张卡上横着几条线。
 * 与场景边界描边同属世界底图那一层。
 * @packageDocumentation
 */

import type { StageGridLines } from './stage-grid-lines'

/** 渲染一组网格容器的格线。 @public */
export function StageGridLinesLayer({ lines }: { readonly lines: readonly StageGridLines[] }) {
  return (
    <>
      {lines.map((grid) => (
        <g
          data-testid={`stage-grid-lines-${grid.containerId}`}
          key={grid.containerId}
          style={{ pointerEvents: 'none' }}
        >
          {grid.columns.map((band, column) => (
            <rect
              className="compose-stage__grid-column"
              height={band.height}
              key={column}
              width={band.width}
              x={band.x}
              y={band.y}
            />
          ))}
          {grid.rows.map((line, row) => (
            <line
              className="compose-stage__grid-row"
              key={row}
              x1={line.x1}
              x2={line.x2}
              y1={line.y}
              y2={line.y}
            />
          ))}
        </g>
      ))}
    </>
  )
}
