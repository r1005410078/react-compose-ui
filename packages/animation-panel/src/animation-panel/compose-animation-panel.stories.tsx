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

/**
 * 行内动作按钮（锁定 / 独奏 / 隐藏 / 更多操作）的按需显现。
 *
 * @remarks
 * 显现走 CSS 的 `:hover` / `:focus-within`，这里用键盘路径（聚焦行的命中按钮触发
 * `:focus-within`）来验证：`userEvent.hover` 只派发合成事件，不会真的改变浏览器的
 * `:hover` 状态，断言不了 CSS 显现。焦点路径本身也是无障碍上必须成立的那一条。
 *
 * 之所以要在真实 Chromium 下守：`ComposeButton` 基类带 `transition-all`，会把
 * `visibility` 这个离散属性一并纳入过渡，于是按钮"能显现但要等到过渡中点"。
 * jsdom 既不跑过渡也不应用外部样式表，这类缺陷在单测里完全看不见。
 */
export const RowActionsOnFocus: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument
    const row = root.querySelectorAll<HTMLElement>('.compose-animation-timeline__track-row')[1]!
    const lock = row.querySelector<HTMLElement>('.compose-animation-timeline__track-action')!
    const label = row.querySelector<HTMLElement>('.compose-animation-timeline__track-label')!
    const visible = (el: HTMLElement) => getComputedStyle(el).visibility === 'visible'

    expect(visible(lock)).toBe(false)
    const labelLeft = label.getBoundingClientRect().left

    // 过渡里一旦混进 visibility（例如误用 transition-all），显现会推迟到过渡中点。
    expect(getComputedStyle(lock).transitionProperty).not.toMatch(/\ball\b|visibility/u)

    row.querySelector<HTMLElement>('.compose-animation-timeline__row-hit')!.focus()
    // 不等任何一帧：显现必须是即时的，等一帧就等于放过了被过渡拖慢的回归。
    expect(visible(lock)).toBe(true)
    // 占位常驻：显现前后行内其它元素不得位移。
    expect(label.getBoundingClientRect().left).toBeCloseTo(labelLeft, 1)

    // 已按下的状态开关在焦点离开后仍要可见，否则"轨道被锁定"这件事无从看出。
    lock.click()
    // React 的状态更新不是同步的，aria-pressed 要等这一帧提交完才反映出来。
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(lock.getAttribute('aria-pressed')).toBe('true')
    // 焦点还在 .row-hit 上（脚本 click 不改变焦点），blur 必须冲着当前焦点元素来，
    // 否则整行仍处于 :focus-within，下面"未按下的开关回到隐藏"恒为假。
    ;(root.activeElement as HTMLElement | null)?.blur()
    expect(visible(lock)).toBe(true)
    // 同一行里没有按下的开关则回到隐藏。
    const solo = row.querySelectorAll<HTMLElement>('.compose-animation-timeline__track-action')[1]!
    expect(visible(solo)).toBe(false)
  },
}

/**
 * 轨道填不满面板时，轨道区仍要铺到底。
 *
 * @remarks
 * 面板停靠在编辑器底部、高度由用户拖动分隔条决定，轨道往往只占上面一小截。左右两栏
 * 曾都按内容高度收缩，于是左栏分隔线、时间列背景和播放头竖线一起在最后一行下面断掉。
 * 这是纯布局约束，jsdom 不做布局，只能在真实 Chromium 下守。
 */
export const FillsPanelHeight: Story = {
  render: () => <AnimationPanelFixture timelineHeight={520} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument
    const pick = (selector: string) => root.querySelector<HTMLElement>(selector)!
    const board = pick('.compose-animation-timeline__board-scroll')
    const content = pick('.compose-animation-timeline__content')

    // 断言前提：轨道确实填不满，否则下面几条恒真。
    expect(board.scrollHeight).toBe(board.clientHeight)
    const rowsHeight = [...root.querySelectorAll('.compose-animation-timeline__track-group')]
      .reduce((total, group) => total + group.getBoundingClientRect().height, 0)
    expect(rowsHeight).toBeLessThan(board.clientHeight)

    const bottom = board.getBoundingClientRect().bottom
    for (const selector of [
      '.compose-animation-timeline__content',
      '.compose-animation-timeline__tracks',
      '.compose-animation-timeline__scale-scroll',
      '.compose-animation-timeline__scale',
      // 播放头是 .scale 里 top:0/bottom:0 的绝对定位元素，它到底等于竖线贯穿整块面板。
      '.compose-animation-timeline__scale .compose-animation-timeline__playhead',
    ]) {
      expect(pick(selector).getBoundingClientRect().bottom).toBeCloseTo(bottom, 0)
    }

    // 铺满只是下限：内容更高时照常撑开并交给 board-scroll 滚动（见 ScrolledManyTracks）。
    expect(content.getBoundingClientRect().height).toBeGreaterThanOrEqual(rowsHeight)
  },
}
