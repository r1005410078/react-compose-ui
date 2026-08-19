import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { emptyWorkspaceRect } from './support/test-helpers'

/**
 * 在所有场景之外拖出一个矩形区域。
 *
 * 空白区可能很窄，因此拖拽尺寸从可用区域推导而不是写死，避免落点被挤回场景里。
 */
async function drawInEmptyWorkspace(page: Page, editor: Locator, tool: '创建容器' | '形状') {
  const region = await emptyWorkspaceRect(page, editor)
  const width = Math.min(160, region.width - 16)
  const height = Math.min(120, region.height - 16)
  // 从空白区中心起手而不是左上角：stage 左上角浮着缩放控件条，贴角起手会把 pointerdown
  // 喂给它，结果什么都画不出来。
  const start = {
    x: region.x + (region.width - width) / 2,
    y: region.y + (region.height - height) / 2,
  }
  // 「形状」是一个下拉工具组，主按钮默认就是矩形。
  await editor.getByRole('button', { name: tool, exact: true }).first().click()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + width, start.y + height, { steps: 4 })
  await page.mouse.up()
  await editor.getByRole('button', { name: '选择', exact: true }).click()
}

/** 断言 inner 完整落在 outer 内，允许 1px 边框与取整带来的误差。 */
function expectContained(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) {
  const EPSILON = 2
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - EPSILON)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - EPSILON)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + EPSILON)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + EPSILON)
}

test('OpenSpec: stage / 空白工作区的新建落点 / 在场景外绘制容器得到并排的新场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  const tags = editor.locator('[data-testid^="stage-scene-tag-"]')
  await expect(tags).toHaveCount(1)

  await drawInEmptyWorkspace(page, editor, '创建容器')

  // 画出来的是一块场景，不是第一块场景里的嵌套容器。
  await expect(tags).toHaveCount(2)
  await expect(stage.locator('[data-testid^="stage-frame-boundary-"]')).toHaveCount(2)
  // 不自动激活：激活写在页面文件里、不进撤销历史。
  await expect(editor.getByTestId('stage-scene-tag-frame-root')).toHaveClass(/is-active/)
  await expect(editor.locator('[data-testid^="stage-scene-tag-"].is-active')).toHaveCount(1)

  // 新建场景改的是文档，可撤销。
  await stage.focus()
  await stage.press('Control+z')
  await expect(tags).toHaveCount(1)
})

test('OpenSpec: stage / 空白工作区的新建落点 / 在场景外绘制矩形落进激活场景且完整可见', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  const renderers = stage.locator('.compose-stage__node.is-renderer')
  const before = await renderers.count()
  await drawInEmptyWorkspace(page, editor, '形状')

  // 先确认真的画出了东西：落在浮动工具条上时什么都不会创建，选中态不变会让下面的
  // 包含断言无条件通过。
  await expect(renderers).toHaveCount(before + 1)
  // 没有多出一块场景：非容器落进激活场景，而不是升格。
  await expect(stage.locator('[data-testid^="stage-frame-boundary-"]')).toHaveCount(1)
  await expect(stage.locator(
    '[data-entity-id="frame-root"] .compose-stage__node.is-renderer',
  )).toHaveCount(1)
  const frameBox = (await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox())!
  const selection = (await stage.getByTestId('stage-selection-bounds').boundingBox())!
  // 落点在定义上落在场景外，钳制必须把它整块拉回场景里，否则用户会觉得「画了但没出现」。
  expectContained(selection, frameBox)
})

test('OpenSpec: stage / 空白工作区的新建落点 / 切换激活场景后落点跟随', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await drawInEmptyWorkspace(page, editor, '创建容器')
  await expect(editor.locator('[data-testid^="stage-scene-tag-"]')).toHaveCount(2)

  // 激活写的是页面文件，而页面文件里的文档是上次保存的那份：新场景必须先保存才能被激活。
  await stage.focus()
  await page.keyboard.press('Control+s')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  const inactive = editor.locator('[data-testid^="stage-scene-tag-"]:not(.is-active)')
  const activatedId = await inactive.evaluate((element) =>
    element.getAttribute('data-testid')!.replace('stage-scene-tag-', ''))
  await inactive.click()
  await expect(editor.getByTestId(`stage-scene-tag-${activatedId}`)).toHaveClass(/is-active/)

  const renderers = stage.locator('.compose-stage__node.is-renderer')
  await expect(renderers).toHaveCount(0)
  await drawInEmptyWorkspace(page, editor, '形状')
  await expect(renderers).toHaveCount(1)

  // 落进的是激活场景，而不是 rootIds 里恰好排第一的那块。这里断言 DOM 父子关系而不是
  // 几何包含：第二块场景是手画出来的，可能比矩形还小，钳制只保证靠齐原点。
  await expect(stage.locator(
    `[data-entity-id="${activatedId}"] .compose-stage__node.is-renderer`,
  )).toHaveCount(1)
})

test('OpenSpec: editor-workspace-layout / 场景与容器同图标 / 场景行与容器行图标一致', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree).toBeVisible()

  // 场景就是放在顶层的容器：场景树里两者用同一个图标，只有可访问名称区分。
  await expect(sceneTree.getByRole('row', { name: /场景/ }).first()
    .getByTestId('material-icon-container')).toBeVisible()
  await expect(sceneTree.getByRole('row', { name: /场景/ }).first()
    .getByRole('img', { name: 'Scene' })).toBeVisible()
})
