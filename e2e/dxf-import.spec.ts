import { expect, test } from '@playwright/test'

/**
 * DXF 导入产出的是页面，不是另一个世界的文档。
 *
 * @remarks
 * 判别性断言是**块基点**：演示夹具里 `TERMINAL` 的基点落在自身几何包围盒之外，且那次插入带
 * 180 度旋转。基点若被写成盒中心（也就是缺席），偏移量与尺寸全都不变，只有**转出来的位置**
 * 差一个基点偏移——因此这条必须断渲染后的包围盒而不是 `LayoutItem` 的位置。
 *
 * 用 `?no-auto-fit` 关掉自动适配，缩放固定在 1，场景局部坐标因此就是屏幕像素差。
 */
test('OpenSpec: dxf-import / 资源浏览器上的导入为页面 / 右键导入', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()
  await rootGrid.getByRole('gridcell', { name: /^Topology\.dxf/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为页面', exact: true }).click()

  // 1) 导入产出一份新页面并打开它
  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Topology' })
  await expect(pageTab).toHaveCount(1)

  // 2) 块变成组件文件，一个块一份，两次插入共用
  await expect(rootGrid.getByRole('gridcell', { name: /^SWITCH/ })).toHaveCount(1)
  await expect(rootGrid.getByRole('gridcell', { name: /^TERMINAL/ })).toHaveCount(1)

  // 3) 表达不了的内容被报告而不是静默丢弃
  await expect(editor.locator('.compose-editor__page-notice')).toContainText('SPLINE')

  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  // 顶层图元落进场景：两条曲线的名字来自它们的图层。
  await expect(rows.filter({ hasText: 'WIRE' })).toHaveCount(2)

  const frameId = await rows.filter({ hasText: 'Topology' }).first()
    .getAttribute('data-scene-node-id')
  const terminalId = await rows.filter({ hasText: 'TERMINAL' }).first()
    .getAttribute('data-scene-node-id')
  expect(frameId).not.toBeNull()
  expect(terminalId).not.toBeNull()

  const stage = editor.getByRole('application', { name: 'Stage' })
  const frameBox = await stage.locator(`[data-entity-id="${frameId}"]`).boundingBox()
  const terminalBox = await stage.locator(`[data-entity-id="${terminalId}"]`).boundingBox()
  if (!frameBox || !terminalBox) throw new Error('场景与实例都应当已渲染')

  /*
   * Y 轴翻转做对了，标注才在导线**上方**：DXF 里标注的 y 比导线大（Y 朝上），不翻转的话它会
   * 跑到下方，而那种「图看起来像镜像的」症状很容易被误当成源文件的问题。
   */
  const label = stage.getByText('SW-01')
  const wire = stage.getByTestId('compose-material-curve-stroke').first()
  const labelBox = await label.boundingBox()
  const wireBox = await wire.boundingBox()
  if (!labelBox || !wireBox) throw new Error('标注与导线都应当已渲染')
  expect(labelBox.y).toBeLessThan(wireBox.y)

  /*
   * 期望值由 DXF 手算：块几何包围盒 `x[0,10] y[-10,0]`、基点 `(-30, 0)`、插入点 `(150, 320)`。
   * 盒左上角落在 `(180, -330)`，绕基点转 180 度之后落在 `(110, -320)`；场景包围盒的原点是
   * `(80, -378)`，因此场景局部坐标是 `(30, 58)`。
   *
   * 基点写成盒中心时盒不动，读数会是 `(20, 48)`——差的正好是一个基点偏移。
   */
  expect(terminalBox.x - frameBox.x).toBeCloseTo(30, 0)
  expect(terminalBox.y - frameBox.y).toBeCloseTo(58, 0)
})
