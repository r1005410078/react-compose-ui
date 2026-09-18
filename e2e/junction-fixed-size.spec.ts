import { expect, test } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 接线点的形状不是作者的意图：改不了尺寸、进不了顶点模式，但照旧挪得动。
 *
 * @remarks
 * 只有端到端拦得住第二条：`resize: 'none'` 今天唯一的漏洞正是 `entity.curve.set`——它写
 * `Curve` 的同时重算盒，而双击进顶点模式后拖一下夹点走的就是它，`entity.transform.set` 那条
 * 既有拒绝完全没参与。组件测试断的是谓词，这里断的是屏幕上真的没有那个入口。
 *
 * 自动适配把场景缩进图面，因此**断言发生在非 100% 缩放下**。
 */
test('OpenSpec: basic-materials / junction Preset 是接线节点 / 接线点改不了尺寸也进不了顶点模式', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = await stableBox(frame)
  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  // 一条水平导线，再从它的线身上接出第二条——那一下就产出接线点。
  const left = { x: Math.round(frameBox.x + 80), y: Math.round(frameBox.y + 160) }
  const right = { x: Math.round(frameBox.x + 320), y: left.y }
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(left.x, left.y)
  await page.mouse.click(right.x, right.y)
  await stage.press('Enter')
  await stage.press('Escape')

  const tap = { x: Math.round((left.x + right.x) / 2), y: left.y }
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(tap.x, tap.y)
  await page.mouse.click(tap.x, tap.y + 120)
  await stage.press('Enter')
  await stage.press('Escape')

  // 节点是填实的方块，因此渲染成 `<polygon>`。此刻图上只有导线，它是唯一那一个——下面的对照
  // 取整圆而不是矩形，正是为了不让它在这里变成两个。
  const junction = stage.locator('polygon[data-testid="compose-material-curve-stroke"]')
  await expect(junction).toHaveCount(1)
  const junctionBox = (await junction.boundingBox())!
  const center = {
    x: Math.round(junctionBox.x + junctionBox.width / 2),
    y: Math.round(junctionBox.y + junctionBox.height / 2),
  }

  // 1) 选中它：八个缩放手柄一个都不画——尺寸由线宽推出，改它没有意义。
  await page.mouse.click(center.x, center.y)
  // 先等一个**肯定**的信号：方块是闭合曲线，因此选中时画的是盒。没有这一步，下面那条
  // `toHaveCount(0)` 会在选区还没画出来的那一帧就通过，成为一条永远绿的假断言。
  await expect(stage.getByTestId('stage-selection-bounds')).toBeVisible()
  await expect(stage.locator('[data-testid^="stage-resize-"]')).toHaveCount(0)

  // 2) 双击它不进顶点模式：那条会话就是在改盒。
  await page.mouse.dblclick(center.x, center.y)
  await expect(stage.getByTestId('stage-selection-bounds')).toBeVisible()
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(0)
  await stage.press('Escape')

  /*
   * 3) 判别性的另一半：同一张图上另一条**闭合**曲线照旧有八个手柄、照旧进得了顶点模式。
   *    只断上面两条时，「把所有曲线的手柄与顶点模式一起收走了」同样绿。
   *
   *    对照必须是闭合曲线而不是导线：开放几何选中时画的是**轮廓**，按既有规则本来就没有盒
   *    手柄（曲线的整体缩放让给变换指示器）。拿导线做对照会得出一条永远绿的假断言。
   *
   *    闭合的那两种里取**整圆**而不是矩形：矩形也是闭合多段线、同样渲染成 `<polygon>`，
   *    画一个下去上面那个 `junction` 定位子就指向两个元素了。整圆走 `<circle>`，两不相干。
   */
  const circleCenter = { x: Math.round(frameBox.x + 430), y: Math.round(frameBox.y + 120) }
  await commandInput.fill('CIRCLE')
  await commandInput.press('Enter')
  await page.mouse.click(circleCenter.x, circleCenter.y)
  await page.mouse.click(circleCenter.x + 50, circleCenter.y)
  await stage.press('Escape')

  /*
   * 落点取**量出来的**包围盒左边中点，不按 `circleCenter ± 半径` 硬算：半径点会被网格吸附，
   * 画出来的半径与键入的那个数差了三个像素，而那已经超过命中容差——硬算的落点会整个落空。
   */
  const circleShape = stage.locator('circle[data-testid="compose-material-curve-stroke"]')
  const circleBox = (await circleShape.boundingBox())!
  const circleEdge = {
    x: Math.round(circleBox.x),
    y: Math.round(circleBox.y + circleBox.height / 2),
  }
  await page.mouse.click(circleEdge.x, circleEdge.y)
  await expect(stage.locator('[data-testid^="stage-resize-"]').first()).toBeVisible()
  await page.mouse.dblclick(circleEdge.x, circleEdge.y)
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-"]').first()).toBeVisible()
  await stage.press('Escape')
  await stage.press('Escape')

  // 4) 挪照旧：`movable` 保持 true，挪接头是接线图上的常规操作。
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 70, center.y + 50, { steps: 8 })
  await page.mouse.up()
  const movedBox = (await junction.boundingBox())!
  const moved = {
    x: movedBox.x + movedBox.width / 2,
    y: movedBox.y + movedBox.height / 2,
  }
  expect(Math.hypot(moved.x - center.x, moved.y - center.y)).toBeGreaterThan(20)
  // 尺寸没跟着变——挪不是缩放。
  expect(movedBox.width).toBeCloseTo(junctionBox.width, 1)
  expect(movedBox.height).toBeCloseTo(junctionBox.height, 1)
})
