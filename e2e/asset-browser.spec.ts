import { expect, test } from '@playwright/test'
import { selectAxisSizing, expandInspectorSection } from './support/test-helpers'

test('OpenSpec: asset-browser / Editor 资源文档 / 双击在中央标签打开 SVG 与脚本', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()
  await expect(assets).toHaveScreenshot('asset-browser-directory-grid.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
  await rootGrid.getByRole('gridcell', { name: /Images/ }).dblclick()
  const imagesGrid = assets.getByRole('grid', { name: 'Images' })
  const svg = imagesGrid.getByRole('gridcell', { name: /compose-grid.svg/ })
  await svg.click()
  await expect(imagesGrid).toBeVisible()
  await svg.dblclick()
  const svgDocument = editor.locator('[data-workspace-panel="asset-document"][data-asset-entry-id="compose-logo"]')
  await expect(svgDocument.getByRole('img', { name: 'compose-grid.svg' })).toBeVisible()
  await svg.dblclick()
  await expect(editor.locator('[data-workspace-panel="asset-document"][data-asset-entry-id="compose-logo"]')).toHaveCount(1)

  await assets.getByRole('treegrid').getByRole('row', { name: 'Demo Assets' }).click()
  const dashboard = assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /dashboard.ts/ })
  await dashboard.dblclick()
  const scriptDocument = editor.locator('[data-workspace-panel="asset-document"][data-asset-entry-id="dashboard-script"]')
  const monaco = scriptDocument.locator('.monaco-editor')
  await expect(monaco).toBeVisible()
  const monacoInput = scriptDocument.getByRole('textbox', { name: 'Editor content' })
  await monacoInput.focus()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n// saved from e2e')
  await expect(scriptDocument.locator('.view-lines')).toContainText('saved from e2e')
  await editor.getByRole('button', { name: '关闭资源 dashboard.ts' }).click()
  const dirtyDialog = page.getByRole('dialog', { name: '资源尚未保存' })
  await expect(dirtyDialog).toBeVisible()
  await dirtyDialog.getByRole('button', { name: '取消' }).click()
  await monacoInput.focus()
  await page.keyboard.press('Control+S')
  await editor.getByRole('button', { name: '关闭资源 dashboard.ts' }).click()
  await expect(scriptDocument).toHaveCount(0)

})


test('OpenSpec: asset-browser / Editor 资源面板 / 右键菜单不被其他工作区遮挡', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' }).getByRole('gridcell', { name: /Images/ }).click({ button: 'right' })

  const menu = page.getByRole('menu', { name: '资源' })
  await expect(menu).toBeVisible()
  for (const name of ['新建文件', '新建目录', '重命名', '删除']) {
    const item = menu.getByRole('menuitem', { name })
    await expect(item).toBeVisible()
    const box = await item.boundingBox()
    expect(box).not.toBeNull()
    const topmostMenu = await page.evaluate(({ x, y }) => (
      document.elementFromPoint(x, y)?.closest('[data-compose-ui="context-menu"]') !== null
    ), { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })
    expect(topmostMenu).toBe(true)
  }
})


test('OpenSpec: stage / 异步资源节点创建 / 批量拖入 Image 与 SVG 并原子撤销重做', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const imagesRow = assets.getByRole('row', { name: /Images/ })
  await imagesRow.getByRole('button', { name: '展开' }).click()
  const assetTree = assets.getByRole('treegrid')
  const svgRow = assetTree.getByRole('row', { name: /compose-grid\.svg/ })
  const imageRow = assetTree.getByRole('row', { name: /dashboard\.bmp/ })
  await svgRow.click()
  await imageRow.click({ modifiers: ['Shift'] })
  await expect(svgRow).toHaveAttribute('aria-selected', 'true')
  await expect(imageRow).toHaveAttribute('aria-selected', 'true')

  await svgRow.dragTo(surface, {
    targetPosition: { x: 80, y: 180 },
  })

  await expect(stage.getByTestId('compose-material-svg')).toBeVisible()
  await expect(stage.getByTestId('compose-material-image')).toBeVisible()
  await expect(stage.getByText('已添加 2 个资源。')).toBeVisible()
  await expect(editor).toHaveScreenshot('asset-materials-batch-drop.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.getByTestId('compose-material-svg')).toHaveCount(0)
  await expect(stage.getByTestId('compose-material-image')).toHaveCount(0)
  await stage.press('Control+Shift+z')
  await expect(stage.getByTestId('compose-material-svg')).toBeVisible()
  await expect(stage.getByTestId('compose-material-image')).toBeVisible()

  await stage.getByTestId('compose-material-image').click()
  const imageInspector = editor.getByRole('region', { name: 'dashboard.bmp 属性', exact: true })
  await selectAxisSizing(imageInspector, '宽度', 'Hug')
  await selectAxisSizing(imageInspector, '高度', 'Hug')
  await expect(stage.getByTestId('stage-layout-diagnostics')).toHaveCount(0)

  await stage.getByTestId('compose-material-svg').click()
  const inspector = editor.getByRole('region', { name: 'compose-grid.svg 属性', exact: true })
  await selectAxisSizing(inspector, '宽度', 'Hug')
  await selectAxisSizing(inspector, '高度', 'Hug')
  await expect(stage.getByTestId('stage-layout-diagnostics')).toHaveCount(0)
  const positionXMetrics = await inspector.getByRole('spinbutton', { name: '位置 X' })
    .evaluate((input) => ({ clientWidth: input.clientWidth, scrollWidth: input.scrollWidth }))
  expect(positionXMetrics.scrollWidth).toBeLessThanOrEqual(positionXMetrics.clientWidth)
  await expect(editor).toHaveScreenshot('auto-layout-asset-hug.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await expandInspectorSection(inspector, 'SVG')
  await inspector.getByRole('checkbox', { name: '覆盖填充' }).check()
  await expect(stage.getByTestId('compose-material-svg').locator('rect').last())
    .toHaveAttribute('fill', '#ffffff')
  await expect(inspector).toHaveCSS('overflow-y', 'auto')
  expect(await inspector.evaluate((element) => element.scrollHeight >= element.clientHeight))
    .toBe(true)
  await inspector.evaluate((element) => element.scrollTo({ top: 0 }))
  await expect(inspector).toHaveScreenshot('svg-material-inspector.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})


test('OpenSpec: components / Paint Picker / 色盘与透明度滑动在真实指针拖动后保持打开', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()
  await page.mouse.click(outputBox!.x + 40, outputBox!.y + 40)

  const inspector = editor.getByRole('region', { name: '画布属性' })
  const trigger = inspector.getByRole('button', { name: '输出背景', exact: true })
  await trigger.click()
  const picker = page.getByRole('dialog', { name: '输出背景', exact: true })
  const plane = picker.getByLabel('纯色色盘', { exact: true })
  const planeBox = await plane.boundingBox()
  const history = editor.locator('[data-compose-ui="history"] li')
  const historyBefore = await history.count()
  expect(planeBox).not.toBeNull()

  await page.mouse.move(planeBox!.x + planeBox!.width * 0.15, planeBox!.y + planeBox!.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(planeBox!.x + planeBox!.width * 0.75, planeBox!.y + planeBox!.height * 0.7, { steps: 4 })
  await page.mouse.up()
  await expect(picker).toBeVisible()

  const alpha = picker.getByRole('slider', { name: '纯色不透明度', exact: true })
  await alpha.scrollIntoViewIfNeeded()
  const alphaBox = await alpha.boundingBox()
  expect(alphaBox).not.toBeNull()
  await expect(alpha).toHaveValue('100')
  await page.mouse.move(alphaBox!.x + alphaBox!.width * 0.9, alphaBox!.y + alphaBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(alphaBox!.x + alphaBox!.width * 0.3, alphaBox!.y + alphaBox!.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(alpha).not.toHaveValue('100')
  await expect(picker).toBeVisible()
  await expect(history).toHaveCount(historyBefore + 1)
})


test('OpenSpec: stage-paint-tools / 背景填充 / 线性渐变显示并提交画布控制柄编辑', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()

  const rectangle = stage.locator('.compose-stage__node.is-renderer').first()
  await rectangle.click()
  // History 作为下方工具标签按需挂载；在打开 Paint 编辑器前激活它，
  // 避免 Dockview 的焦点切换关闭 Popover。
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()
  const rectangleInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  await expandInspectorSection(rectangleInspector, '外观')
  await rectangleInspector.getByRole('button', { name: '背景填充', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '背景填充', exact: true })
  await picker.getByRole('button', { name: '渐变', exact: true }).click()
  await picker.getByRole('button', { name: '线性', exact: true }).click()
  await expect(stage.getByTestId('stage-paint-handles')).toBeVisible()
  await expect(stage.getByTestId('stage-paint-linear-start')).toBeVisible()
  const end = stage.getByTestId('stage-paint-linear-end')
  await expect(end).toBeVisible()

  const history = editor.locator('[data-compose-ui="history"] li')
  const historyBeforeDrag = await history.count()
  const endBox = await end.boundingBox()
  expect(endBox).not.toBeNull()
  const start = { x: endBox!.x + endBox!.width / 2, y: endBox!.y + endBox!.height / 2 }
  expect(await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)
    return target?.outerHTML
  }, start)).toContain('stage-paint-linear-end')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await expect(picker).toBeVisible()
  await expect.poll(() => stage.evaluate((element) => element.hasPointerCapture(1))).toBe(true)
  const target = { x: endBox!.x - 48, y: endBox!.y + 32 }
  await page.mouse.move(target.x, target.y, { steps: 4 })
  await expect(picker).toBeVisible()
  await expect.poll(async () => {
    const current = await end.boundingBox()
    return current
      ? Math.max(
          Math.abs(current.x + current.width / 2 - target.x),
          Math.abs(current.y + current.height / 2 - target.y),
        )
      : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(1.5)
  await page.mouse.up()
  await expect(history).toHaveCount(historyBeforeDrag + 1)

  await page.keyboard.press('Escape')
  await expect(stage.getByTestId('stage-paint-handles')).toHaveCount(0)
})


