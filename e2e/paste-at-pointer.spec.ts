import { expect, test } from '@playwright/test'

/**
 * 粘贴落在指针处：整组副本的包围盒中心落到指针的世界坐标（再过网格吸附），来源不动。
 *
 * 用 `?no-auto-fit` 钉住视口，否则首帧的自动适配会让屏幕与世界之间多出一个不确定的缩放。
 * 网格默认开着、步长 8，因此中心与指针至多差半步；断言留 8px。
 */
async function drawRectangle(page: import('@playwright/test').Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  // 坐标按图面尺寸取比例：图面多大取决于窗口与面板布局，硬编码的像素会落到图面之外。
  const at = (fx: number, fy: number) => ({
    x: box.x + Math.round(box.width * fx),
    y: box.y + Math.round(box.height * fy),
  })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await page.mouse.click(at(0.2, 0.3).x, at(0.2, 0.3).y)
  await page.mouse.click(at(0.35, 0.5).x, at(0.35, 0.5).y)
  const strokes = stage.locator('[data-testid="compose-material-curve-stroke"]')
  await expect(strokes).toHaveCount(1)
  // 画完不自动选中，点上边选上它。
  await page.mouse.click(at(0.275, 0.3).x, at(0.2, 0.3).y)
  await expect(stage.locator('[data-stage-selection-chrome]').first()).toBeVisible()
  return { editor, stage, strokes, at }
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('OpenSpec: stage / Stage 复制剪切粘贴 / 键盘粘贴落在指针处', async ({ page }) => {
  const { stage, strokes, at } = await drawRectangle(page)
  const original = (await strokes.first().boundingBox())!

  await stage.press('Control+c')
  const target = at(0.7, 0.75)
  await page.mouse.move(target.x, target.y)
  await stage.press('Control+v')

  await expect(strokes).toHaveCount(2)
  const pasted = (await strokes.nth(1).boundingBox())!
  expect(Math.abs(center(pasted).x - target.x)).toBeLessThanOrEqual(8)
  expect(Math.abs(center(pasted).y - target.y)).toBeLessThanOrEqual(8)
  // 尺寸与来源一致，来源纹丝不动。
  expect(Math.abs(pasted.width - original.width)).toBeLessThanOrEqual(1)
  expect((await strokes.first().boundingBox())!.x).toBeCloseTo(original.x, 0)
  // 粘贴之后选中的是副本，且粘贴进撤销历史。
  await stage.press('Control+z')
  await expect(strokes).toHaveCount(1)
})

test('OpenSpec: stage / Stage 复制剪切粘贴 / 右键粘贴落在打开菜单的地方', async ({ page }) => {
  const { stage, strokes, at } = await drawRectangle(page)

  await stage.press('Control+c')
  const target = at(0.75, 0.7)
  await page.mouse.click(target.x, target.y, { button: 'right' })
  await page.getByRole('menuitem', { name: /^粘贴/ }).click()

  await expect(strokes).toHaveCount(2)
  const pasted = (await strokes.nth(1).boundingBox())!
  expect(Math.abs(center(pasted).x - target.x)).toBeLessThanOrEqual(8)
  expect(Math.abs(center(pasted).y - target.y)).toBeLessThanOrEqual(8)
})

test('OpenSpec: stage / Stage 复制剪切粘贴 / 指针不在图面上时退回建议落点', async ({ page }) => {
  const { stage, strokes } = await drawRectangle(page)
  const original = (await strokes.first().boundingBox())!

  await stage.press('Control+c')
  // 把指针挪到命令行上（Stage 根内、图面外）再按粘贴：图面上没有落点，副本按同父级错开 10
  // 落在来源旁边。
  await stage.getByRole('combobox', { name: '命令行' }).hover()
  await stage.press('Control+v')

  await expect(strokes).toHaveCount(2)
  const pasted = (await strokes.nth(1).boundingBox())!
  expect(pasted.x - original.x).toBeGreaterThan(0)
  expect(pasted.x - original.x).toBeLessThanOrEqual(20)
})
