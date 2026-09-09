import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { switchToDrawingWorkspace } from './support/test-helpers'

/**
 * 取点过程中的预览几何。
 *
 * @remarks
 * 只有端到端拦得住：这条链是「命令会话给出候选几何 → Stage 每帧按解算后的落点查询 → 覆盖层
 * 画出来」，三段分属三个包，任何一段用替身都会把要证明的那件事假设掉。
 */

async function boxOf(locator: Locator) {
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null
  await expect.poll(async () => {
    box = await locator.boundingBox()
    return box !== null
  }).toBe(true)
  return box!
}

async function openEditor(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  // 制图命令与角度约束的按钮只在绘图工作区的货架上；用例显式说明自己站在哪里。
  await switchToDrawingWorkspace(page)
  const box = await boxOf(stage.getByTestId('stage-surface'))
  return {
    editor,
    stage,
    at: (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy }),
    preview: stage.getByTestId('stage-drafting-preview'),
    band: stage.getByTestId('stage-drafting-band'),
  }
}

/** 折线的顶点数：`points` 是 "x,y x,y …"。 */
async function pointCount(preview: Locator) {
  const raw = await preview.getAttribute('points')
  return raw ? raw.trim().split(/\s+/).length : 0
}

test('OpenSpec: stage-engine / 预览几何 / 多段线预览含已取的全部点', async ({ page }) => {
  const { editor, at, preview, band } = await openEditor(page)

  await editor.getByRole('button', { name: '多段线', exact: true }).click()
  await page.mouse.click(at(160, 160).x, at(160, 160).y)
  await page.mouse.click(at(300, 260).x, at(300, 260).y)
  await page.mouse.click(at(420, 140).x, at(420, 140).y)
  await page.mouse.move(at(540, 300).x, at(540, 300).y, { steps: 4 })

  // 判别点是**四**：三个已取的点加光标上的那个候选点。只画最后一段时这里是 2。
  await expect(preview).toHaveCount(1)
  await expect.poll(async () => pointCount(preview)).toBe(4)

  // 两种呈现互斥：预览几何里本来就含着那条待定段，再叠一条橡皮筋就是同一条线画两遍。
  await expect(band).toHaveCount(0)

  // 折线必须显式关掉填充：SVG 的 `fill` 默认是黑色，线段看不出来，折线会被整块涂黑。
  expect(await preview.evaluate((node) => getComputedStyle(node).fill)).toBe('none')
})

test('OpenSpec: stage-engine / 预览几何 / 矩形预览是闭合四边形而不是对角线', async ({ page }) => {
  const { editor, at, preview, band } = await openEditor(page)

  await editor.getByRole('button', { name: '矩形', exact: true }).click()
  await page.mouse.click(at(160, 160).x, at(160, 160).y)
  await page.mouse.move(at(420, 320).x, at(420, 320).y, { steps: 6 })

  // 形状只有命令知道：两个对角点怎么变成四个顶点，宿主算不出来。
  await expect(preview).toHaveCount(1)
  await expect.poll(async () => pointCount(preview)).toBe(5)
  await expect(band).toHaveCount(0)

  // 闭合：首尾顶点重合。
  const raw = (await preview.getAttribute('points'))!.trim().split(/\s+/)
  expect(raw[0]).toBe(raw[raw.length - 1])
})

test('OpenSpec: stage-engine / 预览几何 / 圆预览是整圆而不是半径线', async ({ page }) => {
  const { editor, at, preview } = await openEditor(page)

  await editor.getByRole('button', { name: '圆', exact: true }).click()
  await page.mouse.click(at(300, 240).x, at(300, 240).y)
  await page.mouse.move(at(420, 240).x, at(420, 240).y, { steps: 6 })

  await expect(preview).toHaveCount(1)
  // 圆被拍成折线来画预览；判别点是它有宽有高，而半径线的包围盒高度为零。
  const box = await boxOf(preview)
  expect(box.width).toBeGreaterThan(200)
  expect(box.height).toBeGreaterThan(200)
})

test('OpenSpec: stage / 预览几何 / 给不出几何的命令仍画橡皮筋', async ({ page }) => {
  const { editor, stage, at, preview, band } = await openEditor(page)

  // 先画一条线并选中它，MOVE 才有目标。
  await editor.getByRole('button', { name: '直线', exact: true }).click()
  await page.mouse.click(at(200, 400).x, at(200, 400).y)
  await page.mouse.click(at(360, 460).x, at(360, 460).y)
  await stage.press('Escape')
  await page.mouse.click(at(280, 430).x, at(280, 430).y)

  const input = stage.getByRole('combobox', { name: '命令行' })
  await input.fill('M')
  await input.press('Enter')
  await page.mouse.click(at(200, 400).x, at(200, 400).y)
  await page.mouse.move(at(300, 500).x, at(300, 500).y, { steps: 4 })

  // 护栏：位移不是形状，`MOVE` 不实现预览查询，因此橡皮筋照旧。
  await expect(band).toHaveCount(1)
  await expect(preview).toHaveCount(0)
})
