import { expect, test } from '@playwright/test'

/**
 * 几何编辑模式的纵向流程。
 *
 * @remarks
 * 判别点是 8b 记下的那笔债：轴对齐的线掰不成斜的。双击进入几何编辑之后，拖端点必须
 * 把水平线掰成斜的，且只产生一条可撤销记录。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`，zoom 恒为 1 时
 * 漏乘 zoom 也看不出来。
 */
test('OpenSpec: stage / 几何编辑模式 / 双击曲线显形夹点，拖端点把水平线掰成斜的', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()

  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  // 画一条**水平**线：这正是 8b 之后改不了方向的那种线。
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(260, 240).x, at(260, 240).y)
  await page.mouse.click(at(460, 240).x, at(460, 240).y)
  await page.keyboard.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)

  const drawn = (await stroke.boundingBox())!
  const onLine = { x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2 }

  // 单击只选中：盒手柄在，夹点不在。
  await page.mouse.click(onLine.x, onLine.y)
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(1)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(0)

  // 双击进入几何编辑：两个端点夹点显形，盒手柄让位。
  await page.mouse.dblclick(onLine.x, onLine.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(2)
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(0)

  // 拖右端点往下：水平线掰成斜的。
  const endHandle = stage.getByTestId('stage-path-vertex-hit-end')
  const endBox = (await endHandle.boundingBox())!
  const endCenter = { x: endBox.x + endBox.width / 2, y: endBox.y + endBox.height / 2 }
  await page.mouse.move(endCenter.x, endCenter.y)
  await page.mouse.down()
  await page.mouse.move(endCenter.x, endCenter.y + 90, { steps: 8 })
  await page.mouse.up()

  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })
  const startY = inspector.getByRole('spinbutton', { name: '起点 Y' })
  const endY = inspector.getByRole('spinbutton', { name: '终点 Y' })
  await expect
    .poll(async () => Number(await endY.inputValue()) - Number(await startY.inputValue()))
    .toBeGreaterThan(40)

  // 一次拖动只写一条事务：撤销一步就回到水平。
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => Number(await endY.inputValue()) - Number(await startY.inputValue()))
    .toBe(0)
})
