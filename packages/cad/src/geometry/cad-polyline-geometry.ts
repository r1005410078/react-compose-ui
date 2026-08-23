/**
 * 多段线运算，全部转导自 `@compose-ui/core`。
 *
 * @remarks
 * 与圆弧同批搬运：纯形状函数，两块画布共用。
 */
import { composePolylineSegments, isDegenerateComposePolyline } from '@compose-ui/core'
import type { CadInputPoint } from '../point-input'
import type { CadSegment } from './cad-segment-geometry'

export const cadPolylineSegments = composePolylineSegments as
  (vertices: readonly CadInputPoint[], closed: boolean) => readonly CadSegment[]
export const isDegenerateCadPolyline = isDegenerateComposePolyline
