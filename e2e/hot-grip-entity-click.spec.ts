import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function typePoint(commandInput: Locator, x: number, y: number) {
  await commandInput.fill(`${x},${y}`)
  await commandInput.press('Enter')
}

/** 用 `PLINE` + `C` 画一个闭合四顶点多段线：只有曲线才有顶点可编辑。 */
async function drawClosedBox(commandInput: Locator, x0: number, y0: number, x1: number, y1: number) {
  await commandInput.fill('PL')
  await commandInput.press('Enter')
  await typePoint(commandInput, x0, y0)
  await typePoint(commandInput, x1, y0)
  await typePoint(commandInput, x1, y1)
  await typePoint(commandInput, x0, y1)
  await commandInput.fill('C')
  await commandInput.press('Enter')
}

/** 进入 A 的几何编辑并点亮它的第一个顶点夹点（原地按下松开）。 */
async function armFirstVertex(page: Page, stage: Locator, shape: { x: number; y: number; width: number }) {
  await page.mouse.dblclick(shape.x + shape.width / 2, shape.y + 2)
  const grips = stage.locator('[data-testid^="stage-path-vertex-hit-"]')
  await expect(grips).toHaveCount(8)
  // 跨过双击窗口：紧接着双击的按下会被数成第三击，而连击中的那一下不点亮。
  await page.waitForTimeout(600)
  const grip = (await stage.getByTestId('stage-path-vertex-hit-v0').boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定新位置')
  await page.waitForTimeout(600)
}

test('OpenSpec: stage / 顶点取点是一条命令会话 / 点亮后点到别的曲线身上即换对象，吸上特征点仍是取点', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  // 坐标刻意不在网格上（步长 8），B 与 A 相隔足够远，B 线身中点附近没有任何可吸的特征点。
  await drawClosedBox(commandInput, 203, 305, 403, 505)
  await drawClosedBox(commandInput, 603, 305, 803, 505)
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)
  const a = (await strokes.nth(0).boundingBox())!
  const b = (await strokes.nth(1).boundingBox())!
  const ids = await strokes.evaluateAll((els) =>
    els.map((el) => el.closest('[data-entity-id]')?.getAttribute('data-entity-id')))
  const grips = stage.locator('[data-testid^="stage-path-vertex-hit-"]')
  const selectedRows = () => editor
    .locator('[data-scene-node-id][aria-selected="true"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-scene-node-id')))

  // 点 B 的上边线，离两个角各 60px、离中点 40px——特征点捕捉够不着。
  await armFirstVertex(page, stage, a)
  await page.mouse.click(b.x + 60, b.y + 2)
  // A 的几何一个字节没动，热夹点会话取消，B 被选中。
  await expect.poll(selectedRows).toEqual([ids[1]])
  expect((await strokes.nth(0).boundingBox())!.width).toBeCloseTo(a.width, 0)
  await expect(stage.getByTestId('stage-drafting-command-prompt')).not.toContainText('指定新位置')
  // 紧接着双击 B 即进入它的顶点模式：夹点全在 B 的盒上。
  await page.waitForTimeout(600)
  await page.mouse.dblclick(b.x + 60, b.y + 2)
  await expect(grips).toHaveCount(8)
  const xs = await grips.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x))
  expect(Math.min(...xs)).toBeGreaterThan(b.x - 12)

  // 对照：点亮后在 B 的一个角上点击——捕捉标记亮着，这一下仍是取点，A 的顶点落到那个角。
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await armFirstVertex(page, stage, a)
  await page.mouse.move(b.x + 2, b.y + 2)
  await expect(stage.getByTestId('stage-drafting-snap')).toHaveCount(1)
  await page.mouse.click(b.x + 2, b.y + 2)
  await expect.poll(async () => (await strokes.nth(0).boundingBox())!.width).toBeGreaterThan(a.width + 100)
  await expect.poll(selectedRows).toEqual([ids[0]])
})
