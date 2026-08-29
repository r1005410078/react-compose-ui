import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * `LINE` 的参考点跟着文档走。
 *
 * 判别点是**新的一段从哪里出发**：撤销之后仍从 c 出发的话，起点是一个已经不存在的地方，
 * 而屏幕上只表现为「线接错了」。
 *
 * 落点都收在 500×450 以内：默认视口下图面只有 566×537，再往外就落到右侧面板上了，而症状是
 * 「这一下什么都没发生」，与命令坏掉无法区分。
 */
async function openStage(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  return {
    stage,
    strokes: stage.getByTestId('compose-material-curve-stroke'),
    commandInput: stage.getByRole('textbox', { name: '命令行' }),
    /*
     * 走 `page.mouse` 而不是 `locator.click({ position })`：后者要过可操作性检查，而 dockview
     * 的面板浮在图面之上，检查会认为落点被拦住。每次重新量一次盒——布局在首帧之后还会动一下。
     */
    click: async (x: number, y: number) => {
      const box = (await surface.boundingBox())!
      await page.mouse.click(box.x + x, box.y + y)
    },
  }
}

/** 每一段的屏幕高度；水平段接近 0，斜段不会。 */
async function strokeHeights(strokes: ReturnType<Page['getByTestId']>) {
  return strokes.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height))
}

test('OpenSpec: stage / 命令会话的参考点跟着文档走 / a→b→c 撤销后新段从 b 出发', async ({ page }) => {
  const { strokes, commandInput, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(100, 120)   // a
  await click(300, 120)   // b
  await click(300, 280)   // c
  await expect(strokes).toHaveCount(2)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(1)

  // 接着画一段到 b 的正右方。
  await click(460, 120)
  await expect(strokes).toHaveCount(2)
  await commandInput.press('Escape')

  /*
   * 两段都是**水平**的。从 c 出发的话新的那一段是斜的，高会是 160——判别力全在高上，
   * 两种情形的宽都是 160。
   */
  expect(Math.max(...await strokeHeights(strokes))).toBeLessThan(4)
})

test('OpenSpec: stage-engine / LINE 的放弃上一段 / U 撤掉上一段并回退参考点', async ({ page }) => {
  const { stage, strokes, commandInput, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(100, 120)
  // 只取过一个点时够不着，提示里没有它。
  await expect(stage.getByTestId('stage-drafting-command-keyword-U')).toHaveCount(0)

  await click(300, 120)
  await click(300, 280)
  await expect(strokes).toHaveCount(2)

  await stage.getByTestId('stage-drafting-command-keyword-U').click()
  await expect(strokes).toHaveCount(1)

  await click(460, 120)
  await expect(strokes).toHaveCount(2)
  await commandInput.press('Escape')
  expect(Math.max(...await strokeHeights(strokes))).toBeLessThan(4)
})
