import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 组件实例的内容缩放（`contentFit: 'scale'`）。
 *
 * @remarks
 * 判别性在「两支写不同的地方」：`'scale'` 只写宿主盒（覆盖列表保持为空、Apply 按钮不可用），
 * `'layout'` 写嵌套根覆盖（Apply 按钮变为可用）。只断言「图形放大了」的用例，在一个顺手把
 * 覆盖也写了的实现上同样会绿——而那正是「组件尺寸的改动传不到 resize 过的实例」的根因。
 */

async function createInstance(page: Page, editor: Locator) {
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const source = sceneTree.getByRole('row', { name: /Container/ })
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('符号')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(editor.getByTestId('compose-component-instance-content')).toBeVisible()
  await sceneTree.getByRole('row', { name: /符号/ }).click()
}

async function dragEdgeEastBy(page: Page, editor: Locator, delta: number) {
  const handle = editor.getByTestId('stage-resize-edge-e')
  const handleBox = (await handle.boundingBox())!
  const start = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta, start.y, { steps: 6 })
  await page.mouse.up()
}

test('OpenSpec: basic-materials / 组件实例的内容缩放 / scale 只写宿主盒，layout 写嵌套覆盖', async ({ page }) => {
  test.setTimeout(90_000)
  // 拖大之后东侧手柄会滑进右侧属性面板底下，默认视口装不下两次加宽。
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await createInstance(page, editor)

  // `添加 矩形` 落的是曲线版 rect Preset：量嵌套实体的 DOM 盒（最深的那个就是矩形）。
  const rectangle = editor.getByTestId('compose-component-instance-content')
    .locator('[data-component-instance-entity-id]').last()
  const before = (await rectangle.boundingBox())!

  // 切到整体缩放。默认（重排布局）是既有行为，不用先断言一遍——全量既有用例钉着它。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('combobox', { name: '内容适配' }).selectOption('scale')

  // 只拖宽一倍：非等比拖动两轴各自缩放，纵向必须纹丝不动。
  const bounds = (await stage.getByTestId('stage-selection-bounds').boundingBox())!
  await dragEdgeEastBy(page, editor, bounds.width)

  await expect(async () => {
    const after = (await rectangle.boundingBox())!
    expect(after.width).toBeGreaterThan(before.width * 1.9)
    expect(after.width).toBeLessThan(before.width * 2.1)
    expect(Math.abs(after.height - before.height)).toBeLessThan(2)
  }).toPass()

  // `'scale'` 不产生嵌套根覆盖：Apply 入口保持不可用。
  await expect(editor.getByRole('button', { name: 'Apply 全部实例覆盖' })).toBeDisabled()

  // 互斥的另一支：切回重排布局再拖，同一个手势写的是嵌套根覆盖。
  await inspector.getByRole('combobox', { name: '内容适配' }).selectOption('layout')
  const layoutBounds = (await stage.getByTestId('stage-selection-bounds').boundingBox())!
  await dragEdgeEastBy(page, editor, Math.round(layoutBounds.width / 2))
  await expect(editor.getByRole('button', { name: 'Apply 全部实例覆盖' })).toBeEnabled()
})

test('OpenSpec: basic-materials / 组件实例的内容缩放 / 下钻选中框跟随缩放', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await createInstance(page, editor)

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('combobox', { name: '内容适配' }).selectOption('scale')
  const bounds = (await stage.getByTestId('stage-selection-bounds').boundingBox())!
  await dragEdgeEastBy(page, editor, bounds.width)

  const rectangle = editor.getByTestId('compose-component-instance-content')
    .locator('[data-component-instance-entity-id]').last()
  const scaled = (await rectangle.boundingBox())!
  await page.waitForTimeout(600)
  await page.mouse.dblclick(scaled.x + scaled.width / 2, scaled.y + scaled.height / 2)

  // 内部实体几何来自 DOM 测量，CSS transform 被它如实反映——选中框必须贴合放大后的图形。
  const outline = stage.getByTestId('stage-instance-selection-bounds')
  await expect(outline).toBeVisible()
  const width = Number.parseFloat((await outline.getAttribute('width'))!)
  const height = Number.parseFloat((await outline.getAttribute('height'))!)
  expect(Math.abs(width - scaled.width)).toBeLessThan(1.5)
  expect(Math.abs(height - scaled.height)).toBeLessThan(1.5)
})
