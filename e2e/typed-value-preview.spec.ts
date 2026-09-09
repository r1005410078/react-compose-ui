import { expect, test } from '@playwright/test'

/**
 * 正在键入时预览跟着键入的值走。
 *
 * 判别点是**回车之前**：键入的数字要立刻反映在图面上，否则用户要按下回车才知道结果，
 * 而那时命令已经结束、错了只能撤销重来。
 *
 * 落点都收在 500×450 以内：默认视口下图面只有 566×537，再往外就落到右侧面板上了，而症状是
 * 「这一下什么都没发生」，与命令坏掉无法区分。
 */
test('OpenSpec: stage / 正在键入时预览跟着键入的值走 / 回车前图面就变了', async ({ page }) => {
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
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')

  await page.mouse.click(at(120, 200).x, at(120, 200).y)
  await page.mouse.move(at(400, 200).x, at(400, 200).y)

  const preview = stage.getByTestId('stage-drafting-preview')
  /** 预览折线终点的屏幕 x；视口 1:1，因此它就是世界 x。 */
  const endX = async () => {
    const points = (await preview.getAttribute('points'))!.trim().split(/\s+/)
    return Number(points.at(-1)!.split(',')[0])
  }
  const start = await endX()

  // 打一个长度，还没回车：预览线立刻缩到 120，而指针仍停在 400。
  await commandInput.focus()
  await commandInput.fill('120')
  await expect.poll(endX).toBeCloseTo(start - 280 + 120, 0)

  // 几何停在别处、光标还在动，因此有一条连线把两者接起来。
  await expect(stage.getByTestId('stage-dynamic-input-connector')).toHaveCount(1)

  // 回车之前文档上什么都没有。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(0)

  await commandInput.press('Enter')
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(1)
  await commandInput.press('Escape')
})
