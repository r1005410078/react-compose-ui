import { expect, test } from '@playwright/test'
import { pointerDrop } from './support/test-helpers'

/**
 * 端口显现与导线端点的接线状态。
 *
 * @remarks
 * 两条都只有端到端拦得住：端口显现要真的走一遍「命令取点 → 光标靠近 → 世界矩阵换算」，
 * 而失效记号要真的删掉一个符号。
 */
test('OpenSpec: stage / 端口在取点时按符号整组显现 / 取点时显现，退出后消失', async ({ page }) => {
  /*
   * **不关自动适配**：这两条不依赖确定的取景，反而依赖拖放真的落进场景——`?no-auto-fit` 下
   * 1280×720 的场景远大于 566 宽的图面，按场景包围盒算出来的落点会跑到可视区之外。
   */
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()

  // 放一个矩形并给它一个端口（默认落在 Entity 局部原点，即矩形左上角）。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox.x + 240,
    y: frameBox.y + 180,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rectangle = stage.getByTestId(rectangleId)
  await expect.poll(() => rectangle.boundingBox()).not.toBeNull()
  const box = (await rectangle.boundingBox())!

  const ports = stage.getByTestId('stage-drafting-port')
  // 空闲时一个都不画：常驻会让一张接线图上多出几十个与几何无关的点。
  await page.mouse.move(box.x, box.y)
  await expect(ports).toHaveCount(0)

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.move(box.x, box.y)
  await expect(ports).toHaveCount(1)

  // 退出命令即收起：它回答的是取点当下的问题。
  await stage.press('Escape')
  await expect(ports).toHaveCount(0)
})

test('OpenSpec: stage / 导线两端的接线状态画在图面上 / 失效不选中也显示', async ({ page }) => {
  /*
   * **不关自动适配**：这两条不依赖确定的取景，反而依赖拖放真的落进场景——`?no-auto-fit` 下
   * 1280×720 的场景远大于 566 宽的图面，按场景包围盒算出来的落点会跑到可视区之外。
   */
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox.x + 200,
    y: frameBox.y + 160,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rectangle = stage.getByTestId(rectangleId)
  await expect.poll(() => rectangle.boundingBox()).not.toBeNull()
  const box = (await rectangle.boundingBox())!

  // 起点绑到端口，终点落在空白处。
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(box.x, box.y)
  await page.mouse.click(box.x + 200, box.y + 140)
  // `WIRE` 连续取点：回车结束这一条，再按 `Escape` 退出命令。
  await stage.press('Enter')
  await stage.press('Escape')

  // 选中那条导线：两端各一个记号，一端已绑定、一端自由。
  // 只认导线那一条（两点走成 `<line>`）：符号本身现在也是曲线，画成 `<polygon>`。
  await stage.locator('line[data-testid="compose-material-curve-stroke"]').click({ force: true })
  await expect(stage.getByTestId('stage-wire-end-bound')).toHaveCount(1)
  await expect(stage.getByTestId('stage-wire-end-free')).toHaveCount(1)

  // 删掉符号，并把选择挪走——失效记号必须在**未选中**状态下仍然出现。点的是**下边线**：
  // 矩形默认空心，盒内部不命中，可点的只有那一圈描边。
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height - 1)
  await page.keyboard.press('Delete')
  await expect(rectangle).toHaveCount(0)
  await expect(stage.getByTestId('stage-wire-end-dangling')).toHaveCount(1)
  await expect(stage.getByTestId('stage-wire-end-free')).toHaveCount(0)
})

test('OpenSpec: stage-engine / WIRE 命令与端口绑定 / 直角导线的拐点不跟着符号走', async ({ page }) => {
  // 与上面两条同样的理由：不关自动适配，拖放才落得进场景。
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox.x + 200,
    y: frameBox.y + 150,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rectangle = stage.getByTestId(rectangleId)
  await expect.poll(() => rectangle.boundingBox()).not.toBeNull()
  const box = (await rectangle.boundingBox())!

  /*
   * 起点吸到端口，中间取一个拐点，终点落在空白处，回车结束这一条。三个点因此攒成**一个**
   * Entity——逐段落地会得到两条线加一个假接头，而假接头不是绑定，符号一挪就裂开。
   */
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(box.x, box.y)
  await page.mouse.click(box.x, box.y + 160)
  await page.mouse.click(box.x + 180, box.y + 160)
  await stage.press('Enter')

  // 只认这条直角导线（三个点走成 `<polyline>`）：符号本身现在也是曲线，画成 `<polygon>`。
  const strokes = stage.locator('polyline[data-testid="compose-material-curve-stroke"]')
  await expect(strokes).toHaveCount(1)

  /*
   * 顶点的**页面坐标**：`points` 属性住在几何空间，而归一化把紧包围盒的左上角钉在原点——
   * 首顶点一动，盒跟着长，所有顶点的几何坐标就一起平移。只有换算到屏幕才看得出谁真的动了。
   */
  const screenPoints = () => strokes.first().evaluate((element) => {
    const polyline = element as SVGPolylineElement
    const ctm = polyline.getScreenCTM()!
    return Array.from(polyline.points).map((point) => {
      const mapped = point.matrixTransform(ctm)
      return [Math.round(mapped.x), Math.round(mapped.y)]
    })
  })

  const before = await screenPoints()
  // 一个 Entity，几何是三顶点折线——逐段落地会得到两条线加一个假接头。
  expect(before).toHaveLength(3)

  // 把符号拖走：首顶点跟着走，拐点与末顶点一个都不动。
  await stage.press('Escape')
  // 抓**下边线**：矩形默认空心，盒内部不命中，可点可拖的只有那一圈描边。落点按量到的盒
  // 取比例——写死像素在非 100% 缩放下会跑到盒外面去。
  const grip = { x: box.x + box.width * 0.2, y: box.y + box.height - 1 }
  await page.mouse.click(grip.x, grip.y)
  // 按下点**避开刚才那一下点击**：同一个位置的第二次按下会被浏览器判成双击，而双击一个
  // 矩形进的是几何编辑（它是曲线），这一次拖拽就不再是移动。
  const dragFrom = { x: box.x + box.width * 0.5, y: grip.y }
  await page.mouse.move(dragFrom.x, dragFrom.y)
  await page.mouse.down()
  await page.mouse.move(dragFrom.x - 70, dragFrom.y - 50, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => (await screenPoints())[0]).not.toEqual(before[0])
  const after = await screenPoints()
  // 拐点与末顶点没动——不为「保持正交」补偿相邻顶点，这是明写的代价。
  expect(after[1]).toEqual(before[1])
  expect(after[2]).toEqual(before[2])
})
