import { expect, test } from '@playwright/test'

/**
 * 多选批量改属性。
 *
 * @remarks
 * 判别性断言在**线宽**上，不在颜色上：两条线的颜色本来就相同，拿其中一条的整份 props 去覆盖
 * 全部目标时颜色照样对，只有那条被改过线宽的线读得出区别——这正是 `docs/oneline-diagram-
 * dogfood-issues.md` O-1 之外最容易顺手写错的一处。
 *
 * 角度约束显式关掉：本用例的落点不需要落在增量角上，跟着默认值走会在默认变化时莫名其妙地红。
 */
test('OpenSpec: editor-workspace-layout / 多选 Inspector / 改一次写入全部，各自的其余属性不受影响', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  const line = async (from: [number, number], to: [number, number]) => {
    await commandInput.fill('LINE')
    await commandInput.press('Enter')
    await page.mouse.click(at(...from).x, at(...from).y)
    await page.mouse.click(at(...to).x, at(...to).y)
    await page.keyboard.press('Enter')
  }

  await line([120, 120], [320, 120])
  await line([120, 200], [320, 200])
  await expect(strokes).toHaveCount(2)

  // 先把第二条的线宽改掉：它是这条用例的判别点。
  await strokes.nth(1).click({ force: true })
  const single = editor.getByRole('region', { name: /属性$/ })
  await single.getByRole('spinbutton', { name: '线条粗细' }).fill('6')
  await single.getByRole('spinbutton', { name: '线条粗细' }).press('Enter')
  await expect.poll(() => strokes.nth(1).getAttribute('stroke-width')).toBe('6')

  // 改色之前先记下两条各自的线宽：判别点是它们**在批量写入之后一个字节没动**。
  const widthsBefore = [
    await strokes.nth(0).getAttribute('stroke-width'),
    await strokes.nth(1).getAttribute('stroke-width'),
  ]
  expect(widthsBefore[0]).not.toBe(widthsBefore[1])

  // 两条一起选中。
  await strokes.nth(0).click({ force: true })
  await page.keyboard.down('Shift')
  await strokes.nth(1).click({ force: true })
  await page.keyboard.up('Shift')

  const multi = editor.getByRole('region', { name: /个对象的属性字段$/ })
  await expect(multi).toBeVisible()

  // 线宽 2 与 6 不是一个值，因此这个字段标成混合；颜色两条相同，不标。
  await expect(multi.locator('[data-property-path="strokeWidth"]'))
    .toHaveAttribute('data-property-mixed', 'true')
  await expect(multi.locator('[data-property-path="stroke"]'))
    .not.toHaveAttribute('data-property-mixed', 'true')

  /*
   * 改一次颜色，两条都变。取色器开在浮层里（popover 挂在面板之外），因此 HEX 输入框按页面
   * 找而不是按面板区域找。
   */
  await multi.getByRole('button', { name: '选择线条颜色' }).click()
  const hex = page.getByRole('textbox', { name: 'HEX' })
  await hex.fill('ff3b30')
  await hex.press('Enter')
  await page.keyboard.press('Escape')
  await expect.poll(() => strokes.nth(0).getAttribute('stroke')).toBe('#ff3b30')
  await expect.poll(() => strokes.nth(1).getAttribute('stroke')).toBe('#ff3b30')

  // 各自的线宽一个字节没动——判别点。
  expect(await strokes.nth(0).getAttribute('stroke-width')).toBe(widthsBefore[0])
  expect(await strokes.nth(1).getAttribute('stroke-width')).toBe(widthsBefore[1])

  // 批量写入只占一步撤销。
  await page.keyboard.press('Control+z')
  await expect.poll(() => strokes.nth(0).getAttribute('stroke')).not.toBe('#ff3b30')
  await expect.poll(() => strokes.nth(1).getAttribute('stroke')).not.toBe('#ff3b30')
})
