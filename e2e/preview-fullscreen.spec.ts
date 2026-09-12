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
