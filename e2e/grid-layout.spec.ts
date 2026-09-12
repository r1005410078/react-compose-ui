import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  drawContainer,
  expandInspectorSection,
  pointerDrop,
  selectChildInSceneTree,
  selectContainer,
} from './support/test-helpers'

/** 从缺席态启用网格：`+` 菜单的第二项。 */
async function enableGrid(inspector: Locator) {
  await inspector.getByRole('button', { name: '添加布局' }).click()
  await inspector.getByRole('menuitem', { name: '网格 12 列' }).click()
}

test('OpenSpec: stage / 网格容器的画布反馈 / 格线显形、推挤与撤销一步回去', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 矩形' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })

  const container = stage.getByTestId('stage-container')
  const children = container.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)

  await selectContainer(editor)
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableGrid(containerInspector)

  // 启用之后分组标题栏标出当前布局类型——两种布局共用「布局」这一个标题，不印出来分不出。
  await expect(containerInspector.getByTestId('grid-layout-status')).toHaveText('Grid')
  // 分组启用后仍是折叠的（与 Auto Layout 同一条既有路径），展开才看得到字段。
  await expandInspectorSection(containerInspector, '布局')
  await expect(containerInspector.getByRole('spinbutton', { name: '列数' })).toHaveValue('12')

  // 两张卡按视觉位置就近落格，各占一片互不重叠的格子。
  const first = await children.nth(0).boundingBox()
  const second = await children.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1)

  // 选中容器时格线显形；静息时一条都不画。
  await expect(stage.getByTestId(/^stage-grid-lines-/)).toHaveCount(1)

  /*
   * 推挤走 Inspector 而不是画布拖拽：两条路径**共用同一个求解器与同一条 batch**（这由
   * stage-engine 的单元用例逐条钉住），而键入是确定性输入。这条端到端要验的是整条栈接得上
   * ——写进文档、求解、DOM 真的动了、撤销一步全回去。
   */
  await selectChildInSceneTree(editor, container, children.nth(1))
  const rectInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const cellX = rectInspector.getByRole('spinbutton', { name: '网格位置 列' })
  const beforeA = await children.nth(0).boundingBox()
  await cellX.fill('0')
  await cellX.press('Enter')

  // 第一张卡被压住，下移到不再重叠的那一行；两张卡此后同列。
  await expect.poll(async () => {
    const a = await children.nth(0).boundingBox()
    const b = await children.nth(1).boundingBox()
    return a && b ? Math.abs(a.y - b.y) : 0
  }).toBeGreaterThan(10)
  const pushedA = await children.nth(0).boundingBox()
  const pushedB = await children.nth(1).boundingBox()
  expect(Math.abs(pushedA!.x - pushedB!.x)).toBeLessThan(2)
  expect(pushedA!.y).toBeGreaterThan(beforeA!.y + 10)

  // 一次撤销把目标与被推挤的兄弟同时带回去——一次编辑就该是一条事务。
  await stage.focus()
  await stage.press('Control+z')
  await expect.poll(async () => (await children.nth(0).boundingBox())!.y)
    .toBeCloseTo(beforeA!.y, 0)
  await expect.poll(async () => {
    const a = await children.nth(0).boundingBox()
    const b = await children.nth(1).boundingBox()
    return a && b ? Math.abs(a.y - b.y) : 99
  }).toBeLessThan(2)
})

test('OpenSpec: basic-materials / 几何 Inspector 的网格档 / 格坐标可键入且尺寸只读', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: outputBox!.x + 120,
    y: outputBox!.y + 160,
  })

  const container = stage.getByTestId('stage-container')
  const children = container.locator(':scope > .compose-stage__node.is-renderer')
  await selectContainer(editor)
  await enableGrid(editor.getByRole('region', { name: 'Container 属性', exact: true }))

  await selectChildInSceneTree(editor, container, children.nth(0))
  const rectInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })

  // 格坐标顶掉位置与自身对齐；尺寸仍然印出来但不可编辑。
  await expect(rectInspector.getByRole('spinbutton', { name: '网格位置 列' })).toBeVisible()
  await expect(rectInspector.getByRole('spinbutton', { name: '网格尺寸 宽' })).toBeVisible()
  await expect(rectInspector.getByRole('combobox', { name: '尺寸宽度' })).toBeDisabled()
  // 间距归容器，因此子级这一侧不再有外边距。
  await expect(rectInspector.getByText('外边距', { exact: true })).toHaveCount(0)

  // 键入格坐标与在画布上拖是同一份事实的两个入口。
  const before = await children.nth(0).boundingBox()
  const cellX = rectInspector.getByRole('spinbutton', { name: '网格位置 列' })
  await cellX.fill('6')
  await cellX.press('Enter')
  await expect.poll(async () => (await children.nth(0).boundingBox())!.x)
    .toBeGreaterThan(before!.x + 100)
})

/**
 * 画布拖拽：全程跟手、兄弟当场让位、松手落格。
 *
 * @remarks
 * 这条覆盖的是 Inspector 那条路径**覆盖不到**的两件事，而它们各自都曾经是真缺陷：
 *
 * 1. **手势不能被自己的预览打断。**网格 move 的求解文档会随目标格在「有兄弟要让位」与
 *    「没有」之间来回，每一次「没有」都是一次 `clearPreview`；而清理预览若发布一份数值相同、
 *    `revision` 加一的新提交态，手势会话的空间基线（document 恒等 + revision 恒等）就会判定
 *    失效并中止手势。症状是拖到某一行时卡片突然弹回原位、此后再也不跟手，而用户还没松手。
 *
 * 2. **推挤必须看得见。**预览求解文档若只写被推挤的兄弟、不写被拖的那一张，交给 Runtime 的
 *    就是一个「没人占着那个格子」的格局，Runtime 自己那趟求解的重力会把兄弟原样浮回去，
 *    一帧之内撤销推挤。屏幕上的结果是「兄弟纹丝不动」，而用户没法判断这一下该不该松手。
 *
 * 因此断言要逐段取样：只断「松手之后落进格子」对上面两条都绿。
 */
test('OpenSpec: stage / 网格容器的画布反馈 / 拖动全程跟手、兄弟当场让位、松手落格', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = (await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox())!

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 矩形' })
  await pointerDrop(page, rectangleButton, { x: outputBox.x + 120, y: outputBox.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox.x + 320, y: outputBox.y + 160 })

  const container = stage.getByTestId('stage-container')
  const children = container.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)
  await selectContainer(editor)
  await enableGrid(editor.getByRole('region', { name: 'Container 属性', exact: true }))

  const first = children.nth(0)
  const second = children.nth(1)
  const a0 = (await first.boundingBox())!
  const b0 = (await second.boundingBox())!

  // 空心矩形只有那一圈描边可点；选中之后它的盒才归它，中间才拖得动。
  await page.mouse.click(b0.x + b0.width / 2, b0.y + 1)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  const start = { x: b0.x + b0.width / 2, y: b0.y + b0.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()

  // 往左上那张卡的列上拖：目标格被占，兄弟必须当场让位。
  await page.mouse.move(start.x - 200, start.y + 20, { steps: 6 })
  await expect.poll(async () => (await first.boundingBox())!.y)
    .toBeGreaterThan(a0.y + 30)
  const shadow = stage.getByTestId('stage-drop-grid-cell')
  await expect(shadow).toHaveCount(1)

  /*
   * 继续往下拖过好几行，**逐段**断言卡片仍然跟着光标走。弹回的那个缺陷正是在越过某一行时
   * 发作的，只在起点与终点取样会整段跳过它。
   */
  for (const dy of [60, 100, 140]) {
    await page.mouse.move(start.x - 200, start.y + dy, { steps: 3 })
    const moving = (await second.boundingBox())!
    expect(Math.round(moving.x - b0.x)).toBeCloseTo(-200, -1)
    expect(moving.y).toBeGreaterThan(b0.y + dy - 40)
  }

  /*
   * 途中**拖回原位再拖走**：回到原位那一刻谁都不用让位，求解文档因此为空，走的是
   * `clearPreview`。清理预览若发布一份 `revision` 加一的新提交态，手势会在这里被自己的预览
   * 判成失效——之后无论怎么动卡片都不再跟手。这一段是那条修复唯一的判别性取样点，其余各段
   * 的求解文档都非空，碰不到它。
   */
  await page.mouse.move(start.x + 2, start.y + 2, { steps: 4 })
  await page.mouse.move(start.x - 160, start.y + 120, { steps: 6 })
  const revived = (await second.boundingBox())!
  expect(Math.round(revived.x - b0.x)).toBeCloseTo(-160, -1)

  // 松手落进格子：落点由同一个求解器决定，因此它对齐到列而不是停在光标处。
  await page.mouse.up()
  const dropped = (await second.boundingBox())!
  expect(Math.abs(dropped.x - a0.x)).toBeLessThan(2)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  // 一次撤销把两张卡一起带回去。
  await stage.focus()
  await stage.press('Control+z')
  await expect.poll(async () => (await first.boundingBox())!.y).toBeCloseTo(a0.y, 0)
  await expect.poll(async () => (await second.boundingBox())!.x).toBeCloseTo(b0.x, 0)
})

/**
 * 网格的公共夹具：一块开了网格的容器，外加若干张卡。
 *
 * @remarks
 * 落点按屏幕像素给：容器的屏幕尺寸随视口适配的缩放变，按比例给会让固定落点落到容器外面。
 */
async function setupGrid(page: Page, drops: readonly { x: number; y: number }[]) {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = (await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox())!

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 矩形' })
  for (const at of drops) {
    await pointerDrop(page, rectangleButton, { x: outputBox.x + at.x, y: outputBox.y + at.y })
  }

  const container = stage.getByTestId('stage-container')
  const children = container.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(drops.length)
  await selectContainer(editor)
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableGrid(containerInspector)
  await expandInspectorSection(containerInspector, '布局')
  const containerBox = (await container.boundingBox())!
  return { editor, stage, container, containerBox, containerInspector, children, outputBox }
}

/** 点描边选中一张空心卡——它的盒要选中之后才归它。 */
async function selectCard(page: Page, stage: Locator, card: Locator) {
  const box = (await card.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 1)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  return box
}

/** 从卡的盒内部起手拖到某个屏幕点。 */
async function dragCardTo(page: Page, box: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number }) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

/**
 * 落点钳制在列范围内。
 *
 * @remarks
 * 断的是 `x = columns - w` 而不是「没跑到容器外面」：允许越界会产出一个永远解算不出来的
 * 坐标，而那种坐标在屏幕上表现为卡片消失，看起来像渲染坏了。跨度从面板读而不是写死——
 * 默认跨度改了之后写死的那个数会让用例变成一条永远绿的假用例。
 */
test('OpenSpec: stage-engine / 网格容器内的拖动与缩放规划 / 落点钳制在列范围内', async ({ page }) => {
  const { editor, stage, containerBox, children } = await setupGrid(page, [{ x: 120, y: 160 }])
  const card = children.nth(0)
  const box = await selectCard(page, stage, card)

  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const span = Number(await inspector.getByRole('spinbutton', { name: '网格尺寸 宽' }).inputValue())

  /*
   * 拖到容器**内**的最右端。刻意不拖到容器之外——那里根本没有落点（落点要求「深入」目标
   * 容器），手势会被整个放弃，于是列号纹丝不动，用例看起来绿着却什么都没验到。
   */
  await dragCardTo(page, box, {
    x: containerBox.x + containerBox.width - 10,
    y: containerBox.y + 40,
  })

  await expect(inspector.getByRole('spinbutton', { name: '网格位置 列' }))
    .toHaveValue(String(12 - span))
  // 卡片仍然落在容器内：越界坐标解算不出来，症状是它从屏幕上消失。
  const after = (await card.boundingBox())!
  expect(after.x + after.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 1)
})

/**
 * 手势目标同样受重力作用，而「空洞自动填上」关掉之后停在放下的那一行。
 *
 * @remarks
 * 这是网格最有辨识度的那条语义，也是唯一一条**同一个手势在两种设置下结果相反**的：
 * 只测其中一半，另一半坏掉也不会红。目标豁免重力会让求解不再幂等——卡停在第 5 行，
 * 下一次任何无关编辑触发重解时它自己跳回第 0 行，而屏幕上没有任何东西解释它为什么动。
 */
test('OpenSpec: compose-document / 网格求解是 core 的纯函数 / 重力对手势目标同样生效，关掉后停在原行', async ({ page }) => {
  const { editor, stage, containerBox, containerInspector, children } =
    await setupGrid(page, [{ x: 120, y: 160 }])
  const card = children.nth(0)
  const box = await selectCard(page, stage, card)
  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  await expect(inspector.getByRole('spinbutton', { name: '网格位置 行' })).toHaveValue('0')

  // 往下拖三行开外再松手：重力开着，它浮回第 0 行。
  await dragCardTo(page, box, { x: box.x + box.width / 2, y: containerBox.y + 260 })
  await expect(inspector.getByRole('spinbutton', { name: '网格位置 行' })).toHaveValue('0')

  // 关掉「空洞自动填上」（协议字段 float 取反），同一个手势结果相反。
  await selectContainer(editor)
  await containerInspector.getByRole('checkbox', { name: '空洞自动填上' }).uncheck()

  const again = await selectCard(page, stage, card)
  await dragCardTo(page, again, { x: again.x + again.width / 2, y: containerBox.y + 260 })
  await expect
    .poll(async () => Number(await inspector
      .getByRole('spinbutton', { name: '网格位置 行' }).inputValue()))
    .toBeGreaterThan(0)
})

/**
 * 列数变少时按新列数呈现，改回去逐像素复原。
 *
 * @remarks
 * 钳制**在读取时而不是写入时**：文档里保留作者写下的列号，容器改回更多列时复原。
 * 判别性全在后半句——写入时钳制的实现前半句同样绿，只有「改回去」那一下才分得出来，
 * 而用户遇到它的场景恰恰是「把板子调窄看一眼再调回来」。
 */
test('OpenSpec: compose-document / 网格 Layout 类型 / 列数变少时钳制呈现，改回去复原', async ({ page }) => {
  const { editor, stage, containerInspector, children } = await setupGrid(page, [{ x: 320, y: 160 }])
  const card = children.nth(0)
  await selectCard(page, stage, card)
  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const cellX = inspector.getByRole('spinbutton', { name: '网格位置 列' })
  await cellX.fill('10')
  await cellX.press('Enter')
  const wide = (await card.boundingBox())!

  await selectContainer(editor)
  const columns = containerInspector.getByRole('spinbutton', { name: '列数' })
  await columns.fill('4')
  await columns.press('Enter')

  // 按 4 列呈现：卡片挪回了范围内。
  await expect.poll(async () => (await card.boundingBox())!.x).toBeLessThan(wide.x - 10)
  // 文档里那个 10 没有被改写。
  await selectCard(page, stage, card)
  await expect(cellX).toHaveValue('10')

  await selectContainer(editor)
  await columns.fill('12')
  await columns.press('Enter')
  await expect.poll(async () => (await card.boundingBox())!.x).toBeCloseTo(wide.x, 0)
})

/**
 * 缩放写的是格跨度，并吸到格线。
 *
 * @remarks
 * 判别性在「再多拖一点点，跨度不变」：一个把像素尺寸直接写进 `LayoutItem` 的实现同样能让
 * 卡片变大，但那份尺寸在下一次求解时会被格矩形覆盖掉——症状是松手之后卡片自己弹回去。
 * 因此两件事都要断：跨度真的变了，而且它是整数。
 *
 * 目标取**容器**而不是矩形：空心矩形选中之后边缘的缩放命中带整条让到盒外，起手点要额外让开
 * 一个描边容差，而那与本用例要验的事无关。
 */
test('OpenSpec: stage-engine / 网格容器内的拖动与缩放规划 / 缩放写格跨度并吸到格线', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = (await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 容器' }),
    { x: outputBox.x + 120, y: outputBox.y + 160 })

  await selectContainer(editor, 0)
  const outerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableGrid(outerInspector)

  const inner = stage.getByTestId('stage-container').nth(1)
  const innerBox = (await inner.boundingBox())!
  await page.mouse.click(innerBox.x + 10, innerBox.y + 10)
  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  const spanW = inspector.getByRole('spinbutton', { name: '网格尺寸 宽' })
  const spanH = inspector.getByRole('spinbutton', { name: '网格尺寸 高' })
  const beforeW = Number(await spanW.inputValue())
  const beforeH = Number(await spanH.inputValue())

  const corner = { x: innerBox.x + innerBox.width, y: innerBox.y + innerBox.height }
  await page.mouse.move(corner.x - 2, corner.y - 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + 110, corner.y + 60, { steps: 8 })
  await page.mouse.up()

  const grownW = Number(await spanW.inputValue())
  const grownH = Number(await spanH.inputValue())
  expect(grownW).toBeGreaterThan(beforeW)
  expect(grownH).toBeGreaterThan(beforeH)
  expect(Number.isInteger(grownW)).toBe(true)
  expect(Number.isInteger(grownH)).toBe(true)

  // 尺寸没有被写成像素：松手之后盒仍然停在格矩形上，再量一次不变。
  const settled = (await inner.boundingBox())!
  await page.waitForTimeout(300)
  const again = (await inner.boundingBox())!
  expect(again.width).toBeCloseTo(settled.width, 0)
  expect(again.height).toBeCloseTo(settled.height, 0)
})

/**
 * 拖出网格容器时删除 GridItem。
 *
 * @remarks
 * 结构取「外层普通容器 + 内层网格容器」——一块页面上摆着一张仪表板，正是这条能力的真实场景，
 * 而且它给「网格之外」留出了落脚的地方。这一点值得写下来：落点要求**深入**目标容器，而
 * `drawContainer` 画出来的那块比场景还宽，直接在它上面做这条用例会连一个合法落点都找不到，
 * 手势被整个放弃、卡片纹丝不动——用例看起来绿着却什么都没验到。
 */
test('OpenSpec: stage-engine / 网格容器内的拖动与缩放规划 / 拖出网格容器时删除 GridItem', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outer = stage.getByTestId('stage-container').nth(0)
  const outerBox = (await outer.boundingBox())!

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 容器' }),
    { x: outerBox.x + 100, y: outerBox.y + 80 })
  const grid = stage.getByTestId('stage-container').nth(1)

  // 把内层容器撑到装得下一张看得清的卡：默认那块只有一百多像素宽，12 列摊下来一格不到十个像素。
  const small = (await grid.boundingBox())!
  await page.mouse.click(small.x + 8, small.y + 8)
  await page.mouse.move(small.x + small.width - 2, small.y + small.height - 2)
  await page.mouse.down()
  await page.mouse.move(small.x + 340, small.y + 200, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await grid.boundingBox())!.width).toBeGreaterThan(300)

  const gridBox = (await grid.boundingBox())!
  await enableGrid(editor.getByRole('region', { name: 'Container 属性', exact: true }))
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }),
    { x: gridBox.x + gridBox.width / 2, y: gridBox.y + gridBox.height / 2 })

  const card = grid.locator(':scope > .compose-stage__node.is-renderer').nth(0)
  const box = await selectCard(page, stage, card)
  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  await expect(inspector.getByRole('spinbutton', { name: '网格位置 列' })).toHaveCount(1)

  // 拖到外层容器里、内层网格之外的深处。
  await dragCardTo(page, box, {
    x: gridBox.x + gridBox.width + 120,
    y: gridBox.y + gridBox.height + 60,
  })

  // 离开网格之后它回到普通的绝对定位：格坐标字段整组消失，位置字段回来。
  await expect(inspector.getByRole('spinbutton', { name: '网格位置 列' })).toHaveCount(0)
  await expect(inspector.getByRole('spinbutton', { name: '位置 X' })).toHaveCount(1)
})

/**
 * 嵌套网格：内层网格的子元素按内层的真实宽度分列，并且能调整宽度。
 *
 * @remarks
 * 这一档此前**整条没有覆盖**——既有用例的网格都只有一层，而单层里内层容器的宽度在第一趟求解
 * 之后就已经成立，因此那个次序缺陷在单层上完全看不出来。
 *
 * 缺陷是这样的：内层网格算列宽要用它自己的内容宽，而它作为**格中子级**根本没有轴尺寸——那个
 * 宽度要等外层把格矩形写进去、再求解一次才存在。只跑一趟时内层读到的宽度是 0，十二列全塌成
 * 0 宽，屏幕上是一排只剩间距的细条，而且怎么改跨度都没有用（每一格都是 0 宽）。
 *
 * 判别性因此有两半：卡片**够宽**（塌掉时它只剩间距那么宽），以及**改跨度真的会变宽**。
 * 只断前一半的话，一个把宽度算对却不跟跨度走的实现同样绿。
 */
test('OpenSpec: layout-engine / 网格容器的预解算 / 嵌套网格的子元素按真实宽度分列且可调跨度', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outerBox = (await stage.getByTestId('stage-container').nth(0).boundingBox())!

  // 外层开网格，再往里放一块板子，那块板子自己也开网格。
  await selectContainer(editor, 0)
  await enableGrid(editor.getByRole('region', { name: 'Container 属性', exact: true }))
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 容器' }),
    { x: outerBox.x + 140, y: outerBox.y + 100 })

  const innerGrid = stage.getByTestId('stage-container').nth(1)
  await expect(innerGrid).toHaveCount(1)
  await page.mouse.click((await innerGrid.boundingBox())!.x + 8, (await innerGrid.boundingBox())!.y + 8)
  await enableGrid(editor.getByRole('region', { name: 'Container 属性', exact: true }))
  const innerBox = (await innerGrid.boundingBox())!

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }),
    { x: innerBox.x + innerBox.width / 2, y: innerBox.y + innerBox.height / 2 })

  const card = innerGrid.locator(':scope > .compose-stage__node.is-renderer').nth(0)
  await expect(card).toHaveCount(1)
  const placed = (await card.boundingBox())!

  /*
   * 塌掉时每一格宽 0，一张跨 w 格的卡只剩 (w-1) 个间距那么宽——按默认间距 6 算不过十几像素。
   * 因此这里断的是「明显比那个宽」，而不是一个精确值：精确值随内层板子的尺寸变，写死会让这条
   * 用例在换了夹具之后变成假用例。
   */
  expect(placed.width).toBeGreaterThan(40)

  // 改跨度真的会变宽——每一格是 0 宽时，这一步一个像素都不会动。
  await page.mouse.click(placed.x + placed.width / 2, placed.y + 1)
  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const spanW = inspector.getByRole('spinbutton', { name: '网格尺寸 宽' })
  const before = Number(await spanW.inputValue())
  await spanW.fill(String(before + 3))
  await spanW.press('Enter')
  await expect.poll(async () => (await card.boundingBox())!.width)
    .toBeGreaterThan(placed.width + 20)
})

/**
 * 网格里的缩放在拖动期就按格实时解算。
 *
 * @remarks
 * 此前缩放只在**松手**那一刻才走网格：拖动期间读数与选区框跟着自由像素走（屏幕上是
 * `500.67` 这样的数），而卡片本身已经被预解算吸到了格矩形上——同一次手势里两样东西在说
 * 不同的话，用户读到的是「我明明拉到了这里」。
 *
 * 判别性有三半，缺一半都会让某种错误实现照样绿：
 *
 * - **选区框与卡片对齐**：只断卡片吸格不够，卡片的吸格来自预览文档那条路径，读数与选区框
 *   走的是另一条。
 * - **相邻两个落点给出同一个宽度**：这是「整格跳」唯一说得死的形式；断「变宽了」对自由像素
 *   同样绿。
 * - **兄弟在松手之前就让位**，且松手后的结果与拖动中所见一致。
 */
test('OpenSpec: stage / 手势期实时布局反馈 / 网格里的缩放拖动期就按格解算', async ({ page }) => {
  const { stage, children } = await setupGrid(page, [{ x: 120, y: 160 }, { x: 400, y: 160 }])
  const first = children.nth(0)
  const second = children.nth(1)
  const a0 = (await first.boundingBox())!
  const b0 = (await second.boundingBox())!

  await page.mouse.click(a0.x + a0.width / 2, a0.y + 1)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  // 东侧手柄：空心选区的缩放命中带整条让到盒外，因此起手点要在边线外侧。
  const start = { x: a0.x + a0.width + 4, y: a0.y + a0.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()

  const widthsAt = async (dx: number) => {
    await page.mouse.move(start.x + dx, start.y, { steps: 3 })
    const card = (await first.boundingBox())!
    const box = (await stage.getByTestId('stage-selection-bounds').first().boundingBox())!
    return { card: card.width, box: box.width }
  }

  // 同一格内的两个落点：宽度必须一模一样，而选区框必须始终贴着卡片。
  const near = await widthsAt(30)
  const alsoNear = await widthsAt(70)
  expect(Math.abs(near.box - near.card)).toBeLessThan(4)
  expect(Math.abs(alsoNear.box - alsoNear.card)).toBeLessThan(4)
  expect(Math.round(alsoNear.card)).toBe(Math.round(near.card))

  // 拉到压住兄弟：它在松手之前就让位。
  const wide = await widthsAt(210)
  expect(wide.card).toBeGreaterThan(near.card + 40)
  expect(Math.abs(wide.box - wide.card)).toBeLessThan(4)
  await expect.poll(async () => (await second.boundingBox())!.y).toBeGreaterThan(b0.y + 30)

  await page.mouse.up()
  // 松手后的结果与拖动中所见逐像素一致。
  await expect.poll(async () => (await first.boundingBox())!.width).toBeCloseTo(wide.card, 0)
  await expect.poll(async () => (await second.boundingBox())!.y).toBeGreaterThan(b0.y + 30)
})
