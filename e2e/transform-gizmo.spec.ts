import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { clickCurveStroke, curveStrokeGrip } from './support/test-helpers'

/**
 * Rive 式变换指示器。
 *
 * @remarks
 * 判别性全在**非中心基点**上：默认基点就是盒中心，指示器画在基点上还是包围盒中心上给出同一个
 * 位置，用默认基点写的用例两种实现都能通过。
 */
async function setup(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__node.is-renderer').first()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(node)
  return { editor, stage, node, inspector: editor.locator('[data-workspace-panel="inspector"]') }
}

/** 量一个节点的屏幕盒。 */
async function boxOf(node: Locator) {
  await expect.poll(() => node.boundingBox()).not.toBeNull()
  return (await node.boundingBox())!
}

/** 一个把手的屏幕中心。 */
async function gripCenter(stage: Locator, testId: string) {
  const handle = stage.getByTestId(testId)
  await expect.poll(() => handle.boundingBox()).not.toBeNull()
  const grip = (await handle.boundingBox())!
  return { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
}

/**
 * 抓住一条轴的平移箭头，斜着拖一段；返回拖完之后的盒。
 *
 * @remarks
 * **抓轴线的中段而不是命中元素的几何中心**：用户看到的是从中心一直画到箭头尖的一条线，会按
 * 在线上任意一处。曾经命中只覆盖最外面 22px，点几何中心的用例照样绿，而实机上「按在看得见的
 * 线上拖不动」。
 */
async function dragAxis(page: Page, stage: Locator, node: Locator, axis: 'x' | 'y') {
  const center = await centerOf(stage)
  // 75 落在环的命中带里（70~90）：轴画在环之上，因此这一按仍是平移而不是旋转。
  const from = axis === 'x'
    ? { x: center.x + 75, y: center.y }
    : { x: center.x, y: center.y - 75 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // 斜着拖：沿轴的分量与垂直分量都给足，垂直那一半必须被约束掉。
  await page.mouse.move(from.x + 96, from.y + 48, { steps: 8 })
  await page.mouse.up()
  return boxOf(node)
}

/** 指示器中心圆点的屏幕坐标。 */
async function centerOf(stage: Locator) {
  const dot = stage.getByTestId('stage-gizmo-center')
  await expect.poll(() => dot.boundingBox()).not.toBeNull()
  const box = (await dot.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * 圆环的实际半径。
 *
 * @remarks
 * 不能写死：环跟着选区大小走（它必须落在对象轮廓之外，否则会把拖对象的手势接走），写死的
 * 数字在对象换个尺寸之后就抓空了。
 */
async function ringRadiusOf(stage: Locator) {
  const ring = stage.getByTestId('stage-gizmo-ring')
  await expect(ring).toHaveCount(1)
  return Number(await ring.getAttribute('r'))
}

test('OpenSpec: stage / Rive 式变换指示器 / 开关控制把手，画在基点上', async ({ page }) => {
  const { editor, stage, node, inspector } = await setup(page)

  // 关着的时候图面上没有把手。
  await expect(stage.getByTestId('stage-transform-gizmo')).toHaveCount(0)

  await inspector.getByRole('combobox', { name: '旋转基点' }).selectOption('middle-left')
  await expect.poll(() => node.boundingBox()).not.toBeNull()
  const box = (await node.boundingBox())!

  await editor.getByRole('button', { name: '变换指示器' }).click()
  await expect(stage.getByTestId('stage-transform-gizmo')).toHaveCount(1)

  // 中心落在盒的左边中点——不是包围盒中心。
  const center = await centerOf(stage)
  expect(center.x).toBeCloseTo(box.x, 0)
  expect(center.y).toBeCloseTo(box.y + box.height / 2, 0)

  // 四种把手都在，形状互不相同：箭头平移、方块缩放、圆环旋转、圆点标基点。
  await expect(stage.getByTestId('stage-gizmo-ring')).toHaveCount(1)
  for (const axis of ['x', 'y']) {
    await expect(stage.getByTestId(`stage-gizmo-move-${axis}`)).toHaveCount(1)
    await expect(stage.getByTestId(`stage-gizmo-scale-${axis}`)).toHaveCount(1)
  }

  /*
   * 次序是「方块 → 环 → 箭头」，三段全部屏幕恒定。判别点是**方块在环内、箭头尖在环外**：
   * 方块坐进环的命中带里的话按下去开始的是旋转，箭头缩进带里则与环互相偷点击。
   */
  const ring = await ringRadiusOf(stage)
  const scale = await gripCenter(stage, 'stage-gizmo-scale-x')
  const tip = await gripCenter(stage, 'stage-gizmo-tip-x')
  expect(scale.x - center.x).toBeLessThan(ring)
  expect(tip.x - center.x).toBeGreaterThan(ring)

  // 再点一次收起来：它是 chrome 的可见性，不是模式。
  await editor.getByRole('button', { name: '变换指示器' }).click()
  await expect(stage.getByTestId('stage-transform-gizmo')).toHaveCount(0)
})

test('OpenSpec: stage / Rive 式变换指示器 / 基点圆点带描边，压在交点上仍读得出', async ({ page }) => {
  const { editor, stage } = await setup(page)
  await editor.getByRole('button', { name: '变换指示器' }).click()

  /*
   * 圆点画在两条轴之后、压在它们的交点上。只有填充的话,填充色一旦撞上对象的颜色它就整个消失,
   * 用户看到的不是「点不见了」而是「两条轴在中间断了一截」——这正是它带描边的原因。
   */
  const paint = await stage.getByTestId('stage-gizmo-center').evaluate((el) => {
    const style = getComputedStyle(el)
    return { fill: style.fill, stroke: style.stroke, width: Number.parseFloat(style.strokeWidth) }
  })
  expect(paint.stroke).not.toBe('none')
  expect(paint.width).toBeGreaterThan(0)
  expect(paint.stroke).not.toBe(paint.fill)
})

test('OpenSpec: stage / Rive 式变换指示器 / 拖轴只写位置，拖环只写角度', async ({ page }) => {
  const { editor, stage, node, inspector } = await setup(page)
  await inspector.getByRole('combobox', { name: '旋转基点' }).selectOption('middle-left')

  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await editor.getByRole('radio', { name: '动画' }).click()
  // 进入动画模式自动打开：那里误拖的代价最高——往时间线塞一条没打算要的轨道。
  await expect(stage.getByTestId('stage-transform-gizmo')).toHaveCount(1)
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')

  /*
   * 平移排在旋转**之前**，不是随手的顺序：转过 90° 之后 X 轴指向屏幕下方，而箭头在环外
   * 五十来像素——那个位置已经落到动画面板上，图面根本收不到这次按下。这是取景的限制，不是
   * 指示器的行为，把它混进这条用例只会让它在一件无关的事情上红。
   */
  await dragAxis(page, stage, node, 'x')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: /关键帧 \d+ ms：旋转/ })).toHaveCount(0)

  /*
   * 拖环：**从 45° 方向抓**，绕 90°。不能从正右方抓——两条轴画在环之上，它们与环相交的那两处
   * 各有一个约 20px 宽的窗口归轴所有。环是一整圈，避开这两处不损失什么；而轴若排在环之下，
   * 按在看得见的轴线上会开始旋转，那才是说不清的。
   */
  const center = await centerOf(stage)
  const radius = await ringRadiusOf(stage)
  const diagonal = radius * Math.SQRT1_2
  await page.mouse.move(center.x + diagonal, center.y + diagonal)
  await page.mouse.down()
  await page.mouse.move(center.x - diagonal, center.y + diagonal, { steps: 8 })
  await page.mouse.up()

  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: /关键帧 \d+ ms：位置/ })).toHaveCount(1)
})

test('OpenSpec: stage / Rive 式变换指示器 / 轴把手沿轴约束，角手柄照常缩放', async ({ page }) => {
  const { editor, stage, node } = await setup(page)
  await editor.getByRole('button', { name: '变换指示器' }).click()

  /*
   * 判别点是**垂直方向一动不动**，不是「对象动了」——覆盖层根是 `pointer-events: none`，
   * 轴把手漏掉 `pointer-events` 时点击会穿透到场景节点，于是「沿轴拖」退化成自由拖动：
   * 对象确实动了、位置轨道也确实写了，只是不沿轴。断「动了」的用例对这个缺陷永远绿。
   */
  const before = await boxOf(node)
  const moved = await dragAxis(page, stage, node, 'x')
  expect(moved.x).toBeGreaterThan(before.x)
  expect(moved.y).toBeCloseTo(before.y, 0)

  // 角手柄没有被环的命中带偷走：环恒在轮廓之外，而它是一条必然穿过四角的宽带。
  const corner = stage.getByTestId('stage-resize-se')
  await expect.poll(() => corner.boundingBox()).not.toBeNull()
  const grip = (await corner.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + grip.height / 2 + 40, { steps: 6 })
  await page.mouse.up()

  const resized = await boxOf(node)
  expect(resized.width).toBeGreaterThan(moved.width)
  expect(resized.height).toBeGreaterThan(moved.height)
})

test('OpenSpec: stage / Rive 式变换指示器 / 拖动时指示器跟着对象走', async ({ page }) => {
  const { editor, stage, node } = await setup(page)
  await editor.getByRole('button', { name: '变换指示器' }).click()

  /*
   * 判别点是**拖动过程中**（松手之前）就跟上：指示器读已提交的文档时，整个拖动过程里它都钉在
   * 原处，用户看到的是「抓着的东西跑了、指示器留在原地」。松手之后才断言对这个缺陷永远绿。
   *
   * 断的是**位移相等**而不是绝对坐标：落点要过一次网格吸附，硬写增量会在吸附步长变化时莫名
   * 其妙地红。
   */
  const before = await centerOf(stage)
  const box = await boxOf(node)
  // 抓的是**上边线**：矩形默认空心，盒内部不命中，可拖的只有那一圈描边。横向偏移避开
  // setup 里那一下点击——同一个位置的第二次按下会被浏览器判成双击，而双击一个矩形进的是
  // 几何编辑（它是曲线），这一次拖拽就不再是移动。
  // 取上边线**靠右**那一段：正中间压在指示器的 y 轴箭头上，那一下会被约束成只沿 y 平移。
  const grab = await curveStrokeGrip(node, box.width - 40)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 160, grab.y + 96, { steps: 8 })

  const moved = await boxOf(node)
  const during = await centerOf(stage)
  expect(moved.x - box.x).toBeGreaterThan(100)
  expect(during.x - before.x).toBeCloseTo(moved.x - box.x, 0)
  expect(during.y - before.y).toBeCloseTo(moved.y - box.y, 0)
  await page.mouse.up()
})

test('OpenSpec: stage / Rive 式变换指示器 / 拖方块沿轴缩放，按位移不按落点', async ({ page }) => {
  const { editor, stage, node } = await setup(page)
  await editor.getByRole('button', { name: '变换指示器' }).click()

  const before = await boxOf(node)
  // 抓方块中心偏 4px：画出来的方块只有 10px，靶区必须比它大一圈，否则偏两三个像素就落到对象
  // 本体上、退化成一次自由拖动——用户看到对象跑了但没缩放，读出来是「缩放不行」。
  const square = await gripCenter(stage, 'stage-gizmo-scale-x')
  const from = { x: square.x + 4, y: square.y + 4 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 64, from.y + 40, { steps: 8 })
  await page.mouse.up()

  const after = await boxOf(node)
  /*
   * 三个判别点各挡一种错法：宽度按**位移**长（方块画在环外，按绝对落点解算会一下长到把手那么
   * 宽）、左边不动（`e` 手柄冻结对边，方块若开的是平移则整个盒会走）、高度不变（沿轴缩放，
   * 不是等比也不是自由缩放）。
   */
  expect(after.width - before.width).toBeGreaterThan(32)
  expect(after.width - before.width).toBeLessThan(96)
  expect(after.x).toBeCloseTo(before.x, 0)
  expect(after.height).toBeCloseTo(before.height, 0)
})
