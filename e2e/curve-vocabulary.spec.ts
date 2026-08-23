import { expect, test } from '@playwright/test'

/**
 * 弧与多段线的纵向流程。
 *
 * @remarks
 * 判别点有两处：整圆必须渲染成 `<circle>`（`A` 命令在起终点重合时画不出东西），
 * 矩形必须是**一个** `<polygon>` 而不是四条线。
 */
test('OpenSpec: compose-document / 弧与多段线 / 画圆、矩形、弧并各成一个 Entity', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  // 圆：圆心 + 半径点。
  await commandInput.fill('C')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定圆心')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await expect(prompt).toContainText('指定半径')
  await page.mouse.click(at(300, 200).x, at(300, 200).y)

  // 矩形：两个对角点。
  await commandInput.fill('REC')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一个角点')
  await page.mouse.click(at(400, 160).x, at(400, 160).y)
  await page.mouse.click(at(540, 260).x, at(540, 260).y)

  // 弧：三点。
  await commandInput.fill('A')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 340).x, at(240, 340).y)
  await page.mouse.click(at(300, 300).x, at(300, 300).y)
  await page.mouse.click(at(360, 340).x, at(360, 340).y)

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(3)

  const tags = await strokes.evaluateAll((nodes) => nodes.map((node) => node.tagName.toLowerCase()))
  // 整圆是 circle、矩形是**一个** polygon、弧是 path——三种 kind 各走各的渲染分支。
  expect(tags.sort()).toEqual(['circle', 'path', 'polygon'])

  // 切回设计模式：三个都是普通页面 Entity，场景树里各一行。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(3)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(2)
})

test('OpenSpec: stage-engine / 绘图命令 / PLINE 攒成一个 Entity 且可放弃上一点', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  await commandInput.fill('PL')
  await commandInput.press('Enter')
  for (const [dx, dy] of [[220, 200], [320, 200], [320, 300], [420, 300]]) {
    await page.mouse.click(at(dx!, dy!).x, at(dx!, dy!).y)
  }
  // 取点期间文档上什么都还没有——这正是 PLINE 与 LINE 的差别。
  await expect(strokes).toHaveCount(0)

  // 放弃最后一点：这一步在会话里，不是一次文档撤销。
  await commandInput.fill('U')
  await commandInput.press('Enter')
  await expect(strokes).toHaveCount(0)

  await commandInput.press('Enter')
  await expect(strokes).toHaveCount(1)
  const points = await strokes.first().getAttribute('points')
  expect(points?.split(' ')).toHaveLength(3)

  // 一个 Entity 因此一步撤销。
  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(0)
})

test('OpenSpec: stage-engine / 特征点捕捉 / 圆心可捕捉', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  // 命中与捕捉的断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  await commandInput.fill('C')
  await commandInput.press('Enter')
  await page.mouse.click(at(300, 240).x, at(300, 240).y)
  await page.mouse.click(at(380, 240).x, at(380, 240).y)

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)
  const first = (await strokes.first().boundingBox())!
  const center = { x: first.x + first.width / 2, y: first.y + first.height / 2 }

  // 第二个圆的圆心落在第一个圆心附近：圆心不是任何线段的端点，只能由弧提供这个候选。
  await commandInput.fill('C')
  await commandInput.press('Enter')
  await page.mouse.click(center.x + 4, center.y + 3)
  await page.mouse.click(at(440, 240).x, at(440, 240).y)
  await expect(strokes).toHaveCount(2)

  const centers = await strokes.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }))
  // 捕捉生效时两个圆同心；没生效则差着光标的那几个像素。
  expect(Math.abs(centers[0]!.x - centers[1]!.x)).toBeLessThan(1.5)
  expect(Math.abs(centers[0]!.y - centers[1]!.y)).toBeLessThan(1.5)
})

/**
 * 曲线的盒与几何之间只有一个变换。
 *
 * @remarks
 * 合并之前这条必然红：曲线的 SVG 没有 `viewBox`，几何是绝对用户单位，而 `.compose-material`
 * 是盒的 100%×100%——盒变了，画出来的一动不动。今天不显眼只是因为盒的**唯一**来源就是几何
 * 自己的紧包围盒，一旦手柄或布局求解动了盒，两者当场分家。
 *
 * 断言在**非 100% 缩放**下取：`world = (屏幕 − 视口) / 缩放`，缩放恒为 1 时盒到几何的比例
 * 会被视口缩放掩盖。
 */
test('OpenSpec: basic-materials / 曲线按 viewBox 跟随盒伸缩 / 拖盒手柄时形状与命中一起变', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const selectedRows = sceneTree.getByRole('row').and(page.locator('[aria-selected="true"]'))

  // 陡斜线：拉宽之后新旧几何在同一个 x 上差得开，命中断言才有判别力。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(220, 140).x, at(220, 140).y)
  await page.mouse.click(at(320, 380).x, at(320, 380).y)
  await commandInput.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)

  // 吸附会把手柄拖动量量化到网格，断言改看比例即可，但先关掉更省事。
  await commandInput.fill('GRIDSNAP')
  await commandInput.press('Enter')
  // 缩放离开 100%：这条用例验的正是「两个缩放不能互相掩盖」。
  await commandInput.fill('ZOOMIN')
  await commandInput.press('Enter')
  const zoom = await page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    return new DOMMatrixReadOnly(getComputedStyle(scene).transform).a
  })
  expect(zoom).toBeGreaterThan(1.01)

  const rect0 = (await stroke.boundingBox())!
  // 直线的包围盒对角线就是它自己，因此盒中心必在线上。
  await page.mouse.click(rect0.x + rect0.width / 2, rect0.y + rect0.height / 2)
  await expect(selectedRows).toHaveCount(1)

  // 曲线的盒手柄本来是关掉的（`GeometryConstraints.resize: 'none'`），注释写的理由正是
  // 「盒缩放该不该等比缩放几何点还没定」。这一刀给的就是那个答案，因此手柄回来。
  await expect(stage.getByTestId('stage-resize-se')).toBeVisible()
  const handle = (await stage.getByTestId('stage-resize-se').boundingBox())!
  const hx = handle.x + handle.width / 2
  const hy = handle.y + handle.height / 2
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx + rect0.width, hy, { steps: 6 })
  await page.mouse.up()

  // 判别性断言：盒宽了一倍，画出来的也宽了一倍。
  const rect1 = (await stroke.boundingBox())!
  expect(rect1.width).toBeGreaterThan(rect0.width * 1.6)
  expect(Math.abs(rect1.height - rect0.height)).toBeLessThan(6)

  // 命中跟着几何走：新形状的中点选得中。
  await page.mouse.click(rect1.x + rect1.width / 2, rect1.y + rect1.height / 2)
  await expect(selectedRows).toHaveCount(1)

  // 而拉宽**前**那条线经过、现在已不经过的位置选不中——盒里那一片仍是空的。
  await page.mouse.click(rect1.x + rect0.width / 2, rect1.y + rect1.height / 2)
  await expect(selectedRows).toHaveCount(0)
})
