import { expect, test } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 导线与普通几何在颜色与线宽上都不同。
 *
 * @remarks
 * 判别点是**两条断言必须同时成立**：更粗，且是红。一次接线图里红 = 合闸/带电，而储能、光伏
 * 这类图画的是正常运行的系统，整条一次回路本来就是带电的；绿在这里表示分闸/停电，正好相反。
 *
 * 角度约束显式关掉：本用例的落点不需要落在增量角上，跟着默认值走会在默认变化时莫名其妙地红。
 */
test('OpenSpec: basic-materials / 基础 Entity Presets / 导线比普通曲线粗且是红色', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  // 1) LINE 画一段，随即回车结束——`LINE` 连续取点。
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await page.mouse.click(at(120, 120).x, at(120, 120).y)
  await page.mouse.click(at(300, 200).x, at(300, 200).y)
  await page.keyboard.press('Enter')
  await expect(prompt).toContainText('命令：')

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)

  // 2) WIRE 画一条，取够两点自己结束。
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(at(120, 300).x, at(120, 300).y)
  await page.mouse.click(at(300, 380).x, at(300, 380).y)
  // `WIRE` 连续取点（可以有拐点），回车结束这一条。
  await page.keyboard.press('Enter')
  await expect(strokes).toHaveCount(2)

  const lineWidth = Number(await strokes.nth(0).getAttribute('stroke-width'))
  const wireWidth = Number(await strokes.nth(1).getAttribute('stroke-width'))
  expect(wireWidth).toBeGreaterThan(lineWidth)

  // 颜色不同，且导线是红：默认画成实施工程师画完之后想要的样子。
  expect(await strokes.nth(1).getAttribute('stroke'))
    .not.toBe(await strokes.nth(0).getAttribute('stroke'))
  expect(await strokes.nth(1).getAttribute('stroke')).toBe('#ff3b30')
})
