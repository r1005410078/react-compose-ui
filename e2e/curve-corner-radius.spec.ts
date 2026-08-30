import { expect, test } from '@playwright/test'

/**
 * 多段线的四角联动圆角：选中即出手柄，拖一个四个角一起变。
 *
 * 判据是「手柄画在角弧的圆心上」——顶点到圆心的位移投影到角平分线上再乘半角正弦就是半径，
 * 因此拖动这件事本身就是在量它。
 */
test('OpenSpec: stage / 多段线的圆角手柄 / 选中即出，拖一个四个角一起圆', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 340).x, at(440, 340).y)

  // 画完不自动选中，先点线身选上它——上边的四分之一处一定落在描边上。
  await page.mouse.click(at(290, 200).x, at(290, 200).y)
  const handles = stage.locator('[data-testid^="stage-curve-corner-"]:not([data-testid*="hit"])')
  await expect(handles).toHaveCount(4)

  // 尖角时轮廓仍是 polygon；拖出圆角之后换成 path，四段角弧。
  await expect(stage.locator('polygon[data-testid="compose-material-curve-stroke"]')).toHaveCount(1)

  const first = stage.getByTestId('stage-curve-corner-hit-0')
  const grip = (await first.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(at(290, 250).x, at(290, 250).y, { steps: 4 })
  // 拖动中光标旁有半径读数，且被量的那一段（圆心到弧上）画了出来。
  await expect(stage.getByTestId('stage-dynamic-input-field-0')).toHaveCount(1)
  await expect(stage.getByTestId('stage-dynamic-input-measured')).toHaveCount(1)
  await page.mouse.up()

  const stroke = stage.locator('path[data-testid="compose-material-curve-stroke"]')
  await expect(stroke).toHaveCount(1)
  expect((await stroke.getAttribute('d'))!.match(/A /g)).toHaveLength(4)

  // 撤销一步回到尖角：圆角与顶点写的是同一个 Component，因此走同一条漏斗。
  await stage.press('Control+z')
  await expect(stage.locator('polygon[data-testid="compose-material-curve-stroke"]')).toHaveCount(1)
})
