import { expect, test } from '@playwright/test'

/**
 * `RECTANGLE` 产出矩形物料而不是 `Curve` 折线。
 *
 * 判据是画完之后想对它做什么：外框与底板的下一步是填色、调圆角、往里塞东西，而这些
 * `Curve` 全都做不到。
 */
test('OpenSpec: stage / 绘图命令的盒效果落地成物料 Entity / R 画出的是矩形物料', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一个角点')

  await page.mouse.click(at(240, 200).x, at(240, 200).y)

  // 取第二点之前画的就是矩形轮廓，不是一条对角线：预览折线闭合回起点，五个点四条边。
  await page.mouse.move(at(420, 320).x, at(420, 320).y)
  const preview = stage.getByTestId('stage-drafting-preview')
  await expect(preview).toHaveCount(1)
  const points = (await preview.getAttribute('points'))!.trim().split(/\s+/)
  expect(points).toHaveLength(5)
  expect(points[0]).toBe(points[4])

  await page.mouse.click(at(420, 320).x, at(420, 320).y)
  await expect(prompt).toContainText('命令：')

  // 场景树里是 Rectangle 而不是 Curve——它带完整 Appearance，下一步能填色调圆角。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(0)
})
