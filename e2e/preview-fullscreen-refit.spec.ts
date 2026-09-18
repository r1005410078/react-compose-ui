import { expect, test } from '@playwright/test'

/**
 * 进出浏览器全屏都要重新取景。
 *
 * @remarks
 * 判别性断言是**两个方向都要断**：只断进去那一半时，「进去之后不动、出来之后也不动」这个
 * 缺陷本身仍然有一半是绿的。两个比例必须不同，否则这条用例恒真——因此先把它们读出来再比，
 * 不把 95% / 100% 写死（窗口尺寸一变那两个数就变了）。
 */
test('OpenSpec: compose-preview / 进出全屏预览重新取景 / 两个方向都跟上', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.getByRole('button', { name: '打开预览' }).click()

  const dialog = page.getByTestId('compose-preview-dialog-backdrop')
  await expect(dialog).toBeVisible()
  const zoom = page.getByTestId('compose-preview-dialog-zoom')

  const modalZoom = (await zoom.textContent())?.trim()
  expect(modalZoom).toBeTruthy()

  await dialog.getByRole('button', { name: '全屏预览' }).click()
  // 全屏台面比对话框大，取景因此是另一个比例；不同才说明它真的重算过。
  await expect.poll(async () => (await zoom.textContent())?.trim()).not.toBe(modalZoom)
  const fullscreenZoom = (await zoom.textContent())?.trim()

  // 在全屏里按「适应窗口」应当什么都不改变：它已经是适应过的了。
  await dialog.getByTestId('compose-preview-dialog-fit').click()
  await expect(zoom).toHaveText(fullscreenZoom!)

  /*
   * 退出全屏**不按那颗按钮**：触发读的是 `fullscreenchange` 这一份事实，而用户可以用浏览器
   * 自己的方式离开。这里直接调 `document.exitFullscreen()` ——合成的 `Escape` 到不了浏览器
   * 那一层（它先被对话框自己的关闭处理吃掉），拿它来断这条会验错东西。
   */
  await page.evaluate(() => document.exitFullscreen())
  await expect.poll(async () => (await zoom.textContent())?.trim()).toBe(modalZoom)
  await expect(dialog).toBeVisible()
})
