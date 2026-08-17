import { ComposeEasingCurveEditor } from '@compose-ui/animation-panel'
import type { ComposeAnimationInterpolation } from '@compose-ui/animation-panel'
import type { ComposePropertyPanelRendererProps } from '@compose-ui/property-panel'

/** 缓动字段的受控值：插值本身加一条随状态变化的说明。 */
export interface KeyframeEasingValue {
  readonly interpolation: ComposeAnimationInterpolation
  /** 末帧等状态下常驻显示的说明；无说明时为 null。 */
  readonly note: string | null
}

/**
 * 「缓动曲线」自定义字段：把动画包的曲线编辑器嵌进属性面板的整行字段位。
 *
 * @remarks
 * 预设由 Section 自己的原生 picklist 行承担，因此这里关掉编辑器内置的预设选择器，
 * 避免同一屏出现两个预设入口。连续调节（拖拽、方向键）以 `input` 提交、离散提交以
 * `commit` 提交——宿主据此决定命令是否共享 mergeKey 合并成一次撤销。
 * @internal
 */
export function KeyframeEasingRenderer({
  commit,
  label,
  readOnly,
  value,
}: ComposePropertyPanelRendererProps) {
  const { interpolation, note } = value as KeyframeEasingValue
  return (
    <ComposeEasingCurveEditor
      aria-label={label}
      className="compose-editor__keyframe-easing"
      note={note}
      presetSelector={false}
      readOnly={readOnly}
      value={interpolation}
      onChange={(next, meta) => {
        commit({ interpolation: next, note }, meta.transient ? 'input' : 'commit')
      }}
    />
  )
}
