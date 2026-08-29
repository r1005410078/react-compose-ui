import { expect, test } from '@playwright/test'

/**
 * 弧与多段线的纵向流程。
 *
 * @remarks
 * 判别点有两处：整圆必须渲染成 `<circle>`（`A` 命令在起终点重合时画不出东西），
 * 闭合多段线必须是**一个** `<polygon>` 而不是四条线。
 *
 * 闭合的那一个用 `PLINE` + `C` 画：`RECTANGLE` 产出的是矩形**物料**，不是曲线。
 */
test('OpenSpec: compose-document / 弧与多段线 / 画圆、闭合多段线、弧并各成一个 Entity', async ({ page }) => {
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

  // 闭合多段线：四个顶点 + C。
  await commandInput.fill('PL')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一点')
  await page.mouse.click(at(400, 160).x, at(400, 160).y)
  await page.mouse.click(at(540, 160).x, at(540, 160).y)
  await page.mouse.click(at(540, 260).x, at(540, 260).y)
  await page.mouse.click(at(400, 260).x, at(400, 260).y)
  await stage.getByTestId('stage-drafting-command-keyword-C').click()

  // 弧：三点。
  await commandInput.fill('A')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 340).x, at(240, 340).y)
  await page.mouse.click(at(300, 300).x, at(300, 300).y)
  await page.mouse.click(at(360, 340).x, at(360, 340).y)

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(3)

  const tags = await strokes.evaluateAll((nodes) => nodes.map((node) => node.tagName.toLowerCase()))
  // 整圆是 circle、闭合多段线是**一个** polygon、弧是 path——三种 kind 各走各的渲染分支。
  expect(tags.sort()).toEqual(['circle', 'path', 'polygon'])

  // 切回设计模式：三个都是普通页面 Entity，场景树里各一行。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(3)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(2)
})

test('OpenSpec: stage-engine / 连续取点命令的闭合关键字 / LINE 的 C 补上收尾那一段', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  // 只取过一个点时够不着闭合，提示里没有它。
  await expect(stage.getByTestId('stage-drafting-command-keyword-C')).toHaveCount(0)

  await page.mouse.click(at(400, 200).x, at(400, 200).y)
  await page.mouse.click(at(400, 320).x, at(400, 320).y)
  await expect(prompt).toContainText('闭合(C)')

  // `LINE` 逐段落地，因此闭合是补第四段——三段画出来的加上收尾那一条。
  await stage.getByTestId('stage-drafting-command-keyword-C').click()
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(3)
  await expect(prompt).toContainText('命令：')
})

test('OpenSpec: stage-engine / 绘图命令 / PLINE 攒成一个 Entity 且可放弃上一点', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
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
  const surfaceLocator = stage.getByTestId('stage-surface')
  await expect.poll(() => surfaceLocator.boundingBox()).not.toBeNull()
  const surface = (await surfaceLocator.boundingBox())!
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

  /*
   * 盒手柄在 `scale` 工具下。`select` 下曲线画的是几何轮廓——盒不是曲线的轮廓——而这一条
   * 断的正是**盒操作**：拖盒手柄，几何跟着变。用户明确在做盒操作时盒就在。
   */
  await editor.getByRole('button', { name: '缩放' }).click()
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

  // 切回 select 再验命中：`scale` 工具下按下的语义是缩放，不是选择。
  await editor.getByRole('button', { name: '选择', exact: true }).first().click()

  // 命中跟着几何走：新形状的中点选得中。
  await page.mouse.click(rect1.x + rect1.width / 2, rect1.y + rect1.height / 2)
  await expect(selectedRows).toHaveCount(1)

  // 而拉宽**前**那条线经过、现在已不经过的位置选不中——盒里那一片仍是空的。
  await page.mouse.click(rect1.x + rect0.width / 2, rect1.y + rect1.height / 2)
  await expect(selectedRows).toHaveCount(0)
})

/**
 * 形状搬进曲线。
 *
 * @remarks
 * 合并之前这条必然红：工具栏的箭头与圆产出的是 `shape` 物料，画出来的 testid 是
 * `compose-material-shape-*`，填色画在宿主盒上（圆靠 `borderRadius: 50%` 裁成椭圆）。
 *
 * 判别点有三处，都指向同一件事——**盒不是形状**：
 *
 * 1. 画出来的必须是曲线物料，且箭头 marker 附在几何终点上；
 * 2. 填色画在 SVG 的几何上，宿主盒不画背景；
 * 3. 填过色的内部可点，没填色的同一位置不可点——空心图形的内部仍是空的。
 */
test('OpenSpec: basic-materials / 物料统一 / 箭头与圆是曲线，填充跟着形状而不是盒', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  // `toBeVisible()` 之后再取 box 是两次往返：负载高时元素会在两次之间重新布局，第二次拿回 null。
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = (await frame.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: frameBox.x + dx, y: frameBox.y + dy })

  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const selectedRows = sceneTree.getByRole('row').and(page.locator('[aria-selected="true"]'))
  const strokes = stage.getByTestId('compose-material-curve-stroke')

  // 绘图入口只有命令一套：工具栏按钮启动的与在命令行敲名字的是同一条会话。
  const run = async (
    name: string,
    ...points: readonly { x: number; y: number }[]
  ) => {
    await editor.getByRole('button', { name, exact: true }).click()
    for (const point of points) await page.mouse.click(point.x, point.y)
  }

  // 反向取点：从右下取到左上。方向由两个真实坐标表达，不再有三态编码。
  await run('箭头', at(420, 300), at(220, 160))
  await expect(strokes).toHaveCount(1)
  expect(await strokes.first().getAttribute('marker-end')).toMatch(/^url\(#/)
  await expect(stage.getByTestId('compose-material-shape-arrow')).toHaveCount(0)

  // 圆：取圆心与半径点。整圆是扫掠 360 的弧，落到 SVG 上就是 `<circle>`。
  await run('圆', at(680, 240), at(800, 240))
  await expect(strokes).toHaveCount(2)
  const circle = strokes.nth(1)
  expect(await circle.evaluate((node) => node.tagName.toLowerCase())).toBe('circle')

  // 填色走通用的「背景填充」Paint 编辑器，不是曲线自己的 prop。命令不回选，先选中它。
  const circleBox = (await circle.boundingBox())!
  await page.mouse.click(circleBox.x + circleBox.width / 2, circleBox.y)
  await editor.getByRole('button', { name: '背景填充', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '背景填充', exact: true })
  await picker.getByRole('button', { name: '#ef4444', exact: true }).click()
  await page.keyboard.press('Escape')

  // 判别性断言：颜色落在几何上，宿主盒一片透明。
  await expect
    .poll(() => circle.evaluate((node) => getComputedStyle(node).fill))
    .toBe('rgb(239, 68, 68)')
  const hostBackground = await circle.evaluate((node) => {
    const host = node.closest('.compose-stage__node')!
    return getComputedStyle(host).backgroundColor
  })
  expect(hostBackground).toBe('rgba(0, 0, 0, 0)')

  // 填过色的内部是用户看见的墨，点得中。
  const filled = (await circle.boundingBox())!
  await page.mouse.click(at(60, 60).x, at(60, 60).y)
  await expect(selectedRows).toHaveCount(0)
  await page.mouse.click(filled.x + filled.width / 2, filled.y + filled.height / 2)
  await expect(selectedRows).toHaveCount(1)

  // 而没填色的同一位置点不中——空心图形的包围盒里仍然绝大部分是空的。
  await run('圆', at(680, 500), at(800, 500))
  await expect(strokes).toHaveCount(3)
  const hollow = (await strokes.nth(2).boundingBox())!
  await page.mouse.click(at(60, 60).x, at(60, 60).y)
  await expect(selectedRows).toHaveCount(0)
  await page.mouse.click(hollow.x + hollow.width / 2, hollow.y + hollow.height / 2)
  await expect(selectedRows).toHaveCount(0)
})
