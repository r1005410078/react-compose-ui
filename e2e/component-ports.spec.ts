import { expect, test } from '@playwright/test'
import { pointerDrop, stableBox } from './support/test-helpers'

/**
 * 端口捕捉的纵向流程。
 *
 * @remarks
 * 判别点是**优先级严格先于距离**：让一条已有曲线的端点比端口更靠近光标，捕捉仍须给出端口。
 * 端口几乎总是画在符号线段的端点上，端点若在同等距离下胜出，用户会画出一条像素级正确但
 * 没有绑定的导线——而那个错误在屏幕上完全不可见。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */
test('OpenSpec: stage-engine / 端口捕捉 / 端口压过更近的曲线端点', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  // 1) 放一个矩形，给它一个端口。默认端口在 Entity 局部原点，也就是矩形的左上角。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const frameBox = await stableBox(frame)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox.x + 260,
    y: frameBox.y + 220,
  })

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  const rectangle = stage.locator('[data-testid^="stage-entity-"]').last()
  const rectBox = (await rectangle.boundingBox())!
  const corner = { x: rectBox.x, y: rectBox.y }

  // 2) 画一条线，终点落在离那个角只有几像素的地方——它比端口更靠近接下来的光标。
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(corner.x - 120, corner.y - 60)
  await page.mouse.click(corner.x + 6, corner.y + 4)
  await page.keyboard.press('Escape')

  // 3) 再起一条线，光标停在那个端点上：端点更近，而捕捉必须给出端口。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.move(corner.x + 6, corner.y + 4)

  const marker = stage.getByTestId('stage-drafting-snap')
  await expect(marker).toHaveAttribute('data-snap-mode', 'port')

  // 4) 标记钉在端口上，而不是那个更近的端点上。
  const markerBox = (await marker.boundingBox())!
  expect(markerBox.x + markerBox.width / 2).toBeCloseTo(corner.x, 0)
  expect(markerBox.y + markerBox.height / 2).toBeCloseTo(corner.y, 0)
})
