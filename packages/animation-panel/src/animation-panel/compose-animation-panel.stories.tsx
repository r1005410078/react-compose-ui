import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
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
  timelineHeight = 300,
}: {
  readonly playbackMode?: 'play-once' | 'loop' | 'ping-pong'
  readonly theme?: 'dark' | 'light'
  /** 压低时间线高度即可让默认夹具的多轨道溢出，用于验证纵向滚动行为。 */
  readonly timelineHeight?: number
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
          gridTemplateRows: `minmax(0, 1fr) ${timelineHeight}px`,
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

/**
 * 轨道数超出可视高度时的纵向滚动：左轨道名与右关键帧车道必须整体同步移动。
 *
 * @remarks
 * 两栏曾是各自独立的纵向滚动容器，滚动其中一个另一个纹丝不动，行与车道彻底错开。
 * 现在两栏同属 `.board-scroll` 这一条纵向滚动；本 Story 在真实 Chromium 布局下守住该行为，
 * jsdom 测试只能守结构前提（不做布局）。
 */
export const ScrolledManyTracks: Story = {
  render: () => <AnimationPanelFixture timelineHeight={200} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument
    const board = root.querySelector<HTMLElement>('.compose-animation-timeline__board-scroll')!
    const trackList = root.querySelector<HTMLElement>('.compose-animation-timeline__track-list')!
    const scaleScroll = root.querySelector<HTMLElement>('.compose-animation-timeline__scale-scroll')!
    // 断言前提：内容确实纵向溢出，否则下面的断言恒真而毫无意义。
    expect(board.scrollHeight).toBeGreaterThan(board.clientHeight)

    // 错位的根源是两栏各自还能纵向滚动：只要任一栏自带纵向溢出，用户滚它时另一栏
    // 就不会跟随。纵轴的唯一滚动者必须是 board-scroll。
    expect(trackList.scrollHeight).toBeLessThanOrEqual(trackList.clientHeight)
    expect(scaleScroll.scrollHeight).toBeLessThanOrEqual(scaleScroll.clientHeight)

    // 正向验证：滚动 board 后，左行与右车道的纵向距离保持不变。
    const propertyId = board.querySelector<HTMLElement>('[data-property-row]')!.dataset.propertyRow!
    const gap = () => (
      board.querySelector<HTMLElement>(`[data-property-row="${propertyId}"]`)!
        .getBoundingClientRect().top
      - board.querySelector<HTMLElement>(`[data-property-lane="${propertyId}"]`)!
        .getBoundingClientRect().top
    )
    const gapBefore = gap()
    board.scrollTop = 60
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(board.scrollTop).toBe(60)
    expect(gap()).toBeCloseTo(gapBefore, 0)
  },
}
