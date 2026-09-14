import { expect, test } from '@playwright/test'

/**
 * DWG 导不进来，而**一片空白让用户读到的是「这个工具不支持我的图」**。
 *
 * @remarks
 * 这条用例断的是「看得见」而不是文案：菜单项在真实的资源浏览器里可达，选中之后说明真的出现
 * 在提示条上。组件测试已经钉住了「只在 `.dwg` 上出现」与「提示里有可执行的下一步」。
 *
 * 判别性的一半是**同一次右键里 `.dwg` 上没有「导入为页面」**——只断说明项存在的话，一个
 * 同时还错误地提供了导入入口的实现照样绿。
 */
test('OpenSpec: dwg-import / `.dwg` 不静默 / 右键给出可执行的下一步', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()
  await rootGrid.getByRole('gridcell', { name: /^Feeder\.dwg/ }).click({ button: 'right' })

  const menu = page.getByRole('menu')
  // DWG 还导不进来，因此这里不该出现导入入口——出现了就是在承诺做不到的事。
  await expect(menu.getByRole('menuitem', { name: '导入为页面', exact: true })).toHaveCount(0)
  await menu.getByRole('menuitem', { name: '如何导入 DWG？' }).click()

  // 用户此刻需要的不是导入，是知道下一步往哪走。
  const notice = editor.locator('.compose-editor__page-notice')
  await expect(notice).toContainText('DXF')
  await expect(notice).toContainText('ODA File Converter')
})

/**
 * 双击一份图纸，用户要的是那块场景。
 *
 * @remarks
 * 判别性的一半是 `.dwg` 那条：它与 `.dxf` 走进同一个「双击」，但结果必须不同——一个给场景，
 * 一个给说明。只断 `.dxf` 的话，一个对两种格式都盲目导入的实现照样绿。
 *
 * 这两个格式此前都会掉进图片预览（CAD 的注册媒体类型正好落在 `image/` 下），给用户一个
 * 空白框。
 */
test('OpenSpec: dxf-import / 资源浏览器上的导入为页面 / 双击即导入', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()

  await rootGrid.getByRole('gridcell', { name: /^Topology\.dxf/ }).dblclick()
  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Topology' })
  await expect(pageTab).toHaveCount(1)
  // 双击走的是导入那条路，因此诊断照旧出现——两个入口一条实现。
  await expect(editor.locator('.compose-editor__page-notice')).toContainText('SPLINE')

  // DWG 解不了，因此同一个手势给的是说明而不是场景。
  await rootGrid.getByRole('gridcell', { name: /^Feeder\.dwg/ }).dblclick()
  const notice = editor.locator('.compose-editor__page-notice')
  await expect(notice).toContainText('ODA File Converter')
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Feeder' })).toHaveCount(0)
})
