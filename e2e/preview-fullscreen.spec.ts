import { expect, test } from '@playwright/test'
import { drawContainer } from './support/test-helpers'

test('OpenSpec: compose-preview / 预览形态之间的切换 / 进整屏、跳回编辑器，选区与撤销栈不动', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await drawContainer(page, editor)
  const stage = editor.getByRole('application', { name: 'Stage' })
  const container = stage.getByTestId('stage-container')
  await expect(container).toBeVisible()

  await editor.getByRole('button', { name: '打开预览' }).click()
  const dialog = page.getByTestId('compose-preview-dialog-backdrop')
  await expect(dialog).toBeVisible()

  // 切到整屏：弹框让位，整屏铺满视口。
  await page.getByTestId('compose-preview-dialog-fullscreen-form').click()
  const previewPage = page.getByTestId('compose-preview-page')
  await expect(previewPage).toBeVisible()
  await expect(dialog).toBeHidden()

  /*
   * 默认屏幕就是视口本身、1:1。断画板的实际盒子而不是读数：读数是我们自己写的字符串，
   * 而盒子是浏览器量出来的——只有后者能证明「默认呈现真实像素」。
   */
  const viewport = page.viewportSize()
  const artboard = page.getByTestId('compose-preview-page-artboard')
  await expect.poll(async () => (await artboard.boundingBox())?.width).toBe(viewport?.width)
  await expect.poll(async () => (await artboard.boundingBox())?.height).toBe(viewport?.height)

  // 静息之后控制条隐去——零 chrome 是这个形态存在的理由。
  const bar = page.getByTestId('compose-preview-page-bar')
  await expect(bar).not.toHaveAttribute('data-visible', 'true')

  // Escape 回编辑器，并且回到的是切换之前的那个弹框。
  await page.keyboard.press('Escape')
  await expect(previewPage).toBeHidden()
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  /*
   * 编辑器根本没卸载：刚画的容器还在、还选中着，撤销栈也还在——整屏是一次同标签页路由，
   * 不是一个新页面。
   */
  await expect(container).toBeVisible()
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(container).toBeHidden()
})

test('OpenSpec: compose-preview / 整屏预览的取景 / 场景等比铺满那块屏，不留台面', async ({ page }) => {
  // 视口刻意与场景（1280 × 720）既不同宽也不同高，且两轴比例不同：等比时 cover 的两个
  // 候选相等，取到哪一个都对，这条就没有判别力了。
  await page.setViewportSize({ width: 1675, height: 996 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor).toBeVisible()

  await editor.getByRole('button', { name: '打开预览' }).click()
  await page.getByTestId('compose-preview-dialog-fullscreen-form').click()
  const previewPage = page.getByTestId('compose-preview-page')
  await expect(previewPage).toBeVisible()

  const artboard = page.getByTestId('compose-preview-page-artboard')
  const frame = previewPage.getByTestId('compose-preview-frame')
  await expect(frame).toBeVisible()

  /*
   * 判据是**量出来的盒子**而不是 transform 字符串：`fit` 的那个 wrapper 是 `height: 100%`，
   * 百分比高度要求每一层祖先都有确定高度，断错一层的症状是纵轴比例恒为 1——两个 fit 都取
   * 不到真正的比例，于是场景只会缩小、永远不放大，而屏幕上看起来像是刻意的 1:1。
   */
  const board = (await artboard.boundingBox())!
  const drawn = (await frame.boundingBox())!
  const scale = Math.max(board.width / 1280, board.height / 720)
  expect(drawn.width).toBeCloseTo(1280 * scale, 0)
  expect(drawn.height).toBeCloseTo(720 * scale, 0)
  /*
   * 铺满而不是放进去：两条边都不留台面，较松的那一轴等量溢出到屏外（这一份视口里松的是宽）。
   * 断「不留台面」用的是 `toBeGreaterThanOrEqual`——等比时两轴同时贴边也是合法的铺满。
   */
  expect(drawn.width).toBeGreaterThanOrEqual(board.width - 0.5)
  expect(drawn.height).toBeGreaterThanOrEqual(board.height - 0.5)
  expect(board.x - drawn.x).toBeCloseTo((drawn.x + drawn.width) - (board.x + board.width), 0)

  // 溢出的那一圈不得盖住画板之外的东西：屏幕盒子把它裁掉。
  const clipped = await previewPage.getByTestId('compose-preview-page-artboard')
    .evaluate((el) => {
      const wrapper = el.querySelector('[data-testid="compose-preview-frame"]')!.parentElement!
      return getComputedStyle(wrapper).overflow
    })
  expect(clipped).toBe('hidden')
})
