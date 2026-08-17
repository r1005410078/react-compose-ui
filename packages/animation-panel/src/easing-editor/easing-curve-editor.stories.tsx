import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ComposeEasingCurveEditor } from '@compose-ui/animation-panel'
import type { ComposeAnimationInterpolation } from '@compose-ui/animation-panel'
import {
  ComposeUIProvider,
  createComposeThemeStyle,
  useComposeThemeContext,
} from '@compose-ui/ui-context'
import type { CSSProperties } from 'react'
import '@compose-ui/animation-panel/styles.css'

/**
 * 宿主外壳：编辑器本身不铺主题变量，真实宿主（关键帧属性面板、Canvas Inspector）
 * 会把 Compose Theme token 写在祖先节点上，这里复制同一条件。
 */
function EasingHost({ children }: { readonly children: React.ReactNode }) {
  const theme = useComposeThemeContext()
  return (
    <div
      className="compose-animation-panel"
      data-compose-theme={theme?.resolvedTheme}
      style={{
        width: 280,
        padding: 12,
        ...(theme ? createComposeThemeStyle(theme.tokens) : {}),
      } as CSSProperties}
    >
      {children}
    </div>
  )
}

function EasingFixture({
  initial,
  note,
  presetSelector = true,
  readOnly = false,
  theme = 'dark',
}: {
  readonly initial: ComposeAnimationInterpolation
  readonly note?: string
  readonly presetSelector?: boolean
  readonly readOnly?: boolean
  readonly theme?: 'dark' | 'light'
}) {
  const [value, setValue] = useState(initial)
  return (
    <ComposeUIProvider theme={theme}>
      <EasingHost>
        <ComposeEasingCurveEditor
          note={note}
          presetSelector={presetSelector}
          readOnly={readOnly}
          value={value}
          onChange={(next) => setValue(next)}
        />
      </EasingHost>
    </ComposeUIProvider>
  )
}

const meta = {
  title: 'Animation/ComposeEasingCurveEditor',
  render: () => <EasingFixture initial={{ kind: 'cubic', control: [0.42, 0, 0.58, 1] }} />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** 常规缓入缓出：控制点都在单位方格内。 */
export const Default: Story = {}

/** 回弹缓动：控制点 y 越出单位方格，显示域自动扩到能包住它。 */
export const Overshoot: Story = {
  render: () => <EasingFixture initial={{ kind: 'cubic', control: [0.34, 1.56, 0.64, 1] }} />,
}

/** hold 画成阶梯，没有控制柄与数值行。 */
export const Hold: Story = {
  render: () => <EasingFixture initial={{ kind: 'hold' }} />,
}

/** 宿主自行渲染预设行时关闭内置选择器，并挂末帧说明。 */
export const EmbeddedWithNote: Story = {
  render: () => (
    <EasingFixture
      initial={{ kind: 'cubic', control: [0.25, 0.1, 0.25, 1] }}
      note="末帧的出向段没有下一帧，暂不参与求值"
      presetSelector={false}
    />
  ),
}

/** 只读：曲线照常显示，三条编辑路径全部禁用。 */
export const ReadOnly: Story = {
  render: () => <EasingFixture readOnly initial={{ kind: 'cubic', control: [0.42, 0, 1, 1] }} />,
}

/** 浅色主题下的对比度。 */
export const Light: Story = {
  render: () => (
    <EasingFixture initial={{ kind: 'cubic', control: [0.42, 0, 0.58, 1] }} theme="light" />
  ),
}
