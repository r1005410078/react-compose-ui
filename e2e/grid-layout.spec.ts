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
