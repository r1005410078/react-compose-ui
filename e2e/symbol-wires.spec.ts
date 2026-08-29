import { expect, test } from '@playwright/test'
import { expandInspectorSection, pointerDrop } from './support/test-helpers'

/**
 * 导线的纵向流程。
 *
 * @remarks
 * 判别点是**求解不存储**：把符号拖走，导线的绑定端必须跟着走，而作者文档里那份几何并没有被
 * 逐条路径回写。删掉符号之后导线仍在——悬空引用是解算失败，不是文档非法。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */
test('OpenSpec: compose-document / 符号导线 / 绑定端跟着符号走，符号删掉后导线仍在', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  // 1) 放一个矩形并给它一个端口（默认落在 Entity 局部原点，即矩形左上角）。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox.x + 240,
    y: frameBox.y + 180,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  // 用固定 testid 锁住矩形：导线落地之后 `.last()` 会变成导线自己。
  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rectangle = stage.getByTestId(rectangleId)
  const beforeRect = (await rectangle.boundingBox())!

  // 2) WIRE：起点捕捉到端口，终点落在右下方的空白处。
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(beforeRect.x, beforeRect.y)
  await page.mouse.click(beforeRect.x + 220, beforeRect.y + 160)
  // `WIRE` 连续取点（可以有拐点），回车结束这一条。
  await stage.press('Enter')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  /*
   * `WIRE` 声明了 `repeat`，画完一条就接着等下一条的第一个点。不退出的话，下面那一下按在
   * 符号上的指针会被取点插件吃掉（它此刻要的是一个**点**，不是一次选择）。
   */
  await stage.press('Escape')
  // 这一条一个点都没取，因此 `Escape` 退出的是整条命令而不只是这一条。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('已取消')
  const beforeWire = (await stroke.boundingBox())!

  // 3) 把符号拖走：绑定端跟着走，自由端不动。抓左下角一带——导线从左上角斜向右下，
  // 抓中心会命中导线本身。
  const grip = { x: beforeRect.x + 8, y: beforeRect.y + beforeRect.height - 8 }
  await page.mouse.click(grip.x, grip.y)
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x - 80, grip.y - 60, { steps: 8 })
  await page.mouse.up()

  const afterRect = (await rectangle.boundingBox())!
  const moved = { x: afterRect.x - beforeRect.x, y: afterRect.y - beforeRect.y }
  expect(moved.x).toBeLessThan(-20)

  await expect.poll(async () => (await stroke.boundingBox())!.x).toBeCloseTo(beforeWire.x + moved.x, 0)
  // 自由端一动不动：右下角还在原处。
  const afterWire = (await stroke.boundingBox())!
  expect(afterWire.x + afterWire.width).toBeCloseTo(beforeWire.x + beforeWire.width, 0)

  // 4) 删掉符号：导线仍在，绑定标为失效。
  await page.mouse.click(afterRect.x + 8, afterRect.y + afterRect.height - 8)
  await page.keyboard.press('Delete')
  await expect(rectangle).toHaveCount(0)
  // 悬空引用是解算失败而不是文档非法，因此导线还在。
  await expect(stroke).toHaveCount(1)

  await stroke.click({ force: true })
  await expandInspectorSection(inspector, '接线')
  await expect(inspector.getByTestId('compose-material-wire-start'))
    .toHaveAttribute('data-wire-end', 'dangling')
  // 自由端与失效必须可区分：两者的几何都来自作者文档，屏幕上看不出差别。
  await expect(inspector.getByTestId('compose-material-wire-end'))
    .toHaveAttribute('data-wire-end', 'free')
})
