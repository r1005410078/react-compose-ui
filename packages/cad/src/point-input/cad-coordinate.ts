/**
 * 点输入管线使用的结构化点。
 *
 * @remarks
 * 刻意不用文档里的 `CadPoint`：后者继承 `JsonObject`（带索引签名），普通的 `{ x, y }` 对象
 * 无法赋值给它。管线处理的是**尚未落进文档**的候选点，用结构类型才不会逼调用方到处重建对象。
 *
 * @public
 */
export interface CadInputPoint {
  readonly x: number
  readonly y: number
}


/** 坐标解析结果；失败时不给出任何近似点。 @public */
export type ParseCadCoordinateResult =
  | { readonly ok: true; readonly point: CadInputPoint }
  | { readonly ok: false; readonly reason: CadCoordinateFailure }

/** 坐标解析失败的原因。 @public */
export type CadCoordinateFailure =
  /** 文本不是任何一种坐标写法；宿主应转而按关键字处理。 */
  | 'not-a-coordinate'
  /** 写法本身合法，但相对与极坐标需要一个上一点。 */
  | 'missing-reference'

const ABSOLUTE = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/
const RELATIVE = /^@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/
const POLAR = /^(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)$/

/**
 * 解析键入的坐标。
 *
 * @remarks
 * 支持三种写法：绝对 `x,y`、相对上一点 `@dx,dy`、极坐标 `距离<角度`。
 *
 * **角度按数学惯例逆时针为正，但屏幕 Y 轴向下**，因此 y 分量取负——`100<90` 必须指向屏幕
 * 上方。少了这个负号，所有极坐标都会上下翻转，而画一条水平线时完全看不出来。
 *
 * @param text - 用户键入的原始文本。
 * @param reference - 上一个点；相对与极坐标据此求解，缺省时这两种写法被拒绝。
 * @public
 */
export function parseCadCoordinate(
  text: string,
  reference?: CadInputPoint,
): ParseCadCoordinateResult {
  const trimmed = text.trim()

  const absolute = ABSOLUTE.exec(trimmed)
  if (absolute) {
    return { ok: true, point: { x: Number(absolute[1]), y: Number(absolute[2]) } }
  }

  const relative = RELATIVE.exec(trimmed)
  if (relative) {
    if (!reference) return { ok: false, reason: 'missing-reference' }
    return {
      ok: true,
      point: { x: reference.x + Number(relative[1]), y: reference.y + Number(relative[2]) },
    }
  }

  const polar = POLAR.exec(trimmed)
  if (polar) {
    if (!reference) return { ok: false, reason: 'missing-reference' }
    const distance = Number(polar[1])
    const radians = (Number(polar[2]) * Math.PI) / 180
    return {
      ok: true,
      point: {
        x: reference.x + distance * Math.cos(radians),
        y: reference.y - distance * Math.sin(radians),
      },
    }
  }

  return { ok: false, reason: 'not-a-coordinate' }
}
