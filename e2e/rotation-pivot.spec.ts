import { expect, test } from '@playwright/test'

/**
 * 「画 → 动 → 脚本驱动」这条纵向流程的闭环用例。
 *
 * @remarks
 * 判别性在于**左端点不动**：基点在盒中心时，同一条线转 90° 会让包围盒左边沿右移半个线长；
 * 基点在左边中点时它原地不动。断言写成「左边沿几乎没动 + 形状确实转了」，两条缺一不可——
 * 只断言前者的话，一条根本没转的线也能通过。
 */
test('OpenSpec: compose-document / 旋转基点 / 画线、设基点、刻角度帧、绕铰点摆动', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 1. 绘图模式画一条水平线。
  await editor.getByRole('radio', { name: '绘图' }).click()
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')
  const surface = stage.getByTestId('stage-surface')
  const box = (await surface.boundingBox())!
  await page.mouse.click(box.x + 220, box.y + 220)
  await page.mouse.click(box.x + 420, box.y + 220)
  await commandInput.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)

  // 2. 回设计模式并选中它。命中点从实测包围盒算：落笔点会被网格吸附挪动最多半格。
  await editor.getByRole('radio', { name: '设计' }).click()
  const drawn = (await stroke.boundingBox())!
  await page.mouse.click(drawn.x + drawn.width / 2, drawn.y + drawn.height / 2)
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expect(inspector.getByRole('combobox', { name: '旋转基点' })).toBeVisible()

  // 3. 把基点设到左边中点——刀闸的铰点就在刀身一端。
  await inspector.getByRole('combobox', { name: '旋转基点' }).selectOption('middle-left')

  // 4. 动画模式：0 ms 刻 0°，200 ms 刻 90°。
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：旋转' })).toBeVisible()

  const timeline = animationPanel.getByRole('slider', { name: '当前时间' })
  await timeline.fill('200')
  const rotation = inspector.getByRole('spinbutton', { name: '旋转' })
  await rotation.fill('90')
  await rotation.blur()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()

  // 5. 铰点不动、另一端扫过。
  await timeline.fill('0')
  await expect.poll(async () => Math.round((await stroke.boundingBox())!.height))
    .toBeLessThan(4)
  const flat = (await stroke.boundingBox())!

  await timeline.fill('200')
  await expect.poll(async () => Math.round((await stroke.boundingBox())!.height))
    .toBeGreaterThan(Math.round(flat.width) - 4)
  const swung = (await stroke.boundingBox())!

  // 基点在盒中心时，这个差值会是半个线长；在左边中点时它原地不动。
  expect(Math.abs(swung.x - flat.x)).toBeLessThan(4)
})
