import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
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
