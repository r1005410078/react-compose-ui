import { DYNAMIC_INPUT_FONT_SIZE } from './dynamic-input-geometry'
import type {
  StageDynamicInputAdornment,
  StageDynamicInputAnnotation,
} from './dynamic-input-geometry'

/** 框尾标记占的宽度；数字因此在**剩下的**那块里居中，不会被标记压住。 */
function adornmentWidth(adornment: StageDynamicInputAdornment) {
  return adornment ? 18 : 0
}

/** {@link StageDynamicInputLayer} 的属性。 */
export interface StageDynamicInputLayerProps {
  /** 已求解好的呈现；`null` 时什么都不画。 */
  readonly annotation: StageDynamicInputAnnotation | null
  /** `data-testid` 前缀。 */
  readonly testIdPrefix: string
}

/**
 * 把动态输入的求解结果画进绘图覆盖层。
 *
 * @remarks
 * 只做渲染：位置、断开与退化全部由 `resolveStageDynamicInput` 决定，这里一行几何都不算。
 *
 * 字号必须与 `DYNAMIC_INPUT_FONT_SIZE` 一致——框宽是按它估算出来的，改了字号而没改常量，
 * 症状是标注断开的缺口与框对不齐。
 */
export function StageDynamicInputLayer({ annotation, testIdPrefix }: StageDynamicInputLayerProps) {
  if (!annotation) return null
  return (
    <g className="compose-stage__dynamic-input" data-testid={`${testIdPrefix}-dynamic-input`}>
      {annotation.measured ? (
        <path
          className="compose-stage__dynamic-input-measured"
          d={annotation.measured}
          data-testid={`${testIdPrefix}-dynamic-input-measured`}
        />
      ) : null}
      {annotation.connector ? (
        <path
          className="compose-stage__dynamic-input-connector"
          d={annotation.connector}
          data-testid={`${testIdPrefix}-dynamic-input-connector`}
        />
      ) : null}
      {annotation.locks.map((d) => (
        <path className="compose-stage__dynamic-input-lock" d={d} key={d} />
      ))}
      {annotation.guides.map((d) => (
        <path className="compose-stage__dynamic-input-guide" d={d} key={d} />
      ))}
      {annotation.ticks.map((tick) => (
        <circle
          className="compose-stage__dynamic-input-tick"
          cx={tick.x}
          cy={tick.y}
          key={`${tick.x},${tick.y}`}
          r={2}
        />
      ))}
      {annotation.boxes.map((box) => (
        <g data-testid={`${testIdPrefix}-dynamic-input-field-${box.index}`} key={box.index}>
          <rect
            className="compose-stage__dynamic-input-box"
            data-state={box.state}
            height={box.height}
            rx={3}
            width={box.width}
            x={box.x}
            y={box.y}
          />
          {box.prefix ? (
            <text
              className="compose-stage__dynamic-input-prefix"
              fontSize={DYNAMIC_INPUT_FONT_SIZE}
              x={box.x + 11}
              y={box.y + box.height / 2 + 4.5}
            >
              {box.prefix}
            </text>
          ) : null}
          <text
            className="compose-stage__dynamic-input-text"
            data-state={box.state}
            fontSize={DYNAMIC_INPUT_FONT_SIZE}
            textAnchor={box.prefix ? 'start' : 'middle'}
            x={box.prefix ? box.x + 30 : box.x + (box.width - adornmentWidth(box.adornment)) / 2}
            y={box.y + box.height / 2 + 4.5}
          >
            {box.text}
          </text>
          {box.adornment === 'lock' ? (
            <g
              className="compose-stage__dynamic-input-lock-glyph"
              transform={`translate(${box.x + box.width - 22} ${box.y + 7})`}
            >
              <rect height="7" width="9" x="0" y="4" />
              <path d="M1.6 4V2.6a2.9 2.9 0 0 1 5.8 0V4" fill="none" strokeWidth="1.5" />
            </g>
          ) : null}
          {box.adornment === 'caret' ? (
            <rect
              className="compose-stage__dynamic-input-caret"
              height={12}
              width={2}
              x={box.x + box.width - 17}
              y={box.y + 6}
            />
          ) : null}
        </g>
      ))}
    </g>
  )
}
