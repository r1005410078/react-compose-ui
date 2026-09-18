import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 场景体不再承担选中与拖动。
 *
 * 这些用例都用 `Meta` 而不是 `Control` 表达 command 修饰键：macOS 上 Ctrl+左键会被 Chromium
 * 翻译成右键，用它按下去根本不会产生左键手势。
 */

/** 从命令面板执行「新建场景」。 */
async function createScene(page: Page, editor: Locator) {
  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  const search = commandPanel.getByRole('combobox', { name: '检索命令' })
  await search.fill('新建场景')
  await commandPanel.getByRole('option', { name: /新建场景/ }).click()
  await search.fill('')
}

/** 场景左上角往里 40px：示例页面的内容都在更右下，这里是场景自己的空白。 */
const INSIDE_SCENE = { dx: 40, dy: 40 }

test('OpenSpec: stage-engine / 顶层容器体的命中收敛 / 已选中的场景体拖拽仍是框选', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()

  // 先经 command 点体把场景选中——这正是曾经让保护失效的那一步。
  const before = await stableBox(output)
  await page.keyboard.down('Meta')
  await page.mouse.click(before.x + INSIDE_SCENE.dx, before.y + INSIDE_SCENE.dy)
  await page.keyboard.up('Meta')
  await expect(stage.getByTestId('stage-selection-bounds')).toBeVisible()

  // 选中之后在场景空白处拖拽：用户想框选里面的东西，不是搬走整块场景。
  await page.mouse.move(before.x + INSIDE_SCENE.dx, before.y + INSIDE_SCENE.dy)
  await page.mouse.down()
  await page.mouse.move(before.x + 320, before.y + 240, { steps: 4 })
  await expect(stage.getByTestId('stage-marquee')).toHaveCount(1)
  await page.mouse.up()

  // 子级是相对坐标，场景被搬走时画面内部没有任何变化——因此断言必须落在场景自己的矩形上。
  const after = (await output.boundingBox())!
  expect(after.x).toBeCloseTo(before.x, 0)
  expect(after.y).toBeCloseTo(before.y, 0)
})

test('OpenSpec: stage-engine / 顶层容器体的命中收敛 / command 拖体与标签拖动都能搬走场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()

  const beforeCommandDrag = await stableBox(output)
  await page.keyboard.down('Meta')
  await page.mouse.move(
    beforeCommandDrag.x + INSIDE_SCENE.dx,
    beforeCommandDrag.y + INSIDE_SCENE.dy,
  )
  await page.mouse.down()
  await page.mouse.move(
    beforeCommandDrag.x + INSIDE_SCENE.dx + 120,
    beforeCommandDrag.y + INSIDE_SCENE.dy,
    { steps: 4 },
  )
  await page.mouse.up()
  await page.keyboard.up('Meta')

  const afterCommandDrag = (await output.boundingBox())!
  expect(afterCommandDrag.x).toBeGreaterThan(beforeCommandDrag.x + 60)

  // 标签是另一个入口，收敛不影响它。
  const label = stage.getByTestId('stage-container-label-frame-root')
  const labelBox = (await label.boundingBox())!
  await page.mouse.move(labelBox.x + 8, labelBox.y + labelBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(labelBox.x + 8, labelBox.y + labelBox.height / 2 + 100, { steps: 4 })
  await page.mouse.up()

  const afterLabelDrag = (await output.boundingBox())!
  expect(afterLabelDrag.y).toBeGreaterThan(afterCommandDrag.y + 60)
})

test('OpenSpec: compose-document / 场景默认外观 / 新建场景背景透明且边界仍然可见', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const scene = stage.locator('[data-entity-id="frame-root"]').first()
  await expect(scene).toBeVisible()

  // 背景透明：Paint 层画的是 transparent，网格因此透过场景可见。
  const paint = scene.locator('> [data-compose-paint]').first()
  await expect(paint).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  // 边界只由 chrome 描边承担——它是用户判断"这一下点的是场景里面还是工作区空白"的唯一依据。
  const outline = stage.getByTestId('stage-frame-outline-frame-root')
  await expect(outline).toHaveCount(1)
  expect(await outline.evaluate((element) => getComputedStyle(element).strokeWidth)).toBe('1px')
})

test('OpenSpec: stage-engine / 顶层容器体的命中收敛 / 空场景体拖拽也是框选', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 新建的场景是空的：它整块都曾经是拖动把手，而里面什么都没有可点——这正是最容易手滑的
  // 时刻，也是「空容器不收敛」那条例外留下的洞。
  await createScene(page, editor)
  const boundaries = stage.locator('[data-testid^="stage-frame-boundary-"]')
  await expect(boundaries).toHaveCount(2)
  const empty = boundaries.nth(1)

  // 新场景摆在既有场景右边、初始视口之外；缩小到它整块进画布，否则按下点落在 Stage 外面。
  await stage.focus()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const stageBox = (await stage.boundingBox())!
    const box = (await empty.boundingBox())!
    if (
      box.x >= stageBox.x && box.y >= stageBox.y
      && box.x + box.width <= stageBox.x + stageBox.width
      && box.y + box.height <= stageBox.y + stageBox.height
    ) break
    await stage.press('Control+-')
  }

  const before = (await empty.boundingBox())!
  await page.mouse.move(before.x + INSIDE_SCENE.dx, before.y + INSIDE_SCENE.dy)
  await page.mouse.down()
  await page.mouse.move(before.x + 200, before.y + 160, { steps: 4 })
  await expect(stage.getByTestId('stage-marquee')).toHaveCount(1)
  await page.mouse.up()

  const after = (await empty.boundingBox())!
  expect(after.x).toBeCloseTo(before.x, 0)
  expect(after.y).toBeCloseTo(before.y, 0)
})
