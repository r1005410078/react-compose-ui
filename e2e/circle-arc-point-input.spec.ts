import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 圆与弧的取点参数化。
 *
 * 落点都收在 500×450 以内：默认视口下图面只有 566×537，再往外就落到右侧面板上了，而症状是
 * 「这一下什么都没发生」，与命令坏掉无法区分。
 */
async function openStage(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = await stableBox(surface)
  return {
    stage,
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    click: (x: number, y: number) => page.mouse.click(box.x + x, box.y + y),
    move: (x: number, y: number) => page.mouse.move(box.x + x, box.y + y),
  }
}

test('OpenSpec: stage-engine / CIRCLE 在半径与直径之间切换 / D 之后打 300 得到半径 150', async ({ page }) => {
  const { stage, commandInput, prompt, click, move } = await openStage(page)

  await commandInput.fill('C')
  await commandInput.press('Enter')
  await click(200, 250)
  await expect(prompt).toContainText('指定半径')

  await move(400, 250)
  // 单字段：只有一个框，没有第二个跟着光标转的角度。
  await expect(stage.getByTestId('stage-dynamic-input-field-0')).toHaveCount(1)
  await expect(stage.getByTestId('stage-dynamic-input-field-1')).toHaveCount(0)
  // 被量的那一段画出来了，否则标注的延伸线从空处伸出来。
  await expect(stage.getByTestId('stage-dynamic-input-measured')).toHaveCount(1)

  await commandInput.fill('D')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定直径')

  await commandInput.fill('300')
  await commandInput.press('Enter')

  // 打 300 得到的是直径 300 的圆：包围盒宽 300，不是 600。
  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  const drawn = (await stroke.boundingBox())!
  expect(drawn.width).toBeGreaterThan(295)
  expect(drawn.width).toBeLessThan(312)
})

test('OpenSpec: stage-engine / 圆与弧各步声明自己的参数化 / 两点画直线，三点才是弧', async ({ page }) => {
  const { stage, commandInput, prompt, click, move } = await openStage(page)

  await commandInput.fill('A')
  await commandInput.press('Enter')
  await click(120, 360)
  await expect(prompt).toContainText('指定圆弧上的一点')

  // 两个点定不出弧：画一段弧要替用户猜一个半径，而第三个点会把它整个换掉。
  await move(300, 200)
  const preview = stage.getByTestId('stage-drafting-preview')
  const segments = async () => (
    (await preview.getAttribute('points'))!.trim().split(/\s+/).length
  )
  expect(await segments()).toBe(2)

  await click(300, 200)
  await move(460, 300)
  // 第三步换成弧，同时画出途经点到落点那一段——它不在弧上。
  expect(await segments()).toBeGreaterThan(2)
  await expect(stage.getByTestId('stage-dynamic-input-measured')).toHaveCount(1)

  await click(460, 300)
  await expect(prompt).toContainText('命令：')
})
