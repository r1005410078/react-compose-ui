import { useId, useState } from 'react'
import type { HTMLAttributes, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useComposeI18nContext } from '@compose-ui/ui-context'
import { CommittedInput } from '../animation-panel/committed-input'
import type { ComposeAnimationInterpolation } from '../animation-panel/types'
import {
  COMPOSE_EASING_PRESETS,
  clampComposeEasingControl,
  composeEasingPresetInterpolation,
  formatComposeEasingControl,
  getComposeEasingPresetLabels,
  matchComposeEasingPreset,
  parseComposeEasingControl,
} from './easing-presets'
import type {
  ComposeEasingControl,
  ComposeEasingLocale,
  ComposeEasingSelectionId,
} from './easing-presets'

const messages = {
  'zh-CN': {
    editor: '缓动曲线',
    preset: '缓动预设',
    control: '控制点',
    controlPoint: (index: number) => `控制点 ${index}`,
    controlHint: '使用方向键调整，按住 Shift 步进更大',
    noControl: '该插值没有可调整的控制点',
  },
  'en-US': {
    editor: 'Easing curve',
    preset: 'Easing preset',
    control: 'Control points',
    controlPoint: (index: number) => `Control point ${index}`,
    controlHint: 'Use the arrow keys to adjust; hold Shift for larger steps',
    noControl: 'This interpolation has no adjustable control points',
  },
} as const

/** 一次缓动改动的来源语义。 @public */
export interface ComposeEasingChangeMeta {
  /**
   * 是否属于一次连续调节的中间值。
   *
   * @remarks
   * 拖拽控制柄与方向键连按都会产生大量中间值，宿主应当把它们合并成一条可撤销记录；
   * 选择预设与提交控制点数值是离散动作，各自独立成一条记录。
   */
  readonly transient: boolean
}

/** 缓动曲线编辑器的受控属性。 @public */
export interface ComposeEasingCurveEditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** 当前插值；`hold` 与 `linear` 只渲染曲线预览，没有控制柄与数值行。 */
  readonly value: ComposeAnimationInterpolation
  /** 每次改动回调完整插值；组件自身不保存除拖拽会话之外的状态。 */
  readonly onChange: (next: ComposeAnimationInterpolation, meta: ComposeEasingChangeMeta) => void
  /**
   * 是否渲染内置的预设选择器。
   *
   * @remarks
   * 宿主已经把预设渲染成自己的原生选择控件（例如属性面板的一行）时传 `false`，
   * 避免同一屏出现两个预设入口。
   *
   * @defaultValue true
   */
  readonly presetSelector?: boolean
  /** 只读时禁用全部编辑路径，曲线仍然照常显示。 */
  readonly readOnly?: boolean
  /** 渲染在编辑器底部的宿主说明，例如末帧出向段暂不参与求值。 */
  readonly note?: ReactNode
}

/** 拖拽期间冻结的纵向显示域。 */
interface EasingDomain {
  readonly min: number
  readonly max: number
}

/** 纵向显示域两端各留的余量，占域高的比例。 */
const DOMAIN_MARGIN = 0.08

/**
 * 计算纵向显示域。
 *
 * @remarks
 * 域按 `0 → 1` 与两个控制点的 y 取包络，再各留一点余量。贴合而不是量化到固定档位，
 * 是为了让常规缓动把画布填满——量化到 0.5 会让一条 y 最大 1.56 的回弹曲线只用掉半屏。
 * 拖拽期间显示域被冻结，因此贴合不会带来连续重标定的抖动。
 */
function easingDomain(interpolation: ComposeAnimationInterpolation): EasingDomain {
  const components = interpolation.kind === 'cubic'
    ? [0, 1, interpolation.control[1], interpolation.control[3]]
    : [0, 1]
  const min = Math.min(...components)
  const max = Math.max(...components)
  const margin = (max - min) * DOMAIN_MARGIN
  return { min: min - margin, max: max + margin }
}

/**
 * 横向留白比例。
 *
 * @remarks
 * 时间轴要占满整个画布宽度——参考 Rive，曲线从最左走到最右才看得出快慢分布。这里只留出
 * 一个控制柄半径的余量：控制点 x 取 0 或 1 时（缓入、缓出预设都会）圆点正好压在边界上，
 * 完全不留会被裁掉一半。纵向余量由显示域自己带（见 DOMAIN_MARGIN），不重复叠加。
 */
const CANVAS_INSET_X = 0.03

function projectX(x: number) {
  return (CANVAS_INSET_X + x * (1 - CANVAS_INSET_X * 2)) * 100
}

function projectY(y: number, domain: EasingDomain) {
  return (1 - (y - domain.min) / (domain.max - domain.min)) * 100
}

/** 曲线预览路径，坐标系与 `viewBox="0 0 100 100"` 一致。 */
function curvePath(interpolation: ComposeAnimationInterpolation, domain: EasingDomain) {
  const left = projectX(0)
  const right = projectX(1)
  const start = projectY(0, domain)
  const end = projectY(1, domain)
  // hold 是阶梯：保持前值走到段末，再在下一帧瞬间跳变。
  if (interpolation.kind === 'hold') return `M${left} ${start}H${right}V${end}`
  if (interpolation.kind === 'linear') return `M${left} ${start}L${right} ${end}`
  const [x1, y1, x2, y2] = interpolation.control
  return `M${left} ${start}C${projectX(x1)} ${projectY(y1, domain)} ${projectX(x2)} ${projectY(y2, domain)} ${right} ${end}`
}

/**
 * 受控的缓动曲线编辑器：预设、可拖控制柄与单行控制点数值三条等价编辑路径。
 *
 * @remarks
 * 组件与文档协议无关，只消费 {@link ComposeAnimationInterpolation} 形状。控制柄的 x 分量
 * 钳制在 `[0, 1]` 保证时间轴单调，y 分量不钳制以表达回弹过冲。
 *
 * @example
 * ```tsx
 * <ComposeEasingCurveEditor
 *   value={keyframe.interpolation}
 *   onChange={(next, meta) => dispatchInterpolation(next, meta.transient)}
 * />
 * ```
 *
 * @public
 */
export function ComposeEasingCurveEditor({
  className,
  note,
  onChange,
  presetSelector = true,
  readOnly = false,
  value,
  ...htmlProps
}: ComposeEasingCurveEditorProps) {
  const i18n = useComposeI18nContext()
  const locale: ComposeEasingLocale = i18n?.locale === 'en-US' ? 'en-US' : 'zh-CN'
  const t = messages[locale]
  const presetLabels = getComposeEasingPresetLabels(locale)
  const hintId = useId()
  // 拖拽会话是组件唯一的本地状态，且随手连显示域一起冻结：否则控制点越界导致的重标定会
  // 在拖拽中途改变指针到数值的映射，手感表现为曲线"追不上"指针。
  const [drag, setDrag] = useState<{ readonly index: number, readonly domain: EasingDomain } | null>(null)
  const dragging = drag?.index ?? null
  const domain = drag?.domain ?? easingDomain(value)
  const preset = matchComposeEasingPreset(value)
  const control = value.kind === 'cubic' ? value.control : null

  const commitControl = (next: ComposeEasingControl, transient: boolean) => {
    onChange({ kind: 'cubic', control: clampComposeEasingControl(next) }, { transient })
  }

  const updateComponent = (index: number, x: number, y: number, transient: boolean) => {
    if (!control) return
    const next: [number, number, number, number] = [...control] as [number, number, number, number]
    next[index * 2] = x
    next[index * 2 + 1] = y
    commitControl(next, transient)
  }

  const pointerToPoint = (event: PointerEvent<HTMLButtonElement>, frozen: EasingDomain) => {
    // 控制柄就挂在画布 div 上：从 parentElement 量比持一个 ref 更省，也避免渲染期读 ref。
    const rect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    // 反投影必须抵消横向留白，否则指针与控制柄会差一个固定偏移。
    const ratioX = ((event.clientX - rect.left) / rect.width - CANVAS_INSET_X)
      / (1 - CANVAS_INSET_X * 2)
    const ratioY = (event.clientY - rect.top) / rect.height
    return {
      x: ratioX,
      y: frozen.max - ratioY * (frozen.max - frozen.min),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (readOnly || !control) return
    event.preventDefault()
    // jsdom 与部分嵌入环境没有 Pointer Capture；可选调用让拖拽在它们那里退化为普通指针跟随。
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ index, domain: easingDomain(value) })
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (!drag || drag.index !== index) return
    const point = pointerToPoint(event, drag.domain)
    if (!point) return
    updateComponent(index, point.x, point.y, true)
  }

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    setDrag(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (readOnly || !control) return
    const step = event.shiftKey ? 0.1 : 0.01
    const x = control[index * 2]!
    const y = control[index * 2 + 1]!
    if (event.key === 'ArrowLeft') updateComponent(index, x - step, y, true)
    else if (event.key === 'ArrowRight') updateComponent(index, x + step, y, true)
    else if (event.key === 'ArrowUp') updateComponent(index, x, y + step, true)
    else if (event.key === 'ArrowDown') updateComponent(index, x, y - step, true)
    else return
    event.preventDefault()
  }

  const rootClassName = ['compose-easing-editor', className].filter(Boolean).join(' ')

  return (
    <div {...htmlProps} className={rootClassName} data-preset={preset}>
      {presetSelector ? (
        <label className="compose-easing-editor__preset">
          <span>{t.preset}</span>
          <select
            aria-label={t.preset}
            disabled={readOnly}
            value={preset}
            onChange={(event) => {
              const next = event.target.value as ComposeEasingSelectionId
              onChange(composeEasingPresetInterpolation(next, value), { transient: false })
            }}
          >
            {COMPOSE_EASING_PRESETS.map(({ id }) => (
              <option key={id} value={id}>{presetLabels[id]}</option>
            ))}
            <option value="custom">{presetLabels.custom}</option>
          </select>
        </label>
      ) : null}
      <div className="compose-easing-editor__canvas">
        <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          {/* 起止值参考线：域被回弹控制点撑大时，这两条线标出「0」与「1」的实际高度。 */}
          <path
            className="compose-easing-editor__guide"
            d={`M0 ${projectY(0, domain)}H100M0 ${projectY(1, domain)}H100`}
          />
          {control ? (
            <path
              className="compose-easing-editor__leash"
              d={`M${projectX(0)} ${projectY(0, domain)}L${projectX(control[0])} ${projectY(control[1], domain)}M${projectX(1)} ${projectY(1, domain)}L${projectX(control[2])} ${projectY(control[3], domain)}`}
            />
          ) : null}
          <path className="compose-easing-editor__curve" d={curvePath(value, domain)} />
        </svg>
        {control ? [0, 1].map((index) => {
          const x = control[index * 2]!
          const y = control[index * 2 + 1]!
          return (
            <button
              aria-describedby={hintId}
              aria-label={t.controlPoint(index + 1)}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(x * 100)}
              aria-valuetext={`${x}, ${y}`}
              className="compose-easing-editor__handle"
              data-dragging={dragging === index || undefined}
              disabled={readOnly}
              key={index}
              role="slider"
              style={{ left: `${projectX(x)}%`, top: `${projectY(y, domain)}%` }}
              type="button"
              onKeyDown={(event) => handleKeyDown(event, index)}
              onLostPointerCapture={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={(event) => handlePointerDown(event, index)}
              onPointerMove={(event) => handlePointerMove(event, index)}
              onPointerUp={endDrag}
            />
          )
        }) : null}
      </div>
      {control ? (
        <label className="compose-easing-editor__control">
          <span>{t.control}</span>
          <CommittedInput
            aria-label={t.control}
            key={formatComposeEasingControl(control)}
            readOnly={readOnly}
            value={formatComposeEasingControl(control)}
            onCommit={(draft) => {
              const parsed = parseComposeEasingControl(draft)
              if (!parsed) return false
              commitControl(parsed, false)
              return true
            }}
          />
        </label>
      ) : (
        <p className="compose-easing-editor__note">{t.noControl}</p>
      )}
      <p className="compose-easing-editor__hint" id={hintId}>{t.controlHint}</p>
      {note ? <p className="compose-easing-editor__note">{note}</p> : null}
    </div>
  )
}
