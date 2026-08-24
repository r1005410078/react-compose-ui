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

  // 双击进入几何编辑：三个夹点显形（两端 + 中点），盒手柄让位。
  await page.mouse.dblclick(onLine.x, onLine.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(3)
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

/**
 * 直线的中点夹点：按中点捕捉着整体平移。
 *
 * @remarks
 * 判别点是「这不是盒拖动的第二个入口」。盒拖动走 `snapTranslation`，吸的是**其他 Entity 的
 * 包围盒参考线**，逐轴独立；中点夹点走 `resolvePoint`，吸的是**二维特征点**，带
 * `port > endpoint > midpoint > center > quadrant` 的优先级。因此本条把目标放在另一条线的
 * **端点**上，且让那个端点落在**网格之外**——网格步长是 8，而键入的 203/85 都不是它的倍数，
 * 中点若只是被网格吸走绝无可能停在那里。
 *
 * 同一条顺带断言选区包围盒在会话期间让位：盒不是曲线的轮廓，拖夹点时它还是过期的。
 */
test('OpenSpec: stage / 曲线几何编辑会话 / 拖中点夹点把整条线平移到另一条线的端点上', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()

  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('textbox', { name: '命令行' })

  // 线 A：水平，之后拖它的中点。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 180).x, at(240, 180).y)
  await page.mouse.click(at(440, 180).x, at(440, 180).y)
  await commandInput.press('Escape')

  // 线 B：终点用相对坐标键入——键入的坐标不被任何吸附改写，因此它精确落在网格之外。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(260, 380).x, at(260, 380).y)
  await commandInput.fill('@203,85')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)

  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })
  const value = async (name: string) => Number(
    await inspector.getByRole('spinbutton', { name }).inputValue(),
  )

  // B 的终点要两份：文档坐标拿来断言，屏幕坐标拿来当拖拽目标。
  const bBox = (await strokes.nth(1).boundingBox())!
  await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2)
  const bEnd = { x: await value('终点 X'), y: await value('终点 Y') }
  // 键入的坐标没被网格改写：终点两轴都不是步长 8 的倍数。
  expect(bEnd.x % 8).not.toBe(0)
  expect(bEnd.y % 8).not.toBe(0)
  // 屏幕上那个端点在包围盒的右下角——B 朝右下走，且描边宽度只有一个像素级的误差。
  const bEndScreen = { x: bBox.x + bBox.width - 1, y: bBox.y + bBox.height - 1 }

  const aBox = (await strokes.nth(0).boundingBox())!
  const aCenter = { x: aBox.x + aBox.width / 2, y: aBox.y + aBox.height / 2 }
  await page.mouse.click(aCenter.x, aCenter.y)
  // 单击只选中：选区盒在。
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  const before = {
    start: { x: await value('起点 X'), y: await value('起点 Y') },
    end: { x: await value('终点 X'), y: await value('终点 Y') },
  }

  await page.mouse.dblclick(aCenter.x, aCenter.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  // 直线现在有三个夹点：两端各一，中点一个。
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(3)
  // 盒手柄与选区盒一并让位：一条对角线的包围盒里绝大部分是空的，而拖夹点时它还是过期的。
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(0)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(0)

  const moveGrip = stage.getByTestId('stage-path-vertex-hit-move')
  const gripBox = (await moveGrip.boundingBox())!
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await page.mouse.down()
  // 落在端点**附近**而不是端点上：捕捉半径 12 屏幕像素，偏这几像素正是要让捕捉去纠正的。
  await page.mouse.move(bEndScreen.x + 3, bEndScreen.y - 2, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => (await value('起点 X')) + (await value('终点 X')))
    .toBeCloseTo(bEnd.x * 2, 1)
  const after = {
    start: { x: await value('起点 X'), y: await value('起点 Y') },
    end: { x: await value('终点 X'), y: await value('终点 Y') },
  }
  // 中点精确落在 B 的端点上，而不是光标的裸坐标。
  expect((after.start.x + after.end.x) / 2).toBeCloseTo(bEnd.x, 1)
  expect((after.start.y + after.end.y) / 2).toBeCloseTo(bEnd.y, 1)
  // 平移，不是拉伸：长度与方向一个都没变。
  expect(after.end.x - after.start.x).toBeCloseTo(before.end.x - before.start.x, 1)
  expect(after.end.y - after.start.y).toBeCloseTo(before.end.y - before.start.y, 1)

  // 退出会话，选区盒回来。
  await page.keyboard.press('Escape')
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(0)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
})
