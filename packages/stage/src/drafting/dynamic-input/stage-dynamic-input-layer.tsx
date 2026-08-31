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
      {/*
        * key 用**下标**而不是内容。
        *
        * 这几组的语义本来就是位置性的——第 i 条延伸线永远是同一个角色，因此下标是它稳定的
        * 身份；而内容会**撞**：轴向段让角度弧的两段退化成同一个 `d`，长度为零时两个 tick
        * 也落在同一点上。重复 key 下 React 不保证移除多出来的节点，症状是**每取一个点就在
        * 那个点上留一条竖虚线加一个圆点**，而它们只在鼠标移出图面、整层卸载时才消失。
        *
        * 直角走线让每一段都退化，因此这个缺陷在接线图上是必现而不是偶发。
        */}
      {annotation.locks.map((d, index) => (
        <path className="compose-stage__dynamic-input-lock" d={d} key={index} />
      ))}
      {annotation.guides.map((d, index) => (
        <path className="compose-stage__dynamic-input-guide" d={d} key={index} />
      ))}
      {annotation.ticks.map((tick, index) => (
        <circle
          className="compose-stage__dynamic-input-tick"
          cx={tick.x}
          cy={tick.y}
          key={index}
          r={2}
        />
      ))}
      {annotation.boxes.map((box) => (
        <g data-testid={`${testIdPrefix}-dynamic-input-field-${box.index}`} key={box.index}>
          {/*
            * 胶囊取全圆角（半径等于半高），方框取 3——**形状先分开、颜色再分开**：一个能
            * 打字、一个不能，两者长得一样是最难自己发现的一类缺陷。
            */}
          <rect
            className="compose-stage__dynamic-input-box"
            data-state={box.state}
            data-variant={box.variant}
            height={box.height}
            rx={box.variant === 'chip' ? box.height / 2 : 3}
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
          {box.adornment === 'swap' ? (
            <text
              className="compose-stage__dynamic-input-swap"
              x={box.x + box.width - 15}
              y={box.y + box.height / 2 + 4.5}
              textAnchor="middle"
            >
              {'\u21C6'}
            </text>
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
