import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ComposeAnimationInspector,
  ComposeAnimationPanelProvider,
  ComposeAnimationTimeline,
  createDefaultComposeAnimationPanelValue,
} from '@compose-ui/animation-panel'
import { ComposeUIProvider } from '@compose-ui/ui-context'
import '@compose-ui/animation-panel/styles.css'

function AnimationPanelFixture({
  playbackMode = 'play-once',
  theme = 'dark',
}: {
  readonly playbackMode?: 'play-once' | 'loop' | 'ping-pong'
  readonly theme?: 'dark' | 'light'
}) {
  const defaultValue = {
    ...createDefaultComposeAnimationPanelValue(),
    playbackMode,
  }
  return (
    <ComposeUIProvider theme={theme}>
      <div
        style={{
          display: 'grid',
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          background: theme === 'dark' ? '#101010' : '#f5f5f5',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gridTemplateRows: 'minmax(0, 1fr) 300px',
        }}
      >
        {/* 纯装饰的宿主占位区：无 role 的 div 不允许挂 aria-label（axe aria-prohibited-attr）。 */}
        <div
          style={{ borderRight: `1px solid ${theme === 'dark' ? '#2a2a2a' : '#d8d8d8'}` }}
        />
        <ComposeAnimationPanelProvider defaultValue={defaultValue}>
          <ComposeAnimationInspector />
          <ComposeAnimationTimeline style={{ gridColumn: '1 / -1' }} />
        </ComposeAnimationPanelProvider>
      </div>
    </ComposeUIProvider>
  )
}

const meta = {
  title: 'Animation/ComposeAnimationPanel',
  render: () => <AnimationPanelFixture />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** 参考图默认关键帧与线性曲线。 */
export const Default: Story = {}

/** 播放到末尾后会回到零点的循环状态。 */
export const Looping: Story = { render: () => <AnimationPanelFixture playbackMode="loop" /> }

/** 在两端间持续往返的 PingPong 状态。 */
export const PingPong: Story = { render: () => <AnimationPanelFixture playbackMode="ping-pong" /> }

/** 浅色主题：全部前景色必须仍然可读，不得出现浅底配浅字。 */
export const Light: Story = { render: () => <AnimationPanelFixture theme="light" /> }
