import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function pointerDrop(page: Page, source: Locator, target: { x: number; y: number }) {
  const sourceBox = await source.boundingBox()
  expect(sourceBox).not.toBeNull()
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.mouse.up()
}

test('OpenSpec: editor-workspace-layout / 完整示例入口 / 根路径直接展示 Stage 编排工作区', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', '组件库')
  await expect(editor.getByRole('button', { name: '添加 Text' })).toHaveCount(0)

  const editorBox = await editor.boundingBox()
  const viewport = page.viewportSize()
  expect(editorBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(editorBox).toEqual({
    x: 0,
    y: 0,
    width: viewport!.width,
    height: viewport!.height,
  })

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const right = page.getByTestId('dv-edge-group-compose-inspector-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const canvas = page.locator('[data-workspace-panel="canvas"]')
  const leftBox = await left.boundingBox()
  const rightBox = await right.boundingBox()
  const bottomBox = await bottom.boundingBox()
  const canvasBox = await canvas.boundingBox()
  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  expect(bottomBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  expect(leftBox!.x).toBeLessThan(canvasBox!.x)
  expect(rightBox!.x).toBeGreaterThanOrEqual(canvasBox!.x + canvasBox!.width)
  expect(bottomBox!.y).toBeGreaterThan(canvasBox!.y)
})

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

  await stage.getByTestId('compose-material-svg').click()
  const inspector = editor.getByRole('region', { name: 'compose-grid.svg 属性', exact: true })
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

test('OpenSpec: editor-workspace-layout / 隐式 Canvas Inspector / 快捷选择常见 PC 尺寸', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  const xAxis = stage.getByTestId('stage-origin-x')
  const yAxis = stage.getByTestId('stage-origin-y')
  const bottomEdge = stage.getByTestId('stage-output-edge-bottom')
  const rightEdge = stage.getByTestId('stage-output-edge-right')
  const origin = stage.getByTestId('stage-world-origin')
  const originSilhouette = stage.getByTestId('stage-world-origin-silhouette')
  const originPosition = stage.getByTestId('stage-world-origin-position')
  await expect(output).toHaveAttribute('fill', 'transparent')
  await expect(xAxis).toHaveCSS('stroke', 'rgba(245, 51, 82, 0.75)')
  await expect(yAxis).toHaveCSS('stroke', 'rgba(135, 214, 3, 0.75)')
  await expect(bottomEdge).toHaveCSS('stroke', 'rgb(142, 152, 168)')
  await expect(rightEdge).toHaveCSS('stroke', 'rgb(142, 152, 168)')
  await expect(bottomEdge).toHaveCSS('stroke-opacity', '0.72')
  await expect(rightEdge).toHaveCSS('stroke-opacity', '0.72')
  await expect(originSilhouette).toHaveCSS('fill', 'rgb(255, 255, 255)')
  await expect(originSilhouette).toHaveCSS('fill-opacity', '0.706')
  await expect(originPosition).toHaveCSS('fill', 'rgb(255, 95, 95)')
  const originTransform = await origin.getAttribute('transform')
  const translatedOrigin = originTransform?.match(/^translate\(([-\d.]+) ([-\d.]+)\)$/)
  expect(translatedOrigin).not.toBeNull()
  expect(Number(translatedOrigin![1]) + 8).toBe(Number(await yAxis.getAttribute('x1')))
  expect(Number(translatedOrigin![2]) + 8).toBe(Number(await xAxis.getAttribute('y1')))
  expect(await origin.evaluate((element) => {
    const yAxisElement = element.previousElementSibling
    return yAxisElement?.getAttribute('data-testid') === 'stage-origin-y'
  })).toBe(true)
  await expect(bottomEdge).toHaveCSS('stroke-width', '1px')
  await expect(rightEdge).toHaveCSS('stroke-width', '1px')

  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()
  await page.mouse.click(outputBox!.x + 40, outputBox!.y + 40)

  const inspector = editor.getByRole('region', { name: '画布属性' })
  await expect(inspector).toBeVisible()
  await expect(output).toHaveClass(/is-selected/)
  await expect(bottomEdge).toHaveCSS('stroke', 'rgb(54, 135, 255)')
  await expect(rightEdge).toHaveCSS('stroke', 'rgb(54, 135, 255)')
  await expect(bottomEdge).toHaveCSS('stroke-opacity', '1')
  await expect(rightEdge).toHaveCSS('stroke-opacity', '1')
  await expect(bottomEdge).toHaveCSS('stroke-width', '0.5px')
  await expect(rightEdge).toHaveCSS('stroke-width', '0.5px')
  const grid = stage.getByTestId('stage-grid')
  for (let index = 0; index < 2; index += 1) {
    await stage.press('Control+-')
  }
  await expect.poll(() => grid.evaluate((element) =>
    getComputedStyle(element).backgroundSize.split(',').length)).toBe(4)
  await expect.poll(() => grid.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).backgroundSize.split(',')[2]!)))
    .toBeGreaterThan(4)
  for (let index = 0; index < 6; index += 1) {
    await stage.press('Control+-')
  }
  await expect.poll(() => grid.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).backgroundSize.split(',')[2]!)))
    .toBeGreaterThanOrEqual(2)
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-inspector.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  for (let index = 0; index < 5; index += 1) {
    await stage.press('Control+-')
  }
  await expect.poll(() => grid.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).backgroundSize.split(',')[2]!)))
    .toBeCloseTo(3.2, 1)
  await expect(editor).toHaveScreenshot('stage-workspace-low-zoom-grid.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+0')

  const outputSizeKey = inspector.getByRole('combobox', { name: '输出尺寸键', exact: true })
  const commonOutputSize = inspector.getByRole('combobox', { name: '常见尺寸', exact: true })
  await expect(outputSizeKey).toHaveValue('preset')
  await expect(commonOutputSize).toHaveValue('1280x720')
  await expect(inspector.getByTestId('semantic-editor-size')).toHaveCount(0)
  await expect(inspector.getByTestId('semantic-editor-color')).toBeVisible()
  const canvasColor = inspector.getByRole('button', { name: '选择输出背景颜色', exact: true })
  await canvasColor.click()
  const canvasColorPicker = page.getByRole('dialog', { name: '输出背景颜色', exact: true })
  await expect(canvasColorPicker.getByRole('textbox')).toHaveCount(0)
  await expect(canvasColorPicker.getByLabel('输出背景色盘')).toBeVisible()
  await expect(canvasColorPicker.getByLabel('输出背景色相')).toBeVisible()
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-color-picker.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await canvasColorPicker.press('Escape')
  await expect(canvasColor).toBeFocused()
  await commonOutputSize.selectOption('1920x1080')
  await expect(outputSizeKey).toHaveValue('preset')
  await expect(commonOutputSize).toHaveValue('1920x1080')
  await expect(inspector.getByTestId('semantic-editor-size')).toHaveCount(0)
  await expect(output).toHaveAttribute('width', '1920')
  await expect(output).toHaveAttribute('height', '1080')

  await outputSizeKey.selectOption('custom')
  await expect(outputSizeKey).toHaveValue('custom')
  const customWidth = inspector.getByRole('spinbutton', { name: '自定义尺寸宽度' })
  const customHeight = inspector.getByRole('spinbutton', { name: '自定义尺寸高度' })
  await expect(customWidth).toHaveValue('1920')
  await expect(customHeight).toHaveValue('1080')
  await customWidth.fill('1600')
  await customWidth.press('Enter')
  await expect(output).toHaveAttribute('width', '1600')
  await expect(outputSizeKey).toHaveValue('custom')

  await stage.focus()
  await stage.press('Control+z')
  await expect(outputSizeKey).toHaveValue('preset')
  await expect(commonOutputSize).toHaveValue('1920x1080')
  await expect(inspector.getByTestId('semantic-editor-size')).toHaveCount(0)
  await expect(output).toHaveClass(/is-selected/)
  await stage.press('Control+Shift+z')
  await expect(outputSizeKey).toHaveValue('custom')
  await expect(customWidth).toHaveValue('1600')
  await expect(customHeight).toHaveValue('1080')
})

test('OpenSpec: components / Color Picker / 色盘与透明度滑动在真实指针拖动后保持打开', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()
  await page.mouse.click(outputBox!.x + 40, outputBox!.y + 40)

  const inspector = editor.getByRole('region', { name: '画布属性' })
  const trigger = inspector.getByRole('button', { name: '选择输出背景颜色', exact: true })
  await trigger.click()
  const picker = page.getByRole('dialog', { name: '输出背景颜色', exact: true })
  const plane = picker.getByLabel('输出背景色盘', { exact: true })
  const planeBox = await plane.boundingBox()
  const history = editor.locator('[data-compose-ui="history"] li')
  const historyBefore = await history.count()
  expect(planeBox).not.toBeNull()

  await page.mouse.move(planeBox!.x + planeBox!.width * 0.15, planeBox!.y + planeBox!.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(planeBox!.x + planeBox!.width * 0.75, planeBox!.y + planeBox!.height * 0.7, { steps: 4 })
  await page.mouse.up()
  await expect(picker).toBeVisible()

  const alpha = picker.getByRole('slider', { name: '输出背景不透明度', exact: true })
  const alphaBox = await alpha.boundingBox()
  expect(alphaBox).not.toBeNull()
  await expect(alpha).toHaveValue('100')
  await page.mouse.move(alphaBox!.x + alphaBox!.width / 2, alphaBox!.y + alphaBox!.height * 0.9)
  await page.mouse.down()
  await page.mouse.move(alphaBox!.x + alphaBox!.width / 2, alphaBox!.y + alphaBox!.height * 0.3, { steps: 4 })
  await page.mouse.up()
  await expect(alpha).not.toHaveValue('100')
  await expect(picker).toBeVisible()
  await expect(history).toHaveCount(historyBefore + 1)
})

test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', '组件库')

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await expect(editor.getByRole('button').filter({ hasText: /Container|Rectangle|Text|ECharts/ }))
    .toHaveCount(4)
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Container' }), {
    x: stageBox!.x + stageBox!.width / 2,
    y: stageBox!.y + stageBox!.height / 2,
  })
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node.is-container')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveCSS('background-color', 'rgb(248, 250, 252)')
  await editor.getByRole('button', { name: '适配容器' }).click()
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.25,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Text' }), {
    x: frameBox!.x + frameBox!.width * 0.7,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  await expect(stage.locator('.compose-stage__node.is-renderer')).toHaveCount(3)

  const components = frame.locator(':scope > .compose-stage__node.is-renderer')
  const textComponent = components.filter({ hasText: 'Text' })
  await textComponent.click()
  await stage.press('Shift+ArrowRight')
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  const historyPanel = editor.locator('[data-compose-ui="history"]')
  const moveHistoryEntry = historyPanel
    .getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }).first()
  await expect(moveHistoryEntry).toBeVisible()
  await expect(moveHistoryEntry.locator('strong')).toHaveCSS('font-size', '12px')
  await expect(moveHistoryEntry.locator('small')).toHaveCSS('font-size', '10.5px')
  await expect(historyPanel).toHaveScreenshot('history-panel-compact.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await components.nth(0).click()
  await components.nth(1).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = frame.locator(':scope > .compose-stage__node.is-container')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-entity-id')
  expect(groupId).not.toBeNull()
  const groupBackground = editor.getByRole('button', { name: '选择背景颜色', exact: true })
  await groupBackground.click()
  const colorPicker = page.getByRole('dialog', { name: '背景颜色', exact: true })
  await expect(colorPicker).toBeVisible()
  await expect(colorPicker.getByRole('textbox')).toHaveCount(0)
  await colorPicker.getByRole('group', { name: '背景颜色色盘', exact: true })
    .press('ArrowRight')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await stage.press('Control+z')
  await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await stage.press('Control+Shift+z')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')

  await stage.locator('.compose-stage__node.is-renderer').filter({
    hasText: 'Text',
  }).click()
  const property = editor.getByRole('textbox', { name: '文本', exact: true })
  await property.fill('统一事务舞台')
  await expect(stage.getByText('统一事务舞台')).toBeVisible()
  await property.press('Control+z')
  await expect(property).toHaveValue('Text')
  await property.press('Control+Shift+z')
  await expect(property).toHaveValue('统一事务舞台')

  await editor.getByText('命令', { exact: true }).click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  await expect(commandPanel.getByText('成功').first()).toBeVisible()

  await editor.getByText('日志', { exact: true }).click()
  const log = editor.getByRole('region', { name: '操作日志' })
  await expect(log.getByRole('button', { name: /Create Container/ })).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^属性 Update Text Text/ }),
  ).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^属性 修改 Container 外观 Container/ }),
  ).toBeVisible()
  await expect(log.getByRole('button', { name: /Undo · Update Text/ })).toBeVisible()
  await expect(log.getByText(/Reject .* outside a Container/)).toHaveCount(0)
  await log.getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }).click()
  const operationDetail = log.getByRole('region', { name: '操作详情' })
  await expect(operationDetail).toContainText('之前')
  await expect(operationDetail).toContainText('之后')
  await expect(operationDetail).toContainText('forwardPatches')

  await group.click()
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })
  const previewRegion = preview.getByRole('region', { name: 'Compose preview' })
  await expect(previewRegion).toBeVisible()
  await expect(preview.getByText('统一事务舞台')).toBeVisible()
  const previewGroup = preview.getByTestId(`compose-preview-entity-${groupId}`)
  await expect(previewGroup).toBeVisible()
  await expect(previewGroup).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(previewRegion).toHaveScreenshot('document-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await preview.getByRole('button', { name: '选中容器' }).click()
  await expect(preview.getByTestId('compose-preview-container')).toBeVisible()
  await expect(preview.getByText('统一事务舞台')).toBeVisible()
  await expect(previewRegion).toHaveScreenshot('frame-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: component-registry / 完整示例 renderer / 在 Stage 中渲染 ECharts Canvas', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建容器' }).click()
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 ECharts Chart' }), {
    x: frameBox!.x + 320,
    y: frameBox!.y + 240,
  })

  const chart = stage.getByRole('img', { name: 'Quarterly data' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / ECS 聚合 Inspector / 添加能力并由几何限制改变 Stage 手柄', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()

  const rectangle = stage.locator('.compose-stage__node.is-renderer').first()
  await rectangle.click()
  const entityId = await rectangle.getAttribute('data-entity-id')
  expect(entityId).not.toBeNull()
  const inspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const propertyRoot = inspector.getByRole('region', { name: 'Rectangle 属性字段' })
  const capability = inspector.getByRole('combobox', { name: '添加能力' })
  await expect(propertyRoot.getByRole('searchbox', { name: '搜索属性' })).toHaveCount(1)

  const appearance = propertyRoot.getByRole('button', { name: '外观' })
  await appearance.click()
  await expect(propertyRoot.getByRole('button', { name: '背景填充' })).toHaveCount(0)
  await propertyRoot.getByRole('searchbox', { name: '搜索属性' }).fill('背景填充')
  await expect(appearance).toHaveAttribute('aria-expanded', 'true')
  await expect(propertyRoot.getByRole('button', { name: '背景填充' })).toBeVisible()
  await expect(propertyRoot.getByRole('button', { name: '变换' })).toHaveCount(0)
  await propertyRoot.getByRole('searchbox', { name: '搜索属性' }).fill('')
  await expect(appearance).toHaveAttribute('aria-expanded', 'false')
  await expect(propertyRoot.getByRole('button', { name: '背景填充' })).toHaveCount(0)

  await capability.selectOption('geometry-constraints')
  const constraints = propertyRoot.getByRole('button', { name: '几何限制' })
  await expect(constraints).toBeVisible()
  await propertyRoot.getByRole('combobox', { name: 'Resize 模式' })
    .selectOption('horizontal')
  await expect(stage.getByTestId('stage-resize-e')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-w')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-n')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(0)
  await expect(stage.getByTestId('stage-rotation-handle')).toBeVisible()

  await inspector.getByRole('button', { name: '移除几何限制' }).click()
  const confirm = page.getByRole('alertdialog', { name: '移除能力？' })
  await expect(confirm).toContainText('几何限制')
  await confirm.getByRole('button', { name: '移除' }).click()
  await expect(propertyRoot.getByRole('button', { name: '几何限制' })).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-n')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-se')).toBeVisible()

  await capability.selectOption('container')
  const composed = stage.locator(`[data-entity-id="${entityId}"]`)
  await expect(composed).toHaveClass(/is-container/)
  await expect(composed.getByTestId('compose-material-rectangle')).toBeVisible()
  await expect(propertyRoot.getByRole('button', { name: '容器' })).toBeVisible()
  await expect(propertyRoot.getByRole('spinbutton', { name: '子项数量' })).toHaveValue('0')
  await expect(propertyRoot.getByRole('searchbox', { name: '搜索属性' })).toHaveCount(1)

  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.locator(`[data-entity-id="${entityId}"]`)).toHaveClass(/is-renderer/)
  await stage.press('Control+Shift+z')
  await expect(stage.locator(`[data-entity-id="${entityId}"]`)).toHaveClass(/is-container/)

  await capability.selectOption('geometry-constraints')
  await inspector.evaluate((element) => {
    element.style.height = '320px'
    element.style.maxHeight = '320px'
  })
  await expect.poll(async () => inspector.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  )).toBe(true)
  await inspector.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  const inspectorBox = await inspector.boundingBox()
  const toolbarBox = await propertyRoot.locator('.property-panel__toolbar').boundingBox()
  expect(inspectorBox).not.toBeNull()
  expect(toolbarBox).not.toBeNull()
  expect(toolbarBox!.y).toBeCloseTo(inspectorBox!.y, 0)
})

test('OpenSpec: stage-paint-tools / 背景填充 / 线性渐变显示并提交画布控制柄编辑', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()

  const rectangle = stage.locator('.compose-stage__node.is-renderer').first()
  await rectangle.click()
  // 历史列表只在 Scene Graph Dock 激活时挂载。先切换再打开 Paint
  // 编辑器，避免 Dockview 激活操作触发 Popover 的失焦关闭。
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  await editor.getByRole('button', { name: '背景填充', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '背景填充', exact: true })
  await picker.getByRole('button', { name: '线性', exact: true }).click()
  await expect(stage.getByTestId('stage-paint-handles')).toBeVisible()
  await expect(stage.getByTestId('stage-paint-linear-start')).toBeVisible()
  const end = stage.getByTestId('stage-paint-linear-end')
  await expect(end).toBeVisible()

  const history = editor.locator('[data-compose-ui="history"] li')
  const historyBeforeDrag = await history.count()
  const endBox = await end.boundingBox()
  expect(endBox).not.toBeNull()
  await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(endBox!.x - 48, endBox!.y + 32, { steps: 4 })
  await page.mouse.up()
  await expect(history).toHaveCount(historyBeforeDrag + 1)

  await page.keyboard.press('Escape')
  await expect(stage.getByTestId('stage-paint-handles')).toHaveCount(0)
})

test('OpenSpec: stage / 八向缩放 / resize 手柄在预览阶段跟随鼠标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('button', { name: '创建容器' }).click()
  await editor.getByRole('button', { name: '适配容器' }).click()
  const movements = {
    n: { x: 0, y: 60 },
    ne: { x: -100, y: 60 },
    e: { x: -100, y: 0 },
    se: { x: -100, y: -60 },
    s: { x: 0, y: -60 },
    sw: { x: 100, y: -60 },
    w: { x: 100, y: 0 },
    nw: { x: 100, y: 60 },
  } as const

  for (const [direction, movement] of Object.entries(movements)) {
    const handle = stage.getByTestId(`stage-resize-${direction}`)
    const startBox = await handle.boundingBox()
    expect(startBox).not.toBeNull()
    const start = {
      x: startBox!.x + startBox!.width / 2,
      y: startBox!.y + startBox!.height / 2,
    }
    const target = {
      x: start.x + movement.x,
      y: start.y + movement.y,
    }
    expect(await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
      start,
    )).toBe(`stage-resize-${direction}`)

    for (const [from, to] of [[start, target], [target, start]] as const) {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 5 })
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box
          ? Math.max(
              Math.abs(box.x + box.width / 2 - to.x),
              Math.abs(box.y + box.height / 2 - to.y),
            )
          : Number.POSITIVE_INFINITY
      }).toBeLessThanOrEqual(1.5)
      await page.mouse.up()
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box
          ? Math.max(
              Math.abs(box.x + box.width / 2 - to.x),
              Math.abs(box.y + box.height / 2 - to.y),
            )
          : Number.POSITIVE_INFINITY
      }).toBeLessThanOrEqual(1.5)
    }
  }
})

test('OpenSpec: stage / 自适应网格标尺与世界原点 / 最低缩放仍显示网格并保持 8 单位吸附', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await rectangle.click()
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()

  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  let expectedHistoryCount = await historyEntries.count()
  for (let index = 0; index < 13; index += 1) {
    await stage.press('Control+-')
  }
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const grid = stage.getByTestId('stage-grid')
  await expect.poll(() => grid.evaluate((element) =>
    getComputedStyle(element).backgroundSize.split(',').length)).toBe(4)
  await expect.poll(() => grid.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).backgroundSize.split(',')[2]!)))
    .toBeCloseTo(3.2, 1)

  const beforeMove = await rectangle.boundingBox()
  expect(beforeMove).not.toBeNull()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2,
    beforeMove!.y + beforeMove!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2 + 19,
    beforeMove!.y + beforeMove!.height / 2 + 13,
    { steps: 1 },
  )
  await page.mouse.up()
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const xField = editor.getByRole('spinbutton', { name: '位置 X', exact: true })
  await expect.poll(async () => Number(await xField.inputValue()) % 8).toBe(0)

  const resize = stage.getByTestId('stage-resize-se')
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2,
    resizeBox!.y + resizeBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2 + 17,
    resizeBox!.y + resizeBox!.height / 2 + 11,
    { steps: 1 },
  )
  await page.mouse.up()
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const widthField = editor.getByRole('spinbutton', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => Number(await widthField.inputValue()) % 8).toBe(0)
})

test('OpenSpec: stage / Pointer 手势原子性与取消 / move 与 resize 各只提交一次且松手不回弹', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建容器' }).click()
  await editor.getByRole('button', { name: '适配容器' }).click()
  const frame = editor.getByTestId('stage-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.35,
    y: frameBox!.y + frameBox!.height * 0.4,
  })
  const rectangle = stage.locator('.compose-stage__node.is-renderer').filter({
    hasText: 'Rectangle',
  })
  await rectangle.click()
  const rectangleId = await rectangle.getAttribute('data-entity-id')
  expect(rectangleId).not.toBeNull()
  const stableRectangle = editor.locator(`[data-entity-id="${rectangleId}"]`)
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()

  let expectedHistoryCount = await historyEntries.count()
  const beforeMove = await stableRectangle.boundingBox()
  expect(beforeMove).not.toBeNull()
  const moveStart = {
    x: beforeMove!.x + beforeMove!.width / 2,
    y: beforeMove!.y + beforeMove!.height / 2,
  }
  await page.keyboard.down('Control')
  await page.mouse.move(moveStart.x, moveStart.y)
  await page.mouse.down()
  await page.mouse.move(moveStart.x + 48, moveStart.y + 24, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  expectedHistoryCount += 1
  await expect(historyEntries).toHaveCount(expectedHistoryCount)
  const afterMove = await stableRectangle.boundingBox()
  expect(afterMove).not.toBeNull()
  expect(afterMove!.x).not.toBeCloseTo(beforeMove!.x, 1)
  const committedMoveX = afterMove!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await stableRectangle.boundingBox())?.x)
    .toBeCloseTo(committedMoveX, 1)

  const latestContainerBox = await frame.boundingBox()
  expect(latestContainerBox).not.toBeNull()
  await page.mouse.click(latestContainerBox!.x + 8, latestContainerBox!.y + 8)
  const resize = editor.getByTestId('stage-resize-se')
  expectedHistoryCount = await historyEntries.count()
  const beforeResize = await resize.boundingBox()
  expect(beforeResize).not.toBeNull()
  const resizeStart = {
    x: beforeResize!.x + beforeResize!.width / 2,
    y: beforeResize!.y + beforeResize!.height / 2,
  }
  await page.keyboard.down('Control')
  await page.mouse.move(resizeStart.x, resizeStart.y)
  await page.mouse.down()
  await page.mouse.move(resizeStart.x + 40, resizeStart.y + 32, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect(historyEntries).toHaveCount(expectedHistoryCount + 1)
  const afterResize = await resize.boundingBox()
  expect(afterResize).not.toBeNull()
  expect(afterResize!.x).not.toBeCloseTo(beforeResize!.x, 1)
  const committedResizeX = afterResize!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await resize.boundingBox())?.x)
    .toBeCloseTo(committedResizeX, 1)
})

test('OpenSpec: stage / 组合 Container 直接操纵 / 舞台可拖动组合 Container 且子节点保持可命中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建容器' }).click()
  await editor.getByRole('button', { name: '适配容器' }).click()
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node.is-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 220,
    y: frameBox!.y + 220,
  })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 580,
    y: frameBox!.y + 220,
  })

  const components = stage.locator('.compose-stage__node.is-renderer')
  const firstEntityId = await components.nth(0).getAttribute('data-entity-id')
  const secondEntityId = await components.nth(1).getAttribute('data-entity-id')
  expect(firstEntityId).not.toBeNull()
  expect(secondEntityId).not.toBeNull()
  await components.nth(0).click()
  await components.nth(1).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = frame.locator(':scope > .compose-stage__node.is-container')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-entity-id')
  expect(groupId).not.toBeNull()
  const stableGroup = editor.locator(`[data-entity-id="${groupId}"]`)
  const componentBoxes = await Promise.all([
    components.nth(0).boundingBox(),
    components.nth(1).boundingBox(),
  ])
  expect(componentBoxes.every(Boolean)).toBe(true)
  const [left, right] = [...componentBoxes]
    .map((box) => box!)
    .sort((first, second) => first.x - second.x)
  const gapPoint = {
    x: (left.x + left.width + right.x) / 2,
    y: (Math.max(left.y, right.y) + Math.min(
      left.y + left.height,
      right.y + right.height,
    )) / 2,
  }
  const nodeAt = (point: { x: number; y: number }) => page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)
      ?.closest('[data-entity-id]')
      ?.getAttribute('data-entity-id'),
    point,
  )
  expect(await nodeAt(gapPoint)).toBe(groupId)

  const groupBefore = await stableGroup.boundingBox()
  expect(groupBefore).not.toBeNull()
  await page.keyboard.down('Control')
  await page.mouse.move(gapPoint.x, gapPoint.y)
  await page.mouse.down()
  await page.mouse.move(gapPoint.x + 80, gapPoint.y + 40, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  const groupAfter = await stableGroup.boundingBox()
  expect(groupAfter).not.toBeNull()
  expect(groupAfter!.x).not.toBeCloseTo(groupBefore!.x, 1)
  const committedGroupX = groupAfter!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await stableGroup.boundingBox())?.x)
    .toBeCloseTo(committedGroupX, 1)

  const child = editor.locator(`[data-entity-id="${firstEntityId}"]`)
  const childBefore = await child.boundingBox()
  expect(childBefore).not.toBeNull()
  const childPoint = {
    x: childBefore!.x + childBefore!.width / 2,
    y: childBefore!.y + childBefore!.height / 2,
  }
  expect(await nodeAt(childPoint)).toBe(await child.getAttribute('data-entity-id'))
  await page.keyboard.down('Control')
  await page.mouse.move(childPoint.x, childPoint.y)
  await page.mouse.down()
  await page.mouse.move(childPoint.x + 40, childPoint.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  const childAfter = await child.boundingBox()
  expect(childAfter).not.toBeNull()
  expect(childAfter!.x).not.toBeCloseTo(childBefore!.x, 1)
  const childX = childAfter!.x
  await page.waitForTimeout(100)
  await expect.poll(async () => (await child.boundingBox())?.x)
    .toBeCloseTo(childX, 1)
})

test('OpenSpec: stage / 网格标尺辅助线与滚动导航 / 完成 Godot 风格纵向流程', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建容器' }).click()
  await editor.getByRole('button', { name: '适配容器' }).click()

  await editor.getByRole('button', { name: '智能吸附' }).click()
  await editor.getByRole('button', { name: '画布设置' }).click()
  const settings = editor.getByRole('dialog', { name: '画布网格与吸附设置' })
  await settings.getByRole('textbox', { name: 'X 步长' }).fill('16')
  await settings.getByRole('textbox', { name: 'Y 步长' }).fill('16')
  await settings.getByRole('button', { name: '应用' }).click()
  await expect(editor.getByRole('button', { name: '智能吸附' }))
    .toHaveAttribute('aria-pressed', 'false')

  const frame = stage.getByTestId('stage-container')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.3,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  const rectangle = stage.locator('.compose-stage__node.is-renderer').filter({
    hasText: 'Rectangle',
  })
  await rectangle.click()

  const beforeMove = await rectangle.boundingBox()
  expect(beforeMove).not.toBeNull()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2,
    beforeMove!.y + beforeMove!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    beforeMove!.x + beforeMove!.width / 2 + 27,
    beforeMove!.y + beforeMove!.height / 2 + 19,
    { steps: 5 },
  )
  await page.mouse.up()
  const xField = editor.getByRole('spinbutton', { name: '位置 X', exact: true })
  await expect.poll(async () => Number(await xField.inputValue()) % 16).toBe(0)

  const resize = stage.getByTestId('stage-resize-se')
  const resizeBox = await resize.boundingBox()
  expect(resizeBox).not.toBeNull()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2,
    resizeBox!.y + resizeBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeBox!.x + resizeBox!.width / 2 + 31,
    resizeBox!.y + resizeBox!.height / 2 + 23,
    { steps: 5 },
  )
  await page.mouse.up()
  const widthField = editor.getByRole('spinbutton', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => Number(await widthField.inputValue()) % 16).toBe(0)

  const originX = await stage.getByTestId('stage-origin-y').getAttribute('x1')
  const originY = await stage.getByTestId('stage-origin-x').getAttribute('y1')
  await expect(stage.getByTestId('stage-ruler-x')
    .locator('[data-world-value="0"]')).toHaveAttribute(
    'transform',
    `translate(${originX} 0)`,
  )
  await expect(stage.getByTestId('stage-ruler-y')
    .locator('[data-world-value="0"]')).toHaveAttribute(
    'transform',
    `translate(0 ${originY})`,
  )

  const ruler = stage.getByTestId('stage-ruler-x')
  const rulerBox = await ruler.boundingBox()
  const surfaceBox = await stage.getByTestId('stage-surface').boundingBox()
  expect(rulerBox).not.toBeNull()
  expect(surfaceBox).not.toBeNull()
  await page.mouse.move(rulerBox!.x + rulerBox!.width * 0.6, rulerBox!.y + 10)
  await page.mouse.down()
  await page.mouse.move(surfaceBox!.x + surfaceBox!.width * 0.62, surfaceBox!.y + 120)
  await page.mouse.up()
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(1)
  await expect(editor).toHaveScreenshot('stage-workspace-guide.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await stage.press('Control+z')
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(0)
  await stage.press('Control+Shift+z')
  await expect(stage.locator('.compose-stage__canvas-guide')).toHaveCount(1)

  const horizontal = stage.getByRole('scrollbar', { name: '水平画布滚动条' })
  const beforeScroll = await horizontal.getAttribute('aria-valuenow')
  await horizontal.press('End')
  await expect(horizontal).not.toHaveAttribute('aria-valuenow', beforeScroll!)
  await horizontal.press('Home')
  const negativeTicks = stage.getByTestId('stage-ruler-x').locator('[data-world-value^="-"]')
  await expect.poll(() => negativeTicks.evaluateAll((ticks) => {
    const ruler = ticks[0]?.closest('[data-testid="stage-ruler-x"]')
    if (!ruler) return false
    const rulerRect = ruler.getBoundingClientRect()
    return ticks.some((tick) => {
      const rect = tick.getBoundingClientRect()
      return rect.right > rulerRect.left && rect.left < rulerRect.right
    })
  })).toBe(true)
  await expect(editor).toHaveScreenshot('stage-workspace-negative-scroll.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: editor-preferences / 设置中心纵向流程 / 切换主题语言并重绑临时平移', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const settingsButton = editor.getByRole('button', { name: '设置', exact: true })
  await settingsButton.click()
  const settingsDialog = page.getByRole('dialog', { name: '设置' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog.getByRole('searchbox', { name: '搜索设置' })).toBeFocused()
  await expect(editor.locator('.compose-editor__workspace')).toHaveAttribute('inert', '')
  await expect(page).toHaveScreenshot('editor-preferences-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await settingsDialog.getByRole('radio', { name: '浅色' }).click()
  await expect(editor).toHaveAttribute('data-compose-theme', 'light')
  await settingsDialog.getByRole('button', { name: '关闭设置' }).click()
  await expect(settingsButton).toBeFocused()
  await expect(editor).toHaveScreenshot('editor-workspace-light.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: '语言', exact: true }).click()
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(editor).toHaveAttribute('lang', 'en-US')
  await expect(editor.locator('button[aria-label="Canvas settings"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', 'Component Library')
  await expect(editor).toHaveScreenshot('editor-workspace-english.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  const temporaryPanBinding = page.getByRole('button', {
    name: 'Change Temporary pan shortcut',
  })
  await temporaryPanBinding.click()
  await page.keyboard.press('p')
  await expect(temporaryPanBinding).toHaveText('P')
  await page.getByRole('button', { name: 'Close settings' }).click()

  const surface = stage.getByTestId('stage-surface')
  const surfaceBox = await surface.boundingBox()
  expect(surfaceBox).not.toBeNull()
  const origin = stage.getByTestId('stage-origin-y')
  const beforeCustomPan = Number(await origin.getAttribute('x1'))
  const start = {
    x: surfaceBox!.x + surfaceBox!.width * 0.72,
    y: surfaceBox!.y + surfaceBox!.height * 0.68,
  }
  await surface.click({
    position: {
      x: surfaceBox!.width * 0.72,
      y: surfaceBox!.height * 0.68,
    },
  })
  await page.keyboard.down('p')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 64, start.y + 36, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('p')
  await expect.poll(async () => Number(await origin.getAttribute('x1')))
    .toBeCloseTo(beforeCustomPan + 64, 0)

  await editor.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  await page.getByRole('button', {
    name: 'Restore default Temporary pan shortcut',
  }).click()
  await expect(page.getByRole('button', {
    name: 'Change Temporary pan shortcut',
  })).toHaveText('Space')
  await page.getByRole('button', { name: 'Close settings' }).click()

  const beforeRestoredPan = Number(await origin.getAttribute('x1'))
  await surface.click({
    position: {
      x: surfaceBox!.width * 0.72,
      y: surfaceBox!.height * 0.68,
    },
  })
  await page.keyboard.down('Space')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 40, start.y + 24, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await expect.poll(async () => Number(await origin.getAttribute('x1')))
    .toBeCloseTo(beforeRestoredPan + 40, 0)

  await page.reload()
  const reloadedEditor = page.getByRole('region', { name: 'Compose editor' })
  await expect(reloadedEditor).toHaveAttribute('data-compose-theme', 'dark')
  await expect(reloadedEditor).toHaveAttribute('lang', 'zh-CN')

  await page.goto('/?message-overrides')
  const overriddenEditor = page.getByRole('region', { name: 'Compose editor' })
  await overriddenEditor.getByRole('button', { name: '偏好设置' }).click()
  await expect(
    page.getByRole('dialog', { name: '偏好设置' }),
  ).toBeVisible()
})

test('OpenSpec: stage / DOM Scene 与 SVG Overlay 分层 / 完整示例视觉黄金文件', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })

  await expect(editor).toHaveScreenshot('stage-workspace-default.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
  await editor.getByText('命令', { exact: true }).click()
  await expect(editor.getByRole('region', { name: '命令调试台' })
    .getByText('成功').first()).toBeVisible()
  await expect(editor).toHaveScreenshot('stage-workspace-root-component.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await editor.getByText('命令', { exact: true }).click()

  await editor.getByRole('button', { name: '创建容器' }).click()
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + 160,
    y: frameBox!.y + 180,
  })
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Text' }), {
    x: frameBox!.x + 480,
    y: frameBox!.y + 180,
  })
  const frame = stage.getByTestId('stage-container')
  const frameComponents = frame.locator(':scope > .compose-stage__node.is-renderer')
  await frameComponents.nth(0).click()
  await frameComponents.nth(1).click({
    modifiers: ['Shift'],
  })

  await expect(editor).toHaveScreenshot('stage-workspace-selected.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+g')
  await expect(stage.locator('.compose-stage__node.is-container .compose-stage__node.is-container'))
    .toHaveCount(1)
  await expect(editor).toHaveScreenshot('stage-workspace-nested-frame.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+Shift+g')

  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  await editor.getByRole('row', { name: /Container/ })
    .getByRole('button', { name: '展开节点' })
    .click()
  await editor.getByRole('row', { name: /Rectangle/ }).last().click()
  const rectangle = frame.locator(':scope > .compose-stage__node.is-renderer').filter({
    hasText: 'Rectangle',
  })
  const rectangleBox = await rectangle.boundingBox()
  expect(rectangleBox).not.toBeNull()
  await expect(editor.getByRole('region', { name: 'Rectangle 属性', exact: true })).toBeVisible()
  const pointerStart = {
    clientX: rectangleBox!.x + rectangleBox!.width / 2,
    clientY: rectangleBox!.y + rectangleBox!.height / 2,
  }
  const pointerEnd = {
    clientX: pointerStart.clientX + frameBox!.x - rectangleBox!.x + 2,
    clientY: pointerStart.clientY,
  }
  await rectangle.dispatchEvent('pointerdown', {
    ...pointerStart,
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 41,
  })
  await stage.dispatchEvent('pointermove', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 41,
  })
  await expect(stage.locator('.compose-stage__guide')).not.toHaveCount(0)
  await expect(editor).toHaveScreenshot('stage-workspace-snapping.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.dispatchEvent('pointerup', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    buttons: 0,
    pointerId: 41,
  })
})

test('OpenSpec: editor-workspace-layout / 页面文档标签 / 创建、编辑、保存并重开页面', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()

  // 1) 右键创建页面
  await rootGrid.getByRole('gridcell', { name: /^Pages/ }).dblclick()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()
  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).click({ button: 'right' })
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem', { name: '创建页面' }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Detail')
  await nameDialog.getByRole('button', { name: '创建' }).click()
  await expect(pagesGrid.getByRole('gridcell', { name: /Detail.page.json/ })).toBeVisible()

  // 2) 创建后随即以页面标签打开
  const detailTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await expect(detailTab).toHaveCount(1)
  await expect(detailTab).toContainText('Detail')

  // 3) 在画布上创建一个容器，页面标签出现未保存指示
  await editor.getByRole('button', { name: '创建容器' }).click()
  const dirty = detailTab.getByRole('img', { name: '有未保存改动' })
  await expect(dirty).toBeVisible()

  // 4) 保存后未保存指示消失
  await detailTab.getByRole('button', { name: /^关闭页面/ }).click()
  const unsaved = page.getByRole('dialog', { name: '页面尚未保存' })
  await expect(unsaved).toBeVisible()
  await unsaved.getByRole('button', { name: '保存' }).click()
  await expect(detailTab).toHaveCount(0)

  // 5) 重开该页面时看到已持久化的实体
  await pagesGrid.getByRole('gridcell', { name: /Detail.page.json/ }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(1)
  const sceneTree = editor.locator('[data-workspace-panel="scene-graph"]')
  await expect(sceneTree).toContainText('Container')
})

test('OpenSpec: editor-workspace-layout / 首页标记 / 设为首页并在树与网格双处标记', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).dblclick()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()

  // 文件树默认不展开子目录；标记要在树与网格双处断言，先展开 Pages 节点。
  const tree = assets.getByRole('treegrid')
  const pagesRow = tree.getByRole('row', { name: 'Pages' })
  await pagesRow.click()
  await pagesRow.press('ArrowRight')
  await expect(tree.getByRole('row', { name: /Home.page.json/ })).toBeVisible()

  // 初始没有首页
  await expect(assets.getByRole('img', { name: '首页' })).toHaveCount(0)

  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '设为首页' }).click()

  // 树行与网格块双处渲染标记
  await expect(tree.getByRole('row', { name: /Home.page.json/ })
    .getByRole('img', { name: '首页' })).toBeVisible()
  await expect(pagesGrid.getByRole('gridcell', { name: /Home.page.json/ })
    .getByRole('img', { name: '首页' })).toBeVisible()

  // 已是首页时该项禁用
  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).click({ button: 'right' })
  await expect(page.getByRole('menu').getByRole('menuitem', { name: '设为首页' }))
    .toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')

  // 第二个页面接管首页标记
  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建页面' }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Second')
  await nameDialog.getByRole('button', { name: '创建' }).click()
  await expect(pagesGrid.getByRole('gridcell', { name: /Second.page.json/ })).toBeVisible()

  await pagesGrid.getByRole('gridcell', { name: /Second.page.json/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '设为首页' }).click()

  await expect(pagesGrid.getByRole('gridcell', { name: /Second.page.json/ })
    .getByRole('img', { name: '首页' })).toBeVisible()
  await expect(pagesGrid.getByRole('gridcell', { name: /Home.page.json/ })
    .getByRole('img', { name: '首页' })).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 只读页面 JSON / Monaco 只读且无保存', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).dblclick()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()

  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '打开组件 JSON 配置' }).click()

  const jsonDocument = editor.locator('[data-workspace-panel="asset-document"][data-readonly="true"]')
  await expect(jsonDocument.locator('.monaco-editor')).toBeVisible()
  await expect(jsonDocument.locator('.view-lines')).toContainText('"schemaVersion"')

  // 输入不改变内容，也不产生未保存指示
  const monacoInput = jsonDocument.getByRole('textbox', { name: 'Editor content' })
  await monacoInput.focus()
  await page.keyboard.type('tampered')
  await expect(jsonDocument.locator('.view-lines')).not.toContainText('tampered')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // Cmd/Ctrl+S 不触发保存；关闭时不需要确认
  await page.keyboard.press('Control+S')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)
  await editor.getByRole('button', { name: /关闭资源 Home.page.json/ }).click()
  await expect(jsonDocument).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('OpenSpec: basic-materials / Page Slot / 拖页面到画布并在画布与预览中渲染', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  // 1) 先在 Home 页面里放一个矩形，作为嵌套渲染的可见证据
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).dblclick()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: /Home.page.json/ }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(1)
  await editor.getByRole('button', { name: '创建容器' }).click()
  const homeTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await homeTab.getByRole('button', { name: /^关闭页面/ }).click()
  await page.getByRole('dialog', { name: '页面尚未保存' })
    .getByRole('button', { name: '保存' }).click()
  await expect(homeTab).toHaveCount(0)

  // 2) 在根文档里创建一个 Page Slot 实体
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: 'Page Slot' }).click()
  await expect(stage.getByTestId('compose-page-slot-placeholder')).toBeVisible()

  // 3) 属性面板的 node 字段选中 Home 页面
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const nodeField = inspector.getByTestId('semantic-editor-node')
  await expect(nodeField).toBeVisible()
  await nodeField.getByRole('combobox').click()
  await inspector.getByRole('option', { name: 'Home' }).click()

  // 4) 画布上实时渲染被引用页面的内容
  await expect(stage.getByTestId('compose-page-slot-content')).toBeVisible()

  // 5) 预览中同样渲染
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog').or(page.getByTestId('compose-preview-document'))
  await expect(preview.getByTestId('compose-page-slot-content').first()).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 页面文档标签 / 页面面板与固定画布布局一致', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).dblclick()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: /Home.page.json/ }).dblclick()

  const pagePanel = editor.locator('[data-workspace-panel="page-document"]')
  await expect(pagePanel).toBeVisible()
  const pageContent = await pagePanel.locator('.compose-editor__canvas-content').boundingBox()
  const pageStage = await pagePanel.locator('.compose-stage').boundingBox()

  await editor.locator('[data-workspace-tab="compose-canvas"]').click()
  const canvasPanel = editor.locator('[data-workspace-panel="canvas"]')
  const canvasContent = await canvasPanel.locator('.compose-editor__canvas-content').boundingBox()

  // 内容区依赖 flex-1 撑开；页面面板若用 grid 布局会塌陷成零高度并在工具栏下留出空隙。
  expect(pageContent?.height).toBeGreaterThan(100)
  expect(Math.round(pageContent?.height ?? 0)).toBe(Math.round(canvasContent?.height ?? -1))
  expect(Math.round(pageStage?.height ?? 0)).toBe(Math.round(pageContent?.height ?? -1))
})

test('OpenSpec: editor-workspace-layout / 页面文档标签 / 切换其他面板不会让画布消失', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).dblclick()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: /Home.page.json/ }).dblclick()

  const pagePanel = editor.locator('[data-workspace-panel="page-document"]')
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)

  // Dockview 的活动面板是全局的：点击其他组的面板不得让页面标签失去 Stage 宿主身份。
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)

  // 工作区仍跟随该页面：从组件库创建的实体写进页面运行时并标脏。
  await editor.getByRole('button', { name: 'Rectangle' }).click()
  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await expect(pageTab.getByRole('img', { name: '有未保存改动' })).toBeVisible()

  // 切回资源面板后画布依然在。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)
})
