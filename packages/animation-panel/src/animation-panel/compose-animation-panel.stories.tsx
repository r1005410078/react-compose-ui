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
}: {
  readonly playbackMode?: 'play-once' | 'loop' | 'ping-pong'
}) {
  const defaultValue = {
    ...createDefaultComposeAnimationPanelValue(),
    playbackMode,
  }
  return (
    <ComposeUIProvider theme="dark">
      <div
        style={{
          display: 'grid',
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          background: '#101010',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gridTemplateRows: 'minmax(0, 1fr) 300px',
        }}
      >
        <div aria-label="宿主嵌入区域" style={{ borderRight: '1px solid #2a2a2a' }} />
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
