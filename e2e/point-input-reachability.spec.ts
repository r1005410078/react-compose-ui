import { expect, test } from '@playwright/test'

/**
 * 取点管线上的两处可达性。
 *
 * @remarks
 * 两条都在**只用键盘**的路径上：命令由命令行启动，指针从未进过图面。这正是
 * `docs/oneline-diagram-dogfood-issues.md` 里 O-2 与 O-3 的现场。
 */
test('OpenSpec: stage / 动态输入 / 命令行敲 CIRCLE 收得下半径数值', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  await commandInput.fill('CIRCLE')
  await commandInput.press('Enter')
  await commandInput.fill('500,300')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定半径')

  // 提示写着「指定半径」，那就该收一个半径数值——而不是回「需要一个点」。
  await commandInput.fill('40')
  await commandInput.press('Enter')

  await expect(strokes).toHaveCount(1)
  const box = await strokes.first().boundingBox()
  expect(box).not.toBeNull()
  // 半径 40 的圆：两轴都是 80 个世界单位，按当前缩放折算后仍然接近正方。
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2)
})

test('OpenSpec: stage / 取点捕捉 / 圆心压在已有端点上仍画得出小圆', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  // 先画一段线，它的端点就是下面那个圆的圆心要吸上去的地方。
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await page.mouse.click(at(200, 200).x, at(200, 200).y)
  await page.mouse.click(at(400, 200).x, at(400, 200).y)
  await page.keyboard.press('Enter')
  await expect(strokes).toHaveCount(1)

  /*
   * 圆心用鼠标点在那个端点上（吸上去），半径点只离开 6 像素——落在捕捉容差之内。
   * 排除参考点之前，把落点拽回圆心的正是**那条线的端点**，圆退化并被拒掉。
   */
  await commandInput.fill('CIRCLE')
  await commandInput.press('Enter')
  await page.mouse.move(at(400, 200).x, at(400, 200).y)
  await page.mouse.click(at(400, 200).x, at(400, 200).y)
  await page.mouse.move(at(406, 200).x, at(406, 200).y)
  await page.mouse.click(at(406, 200).x, at(406, 200).y)

  await expect(strokes).toHaveCount(2)
})
