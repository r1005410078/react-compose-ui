/** 把任意有限角度转换为转盘使用的 0–359° 等价角度。 @public */
export function normalizeComposeAngle(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}
