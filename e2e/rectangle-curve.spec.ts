import { expect, test } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * `RECTANGLE` 产出闭合多段线曲线，双击即可改它的形状。
 *
 * 判据仍是「用户画完之后想对它做什么」，只是这个产品里的答案不是填色调圆角——画的是设备
 * 外框与分区框，画完之后想做的是把某个角对到导线端点上、把某条边整体挪一格。
 */
test('OpenSpec: stage / 矩形命令落地成可几何编辑的闭合曲线 / R 画出的是曲线并能双击改形状', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一个角点')

  await page.mouse.click(at(240, 200).x, at(240, 200).y)

  // 取第二点之前画的就是矩形轮廓，不是一条对角线：预览折线闭合回起点，五个点四条边。
  await page.mouse.move(at(420, 320).x, at(420, 320).y)
  const preview = stage.getByTestId('stage-drafting-preview')
  await expect(preview).toHaveCount(1)
  const points = (await preview.getAttribute('points'))!.trim().split(/\s+/)
  expect(points).toHaveLength(5)
  expect(points[0]).toBe(points[4])

  await page.mouse.click(at(420, 320).x, at(420, 320).y)
  await expect(prompt).toContainText('命令：')

  // 场景树里叫 Rectangle，落地走的是**物料面板里那同一个** `rect` Preset；它带 `Curve`，
  // 因此顶点、段中点与捕捉全都够得着。那个盒物料（Panel）已经从面板退役，两条入口都指向
  // 这一个——「同一个词指两件东西」正是这次要修的。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await expect(editor.getByRole('button', { name: '添加 Panel' })).toHaveCount(0)
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()

  // 选中画的是普通包围盒与八个手柄：矩形的盒**就是**它的轮廓。
  await page.mouse.click(at(330, 200).x, at(330, 200).y)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(1)

  // 盒内部双击进几何编辑：空心矩形选中之后看起来就是一个面积对象，而唯一能进顶点模式的
  // 地方本来只有那一圈几像素宽的描边。
  await page.mouse.dblclick(at(330, 260).x, at(330, 260).y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  // 四个顶点方块加四条边的中点条形；两者形状不同，因为按下去做的事不同。闭合多段线的段
  // 含收尾那一段，因此段中点也是四个——少一个用户看不出为什么。
  await expect(stage.locator('[data-vertex-role="vertex"]')).toHaveCount(4)
  await expect(stage.locator('[data-vertex-role="segment"]')).toHaveCount(4)
})

/**
 * 矩形默认空心：内部不命中，描边归移动。
 *
 * @remarks
 * 这个产品里的矩形是设备外框、柜体轮廓与分区框，套在符号外面，默认填色会把里面的符号整片
 * 盖住——而那发生在每一次画外框。空心的代价是盒内部点不中，它由两处承担：选中之后边缘的
 * 缩放命中带整条让到盒外（描边连同它的容差归**移动**），以及盒内双击进几何编辑。
 */
test('OpenSpec: stage / 矩形命令落地成可几何编辑的闭合曲线 / 默认空心因此内部不命中而描边可拖', async ({ page }) => {
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
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 340).x, at(440, 340).y)

  // 从**内部**点一下什么都选不中：空心矩形的盒里没有墨，这一下收敛成一次空框选。
  await page.mouse.click(at(340, 270).x, at(340, 270).y)
  const bounds = stage.getByTestId('stage-selection-bounds')
  await expect(bounds).toHaveCount(0)

  // 点它的**描边**才选中——那是它在画布上唯一可拖的那几个像素。
  await page.mouse.click(at(240, 270).x, at(240, 270).y)
  await expect(bounds).toHaveCount(1)
  const before = {
    x: Number(await bounds.getAttribute('x')),
    y: Number(await bounds.getAttribute('y')),
    width: Number(await bounds.getAttribute('width')),
    height: Number(await bounds.getAttribute('height')),
  }

  /*
   * 从**上边线**拖：选中之后边缘的缩放命中带整条让到盒外，因此压在边线上的这一下是移动。
   * 命中带若压在边线上，一个被选中的空心矩形就根本拖不动——那正是这条让位要挡的。
   * 起手点与上面那一下点击刻意错开：同一个位置的第二次按下会被浏览器判成双击。
   */
  await page.mouse.move(at(340, 200).x, at(340, 200).y)
  await page.mouse.down()
  await page.mouse.move(at(340, 260).x, at(340, 260).y, { steps: 6 })
  await page.mouse.up()

  const after = {
    x: Number(await bounds.getAttribute('x')),
    y: Number(await bounds.getAttribute('y')),
    width: Number(await bounds.getAttribute('width')),
    height: Number(await bounds.getAttribute('height')),
  }
  // 尺寸一个像素不变——变了就说明这一下被解释成了缩放。
  expect(after.width).toBeCloseTo(before.width, 1)
  expect(after.height).toBeCloseTo(before.height, 1)
  expect(after.y).toBeGreaterThan(before.y + 30)
  expect(after.x).toBeCloseTo(before.x, 1)
})
