import { expect, test } from '@playwright/test'
import { clickCurveStroke, openPageInspector, pointerDrop, drawContainer, drawText, selectContainer, switchToDrawingWorkspace } from './support/test-helpers'


/**
 * 读出 X 轴上**最细**的那一层网格的屏幕间距。
 *
 * @remarks
 * 不能按固定下标取：网格的图层数会随缩放变化（细档淡到 0 时那一层被丢掉），
 * 而且大格分两级。X 轴的层写成 `<间距>px 100%`，取最后一条即最细的那层。
 */
const finestGridStepX = (element: Element) => {
  const sizes = getComputedStyle(element).backgroundSize.split(', ')
  const xs = sizes.filter((size) => size.endsWith('100%'))
  return Number.parseFloat(xs[xs.length - 1]!)
}

test('OpenSpec: stage / 四角缩放 / resize 手柄在预览阶段跟随鼠标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const movements = {
    ne: { x: -100, y: 60 },
    se: { x: -100, y: -60 },
    sw: { x: 100, y: -60 },
    nw: { x: 100, y: 60 },
  } as const

  for (const [direction, movement] of Object.entries(movements)) {
    const handle = stage.getByTestId(`stage-resize-${direction}`)
    const startBox = await handle.boundingBox()
    expect(startBox).not.toBeNull()
    const start = {
      x: startBox!.x + startBox!.width / 2,
      y: startBox!.y + startBox!.height / 2,
    }
    const target = {
      x: start.x + movement.x,
      y: start.y + movement.y,
    }
    expect(await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
      start,
    )).toBe(`stage-resize-${direction}`)

    for (const [from, to] of [[start, target], [target, start]] as const) {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 5 })
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box
          ? Math.max(
              Math.abs(box.x + box.width / 2 - to.x),
              Math.abs(box.y + box.height / 2 - to.y),
            )
          : Number.POSITIVE_INFINITY
      }).toBeLessThanOrEqual(4.1)
      await page.mouse.up()
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box
          ? Math.max(
              Math.abs(box.x + box.width / 2 - to.x),
              Math.abs(box.y + box.height / 2 - to.y),
            )
          : Number.POSITIVE_INFINITY
      }).toBeLessThanOrEqual(4.1)
    }
  }
})


test('OpenSpec: stage / 绘制工具与框选隔离 / 十字光标、形状预览与尺寸浮标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  // 拖拽绘制只剩容器与文字：制图几何一律由绘图命令产出。
  await editor.getByRole('button', { name: '创建容器', exact: true }).click()
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'crosshair')
  await expect(output).toHaveCSS('cursor', /crosshair/)

  const start = { x: outputBox!.x + 180, y: outputBox!.y + 132 }
  const target = { x: start.x + 248, y: start.y + 144 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })

  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-container')
  await expect(preview.locator('rect')).toHaveCount(2)
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('248 × 144')
  await expect(stage.getByTestId('stage-marquee')).toHaveCount(0)
  await expect(stage).toHaveScreenshot('stage-drawing-container-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.mouse.up()
  await expect(editor.getByRole('treegrid', { name: '场景树' }).getByText('Container', { exact: true })).toBeVisible()
})


test('OpenSpec: stage / Stage 节点层级操作 / 菜单、快捷键、命中与撤销保持一致', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()
  const start = { x: outputBox!.x + 240, y: outputBox!.y + 180 }
  const target = { x: start.x + 200, y: start.y + 120 }

  // 两个几何完全重合的矩形：第二个的角点会被特征点捕捉吸到第一个的角上，因此两条描边
  // 逐像素重叠，重叠处的点选正是本条要考的东西。
  for (let index = 0; index < 2; index += 1) {
    await editor.getByRole('button', { name: '矩形', exact: true }).click()
    await page.mouse.click(start.x, start.y)
    await page.mouse.click(target.x, target.y)
  }

  const nodes = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  /*
   * 重叠取样点取**上边四分之一处**：`RECTANGLE` 产出的是空心的闭合多段线，命中按点到几何的
   * 距离判定，盒中心是空白；而上边的**中点**正好压在上中缩放手柄上，选中之后那一下会被手柄
   * 吃掉，选区停在原处。用渲染出来的盒而不是鼠标原始坐标——角点经过了吸附。
   */
  const nodeBox = (await nodes.first().boundingBox())!
  const overlap = { x: nodeBox.x + nodeBox.width / 4, y: nodeBox.y }

  await expect(nodes).toHaveCount(2)
  const originalBackId = await nodes.nth(0).getAttribute('data-entity-id')
  const originalFrontId = await nodes.nth(1).getAttribute('data-entity-id')
  expect(originalBackId).not.toBeNull()
  expect(originalFrontId).not.toBeNull()

  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const tree = editor.getByRole('treegrid', { name: '场景树' })
  const treeOrder = () => tree.locator('[data-scene-node-id]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-scene-node-id')))
  // 场景树的第一行是根画板，两个渲染节点是它的子级。
  await expect.poll(treeOrder).toEqual(['frame-root', originalBackId, originalFrontId])

  /*
   * 每次按重叠点取顶层之前先点一下空白取消选择：矩形选中之后八个手柄与四条边缘命中带正好
   * 盖住它的整圈描边，此时再点同一处开始的是缩放而不是换选中——那与矩形物料的行为一致，
   * 而本条考的是层级操作，不是那件事。
   */
  const pickTopmost = async () => {
    await page.mouse.click(outputBox!.x + 24, outputBox!.y + 24)
    await page.mouse.click(overlap.x, overlap.y)
  }

  await page.mouse.click(overlap.x, overlap.y)
  await expect(tree.locator(`[data-scene-node-id="${originalFrontId}"]`))
    .toHaveAttribute('aria-selected', 'true')
  await page.mouse.click(overlap.x, overlap.y, { button: 'right' })
  const layerOrder = page.getByRole('menuitem', { name: /^层级/ })
  await layerOrder.hover()
  const sendToBack = page.getByRole('menuitem', { name: /置于底层/ })
  await expect(sendToBack).toBeVisible()
  await expect(page).toHaveScreenshot('stage-layer-order-menu.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await sendToBack.click()

  await expect.poll(treeOrder).toEqual(['frame-root', originalFrontId, originalBackId])
  await expect(tree.locator(`[data-scene-node-id="${originalFrontId}"]`))
    .toHaveAttribute('aria-selected', 'true')
  await pickTopmost()
  await expect(tree.locator(`[data-scene-node-id="${originalBackId}"]`))
    .toHaveAttribute('aria-selected', 'true')

  await stage.press('Control+[')
  // 场景树的第一行是根画板，两个渲染节点是它的子级。
  await expect.poll(treeOrder).toEqual(['frame-root', originalBackId, originalFrontId])
  await pickTopmost()
  await expect(tree.locator(`[data-scene-node-id="${originalFrontId}"]`))
    .toHaveAttribute('aria-selected', 'true')

  await stage.press('Control+z')
  await expect.poll(treeOrder).toEqual(['frame-root', originalFrontId, originalBackId])
  await pickTopmost()
  await expect(tree.locator(`[data-scene-node-id="${originalBackId}"]`))
    .toHaveAttribute('aria-selected', 'true')
})


test('OpenSpec: stage / 直接绘制 Preset / 文字工具只按点创建', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  const textTool = editor.getByRole('button', { name: '文字', exact: true })
  await textTool.click()
  const clickPoint = { x: outputBox!.x + 180, y: outputBox!.y + 132 }
  await page.mouse.click(clickPoint.x, clickPoint.y)

  await expect(editor.getByRole('button', { name: '选择', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const defaultText = stage.getByTestId('compose-material-text')
  await expect(defaultText).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(defaultText).toHaveCSS('font-size', '12px')
  const defaultTextBox = await defaultText.boundingBox()
  expect(defaultTextBox).not.toBeNull()
  expect(defaultTextBox!.width).toBeLessThan(64)
  expect(defaultTextBox!.height).toBeLessThanOrEqual(24)

  await textTool.click()
  const start = { x: outputBox!.x + 280, y: outputBox!.y + 172 }
  const target = { x: start.x + 160, y: start.y + 48 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })
  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-text')
  // 占位文案不得出现在 Stage 的任何位置。范围必须是整个 Stage 而不是预览元素内部：
  // 它曾经就画在预览框之外（y + 25，落在 16px 高的框下方），只查预览会漏掉。
  // 尺寸标签本身也是 SVG text，因此按内容精确匹配。
  await expect(stage.getByText('Text', { exact: true })).toHaveCount(0)
  // 文字预览只有一根光标：不画框、不标尺寸，也不随拖拽变化。
  const caret = preview.getByTestId('stage-drawing-preview-caret')
  await expect(caret).toHaveCount(1)
  await expect(preview.locator('rect')).toHaveCount(0)
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toHaveCount(0)
  const caretGeometry = async () => caret.evaluate((node) => ({
    x: node.getAttribute('x1'),
    y1: node.getAttribute('y1'),
    y2: node.getAttribute('y2'),
  }))
  const pressed = await caretGeometry()

  await page.mouse.move(target.x + 120, target.y + 60, { steps: 4 })
  await expect(stage.getByText('Text', { exact: true })).toHaveCount(0)
  expect(await caretGeometry()).toEqual(pressed)
  await expect(stage).toHaveScreenshot('stage-drawing-text-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await page.mouse.up()

  // 拖了 160×48 也只得到按下点上的 Auto width 文字，并直接进入编辑。
  await expect(stage.getByTestId('compose-material-text-editable')).toHaveText('')
  const created = stage.locator('.compose-stage__node.is-renderer').last()
  const createdBox = await created.boundingBox()
  expect(createdBox!.width).toBeLessThan(64)
})


test('OpenSpec: stage / ARROW / 两点取向、marker 与反向重画', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  const arrow = editor.getByRole('button', { name: '箭头', exact: true })
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  // 竖直取两点：退化轴由曲线自己的最小范围钳住，不再需要 Shape 那个 0.5px 偏移补丁。
  const start = { x: outputBox!.x + 196, y: outputBox!.y + 128 }
  const target = { x: start.x, y: start.y + 144 }
  await arrow.click()
  await page.mouse.click(start.x, start.y)
  await page.mouse.click(target.x, target.y)

  // 画出来的是曲线，箭头挂在几何终点上。
  await expect(strokes).toHaveCount(1)
  expect(await strokes.first().getAttribute('marker-end')).toMatch(/^url\(#/)
  // 向下取第二点，终点在下：方向由两个真实坐标表达，不再有三态编码。
  expect(Number(await strokes.first().getAttribute('y2')))
    .toBeGreaterThan(Number(await strokes.first().getAttribute('y1')))

  /*
   * 命令产出的对象**不进**几何编辑：命令还握着光标与提示，两个「正在取点」的东西叠在
   * 一起会让 `Escape` 的含义说不清。「画完曲线直接进几何编辑」说的是绘制手势那条路。
   */
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(0)

  /*
   * `ARROW` 声明了 `repeat`：画完一条接着画下一条，因此按钮仍是按下态、提示回到**第一步**。
   * 判据是「用户画完之后想对它做什么」——箭头和导线一样是成批标注出来的。
   */
  await expect(arrow).toHaveAttribute('aria-pressed', 'true')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')

  // 反向取第二条：终点在上，几何跟着翻过来。命令还在跑，因此不用再点一次按钮。
  await page.mouse.click(target.x + 120, target.y)
  await page.mouse.click(start.x + 120, start.y)
  await expect(strokes).toHaveCount(2)
  expect(Number(await strokes.nth(1).getAttribute('y2')))
    .toBeLessThan(Number(await strokes.nth(1).getAttribute('y1')))

  // 一个点都没取时 `Escape` 退出命令。
  await stage.press('Escape')
  await expect(arrow).toHaveAttribute('aria-pressed', 'false')
})


test('OpenSpec: stage / 线段命中 / 透明外接矩形不选中，线身仍可选中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  const start = { x: outputBox!.x + 180, y: outputBox!.y + 420 }
  const end = { x: start.x + 360, y: start.y - 240 }
  // `LINE` 的按钮只在绘图工作区的货架上。
  await switchToDrawingWorkspace(page)
  await editor.getByRole('button', { name: '直线', exact: true }).click()
  await page.mouse.click(start.x, start.y)
  await page.mouse.click(end.x, end.y)
  // `LINE` 逐段落地且不自动结束，先把命令收掉再验命中。
  await stage.press('Escape')

  // 曲线的选中呈现是沿几何的轮廓，不是包围盒。命令不回选，先点线身选中它。
  const selection = stage.getByTestId('stage-selection-outline')
  await page.mouse.click((start.x + end.x) / 2, (start.y + end.y) / 2)
  await expect(selection).toBeVisible()

  // 位于轴对齐外接矩形内部，但离实际线段很远；点击应落到画布并清除选择。
  await page.mouse.click(end.x - 24, start.y - 24)
  await expect(selection).toHaveCount(0)

  // 加宽的透明 stroke 仍给细线保留易用的点击命中带。
  await page.mouse.click((start.x + end.x) / 2, (start.y + end.y) / 2)
  await expect(selection).toBeVisible()
})


test('OpenSpec: stage / 画布平移手势 / 空闲张手且拖动时握手', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  const horizontalRuler = stage.getByTestId('stage-ruler-x')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  const rulerBox = await horizontalRuler.boundingBox()
  expect(outputBox).not.toBeNull()
  expect(rulerBox).not.toBeNull()
  const point = { x: outputBox!.x + 320, y: outputBox!.y + 240 }

  /*
   * 平移只剩两个入口：按住空格与中键。
   *
   * 曾经还有一个 pan 工具位——它与这两个随时可用的临时覆盖完全重复，而工具是**有状态的**：
   * 选了 pan 之后要再选回 select 才能做别的事。
   */
  // 临时 Space 平移，松开后恢复选择工具的默认光标。
  await editor.getByRole('button', { name: '选择', exact: true }).click()
  await stage.focus()
  await page.keyboard.down('Space')
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'grab')
  await expect(output).toHaveCSS('cursor', 'grab')
  await page.mouse.move(point.x + 40, point.y + 24)
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'grabbing')
  await expect(output).toHaveCSS('cursor', 'grabbing')
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'default')

  // 中键：与工具无关，Pointer capture 期间同样是握手。
  await page.mouse.move(point.x, point.y)
  await page.mouse.down({ button: 'middle' })
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'grabbing')
  await page.mouse.move(point.x + 40, point.y + 24, { steps: 3 })
  await page.mouse.up({ button: 'middle' })
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'default')
})


test('OpenSpec: stage / 自适应网格标尺与世界原点 / 最低缩放仍显示网格并保持网格单位吸附', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(rectangle)
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()

  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  let expectedHistoryCount = await historyEntries.count()
  for (let index = 0; index < 13; index += 1) {
    await stage.press('Control+-')
  }
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const grid = stage.getByTestId('stage-grid')
  // 判别点是「还在画」而不是某个具体间距：抽稀让细档间距恒落在 [4, 8)，因此缩到最低倍数
  // 时网格仍然可见，而满不透明度的线（骨架档，细档的两倍）恒不小于 8px。
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeGreaterThanOrEqual(4)
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeLessThan(8)

  const beforeMove = await rectangle.boundingBox()
  expect(beforeMove).not.toBeNull()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2,
    beforeMove!.y + beforeMove!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2 + 19,
    beforeMove!.y + beforeMove!.height / 2 + 13,
    { steps: 1 },
  )
  await page.mouse.up()
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const xField = editor.getByRole('spinbutton', { name: '位置 X', exact: true })
  await expect.poll(async () => Number(await xField.inputValue()) % 4).toBe(0)

  const resize = stage.getByTestId('stage-resize-se')
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2,
    resizeBox!.y + resizeBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2 + 17,
    resizeBox!.y + resizeBox!.height / 2 + 11,
    { steps: 1 },
  )
  await page.mouse.up()
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const widthField = editor.getByRole('combobox', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => Number(await widthField.inputValue()) % 4).toBe(0)
})


test('OpenSpec: stage / Pointer 手势原子性与取消 / move 与 resize 各只提交一次且松手不回弹', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  const frame = editor.getByTestId('stage-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox!.x + frameBox!.width * 0.35,
    y: frameBox!.y + frameBox!.height * 0.4,
  })
  // 矩形现在是曲线，节点里没有任何文字——`hasText` 匹配不到，改用它的描边元素。
  const rectangle = stage.locator(
    '.compose-stage__node.is-renderer:has([data-testid="compose-material-curve-stroke"])',
  )
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(rectangle)
  const rectangleId = await rectangle.getAttribute('data-entity-id')
  expect(rectangleId).not.toBeNull()
  const stablePanel = editor.locator(`[data-entity-id="${rectangleId}"]`)
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()

  let expectedHistoryCount = await historyEntries.count()
  const beforeMove = await stablePanel.boundingBox()
  expect(beforeMove).not.toBeNull()
  // 起点**避开刚才那一下点击**：同一个位置的第二次按下会被浏览器判成双击，而双击一个矩形
  // 进的是几何编辑（它是曲线），这一次拖拽就再也不是移动了。
  const moveStart = {
    x: beforeMove!.x + beforeMove!.width * 0.25,
    y: beforeMove!.y + beforeMove!.height * 0.25,
  }
  await page.keyboard.down('Control')
  await page.mouse.move(moveStart.x, moveStart.y)
  await page.mouse.down()
  await page.mouse.move(moveStart.x + 48, moveStart.y + 24, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const afterMove = await stablePanel.boundingBox()
  expect(afterMove).not.toBeNull()
  expect(afterMove!.x).not.toBeCloseTo(beforeMove!.x, 1)
  const committedMoveX = afterMove!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await stablePanel.boundingBox())?.x)
    .toBeCloseTo(committedMoveX, 1)

  await selectContainer(editor)
  const resize = editor.getByTestId('stage-resize-se')
  expectedHistoryCount = await historyEntries.count()
  const beforeResize = await resize.boundingBox()
  expect(beforeResize).not.toBeNull()
  const resizeStart = {
    x: beforeResize!.x + beforeResize!.width / 2,
    y: beforeResize!.y + beforeResize!.height / 2,
  }
  await page.keyboard.down('Control')
  await page.mouse.move(resizeStart.x, resizeStart.y)
  await page.mouse.down()
  await page.mouse.move(resizeStart.x + 40, resizeStart.y + 32, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect(historyEntries).toHaveCount(expectedHistoryCount + 1)
  const afterResize = await resize.boundingBox()
  expect(afterResize).not.toBeNull()
  expect(afterResize!.x).not.toBeCloseTo(beforeResize!.x, 1)
  const committedResizeX = afterResize!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await resize.boundingBox())?.x)
    .toBeCloseTo(committedResizeX, 1)
})


test('OpenSpec: stage / 组合 Container 直接操纵 / 舞台可拖动组合 Container 且子节点保持可命中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  const rectangleButton = editor.getByRole('button', { name: '添加 矩形' })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 220,
    y: frameBox!.y + 220,
  })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 580,
    y: frameBox!.y + 220,
  })

  const components = stage.locator('.compose-stage__node.is-renderer')
  const firstEntityId = await components.nth(0).getAttribute('data-entity-id')
  const secondEntityId = await components.nth(1).getAttribute('data-entity-id')
  expect(firstEntityId).not.toBeNull()
  expect(secondEntityId).not.toBeNull()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(components.nth(0))
  await clickCurveStroke(components.nth(1), { modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = frame.locator(':scope > .compose-stage__node.is-container')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-entity-id')
  expect(groupId).not.toBeNull()
  const stableGroup = editor.locator(`[data-entity-id="${groupId}"]`)
  const componentBoxes = await Promise.all([
    components.nth(0).boundingBox(),
    components.nth(1).boundingBox(),
  ])
  expect(componentBoxes.every(Boolean)).toBe(true)
  const [left, right] = [...componentBoxes]
    .map((box) => box!)
    .sort((first, second) => first.x - second.x)
  const gapPoint = {
    x: (left.x + left.width + right.x) / 2,
    y: (Math.max(left.y, right.y) + Math.min(
      left.y + left.height,
      right.y + right.height,
    )) / 2,
  }
  const nodeAt = (point: { x: number; y: number }) => page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)
      ?.closest('[data-entity-id]')
      ?.getAttribute('data-entity-id'),
    point,
  )
  expect(await nodeAt(gapPoint)).toBe(groupId)

  const groupBefore = await stableGroup.boundingBox()
  expect(groupBefore).not.toBeNull()
  await page.keyboard.down('Control')
  await page.mouse.move(gapPoint.x, gapPoint.y)
  await page.mouse.down()
  await page.mouse.move(gapPoint.x + 80, gapPoint.y + 40, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  const groupAfter = await stableGroup.boundingBox()
  expect(groupAfter).not.toBeNull()
  expect(groupAfter!.x).not.toBeCloseTo(groupBefore!.x, 1)
  const committedGroupX = groupAfter!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await stableGroup.boundingBox())?.x)
    .toBeCloseTo(committedGroupX, 1)

  const child = editor.locator(`[data-entity-id="${firstEntityId}"]`)
  const childBefore = await child.boundingBox()
  expect(childBefore).not.toBeNull()
  // 取**上边线**而不是盒中心：这个子项是矩形，默认空心，盒内部不命中。
  const childPoint = {
    x: childBefore!.x + childBefore!.width / 2,
    y: childBefore!.y + 1,
  }
  expect(await nodeAt(childPoint)).toBe(await child.getAttribute('data-entity-id'))
  await page.keyboard.down('Control')
  await page.mouse.move(childPoint.x, childPoint.y)
  await page.mouse.down()
  await page.mouse.move(childPoint.x + 40, childPoint.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  const childAfter = await child.boundingBox()
  expect(childAfter).not.toBeNull()
  expect(childAfter!.x).not.toBeCloseTo(childBefore!.x, 1)
  const childX = childAfter!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await child.boundingBox())?.x)
    .toBeCloseTo(childX, 1)
})


test('OpenSpec: stage / 网格标尺辅助线与滚动导航 / 完成 Godot 风格纵向流程', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  await editor.getByRole('button', { name: '网格大小' }).click()
  await editor.getByRole('menu', { name: '网格大小' })
    .getByRole('menuitem', { name: '画布设置' })
    .click()
  const settings = editor.getByRole('dialog', { name: '画布网格与吸附设置' })
  await settings.getByRole('textbox', { name: 'X 步长' }).fill('16')
  await settings.getByRole('textbox', { name: 'Y 步长' }).fill('16')
  await settings.getByRole('button', { name: '应用' }).click()
  await expect(editor.getByRole('button', { name: '吸附' }))
    .toHaveAttribute('aria-pressed', 'true')

  const frame = stage.getByTestId('stage-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox!.x + frameBox!.width * 0.3,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  // 矩形现在是曲线，节点里没有任何文字——`hasText` 匹配不到，改用它的描边元素。
  const rectangle = stage.locator(
    '.compose-stage__node.is-renderer:has([data-testid="compose-material-curve-stroke"])',
  )
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(rectangle)

  const beforeMove = await rectangle.boundingBox()
  expect(beforeMove).not.toBeNull()
  /*
   * 起点在**上边线**上：矩形默认空心，盒内部不命中，可拖的只有那一圈描边。横向偏移避开
   * 刚才那一下点击——同一个位置的第二次按下会被浏览器判成双击，而双击一个矩形进的是几何
   * 编辑（它是曲线）。
   */
  const dragFrom = {
    x: beforeMove!.x + beforeMove!.width * 0.6,
    y: beforeMove!.y + 1,
  }
  await page.mouse.move(dragFrom.x, dragFrom.y)
  await page.mouse.down()
  await page.mouse.move(dragFrom.x + 27, dragFrom.y + 19, { steps: 5 })
  await page.mouse.up()
  const xField = editor.getByRole('spinbutton', { name: '位置 X', exact: true })
  // Yoga absolute inset 以父容器 border 内沿为原点；默认 Container border 为 1px。
  await expect.poll(async () => {
    const resolvedX = Number(await xField.inputValue()) + 1
    return Math.abs(resolvedX - Math.round(resolvedX / 16) * 16)
  }).toBeLessThan(0.001)

  const resize = stage.getByTestId('stage-resize-se')
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2,
    resizeBox!.y + resizeBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2 + 31,
    resizeBox!.y + resizeBox!.height / 2 + 23,
    { steps: 5 },
  )
  await page.mouse.up()
  const widthField = editor.getByRole('combobox', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => {
    const width = Number(await widthField.inputValue())
    return Math.abs(width - Math.round(width / 16) * 16)
  }).toBeLessThan(0.001)

  // 标尺已改为 Canvas，无法再按刻度节点断言。改为验证共享点阵：世界原点必须正好落在画布
  // 网格线上；标尺与网格由同一 lattice 产出（见 stage-engine 单测），因此二者随之对齐。
  const originX = Number(await stage.getByTestId('stage-origin-y').getAttribute('x1'))
  const originY = Number(await stage.getByTestId('stage-origin-x').getAttribute('y1'))
  const gridLattice = await stage.getByTestId('stage-grid').evaluate((element) => {
    const computed = getComputedStyle(element)
    const sizes = computed.backgroundSize.split(', ')
    const positions = computed.backgroundPosition.split(', ')
    // 按下标取会随图层数漂：细档淡到 0 时那一层被丢掉，大格又分两级。取每个轴最后一条，
    // 也就是最细的那一层——世界原点要落在它上面。
    const lastIndexWhere = (test: (value: string) => boolean) =>
      sizes.reduce((found, size, index) => (test(size) ? index : found), -1)
    const x = lastIndexWhere((size) => size.endsWith('100%'))
    const y = lastIndexWhere((size) => size.startsWith('100%'))
    return {
      stepX: Number.parseFloat(sizes[x] ?? ''),
      stepY: Number.parseFloat(sizes[y]?.split(' ')[1] ?? ''),
      offsetX: Number.parseFloat(positions[x] ?? ''),
      offsetY: Number.parseFloat(positions[y]?.split(' ')[1] ?? ''),
    }
  })
  const distanceToLine = (position: number, offset: number, step: number) => {
    const remainder = Math.abs(position - offset) % step
    return Math.min(remainder, step - remainder)
  }
  expect(distanceToLine(originX, gridLattice.offsetX, gridLattice.stepX)).toBeLessThan(0.001)
  expect(distanceToLine(originY, gridLattice.offsetY, gridLattice.stepY)).toBeLessThan(0.001)

  const ruler = stage.getByTestId('stage-ruler-x')
  const rulerBox = await ruler.boundingBox()
  const surfaceBox = await stage.getByTestId('stage-surface').boundingBox()
  expect(rulerBox).not.toBeNull()
  expect(surfaceBox).not.toBeNull()
  await page.mouse.move(rulerBox!.x + rulerBox!.width * 0.6, rulerBox!.y + 10)
  await page.mouse.down()
  await page.mouse.move(surfaceBox!.x + surfaceBox!.width * 0.62, surfaceBox!.y + 120)
  await page.mouse.up()
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(1)
  await expect(editor).toHaveScreenshot('stage-workspace-guide.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await stage.press('Control+z')
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(0)
  await stage.press('Control+Shift+z')
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(1)

  const horizontal = stage.getByRole('scrollbar', { name: '水平画布滚动条' })
  const beforeScroll = await horizontal.getAttribute('aria-valuenow')
  await horizontal.press('End')
  await expect(horizontal).not.toHaveAttribute('aria-valuenow', beforeScroll!)
  await horizontal.press('Home')
  // 回到 Home 后视口起点必须落到负世界坐标，即标尺重新覆盖负刻度区间。
  // 虚拟滚动范围会单调扩展，因此只能断言符号而不能断言等于 aria-valuemin。
  await expect.poll(async () => {
    const now = await horizontal.getAttribute('aria-valuenow')
    return now === null ? Number.NaN : Number(now)
  }).toBeLessThan(0)
  await expect(editor).toHaveScreenshot('stage-workspace-negative-scroll.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})


test('OpenSpec: stage / DOM Scene 与 SVG Overlay 分层 / 完整示例视觉黄金文件', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })

  await expect(editor).toHaveScreenshot('stage-workspace-default.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
  await editor.getByText('命令', { exact: true }).click()
  await expect(editor.getByRole('region', { name: '命令调试台' })
    .getByText('成功').first()).toBeVisible()
  await expect(editor).toHaveScreenshot('stage-workspace-root-component.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await editor.getByText('命令', { exact: true }).click()

  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox!.x + 160,
    y: frameBox!.y + 180,
  })
  // 这个用例改过视口缩放，固定像素偏移会落到容器外；按容器尺寸取比例才稳定。
  await drawText(page, editor, {
    x: frameBox!.x + frameBox!.width * 0.6,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  const frame = stage.getByTestId('stage-container')
  const frameComponents = frame.locator(':scope > .compose-stage__node.is-renderer')
  // 第一个是矩形：默认空心，盒内部不命中，选中它要点那一圈描边。
  await clickCurveStroke(frameComponents.nth(0))
  await frameComponents.nth(1).click({
    modifiers: ['Shift'],
  })

  await expect(editor).toHaveScreenshot('stage-workspace-selected.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+g')
  // 根画板自身也是容器节点，Group 后画板下多一层嵌套容器。
  await expect(stage.locator('.compose-stage__node.is-container .compose-stage__node.is-container'))
    .toHaveCount(2)
  await expect(editor).toHaveScreenshot('stage-workspace-nested-frame.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+Shift+g')

  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.getByRole('row', { name: /Container/ })
    .getByRole('button', { name: '展开节点' })
    .click()
  await editor.getByRole('row', { name: /Rectangle/ }).last().click()
  const rectangle = frame.locator(
    ':scope > .compose-stage__node.is-renderer:has([data-testid="compose-material-curve-stroke"])',
  )
  const rectangleBox = await rectangle.boundingBox()
  expect(rectangleBox).not.toBeNull()
  await expect(editor.getByRole('region', { name: 'Rectangle 属性', exact: true })).toBeVisible()
  const pointerStart = {
    clientX: rectangleBox!.x + rectangleBox!.width / 2,
    clientY: rectangleBox!.y + rectangleBox!.height / 2,
  }
  const pointerEnd = {
    clientX: pointerStart.clientX + frameBox!.x - rectangleBox!.x + 2,
    clientY: pointerStart.clientY,
  }
  await rectangle.dispatchEvent('pointerdown', {
    ...pointerStart,
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 41,
  })
  await stage.dispatchEvent('pointermove', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 41,
  })
  await expect(stage.locator('.compose-stage__guide')).not.toHaveCount(0)
  await expect(editor).toHaveScreenshot('stage-workspace-snapping.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.dispatchEvent('pointerup', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    buttons: 0,
    pointerId: 41,
  })
})


test('OpenSpec: stage / 自适应网格标尺与世界原点 / Canvas 标尺对齐网格并显示选区与游标', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(stage.locator('.compose-stage__node.is-renderer').first())

  const horizontal = stage.getByTestId('stage-ruler-x')
  const vertical = stage.getByTestId('stage-ruler-y')
  // 容器语义必须在迁移到 Canvas 后保持不变；刻度本身不再是 DOM。
  await expect(horizontal).toHaveAttribute('aria-label', '水平标尺')
  await expect(vertical).toHaveAttribute('aria-label', '垂直标尺')
  await expect(horizontal.locator('canvas')).toHaveAttribute('aria-hidden', 'true')
  await expect(horizontal.locator('[data-world-value]')).toHaveCount(0)

  const surface = await stage.getByTestId('stage-surface').boundingBox()
  expect(surface).not.toBeNull()
  // 指针停在一个确定位置，让游标线进入黄金图。
  await page.mouse.move(surface!.x + 180, surface!.y + 140)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  await expect(page).toHaveScreenshot('stage-ruler-canvas.png', {
    animations: 'disabled',
    caret: 'hide',
    clip: { x: stageBox!.x, y: stageBox!.y, width: 320, height: 220 },
    maxDiffPixelRatio: 0.01,
  })
})




test('OpenSpec: stage / 顶层容器标题标签 / 场景带标签重命名而嵌套容器点体选中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  const frameBox = (await stage.getByTestId('stage-container').boundingBox())!

  // 容器内放一个矩形：即使有内容，场景内的容器也不收敛、不带标签。
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox.x + frameBox.width * 0.3,
    y: frameBox.y + frameBox.height * 0.3,
  })
  // 标题标签只画给场景（rootIds 直接成员）；场景内的容器已是嵌套层，不带标签。
  const nestedLabels = editor
    .locator('[data-testid^="stage-container-label-"]:not([data-testid$="frame-root"])')
  await expect(nestedLabels).toHaveCount(0)
  const sceneLabel = editor.getByTestId('stage-container-label-frame-root')
  await expect(sceneLabel).toHaveText('场景')

  // 嵌套容器没有标签，点体就是它的选中入口——即使装了内容也不收敛为框选。
  await page.mouse.click(frameBox.x + frameBox.width - 24, frameBox.y + frameBox.height - 24)
  await expect(editor.getByRole('region', { name: 'Container 属性', exact: true }))
    .toBeVisible()

  // 场景体仍然收敛：点空白工作区清空选择，再从场景空白处起框。框只与容器右缘相交
  //（避开内部矩形），选中的是容器本身，起框的场景不进入结果。
  await openPageInspector(page, editor)
  await expect(editor.getByRole('region', { name: 'Container 属性', exact: true }))
    .toHaveCount(0)
  await page.mouse.move(frameBox.x + frameBox.width + 40, frameBox.y + 20)
  await page.mouse.down()
  await page.mouse.move(frameBox.x + frameBox.width - 40, frameBox.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect(editor.getByRole('region', { name: 'Container 属性', exact: true }))
    .toBeVisible()

  // 双击场景标签就地重命名，结果与场景树同步。
  await sceneLabel.dblclick()
  const input = editor.locator('input.compose-stage__container-label')
  await input.fill('登录页')
  await input.press('Enter')
  await expect(sceneLabel).toHaveText('登录页')
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await expect(sceneTree.getByRole('row', { name: /登录页/ })).toBeVisible()
})

test('OpenSpec: stage / 场景视口适配 / 首次进入适配激活场景', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(frame).toBeVisible()

  // 1280×720 的场景在这块可视区域里放不下 100%，因此适配一定把缩放压到 100% 以下。
  // 适配发生在首次量到 surface 之后的一个 effect 里，读数值前必须等它落地。
  const zoomValue = editor.locator('.compose-editor__canvas-zoom-value')
  await expect(zoomValue).not.toHaveText('100%')
  const zoom = Number((await zoomValue.textContent())!.replace('%', ''))
  expect(zoom).toBeGreaterThan(10)
  expect(zoom).toBeLessThan(100)

  // 适配后场景整体落在 Stage 可视区域内，四周还留有空白。
  const stageBox = await stage.boundingBox()
  const frameBox = await frame.boundingBox()
  expect(frameBox!.x).toBeGreaterThan(stageBox!.x)
  expect(frameBox!.y).toBeGreaterThan(stageBox!.y)
  expect(frameBox!.x + frameBox!.width).toBeLessThan(stageBox!.x + stageBox!.width)
  expect(frameBox!.y + frameBox!.height).toBeLessThan(stageBox!.y + stageBox!.height)

  // 关掉自动适配的宿主停在受控初始视口，缩放仍是 100%。
  await page.goto('/?no-auto-fit')
  await expect(stage.getByTestId('stage-frame-boundary-frame-root')).toBeVisible()
  await expect(zoomValue).toHaveText('100%')
})

test('OpenSpec: stage / 场景尺寸弹框 / 双击尺寸胶囊改尺寸并重新适配', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const chip = stage.getByTestId('stage-scene-size-frame-root')
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(frame).toBeVisible()
  await expect(chip).toHaveText('1280 × 720')
  // 先等首次适配落地，否则量到的是适配前那一帧的场景宽度。
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')
  const fittedWidth = (await frame.boundingBox())!.width

  await chip.dblclick()
  const dialog = page.getByTestId('stage-scene-size-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('stage-scene-size-preset-1920x1080').click()
  await expect(dialog.getByTestId('stage-scene-size-width')).toHaveValue('1920')
  await dialog.getByTestId('stage-scene-size-confirm').click()
  await expect(dialog).toBeHidden()

  await expect(chip).toHaveText('1920 × 1080')
  // 改完立刻重新适配：更宽的场景在屏幕上仍占据同一片可视区域，而不是溢出到画布外。
  expect((await frame.boundingBox())!.width).toBeCloseTo(fittedWidth, 0)
  const stageBox = await stage.boundingBox()
  const frameBox = await frame.boundingBox()
  expect(frameBox!.x + frameBox!.width).toBeLessThan(stageBox!.x + stageBox!.width)

  // 与 Inspector 走同一条命令，撤销一步回到原尺寸。
  await stage.press('Control+z')
  await expect(chip).toHaveText('1280 × 720')

  // 取消不写文档：改了输入再按 Esc，尺寸不变，重新打开回到当前值。
  await chip.dblclick()
  await dialog.getByTestId('stage-scene-size-width').fill('900')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(chip).toHaveText('1280 × 720')
  await chip.dblclick()
  await expect(dialog.getByTestId('stage-scene-size-width')).toHaveValue('1280')
})

test('OpenSpec: stage-engine / Headless 绘制会话 / 非 100% 缩放下绘制读数仍是网格倍数', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(frame).toBeVisible()
  // 首次进入已经适配，缩放不是 100%：world = (屏幕 - 视口) / zoom 此时必然带小数，
  // 这正是绘制没接吸附时会写进文档的那串长尾。
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  // 起止都用奇数屏幕偏移：未吸附的话每一个读数都会带小数。
  const box = await frame.boundingBox()
  await editor.getByRole('button', { name: '创建容器' }).click()
  await page.mouse.move(box!.x + 41, box!.y + 43)
  await page.mouse.down()
  await page.mouse.move(box!.x + 223, box!.y + 161, { steps: 6 })
  await page.mouse.up()
  await editor.getByRole('button', { name: '选择', exact: true }).click()

  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  const readings = await Promise.all([
    inspector.getByRole('spinbutton', { name: '位置 X' }).inputValue(),
    inspector.getByRole('spinbutton', { name: '位置 Y' }).inputValue(),
    inspector.getByRole('combobox', { name: '尺寸宽度' }).inputValue(),
    inspector.getByRole('combobox', { name: '尺寸高度' }).inputValue(),
  ])
  for (const reading of readings) {
    // 吸附把四条边都拉回网格（默认步长 4），因此读数是整数且是 4 的倍数——没有小数需要保留。
    expect(reading).toMatch(/^-?\d+$/)
    expect(Number(reading) % 4).toBe(0)
  }
})
