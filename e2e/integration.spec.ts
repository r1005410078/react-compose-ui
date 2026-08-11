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

/** 通过新的画布工具流创建一个可供后续断言操作的 Container。 */
async function drawContainer(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '创建容器' }).click()
  await page.mouse.move(outputBox!.x + 48, outputBox!.y + 64)
  await page.mouse.down()
  await page.mouse.move(outputBox!.x + 696, outputBox!.y + 424, { steps: 4 })
  await page.mouse.up()
  await expect(stage.getByTestId('stage-container')).toBeVisible()
  await editor.getByRole('button', { name: '选择' }).click()
}

async function enableAutoLayout(inspector: Locator) {
  await inspector.getByRole('button', { name: '添加布局' }).click()
  await inspector.getByRole('menuitem', { name: 'Auto Layout display: flex' }).click()
}

async function selectAxisSizing(inspector: Locator, axis: '宽度' | '高度', mode: 'Fill' | 'Hug') {
  const input = inspector.getByRole('combobox', { name: `尺寸${axis}` })
  await input.fill(mode)
  await input.press('Enter')
}

async function expandInspectorSection(inspector: Locator, name: string) {
  const trigger = inspector.getByRole('button', { name, exact: true })
  if (await trigger.getAttribute('aria-expanded') === 'false') {
    await trigger.click()
  }
}

test('OpenSpec: editor-workspace-layout / 启动时打开标记首页 / 根路径直接展示 Home 页面工作区', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)
  await expect(editor.locator('[data-workspace-tab="compose-component-library"]')).toHaveCount(0)
  const componentLibrary = editor.locator('[data-workspace-panel="component-library"]')
  await expect(componentLibrary).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '基础 (8)' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 Text' })).toBeVisible()

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
  const homeDocument = page.locator(
    '[data-workspace-panel="page-document"][data-page-key="demo-home-page"]',
  )
  const leftBox = await left.boundingBox()
  const rightBox = await right.boundingBox()
  const bottomBox = await bottom.boundingBox()
  const homeDocumentBox = await homeDocument.boundingBox()
  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  expect(bottomBox).not.toBeNull()
  expect(homeDocumentBox).not.toBeNull()
  await expect(editor.locator('[data-workspace-panel="canvas"]')).toHaveCount(0)
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Home' })).toBeVisible()
  expect(leftBox!.x).toBeLessThan(homeDocumentBox!.x)
  expect(rightBox!.x).toBeGreaterThanOrEqual(homeDocumentBox!.x + homeDocumentBox!.width)
  expect(bottomBox!.y).toBeGreaterThan(homeDocumentBox!.y)
  expect(bottomBox!.height).toBeLessThan(80)
  expect(await bottom.locator('[data-workspace-tab]').evaluateAll(
    (tabs) => tabs.map((tab) => tab.getAttribute('data-workspace-tab')),
  )).toEqual(['compose-assets', 'compose-command', 'compose-transaction-log'])
  await expect(componentLibrary).toHaveScreenshot('component-library-dock.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
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
  await expect(xAxis).toHaveCSS('stroke', 'rgba(216, 91, 216, 0.75)')
  await expect(yAxis).toHaveCSS('stroke', 'rgba(194, 238, 109, 0.75)')
  await expect(bottomEdge).toHaveCSS('stroke', 'rgb(142, 152, 168)')
  await expect(rightEdge).toHaveCSS('stroke', 'rgb(142, 152, 168)')
  await expect(bottomEdge).toHaveCSS('stroke-opacity', '0.72')
  await expect(rightEdge).toHaveCSS('stroke-opacity', '0.72')
  await expect(originSilhouette).toHaveCSS('fill', 'rgb(32, 37, 45)')
  await expect(originSilhouette).toHaveCSS('fill-opacity', '0.9')
  await expect(originPosition).toHaveCSS('fill', 'rgb(164, 172, 183)')
  await expect(originPosition).toHaveCSS('fill-opacity', '0.88')
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
  await expect(inspector.getByTestId('semantic-editor-paint')).toBeVisible()
  const canvasPaint = inspector.getByRole('button', { name: '输出背景', exact: true })
  await canvasPaint.click()
  const canvasPaintPicker = page.getByRole('dialog', { name: '输出背景', exact: true })
  const expectCompactPaintPicker = async () => {
    expect(await canvasPaintPicker.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      overflowY: getComputedStyle(element).overflowY,
      scrollableX: element.scrollWidth > element.clientWidth,
      scrollableY: element.scrollHeight > element.clientHeight,
    }))).toEqual({
      overflowX: 'visible',
      overflowY: 'visible',
      scrollableX: false,
      scrollableY: false,
    })
  }
  const expectPaintCardsContained = async () => {
    expect(await canvasPaintPicker.locator('.compose-paint-picker__card').evaluateAll((cards) =>
      cards
        .filter((card) => card.scrollWidth > card.clientWidth)
        .map((card) => card.scrollWidth - card.clientWidth),
    )).toEqual([])
  }
  await expect(canvasPaintPicker.getByRole('textbox')).toHaveCount(2)
  await expect(canvasPaintPicker.getByText('颜色与图片', { exact: true })).toHaveCount(0)
  await expect(canvasPaintPicker.getByRole('button', { name: '纯色', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '渐变', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '图片', exact: true })).toBeVisible()
  await expectCompactPaintPicker()
  await canvasPaintPicker.getByRole('button', { name: '图片', exact: true }).click()
  await expect(canvasPaintPicker.getByRole('button', { name: 'compose-grid.svg' })).toBeVisible()
  await canvasPaintPicker.getByRole('button', { name: 'compose-grid.svg' }).click()
  await expect(stage.getByTestId('stage-output-paint'))
    .toHaveAttribute('data-compose-output-paint', 'image')
  await expect(canvasPaintPicker.getByRole('checkbox', { name: '叠加颜色' })).toBeChecked()
  await canvasPaintPicker.getByRole('button', { name: '适应', exact: true }).click()
  await expect(canvasPaintPicker.getByRole('button', { name: '适应', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await canvasPaintPicker.getByRole('slider', { name: '不透明度', exact: true }).fill('72')
  await expect(canvasPaintPicker.getByRole('slider', { name: '不透明度', exact: true })).toHaveValue('72')
  await expectCompactPaintPicker()
  await expectPaintCardsContained()
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-image-picker.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await canvasPaintPicker.getByRole('button', { name: '选择图片', exact: true }).click()
  await expect(canvasPaintPicker.getByRole('heading', { name: '图片资源' })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: 'dashboard.bmp' })).toBeVisible()
  await expectCompactPaintPicker()
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-image-library.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await canvasPaintPicker.getByRole('button', { name: 'dashboard.bmp' }).click()
  await expect(canvasPaintPicker.getByRole('button', { name: '适应', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(canvasPaintPicker.getByRole('slider', { name: '不透明度', exact: true })).toHaveValue('72')

  await canvasPaintPicker.getByLabel('上传图片').setInputFiles({
    name: 'uploaded.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#8b5cf6"/></svg>'),
  })
  await expect(stage.getByTestId('stage-output-paint'))
    .toHaveAttribute('data-compose-output-paint', 'image')
  await expectCompactPaintPicker()

  await canvasPaintPicker.getByRole('button', { name: '渐变', exact: true }).click()
  await expectCompactPaintPicker()
  await expectPaintCardsContained()
  await expect(canvasPaintPicker.getByRole('button', { name: '线性', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '径向', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '角向', exact: true })).toBeVisible()
  await canvasPaintPicker.getByRole('button', { name: '线性', exact: true }).click()
  await expect(canvasPaintPicker.getByLabel('渐变色标轨道')).toBeVisible()
  await expect(stage.getByTestId('stage-output-paint'))
    .toHaveAttribute('data-compose-output-paint', 'linear-gradient')
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-color-picker.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  const addStop = canvasPaintPicker.getByRole('button', { name: /添加色标/ })
  await addStop.click()
  await addStop.click()
  const stopTrack = canvasPaintPicker.getByLabel('渐变色标轨道')
  await expect(stopTrack.getByRole('button', { name: '25%' })).toHaveAttribute('aria-pressed', 'true')
  await expect(stopTrack.getByRole('button')).toHaveCount(4)

  const directionDial = canvasPaintPicker.getByRole('slider', { name: '方向角度' })
  const directionBox = await directionDial.boundingBox()
  expect(directionBox).not.toBeNull()
  await page.mouse.move(
    directionBox!.x + directionBox!.width - 1,
    directionBox!.y + directionBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    directionBox!.x + directionBox!.width / 2,
    directionBox!.y + directionBox!.height - 1,
    { steps: 4 },
  )
  await page.mouse.up()
  await expect(canvasPaintPicker.getByRole('spinbutton', { name: '角度' })).toHaveValue('90')

  await canvasPaintPicker.getByRole('button', { name: '径向', exact: true }).click()
  await expect(stage.getByTestId('stage-output-paint'))
    .toHaveAttribute('data-compose-output-paint', 'radial-gradient')
  await expect(canvasPaintPicker.getByRole('slider', { name: '方向角度' })).toHaveCount(0)
  await canvasPaintPicker.getByRole('spinbutton', { name: '中心 X' }).fill('65')
  await canvasPaintPicker.getByRole('spinbutton', { name: '垂直半径' }).fill('35')
  await expect(canvasPaintPicker.getByRole('spinbutton', { name: '中心 X' })).toHaveValue('65')
  await expect(canvasPaintPicker.getByRole('spinbutton', { name: '垂直半径' })).toHaveValue('35')
  await expectCompactPaintPicker()
  await expectPaintCardsContained()

  await canvasPaintPicker.getByRole('button', { name: '角向', exact: true }).click()
  await expect(stage.getByTestId('stage-output-paint'))
    .toHaveAttribute('data-compose-output-paint', 'angular-gradient')
  await canvasPaintPicker.getByRole('spinbutton', { name: '角度' }).fill('135')
  await expect(canvasPaintPicker.getByRole('slider', { name: '方向角度' }))
    .toHaveAttribute('aria-valuenow', '135')
  await canvasPaintPicker.getByText('高级设置', { exact: true }).click()
  await canvasPaintPicker.getByRole('spinbutton', { name: '中心 X' }).fill('40')
  await expect(canvasPaintPicker.getByRole('slider', { name: '角向中心' }))
    .toHaveAttribute('aria-valuetext', '40%, 50%')
  await expectCompactPaintPicker()
  await expectPaintCardsContained()

  await canvasPaintPicker.press('Escape')
  await expect(canvasPaint).toBeFocused()
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

test('OpenSpec: components / Paint Picker / 色盘与透明度滑动在真实指针拖动后保持打开', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()
  const output = stage.getByTestId('stage-output-boundary')
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

test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library-panel"]'),
  ).toHaveAttribute('title', '基础组件')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await expect(editor.getByRole('button').filter({ hasText: /Container|Rectangle|Text|ECharts/ }))
    .toHaveCount(4)
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  const containerTile = editor.getByRole('button', { name: '添加 Container' })
  const containerTileBox = await containerTile.boundingBox()
  expect(containerTileBox).not.toBeNull()
  const containerDropTarget = {
    x: stageBox!.x + stageBox!.width / 2,
    y: stageBox!.y + stageBox!.height / 2,
  }
  await page.mouse.move(
    containerTileBox!.x + containerTileBox!.width / 2,
    containerTileBox!.y + containerTileBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(containerDropTarget.x, containerDropTarget.y, { steps: 5 })
  const dragPreview = editor
    .locator('[data-workspace-panel="component-library"]')
    .locator('.component-palette__drag-preview')
  await expect(dragPreview).toBeVisible()
  const dragPreviewBox = await dragPreview.boundingBox()
  expect(dragPreviewBox).not.toBeNull()
  expect(Math.round(dragPreviewBox!.x)).toBe(Math.round(containerDropTarget.x + 12))
  expect(Math.round(dragPreviewBox!.y)).toBe(Math.round(containerDropTarget.y + 12))
  await page.mouse.up()
  await expect(dragPreview).toHaveCount(0)
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node.is-container')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveCSS('background-color', 'rgb(248, 250, 252)')
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
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()
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
  const groupInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await expandInspectorSection(groupInspector, '容器')
  await groupInspector.getByRole('combobox', { name: '纵向溢出', exact: true })
    .selectOption('scroll')
  await expect(group.getByTestId('stage-overflow-indicator-y')).toBeVisible()
  await expect(group.getByTestId('stage-overflow-indicator-x')).toHaveCount(0)
  await expandInspectorSection(groupInspector, '外观')
  const groupBackground = groupInspector.getByRole('button', { name: '背景填充', exact: true })
  await groupBackground.click()
  const colorPicker = page.getByRole('dialog', { name: '背景填充', exact: true })
  await expect(colorPicker).toBeVisible()
  await expect(colorPicker.getByRole('textbox')).toHaveCount(2)
  await colorPicker.getByRole('group', { name: '纯色色盘', exact: true })
    .press('ArrowRight')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await stage.press('Control+z')
  await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await stage.press('Control+Shift+z')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await colorPicker.press('Escape')
  await expect(colorPicker).not.toBeVisible()

  await stage.locator('.compose-stage__node.is-renderer').filter({
    hasText: 'Text',
  }).click()
  const textInspector = editor.getByRole('region', { name: 'Text 属性', exact: true })
  await expandInspectorSection(textInspector, '文本')
  await expect(textInspector.getByRole('button', { name: '内容' })).toHaveCount(0)
  const property = textInspector.getByRole('textbox', { name: '文本', exact: true })
  await property.fill('统一事务舞台')
  await expect(stage.getByText('统一事务舞台')).toBeVisible()
  await property.press('Control+z')
  await expect(property).toHaveValue('Text')
  await property.press('Control+Shift+z')
  await expect(property).toHaveValue('统一事务舞台')
  await expandInspectorSection(textInspector, '排版')
  await expect(textInspector.getByRole('spinbutton', { name: '字号' })).toBeVisible()
  await expect(textInspector.getByRole('textbox', { name: '字体' })).toBeVisible()
  await expect(textInspector.getByRole('textbox', { name: '字重' })).toBeVisible()
  await expect(textInspector.getByRole('spinbutton', { name: '字间距' })).toBeVisible()
  await expect(textInspector.getByRole('spinbutton', { name: '行高' })).toBeVisible()
  // OpenSpec: property-panel / 受控属性变量绑定 / 绑定入口不占用编辑区
  for (const label of ['字号', '字体', '字重', '字间距', '行高']) {
    const trigger = textInspector.getByRole('button', { name: new RegExp(`绑定\\s*${label}`, 'u') })
    const field = trigger.locator('..').locator('..')
    await expect(trigger).toHaveCSS('opacity', '0')
    await expect(field.locator('.property-panel__binding-slot')).toHaveCount(0)
    const geometry = await field.evaluate((element) => {
      const control = element.querySelector<HTMLElement>('[data-property-part="control"]')
      const input = control?.querySelector<HTMLElement>('input, select')
      if (!control || !input) return null
      return {
        controlWidth: control.getBoundingClientRect().width,
        inputWidth: input.getBoundingClientRect().width,
      }
    })
    expect(geometry).not.toBeNull()
    expect(Math.abs(geometry!.controlWidth - geometry!.inputWidth)).toBeLessThanOrEqual(1)
    await field.hover()
    await expect(trigger).toHaveCSS('opacity', '1')
    await textInspector.getByLabel(label, { exact: true }).focus()
    await expect(trigger).toHaveCSS('opacity', '1')
  }
  for (let index = 0; index < 12; index += 1) {
    await stage.press('Shift+ArrowDown')
  }

  await editor.getByText('命令', { exact: true }).click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  await expect(commandPanel.getByText('成功').first()).toBeVisible()

  await editor.getByText('日志', { exact: true }).click()
  const log = editor.getByRole('region', { name: '操作日志' })
  await expect(log.getByRole('button', { name: /Create Container/ })).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^属性 Update Text Text/ }).first(),
  ).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^属性 修改 Container 外观 Container/ }),
  ).toBeVisible()
  await expect(log.getByRole('button', { name: /Undo · Update Text/ })).toBeVisible()
  await expect(log.getByText(/Reject .* outside a Container/)).toHaveCount(0)
  await log.getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }).last().click()
  const operationDetail = log.getByRole('region', { name: '操作详情' })
  await expect(operationDetail).toContainText('之前')
  await expect(operationDetail).toContainText('之后')
  await expect(operationDetail).toContainText('forwardPatches')

  await group.click()
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })
  const previewRegion = preview.getByRole('region', { name: 'Compose preview' })
  await expect(previewRegion).toBeVisible()
  await expect(preview).toHaveScreenshot('preview-dialog.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await expect(preview.getByText('统一事务舞台')).toBeVisible()
  const previewGroup = preview.getByTestId(`compose-preview-entity-${groupId}`)
  await expect(previewGroup).toBeVisible()
  await expect(previewGroup).toHaveCSS('overflow-y', 'auto')
  expect(await previewGroup.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeGreaterThan(0)
  await previewGroup.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect.poll(() => previewGroup.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
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

test('OpenSpec: Preview 原生 Container 滚动 / 滚动范围保留底部内边距', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const container = stage.getByTestId('stage-container')
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const containerBox = await container.boundingBox()
  expect(containerBox).not.toBeNull()
  for (let index = 0; index < 5; index += 1) {
    await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
      x: containerBox!.x + containerBox!.width / 2,
      y: containerBox!.y + containerBox!.height / 2,
    })
  }
  await editor.getByRole('treegrid', { name: '场景树' })
    .getByRole('row')
    .filter({ hasText: 'Container' })
    .click()
  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(inspector)
  const layoutHeader = inspector.getByRole('button', { name: '布局', exact: true })
  const layoutSection = layoutHeader.locator('..').locator('..')
  await layoutSection.getByRole('radiogroup', { name: '方向' })
    .getByRole('radio', { name: '纵向', exact: true })
    .click()
  const padding = layoutSection.getByRole('spinbutton', { name: '内边距' })
  await padding.fill('40')
  await padding.blur()
  await expandInspectorSection(inspector, '容器')
  await inspector.getByRole('combobox', { name: '纵向溢出', exact: true })
    .selectOption('scroll')
  await expect(container.getByTestId('stage-overflow-indicator-y')).toBeVisible()
  await editor.getByRole('button', { name: '打开预览' }).click()
  const dialog = page.getByRole('dialog', { name: '文档预览对话框' })
  await dialog.getByRole('combobox', { name: '预览缩放' }).selectOption('1')
  await dialog.getByRole('button', { name: '选中容器' }).click()
  const preview = dialog.getByTestId('compose-preview-container')
  await expect(preview).toHaveCSS('overflow-y', 'auto')

  const metrics = await preview.evaluate((element) => {
    const children = Array.from(element.querySelectorAll<HTMLElement>(
      ':scope > [data-testid^="compose-preview-entity-"]',
    ))
    const lastChildBottom = Math.max(...children.map((child) => child.offsetTop + child.offsetHeight))
    element.scrollTop = element.scrollHeight
    const border = element.querySelector<HTMLElement>(':scope > [data-compose-entity-border]')
    const extent = element.querySelector<HTMLElement>(':scope > [data-testid^="compose-preview-content-extent-"]')
    const borderWidth = border ? Number.parseFloat(border.style.borderWidth) : 0
    return {
      childBottoms: children.map((child) => child.offsetTop + child.offsetHeight),
      clientHeight: element.clientHeight,
      extentHeight: extent?.offsetHeight ?? 0,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      endPadding: element.clientHeight - (lastChildBottom - element.scrollTop) - borderWidth,
    }
  })
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(metrics.endPadding).toBeCloseTo(40, 0)
})

test('OpenSpec: component-registry / 完整示例 renderer / 在 Stage 中渲染 ECharts Canvas', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 ECharts Chart' }), {
    x: frameBox!.x + 320,
    y: frameBox!.y + 240,
  })

  const chart = stage.getByRole('img', { name: 'Quarterly data' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()
  const inspector = editor.getByRole('region', { name: 'ECharts Chart 属性', exact: true })
  await inspector.getByRole('button', { name: '图表' }).click()
  // OpenSpec: property-panel / 自定义 Renderer 子目标绑定 / ECharts 输入分别绑定
  const titleActions = inspector.getByRole('button', { name: '绑定 图表标题' })
  const dataActions = inspector.getByRole('button', { name: '绑定 数据' })
  const titleHeader = titleActions.locator('..').locator('..')
  await expect(titleActions).toHaveCSS('opacity', '0')
  await expect(dataActions).toHaveCSS('opacity', '0')
  await titleHeader.hover()
  await expect(titleActions).toHaveCSS('opacity', '1')
  await titleActions.click()
  await expect(inspector.getByRole('dialog', { name: '绑定 图表标题' })).toBeVisible()
  await inspector.getByRole('button', { name: '关闭变量选择器' }).click()
  const dataHeader = dataActions.locator('..').locator('..')
  await dataHeader.hover()
  await expect(dataActions).toHaveCSS('opacity', '1')
  await dataActions.click()
  await expect(inspector.getByRole('dialog', { name: '绑定 数据' })).toBeVisible()
  await expect(inspector.getByRole('button', { name: '高级' })).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / ECS 聚合 Inspector / 添加能力并由几何限制改变 Stage 手柄', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
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
  await expect(appearance).toHaveAttribute('aria-expanded', 'false')
  await expect(propertyRoot.getByRole('button', { name: '背景填充', exact: true })).toHaveCount(0)
  await propertyRoot.getByRole('searchbox', { name: '搜索属性' }).fill('背景填充')
  await expect(appearance).toHaveAttribute('aria-expanded', 'true')
  await expect(propertyRoot.getByRole('button', { name: '背景填充', exact: true })).toBeVisible()
  await expect(propertyRoot.getByRole('button', { name: '变换' })).toHaveCount(0)
  await propertyRoot.getByRole('searchbox', { name: '搜索属性' }).fill('')
  await expect(appearance).toHaveAttribute('aria-expanded', 'false')
  await expect(propertyRoot.getByRole('button', { name: '背景填充', exact: true })).toHaveCount(0)

  await capability.selectOption('geometry-constraints')
  const constraints = propertyRoot.getByRole('button', { name: '几何限制' })
  await expect(constraints).toBeVisible()
  await expandInspectorSection(inspector, '几何限制')
  await propertyRoot.getByRole('combobox', { name: 'Resize 模式' })
    .selectOption('horizontal')
  await expect(stage.getByTestId('stage-resize-edge-e')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-edge-w')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-ne')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(0)
  await expect(stage.getByTestId('stage-rotation-handle')).toHaveCount(0)

  await inspector.getByRole('button', { name: '移除几何限制' }).click()
  const confirm = page.getByRole('alertdialog', { name: '移除能力？' })
  await expect(confirm).toContainText('几何限制')
  await confirm.getByRole('button', { name: '移除' }).click()
  await expect(propertyRoot.getByRole('button', { name: '几何限制' })).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-ne')).toBeVisible()
  await expect(stage.getByTestId('stage-resize-se')).toBeVisible()

  await capability.selectOption('container')
  const composed = stage.locator(`[data-entity-id="${entityId}"]`)
  await expect(composed).toHaveClass(/is-container/)
  await expect(composed.getByTestId('compose-material-rectangle')).toBeVisible()
  await expect(propertyRoot.getByRole('button', { name: '容器' })).toBeVisible()
  await expandInspectorSection(inspector, '容器')
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

test('OpenSpec: 自动布局显式启用 / 自由 Container 添加、移除并可撤销重做', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })

  const emptyLayoutHeader = inspector.getByRole('button', { name: '布局', exact: true })
  const emptyLayoutSection = emptyLayoutHeader.locator('..').locator('..')
  await expect(emptyLayoutHeader).toHaveAttribute('aria-expanded', 'true')
  await expect(inspector.getByRole('button', { name: '添加布局' })).toBeVisible()
  await expect(emptyLayoutSection.getByText('使用自动布局', { exact: true })).toBeVisible()
  await expect(emptyLayoutSection.getByText(
    '自动排列子项，并统一控制方向、间距、换行与对齐。',
    { exact: true },
  )).toBeVisible()
  await expect(emptyLayoutSection.getByRole('button', { name: '添加自动布局' })).toBeVisible()
  await expect(emptyLayoutSection).toHaveScreenshot('empty-auto-layout-guide.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await emptyLayoutHeader.click()
  await expect(emptyLayoutSection.getByRole('button', { name: '添加自动布局' })).toBeHidden()
  await emptyLayoutHeader.click()
  await enableAutoLayout(inspector)
  await expect(inspector.getByRole('button', { name: '布局', exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: '更多布局操作' }).click()
  const remove = inspector.getByRole('menuitem', { name: '移除自动布局' })
  await expect(remove).toBeEnabled()
  await remove.click()
  await expect(inspector.getByRole('button', { name: '添加布局' })).toBeVisible()

  await stage.focus()
  await stage.press('Control+z')
  await expect(inspector.getByRole('button', { name: '布局', exact: true })).toBeVisible()
  await stage.press('Control+Shift+z')
  await expect(inspector.getByRole('button', { name: '添加布局' })).toBeVisible()
})

test('OpenSpec: basic-materials / Flex Layout 紧凑属性与仅 Inspector 生效', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)

  const container = stage.getByTestId('stage-container')
  const stageStyleBefore = await container.evaluate((element) => ({
    display: getComputedStyle(element).display,
    left: getComputedStyle(element).left,
    top: getComputedStyle(element).top,
  }))
  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  const propertyRoot = inspector.getByRole('region', { name: 'Container 属性字段' })
  await enableAutoLayout(inspector)
  const layoutHeader = propertyRoot.getByRole('button', { name: '布局', exact: true })
  const layoutSection = layoutHeader.locator('..').locator('..')
  const topLevelTitles = await propertyRoot.locator(
    ':scope > .property-panel__group > .property-panel__group-header > button',
  ).allTextContents()
  expect(topLevelTitles).not.toContain('变换')
  expect(topLevelTitles).not.toContain('布局项')
  expect(topLevelTitles.indexOf('布局')).toBe(topLevelTitles.indexOf('基础') + 1)
  await expect(layoutSection.getByText('Auto Layout', { exact: true })).toBeVisible()
  const resetLayout = layoutSection.getByRole('button', { name: '重置布局' })
  await expect(resetLayout).toBeDisabled()

  const direction = layoutSection.getByRole('radiogroup', { name: '方向' })
  const wrapping = layoutSection.getByRole('radiogroup', { name: '换行' })
  const content = layoutSection.getByRole('radiogroup', { name: '多行' })
  const mainAxis = layoutSection.getByRole('radiogroup', { name: '主轴' })
  const crossAxis = layoutSection.getByRole('radiogroup', { name: '交叉轴' })
  await expect(direction.getByRole('radio')).toHaveCount(4)
  await expect(wrapping.getByRole('radio')).toHaveCount(3)
  await expect(content.getByRole('radio')).toHaveCount(6)
  await expect(mainAxis.getByRole('radio')).toHaveCount(6)
  await expect(crossAxis.getByRole('radio')).toHaveCount(5)
  await expect(content.getByRole('radio', { name: '拉伸', checked: true })).toBeVisible()
  const iconSizes = await layoutSection.locator('.flex-layout-inspector__option svg').evaluateAll(
    (icons) => icons.map((icon) => {
      const box = icon.getBoundingClientRect()
      return `${box.width}x${box.height}`
    }),
  )
  expect(new Set(iconSizes)).toEqual(new Set(['18x18']))
  const firstContentOption = await content.getByRole('radio').nth(0).boundingBox()
  const fourthContentOption = await content.getByRole('radio').nth(3).boundingBox()
  expect(firstContentOption).not.toBeNull()
  expect(fourthContentOption).not.toBeNull()
  expect(fourthContentOption!.y).toBeCloseTo(firstContentOption!.y, 0)
  const firstCrossOption = await crossAxis.getByRole('radio').nth(0).boundingBox()
  const fourthCrossOption = await crossAxis.getByRole('radio').nth(3).boundingBox()
  expect(firstCrossOption).not.toBeNull()
  expect(fourthCrossOption).not.toBeNull()
  expect(fourthCrossOption!.y).toBeCloseTo(firstCrossOption!.y, 0)

  const gap = layoutSection.getByRole('spinbutton', { name: '项间距' })
  const gapRow = layoutSection.locator('[data-property-path="gap"]')
  await expect(gapRow).not.toContainText('px')
  await expect(gapRow.getByRole('button', { name: '拆分项间距' })).toBeVisible()
  const directionBox = await direction.boundingBox()
  const wrappingBox = await wrapping.boundingBox()
  const gapBox = await gap.boundingBox()
  const contentBox = await content.boundingBox()
  expect(directionBox).not.toBeNull()
  expect(wrappingBox).not.toBeNull()
  expect(gapBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(wrappingBox!.x).toBeGreaterThan(directionBox!.x)
  expect(wrappingBox!.x - (directionBox!.x + directionBox!.width)).toBeLessThanOrEqual(10)
  expect(gapBox!.y).toBeGreaterThan(directionBox!.y)
  expect(contentBox!.x).toBeGreaterThan(gapBox!.x)
  expect(directionBox!.width).toBeGreaterThan(140)
  expect(contentBox!.width).toBeGreaterThan(140)

  const padding = layoutSection.getByRole('spinbutton', { name: '内边距' })
  const expandPadding = layoutSection.getByRole('button', { name: '展开内边距' })
  const paddingRow = layoutSection.locator('[data-property-path="padding"]')
  await expect(padding).toHaveValue('0')
  await expect(expandPadding).toBeVisible()
  await expect(paddingRow.locator('code')).toHaveText('padding')
  const paddingLabelBox = await paddingRow.locator('.property-panel__label').boundingBox()
  const paddingEditorBox = await paddingRow.locator('.property-panel__editor').boundingBox()
  expect(paddingLabelBox).not.toBeNull()
  expect(paddingEditorBox).not.toBeNull()
  expect(paddingEditorBox!.y).toBeGreaterThan(paddingLabelBox!.y)

  const preview = layoutSection.getByTestId('flex-layout-preview')
  const previewNodes = preview.locator('[data-flex-preview-node]')
  await expect(previewNodes).toHaveCount(3)
  await expect(preview.getByText('Flex 容器', { exact: true })).toBeVisible()
  await expect(preview.getByText('row · nowrap · gap 0', { exact: true })).toBeVisible()
  const previewMainAxis = preview.getByTestId('flex-preview-main-axis')
  const previewCrossAxis = preview.getByTestId('flex-preview-cross-axis')
  await expect(previewMainAxis).toHaveText('主轴')
  await expect(previewMainAxis).toHaveClass(/is-horizontal/)
  await expect(previewCrossAxis).toHaveText('交叉轴')
  await expect(previewCrossAxis).toHaveClass(/is-vertical/)
  await expect(preview.locator('input, button')).toHaveCount(0)
  const defaultPreviewNode = await previewNodes.first().boundingBox()
  expect(defaultPreviewNode).not.toBeNull()
  expect(defaultPreviewNode!.height).toBeGreaterThan(20)
  const defaultPreviewNodeStyle = await previewNodes.first().evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    backgroundImage: getComputedStyle(element).backgroundImage,
  }))
  expect(defaultPreviewNodeStyle).toEqual({
    backgroundColor: 'rgb(36, 51, 66)',
    backgroundImage: 'none',
  })
  await expect(layoutSection).toHaveScreenshot('flex-layout-inspector.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await expandPadding.click()
  await expect(layoutSection.getByRole('spinbutton', { name: '内边距 top' })).toHaveValue('0')
  await expect(layoutSection.getByRole('spinbutton', { name: '内边距 right' })).toHaveValue('0')
  await expect(layoutSection.getByRole('spinbutton', { name: '内边距 bottom' })).toHaveValue('0')
  await expect(layoutSection.getByRole('spinbutton', { name: '内边距 left' })).toHaveValue('0')
  await expect(layoutSection).toHaveScreenshot('flex-layout-padding-expanded.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await layoutSection.getByRole('button', { name: '收起并联动内边距' }).click()

  await crossAxis.getByRole('radio', { name: '起始', exact: true }).click()
  const crossStartNode = await previewNodes.first().boundingBox()
  await crossAxis.getByRole('radio', { name: '起始', exact: true }).click()
  await expect(crossAxis.getByRole('radio', { name: '拉伸', checked: true })).toBeVisible()
  await expect(preview).toHaveAttribute('data-align-items', 'stretch')
  await crossAxis.getByRole('radio', { name: '末端', exact: true }).click()
  const crossEndNode = await previewNodes.first().boundingBox()
  await crossAxis.getByRole('radio', { name: '拉伸', exact: true }).click()
  const crossStretchNode = await previewNodes.first().boundingBox()
  expect(crossStartNode).not.toBeNull()
  expect(crossEndNode).not.toBeNull()
  expect(crossStretchNode).not.toBeNull()
  expect(crossEndNode!.y).toBeGreaterThan(crossStartNode!.y)
  expect(crossStretchNode!.height).toBeGreaterThan(crossStartNode!.height)
  await expect(preview).toHaveAttribute('data-align-items', 'stretch')

  await gap.fill('12')
  await gap.press('Tab')
  await direction.getByRole('radio', { name: '纵向', exact: true }).click()

  await expect(preview.locator('.flex-layout-inspector__preview-surface'))
    .toHaveCSS('flex-direction', 'column')
  await expect(preview.locator('.flex-layout-inspector__preview-surface'))
    .toHaveCSS('row-gap', '12px')
  await expect(preview.locator('.flex-layout-inspector__preview-surface'))
    .toHaveCSS('column-gap', '12px')
  await expect(preview.getByText('column · nowrap · gap 12', { exact: true })).toBeVisible()
  await expect(previewMainAxis).toHaveClass(/is-vertical/)
  await expect(previewCrossAxis).toHaveClass(/is-horizontal/)
  await expect(resetLayout).toBeEnabled()

  await crossAxis.getByRole('radio', { name: '起始', exact: true }).click()
  const columnCrossStartNode = await previewNodes.first().boundingBox()
  await crossAxis.getByRole('radio', { name: '末端', exact: true }).click()
  const columnCrossEndNode = await previewNodes.first().boundingBox()
  await crossAxis.getByRole('radio', { name: '拉伸', exact: true }).click()
  const columnCrossStretchNode = await previewNodes.first().boundingBox()
  expect(columnCrossStartNode).not.toBeNull()
  expect(columnCrossEndNode).not.toBeNull()
  expect(columnCrossStretchNode).not.toBeNull()
  expect(columnCrossEndNode!.x).toBeGreaterThan(columnCrossStartNode!.x)
  expect(columnCrossStretchNode!.width).toBeGreaterThan(columnCrossStartNode!.width)

  const previewBox = await preview.boundingBox()
  const previewNodeBoxes = await Promise.all([
    previewNodes.nth(0).boundingBox(),
    previewNodes.nth(1).boundingBox(),
    previewNodes.nth(2).boundingBox(),
  ])
  expect(previewBox).not.toBeNull()
  expect(previewNodeBoxes.every(Boolean)).toBe(true)
  for (const nodeBox of previewNodeBoxes) {
    expect(nodeBox!.y).toBeGreaterThanOrEqual(previewBox!.y)
    expect(nodeBox!.y + nodeBox!.height).toBeLessThanOrEqual(previewBox!.y + previewBox!.height)
  }

  await resetLayout.click()
  await expect(direction.getByRole('radio', { name: '横向', exact: true })).toBeChecked()
  await expect(gap).toHaveValue('0')
  await expect(resetLayout).toBeDisabled()
  expect(await container.evaluate((element) => ({
    display: getComputedStyle(element).display,
    left: getComputedStyle(element).left,
    top: getComputedStyle(element).top,
  }))).toEqual(stageStyleBefore)
})

test('OpenSpec: auto-layout-interactions / Fill 与 Flow 移动 / 烘焙为 Absolute 并一次提交', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()

  const container = stage.getByTestId('stage-container')
  const containerBox = await container.boundingBox()
  expect(containerBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: containerBox!.x + 160,
    y: containerBox!.y + 160,
  })
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: containerBox!.x + 400,
    y: containerBox!.y + 160,
  })

  await editor.getByRole('treegrid', { name: '场景树' })
    .getByRole('row')
    .filter({ hasText: 'Container' })
    .click()
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(containerInspector)

  const children = container.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)
  const firstFlowBox = await children.nth(0).boundingBox()
  const secondFlowBox = await children.nth(1).boundingBox()
  expect(firstFlowBox).not.toBeNull()
  expect(secondFlowBox).not.toBeNull()
  expect(secondFlowBox!.x).toBeCloseTo(firstFlowBox!.x + firstFlowBox!.width, 0)
  expect(secondFlowBox!.y).toBeCloseTo(firstFlowBox!.y, 0)

  await children.nth(0).click()
  const childInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  const basicSection = childInspector.getByRole('button', { name: '基础', exact: true })
    .locator('..')
    .locator('..')
  const widthSizing = childInspector.getByRole('combobox', { name: '尺寸宽度' })
  await expect(childInspector.getByRole('combobox', { name: '自身对齐' })).toHaveValue('auto')
  await expect(childInspector.getByRole('spinbutton', { name: '位置 X' })).toHaveCount(0)
  await expect(childInspector.getByRole('spinbutton', { name: '旋转' })).toHaveValue('0')
  const alignSelfField = await childInspector.locator('[data-property-path="alignSelf"]').boundingBox()
  const rotationField = await childInspector.locator('[data-property-path="rotation"]').boundingBox()
  const sizeField = await childInspector.locator('[data-property-path="size"]').boundingBox()
  const marginField = await childInspector.locator('[data-property-path="margin"]').boundingBox()
  expect(alignSelfField).not.toBeNull()
  expect(rotationField).not.toBeNull()
  expect(sizeField).not.toBeNull()
  expect(marginField).not.toBeNull()
  expect(rotationField!.y).toBeGreaterThan(alignSelfField!.y)
  expect(sizeField!.y).toBeGreaterThan(rotationField!.y)
  expect(marginField!.y).toBeGreaterThan(sizeField!.y)
  const basicRowStyles = await childInspector.evaluate((element) => (
    ['alignSelf', 'rotation', 'size', 'margin'].map((path) => {
      const field = element.querySelector<HTMLElement>(`[data-property-path="${path}"]`)
      const actions = field?.querySelector<HTMLElement>(':scope > .property-panel__actions')
      return {
        actionDisplay: actions ? getComputedStyle(actions).display : null,
        borderTopWidth: field ? getComputedStyle(field).borderTopWidth : null,
        gridColumnCount: field ? getComputedStyle(field).gridTemplateColumns.split(' ').length : 0,
      }
    })
  ))
  expect(basicRowStyles).toEqual([
    { actionDisplay: 'flex', borderTopWidth: '1px', gridColumnCount: 3 },
    { actionDisplay: 'flex', borderTopWidth: '1px', gridColumnCount: 3 },
    { actionDisplay: 'flex', borderTopWidth: '1px', gridColumnCount: 3 },
    { actionDisplay: 'flex', borderTopWidth: '1px', gridColumnCount: 3 },
  ])
  const basicLabelStarts = await childInspector.evaluate((element) => (
    ['name', 'alignSelf', 'rotation', 'size', 'margin'].map((path) => {
      const field = element.querySelector(`[data-property-path="${path}"]`)
      const label = field?.querySelector(':scope > .property-panel__label, :scope > label')
      return label?.getBoundingClientRect().x ?? null
    })
  ))
  expect(basicLabelStarts.every((start) => start === basicLabelStarts[0])).toBe(true)
  expect(await childInspector.locator('[data-property-path="size"] input').evaluateAll((inputs) => (
    inputs.every((input) => input.scrollWidth <= input.clientWidth)
  ))).toBe(true)
  await widthSizing.click()
  const widthSuggestions = childInspector.getByRole('listbox', { name: '宽度尺寸选项' })
  await expect(widthSuggestions.getByRole('option')).toHaveText(['Fill', 'Hug'])
  await expect(childInspector.getByRole('combobox', { name: '宽度模式' })).toHaveCount(0)
  await expect(widthSuggestions.getByText(/填充|适应|固定/)).toHaveCount(0)
  await expect(childInspector).toHaveScreenshot('basic-inspector-size-suggestions.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await widthSizing.fill('Fill')
  await widthSizing.press('Enter')
  await expect(widthSizing).toHaveValue('Fill')
  await expect(basicSection).toHaveScreenshot('basic-inspector-flow-fill.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  expect(await basicSection.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  const fillBox = await children.nth(0).boundingBox()
  expect(fillBox).not.toBeNull()
  expect(fillBox!.width).toBeGreaterThan(firstFlowBox!.width)
  await stage.focus()
  await stage.press('ArrowRight')

  await expect(childInspector.getByRole('spinbutton', { name: '位置 X' })).toBeVisible()
  await expect(childInspector.getByRole('combobox', { name: '自身对齐' })).toHaveCount(0)
  await expect.poll(async () => Number.isFinite(Number(await widthSizing.inputValue()))).toBe(true)
  const absoluteBox = await children.nth(0).boundingBox()
  expect(absoluteBox).not.toBeNull()
  expect(absoluteBox!.x).toBeGreaterThan(fillBox!.x)
  expect(absoluteBox!.x - fillBox!.x).toBeLessThanOrEqual(3)
  expect(absoluteBox!.width).toBeCloseTo(fillBox!.width, 0)

  await expect(basicSection).toHaveScreenshot('basic-inspector-absolute-fixed.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await childInspector.getByRole('button', { name: '展开外边距' }).click()
  await expect(basicSection).toHaveScreenshot('basic-inspector-margin-expanded.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  expect(await basicSection.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await childInspector.getByRole('button', { name: '快捷设置旋转' }).click()
  const anglePopup = page.getByRole('dialog', { name: '旋转快捷设置' })
  await expect(anglePopup).toHaveScreenshot('basic-inspector-rotation-popup.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await page.keyboard.press('Escape')

  await expect(editor).toHaveScreenshot('auto-layout-fill-interactions.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: hug-content-layout / Text 与 Auto Layout 容器 Hug / Stage Preview 一致', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()

  const container = stage.getByTestId('stage-container')
  const initialContainerBox = await container.boundingBox()
  expect(initialContainerBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Text' }), {
    x: initialContainerBox!.x + 160,
    y: initialContainerBox!.y + 120,
  })
  await container.click({ position: { x: 8, y: 8 } })
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(containerInspector)

  const textNode = container.locator(':scope > .compose-stage__node.is-renderer').first()
  await textNode.click()
  const textInspector = editor.getByRole('region', { name: 'Text 属性', exact: true })
  await selectAxisSizing(textInspector, '宽度', 'Hug')
  await selectAxisSizing(textInspector, '高度', 'Hug')
  await expect.poll(async () => (await textNode.boundingBox())?.width ?? 1000).toBeLessThan(160)
  await expect(stage.getByTestId('stage-layout-diagnostics')).toHaveCount(0)

  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.getByRole('row', { name: /Container/ }).click()
  await selectAxisSizing(containerInspector, '宽度', 'Hug')
  await selectAxisSizing(containerInspector, '高度', 'Hug')
  await expect.poll(async () => (await container.boundingBox())?.width ?? 1000).toBeLessThan(180)
  const stageTextBox = await stage.getByText('Text', { exact: true }).boundingBox()
  expect(stageTextBox).not.toBeNull()

  await expect(editor).toHaveScreenshot('auto-layout-hug-content.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: '打开预览' }).click()
  await page.getByRole('dialog', { name: '文档预览对话框' })
    .getByRole('combobox', { name: '预览缩放' })
    .selectOption('1')
  const preview = page.getByTestId('compose-preview-document')
  const previewTextBox = await preview.getByText('Text', { exact: true }).boundingBox()
  expect(previewTextBox).not.toBeNull()
  expect(previewTextBox!.width).toBeCloseTo(stageTextBox!.width, 0)
  expect(previewTextBox!.height).toBeCloseTo(stageTextBox!.height, 0)
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

test('OpenSpec: stage / 四角缩放 / resize 手柄在预览阶段跟随鼠标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const movements = {
    ne: { x: -100, y: 60 },
    se: { x: -100, y: -60 },
    sw: { x: 100, y: -60 },
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
      }).toBeLessThanOrEqual(4.1)
      await page.mouse.up()
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box
          ? Math.max(
              Math.abs(box.x + box.width / 2 - to.x),
              Math.abs(box.y + box.height / 2 - to.y),
            )
          : Number.POSITIVE_INFINITY
      }).toBeLessThanOrEqual(4.1)
    }
  }
})

test('OpenSpec: stage / 绘制工具与框选隔离 / 十字光标、实际形状预览与尺寸浮标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '形状', exact: true }).first().click()
  await expect(stage).toHaveAttribute('data-interaction-cursor', 'crosshair')
  await expect(output).toHaveCSS('cursor', /crosshair/)

  const start = { x: outputBox!.x + 180, y: outputBox!.y + 132 }
  const target = { x: start.x + 248, y: start.y + 144 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })

  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-rectangle')
  await expect(preview.locator('rect')).toHaveCount(2)
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('248 × 144')
  await expect(stage.getByTestId('stage-marquee')).toHaveCount(0)
  await expect(stage).toHaveScreenshot('stage-drawing-rectangle-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.mouse.up()
  await expect(editor.getByRole('treegrid', { name: '场景树' }).getByText('Rectangle', { exact: true })).toBeVisible()
})

test('OpenSpec: stage / 直接绘制 Preset / 点击或拖拽绘制文字', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  const textTool = editor.getByRole('button', { name: '文字', exact: true })
  await textTool.click()
  const clickPoint = { x: outputBox!.x + 180, y: outputBox!.y + 132 }
  await page.mouse.click(clickPoint.x, clickPoint.y)

  await expect(editor.getByRole('button', { name: '选择', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const defaultText = stage.getByTestId('compose-material-text')
  await expect(defaultText).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(defaultText).toHaveCSS('font-size', '12px')
  const defaultTextBox = await defaultText.boundingBox()
  expect(defaultTextBox).not.toBeNull()
  expect(defaultTextBox!.width).toBeLessThan(64)
  expect(defaultTextBox!.height).toBeLessThanOrEqual(24)

  await textTool.click()
  const start = { x: outputBox!.x + 280, y: outputBox!.y + 172 }
  const target = { x: start.x + 160, y: start.y + 48 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })
  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-text')
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('160 × 48')
  await expect(stage).toHaveScreenshot('stage-drawing-text-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await page.mouse.up()

  const fixedText = stage.locator('.compose-stage__node.is-renderer').last()
  await expect(fixedText).toHaveCSS('width', '160px')
  await expect(fixedText).toHaveCSS('height', '48px')
})

test('OpenSpec: stage / 线条绘制 / 端点尺寸、完成回选与形状主图标同步', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  const shapeButtons = editor.getByRole('button', { name: '形状', exact: true })
  await shapeButtons.nth(1).click()
  await editor.getByRole('menu', { name: '形状' }).getByRole('menuitemradio', { name: '线条' }).click()
  await expect(shapeButtons.first()).toHaveAttribute('data-active-shape', 'draw-line')

  const start = { x: outputBox!.x + 196, y: outputBox!.y + 128 }
  const target = { x: start.x, y: start.y + 144 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })

  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-line')
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('0 × 144')
  await page.mouse.up()

  await expect(editor.getByRole('button', { name: '选择', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(shapeButtons.first()).toHaveAttribute('data-active-shape', 'draw-line')
  await expect(stage.getByTestId('stage-line-selection')).toBeVisible()
  await expect(stage.getByTestId('stage-line-selection-start')).toBeVisible()
  await expect(stage.getByTestId('stage-line-selection-end')).toBeVisible()
  await expect(stage.getByTestId('stage-line-selection-dimensions')).toContainText('× 0')
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(0)

  const startHandle = await stage.getByTestId('stage-line-selection-start').boundingBox()
  expect(startHandle).not.toBeNull()
  await page.mouse.move(startHandle!.x + startHandle!.width / 2, startHandle!.y + startHandle!.height / 2)
  await page.mouse.down()
  // 拖过另一端：固定终点不动，底层方向会翻转，但可见选择态始终保持两个端点。
  await page.mouse.move(target.x + 72, target.y + 32, { steps: 4 })
  await expect(stage.getByTestId('stage-line-selection')).toBeVisible()
  await page.mouse.up()
  await expect(stage.getByTestId('stage-line-selection-start')).toBeVisible()
  await expect(stage.getByTestId('stage-line-selection-end')).toBeVisible()
})

test('OpenSpec: stage / Shift 绘制正方形与正圆 / 拖动中动态锁定预览与提交', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '形状', exact: true }).first().click()
  const start = { x: outputBox!.x + 180, y: outputBox!.y + 132 }
  const target = { x: start.x + 248, y: start.y + 144 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 4 })

  const preview = stage.getByTestId('stage-drawing-preview')
  await expect(preview).toHaveAttribute('data-drawing-tool', 'draw-rectangle')
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('248 × 144')
  await page.keyboard.down('Shift')
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('248 × 248')
  const squarePreviewBounds = await preview.locator('rect').first().boundingBox()
  expect(squarePreviewBounds).not.toBeNull()
  // SVG 的 1.5px 白色描边会使 DOM box 向外扩 0.75px；允许一个物理像素的视觉误差。
  expect(Math.abs(squarePreviewBounds!.x + squarePreviewBounds!.width - target.x)).toBeLessThan(1)
  expect(Math.abs(squarePreviewBounds!.y + squarePreviewBounds!.height - target.y)).toBeLessThan(1)
  await page.keyboard.up('Shift')
  await expect(preview.locator('.compose-stage__drawing-dimensions')).toContainText('248 × 144')
  await page.keyboard.down('Shift')
  await page.mouse.up()
  await page.keyboard.up('Shift')

  await expect(editor.getByRole('treegrid', { name: '场景树' }).getByText('Rectangle', { exact: true })).toBeVisible()
  const createdRectangle = stage.locator('.compose-stage__node.is-renderer').last()
  await expect(createdRectangle).toHaveCSS('width', '248px')
  await expect(createdRectangle).toHaveCSS('height', '248px')
  await expect(createdRectangle).toHaveCSS('border-radius', '0px')
})

test('OpenSpec: stage / 自适应网格标尺与世界原点 / 最低缩放仍显示网格并保持 8 单位吸附', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await rectangle.click()
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()

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
  const widthField = editor.getByRole('combobox', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => Number(await widthField.inputValue()) % 8).toBe(0)
})

test('OpenSpec: stage / Pointer 手势原子性与取消 / move 与 resize 各只提交一次且松手不回弹', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
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
  await editor.locator('[data-workspace-tab="compose-history-panel"]').click()

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
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
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
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  await editor.getByRole('button', { name: '网格大小' }).click()
  await editor.getByRole('menu', { name: '网格大小' })
    .getByRole('menuitem', { name: '画布设置' })
    .click()
  const settings = editor.getByRole('dialog', { name: '画布网格与吸附设置' })
  await settings.getByRole('textbox', { name: 'X 步长' }).fill('16')
  await settings.getByRole('textbox', { name: 'Y 步长' }).fill('16')
  await settings.getByRole('button', { name: '应用' }).click()
  await expect(editor.getByRole('button', { name: '吸附' }))
    .toHaveAttribute('aria-pressed', 'true')

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
  // Yoga absolute inset 以父容器 border 内沿为原点；默认 Container border 为 1px。
  await expect.poll(async () => {
    const resolvedX = Number(await xField.inputValue()) + 1
    return Math.abs(resolvedX - Math.round(resolvedX / 16) * 16)
  }).toBeLessThan(0.001)

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
  const widthField = editor.getByRole('combobox', { name: '尺寸宽度', exact: true })
  await expect.poll(async () => {
    const width = Number(await widthField.inputValue())
    return Math.abs(width - Math.round(width / 16) * 16)
  }).toBeLessThan(0.001)

  // 标尺已改为 Canvas，无法再按刻度节点断言。改为验证共享点阵：世界原点必须正好落在画布
  // 网格线上；标尺与网格由同一 lattice 产出（见 stage-engine 单测），因此二者随之对齐。
  const originX = Number(await stage.getByTestId('stage-origin-y').getAttribute('x1'))
  const originY = Number(await stage.getByTestId('stage-origin-x').getAttribute('y1'))
  const gridLattice = await stage.getByTestId('stage-grid').evaluate((element) => {
    const computed = getComputedStyle(element)
    const sizes = computed.backgroundSize.split(', ')
    const positions = computed.backgroundPosition.split(', ')
    return {
      stepX: Number.parseFloat(sizes[2] ?? ''),
      stepY: Number.parseFloat(sizes[3]?.split(' ')[1] ?? ''),
      offsetX: Number.parseFloat(positions[2] ?? ''),
      offsetY: Number.parseFloat(positions[3]?.split(' ')[1] ?? ''),
    }
  })
  const distanceToLine = (position: number, offset: number, step: number) => {
    const remainder = Math.abs(position - offset) % step
    return Math.min(remainder, step - remainder)
  }
  expect(distanceToLine(originX, gridLattice.offsetX, gridLattice.stepX)).toBeLessThan(0.001)
  expect(distanceToLine(originY, gridLattice.offsetY, gridLattice.stepY)).toBeLessThan(0.001)

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
  // 回到 Home 后视口起点必须落到负世界坐标，即标尺重新覆盖负刻度区间。
  // 虚拟滚动范围会单调扩展，因此只能断言符号而不能断言等于 aria-valuemin。
  await expect.poll(async () => {
    const now = await horizontal.getAttribute('aria-valuenow')
    return now === null ? Number.NaN : Number(now)
  }).toBeLessThan(0)
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
  await expect(editor.locator('button[aria-label="Grid size"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library-panel"]'),
  ).toHaveAttribute('title', 'Components')
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

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
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

  await drawContainer(page, editor)
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

  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
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
  await rootGrid.getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem', { name: '创建页面', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Detail')
  await nameDialog.getByRole('button', { name: '创建' }).click()
  await expect(pagesGrid.getByRole('gridcell', { name: 'Detail' })).toBeVisible()

  // 2) 创建后随即以页面标签打开
  const detailTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Detail' })
  await expect(detailTab).toHaveCount(1)
  await expect(detailTab).toContainText('Detail')

  // 3) 在画布上创建一个容器，页面标签出现未保存指示
  await drawContainer(page, editor)
  const dirty = detailTab.getByRole('img', { name: '有未保存改动' })
  await expect(dirty).toBeVisible()

  // 4) 保存后未保存指示消失
  await detailTab.getByRole('button', { name: /^关闭页面/ }).click()
  const unsaved = page.getByRole('dialog', { name: '页面尚未保存' })
  await expect(unsaved).toBeVisible()
  await unsaved.getByRole('button', { name: '保存' }).click()
  await expect(detailTab).toHaveCount(0)

  // 5) 重开该页面时看到已持久化的实体
  await pagesGrid.getByRole('gridcell', { name: 'Detail' }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(2)
  const sceneTree = editor.locator('[data-workspace-panel="scene-graph"]')
  await expect(sceneTree).toContainText('Container')
})

test('OpenSpec: editor-workspace-layout / 首页标记 / 设为首页并在树与网格双处标记', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()

  // 文件树默认不展开子目录；标记要在树与网格双处断言，先展开 Pages 节点。
  const tree = assets.getByRole('treegrid')
  const pagesRow = tree.getByRole('row', { name: 'Pages' })
  await pagesRow.click()
  await pagesRow.press('ArrowRight')
  await expect(tree.getByRole('row', { name: 'Home' })).toBeVisible()

  // 示例清单在初始化时已经把 Home 指定为首页。
  await expect(tree.getByRole('row', { name: 'Home' })
    .getByRole('img', { name: '首页' })).toBeVisible()
  await expect(pagesGrid.getByRole('gridcell', { name: 'Home' })
    .getByRole('img', { name: '首页' })).toBeVisible()

  // 已是首页时该项禁用
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await expect(page.getByRole('menu').getByRole('menuitem', { name: '设为首页' }))
    .toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')

  // 第二个页面接管首页标记
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建页面', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Second')
  await nameDialog.getByRole('button', { name: '创建' }).click()
  await expect(pagesGrid.getByRole('gridcell', { name: 'Second' })).toBeVisible()

  await pagesGrid.getByRole('gridcell', { name: 'Second' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '设为首页' }).click()

  await expect(pagesGrid.getByRole('gridcell', { name: 'Second' })
    .getByRole('img', { name: '首页' })).toBeVisible()
  await expect(pagesGrid.getByRole('gridcell', { name: 'Home' })
    .getByRole('img', { name: '首页' })).toHaveCount(0)
})

test('OpenSpec: page-script-runtime / 页面计数器纵向流程 / Stage、Preview 与脚本重载', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()

  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Counter' })
  await expect(pageTab).toBeVisible()
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('compose-material-text')).toHaveText('0')
  await stage.getByRole('button', { name: 'Add' }).click()
  await expect(stage.getByTestId('compose-material-text')).toHaveText('0')
  await stage.getByTestId('stage-output-boundary').click({ position: { x: 8, y: 8 } })
  const canvasInspector = editor.getByRole('region', { name: '画布属性' })
  const pageScriptProperty = canvasInspector.locator('[data-property-path="pageScript"]')
  await expect(canvasInspector.getByRole('searchbox', { name: '搜索属性' })).toHaveCount(1)
  await expect(canvasInspector.getByRole('combobox', { name: '选择页面脚本' }))
    .toHaveValue('demo-home-setup')
  await expect(pageScriptProperty.getByRole('list', { name: '页面脚本返回成员' }))
    .toContainText('onAdd')
  await expect(pageScriptProperty.getByRole('button', { name: '重新加载脚本' })).toBeVisible()
  await expect(pageScriptProperty).toHaveScreenshot('page-script-canvas-property.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await pageScriptProperty.getByRole('button', { name: '重新加载脚本' }).click()
  await expect(pageScriptProperty.getByRole('list', { name: '页面脚本返回成员' }))
    .toContainText('0')

  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })
  await expect(preview.getByTestId('compose-material-text')).toHaveText('0')
  await preview.getByRole('button', { name: 'Add' }).click()
  await expect(preview.getByTestId('compose-material-text')).toHaveText('1')
  await expect(preview.getByRole('button', { name: 'Add 1' })).toBeVisible()
  await expect(stage.getByTestId('compose-material-text')).toHaveText('0')
  await preview.getByRole('button', { name: '关闭预览' }).click()

  await pageScriptProperty.getByRole('button', { name: '更多页面脚本操作' }).click()
  await page.getByRole('menu', { name: '页面脚本操作' })
    .getByRole('menuitem', { name: '打开页面脚本' }).click()
  const scriptDocument = editor.locator(
    '[data-workspace-panel="asset-document"][data-asset-entry-id="demo-home-setup"]',
  )
  const scriptTab = editor.locator(
    '[data-workspace-tab="compose-asset-document:demo-memory:demo-home-setup"]',
  )
  const scriptInput = scriptDocument.getByRole('textbox', { name: 'Editor content' })
  await expect(scriptDocument.locator('.monaco-editor')).toBeVisible()
  await scriptInput.focus()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.insertText('10')
  await expect(scriptDocument.locator('.view-lines')).toContainText('ctx.state(10)')
  await expect(scriptDocument.locator('.view-lines')).not.toContainText('ctx.state(0)')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(1)
  await page.keyboard.press('Control+S')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)
  await pageTab.click()
  await expect(stage.getByTestId('compose-material-text')).toHaveText('10')
  await expect(stage.getByRole('button', { name: 'Add' })).toBeVisible()
  await stage.getByTestId('stage-output-boundary').click({ position: { x: 8, y: 8 } })
  await expect(pageScriptProperty.getByRole('list', { name: '页面脚本返回成员' }))
    .toContainText('10')
  await expect(stage.getByTestId('compose-material-text')).toHaveText('10')

  // 新 revision 注册 cleanup；切换页面保留非活动实例，下一次脚本重载才 dispose 旧 scope。
  await scriptTab.click()
  await scriptInput.focus()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.insertText(
    '  ctx.effect(() => () => { globalThis.__composeCounterDisposed = true })',
  )
  await expect(scriptDocument.locator('.view-lines')).toContainText('__composeCounterDisposed')
  await page.keyboard.press('Control+S')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)
  await pageTab.click()
  await expect(stage.getByTestId('compose-material-text')).toHaveText('10')
  await page.evaluate(() => {
    (globalThis as typeof globalThis & { __composeCounterDisposed?: boolean })
      .__composeCounterDisposed = false
  })

  await pagesGrid.getByRole('gridcell', { name: /^Home/ }).dblclick()
  await expect.poll(() => page.evaluate(() => (
    globalThis as typeof globalThis & { __composeCounterDisposed?: boolean }
  ).__composeCounterDisposed)).toBe(false)
  await pageTab.click()
  await expect(stage.getByTestId('compose-material-text')).toHaveText('10')

  // 制造新 revision 的语法错误：旧 scope cleanup 被执行，绑定回退到 authored Props。
  await scriptTab.click()
  await scriptInput.focus()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.insertText(')')
  await page.keyboard.press('Control+S')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)
  await pageTab.click()
  await stage.getByTestId('stage-output-boundary').click({ position: { x: 8, y: 8 } })
  await expect(pageScriptProperty)
    .toContainText('页面脚本导入失败')
  await expect(stage.getByTestId('compose-material-text')).toHaveText('0')
  await expect.poll(() => page.evaluate(() => (
    globalThis as typeof globalThis & { __composeCounterDisposed?: boolean }
  ).__composeCounterDisposed)).toBe(true)

  await pageTab.getByRole('button', { name: '关闭页面 Counter' }).click()
  await expect(pageTab).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 页面 Setup JavaScript 智能编辑 / 着色、提示与保存隔离', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  const counter = pagesGrid.getByRole('gridcell', { name: 'Counter', exact: true })

  await counter.click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '打开页面脚本' }).click()
  let scriptDocument = editor.locator(
    '[data-workspace-panel="asset-document"][data-asset-entry-id="demo-home-setup"]',
  )
  const scriptInput = scriptDocument.getByRole('textbox', { name: 'Editor content' })
  await expect(scriptDocument.locator('.monaco-editor')).toBeVisible()

  await expect.poll(async () => scriptDocument.locator('.view-lines span[class*="mtk"]')
    .evaluateAll((tokens) => new Set(tokens.map((token) => token.className)).size))
    .toBeGreaterThan(1)
  await expect(scriptDocument.locator('.view-lines')).not.toContainText('ComposeState<number>')

  await scriptInput.focus()
  await page.keyboard.press('Control+Home')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('  ctx.')
  const suggestWidget = page.locator('.suggest-widget.visible')
  await expect(suggestWidget).toBeVisible()
  await expect(suggestWidget).toContainText('state')
  await expect(suggestWidget).toContainText('computed')
  await expect(suggestWidget).toContainText('effect')
  const suggestDetails = page.locator('.suggest-details')
  if (!await suggestDetails.isVisible()) await page.keyboard.press('Control+Space')
  await expect(suggestDetails).toBeVisible()
  await expect(suggestDetails).toContainText('示例')
  const exampleCode = suggestDetails.locator('.monaco-tokenized-source')
  await expect(exampleCode).toBeVisible()
  await expect.poll(async () => exampleCode.locator('span[class*="mtk"]')
    .evaluateAll((tokens) => new Set(tokens.map((token) => token.className)).size))
    .toBeGreaterThan(1)
  await page.keyboard.press('Escape')

  const invalidTypeSource = `export function setup(ctx) {
  const num = ctx.state(0)
  num.value = 'wrong'
  const onAdd = () => { num.value += 1 }
  return { num, onAdd }
}
`
  await page.keyboard.press('Control+A')
  await page.keyboard.insertText(invalidTypeSource)
  await expect(scriptDocument.locator('.squiggly-error')).not.toHaveCount(0)
  await page.keyboard.press('Control+S')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  await editor.getByRole('button', { name: '关闭资源 Counter.setup.js' }).click()
  await expect(scriptDocument).toHaveCount(0)
  await counter.click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '打开页面脚本' }).click()
  scriptDocument = editor.locator(
    '[data-workspace-panel="asset-document"][data-asset-entry-id="demo-home-setup"]',
  )
  await expect(scriptDocument.locator('.view-lines')).toContainText("num.value = 'wrong'")
  await expect(scriptDocument.locator('.view-lines')).not.toContainText('@ts-check')
  await expect(scriptDocument.locator('.view-lines')).not.toContainText('ComposePageScriptContext')
})

test('OpenSpec: editor-workspace-layout / 只读页面 JSON / Monaco 只读且无保存', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()

  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
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
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(1)
  await drawContainer(page, editor)
  const homeTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await page.keyboard.press('Control+S')
  await expect(homeTab.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // 2) 在 Counter 页面里创建一个 Page Slot 实体，引用已保存的 Home 页面。
  await pagesGrid.getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(2)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: 'Page Slot' }).click()
  await expect(stage.getByTestId('compose-page-slot-placeholder')).toBeVisible()

  // 3) 属性面板的 node 字段选中 Home 页面
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expandInspectorSection(inspector, '页面')
  const nodeField = inspector.getByTestId('semantic-editor-node')
  await expect(nodeField).toBeVisible()
  await nodeField.getByRole('combobox').click()
  await inspector.getByRole('option', { name: 'Home' }).click()

  // 4) 画布上实时渲染被引用页面的内容
  await expect(stage.getByTestId('compose-page-slot-content')).toBeVisible()
  await selectAxisSizing(inspector, '宽度', 'Hug')
  await selectAxisSizing(inspector, '高度', 'Hug')
  await expect(stage.getByTestId('stage-layout-diagnostics')).toHaveCount(0)

  // 5) 预览中同样渲染
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog').or(page.getByTestId('compose-preview-document'))
  await expect(preview.getByTestId('compose-page-slot-content').first()).toBeVisible()
})

test('回归：Page Slot / A → B → Home 冷加载不会被 StrictMode 取消', async ({ page }) => {
  await page.goto('/?deep-page-slot')
  const preview = page.getByTestId('compose-preview-document')
  await expect(page.getByTestId('deep-page-slot-demo')).toBeVisible()
  await expect(preview.getByTestId('compose-page-slot-content')).toHaveCount(3)
  await expect(preview.getByTestId('compose-page-slot-error')).toHaveCount(0)
  await expect(preview.locator('[data-page-slot-entity-id]')).toHaveCount(4)
})

test('OpenSpec: editor-workspace-layout / 页面文档标签 / 页面面板占据中央文档区且不回退固定画布', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()

  const pagePanel = editor.locator(
    '[data-workspace-panel="page-document"][data-page-key="demo-counter-page"]',
  )
  await expect(pagePanel).toBeVisible()
  const pageContent = await pagePanel.locator('.compose-editor__canvas-content').boundingBox()
  const pageStage = await pagePanel.locator('.compose-stage').boundingBox()

  // 内容区依赖 flex-1 撑开；页面面板若用 grid 布局会塌陷成零高度并在工具栏下留出空隙。
  expect(pageContent?.height).toBeGreaterThan(100)
  expect(Math.round(pageStage?.height ?? 0)).toBe(Math.round(pageContent?.height ?? -1))
  await expect(editor.locator('[data-workspace-panel="canvas"]')).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 页面文档标签 / 切换其他面板不会让画布消失', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Home' }).dblclick()

  const pagePanel = editor.locator('[data-workspace-panel="page-document"]')
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)

  // Dockview 的活动面板是全局的：点击其他组的面板不得让页面标签失去 Stage 宿主身份。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)

  // 工作区仍跟随该页面：从组件库创建的实体写进页面运行时并标脏。
  await editor.getByRole('button', { name: 'Rectangle' }).click()
  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await expect(pageTab.getByRole('img', { name: '有未保存改动' })).toBeVisible()

  // 切回资源面板后画布依然在。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await expect(pagePanel.locator('.compose-stage')).toHaveCount(1)
})

test('OpenSpec: editor-workspace-layout / 页面保存 / 快捷键与按钮可在不关闭标签时保存', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Home' }).dblclick()

  const tab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  const dirty = tab.getByRole('img', { name: '有未保存改动' })
  const pagePanel = editor.locator('[data-workspace-panel="page-document"]')

  // 无改动时保存按钮禁用
  await expect(pagePanel.getByRole('button', { name: '保存页面' })).toBeDisabled()

  await drawContainer(page, editor)
  await expect(dirty).toBeVisible()
  await expect(pagePanel.getByRole('button', { name: '保存页面' })).toBeEnabled()

  // 显式按钮保存：不关闭标签也能落盘
  await pagePanel.getByRole('button', { name: '保存页面' }).click()
  await expect(dirty).toHaveCount(0)

  // 快捷键保存
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: 'Rectangle' }).click()
  await expect(dirty).toBeVisible()
  await page.keyboard.press('Control+S')
  await expect(dirty).toHaveCount(0)

  // 两次保存都已落盘，因此关闭标签不再触发未保存确认。
  await tab.getByRole('button', { name: /^关闭页面/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tab).toHaveCount(0)
})

test('OpenSpec: basic-materials / Page Slot / 画布与预览的嵌套内容完全一致', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  // 在 Home 页面里放三个实体：容器、矩形、文本
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Home' }).dblclick()
  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: 'Rectangle' }).click()
  await editor.getByRole('button', { name: 'Text' }).click()

  const tab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await page.keyboard.press('Control+S')
  await expect(tab.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // Counter 页面里放一个 Page Slot 指向 Home（组件库仍是打开状态）。
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: 'Page Slot' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expandInspectorSection(inspector, '页面')
  await inspector.getByTestId('semantic-editor-node').getByRole('combobox').click()
  await inspector.getByRole('option', { name: 'Home' }).click()

  // 嵌套内容必须逐个实体渲染并各自定位；缺少定位包装或递归时数量会少于 3
  await expect(stage.getByTestId('compose-page-slot-content')).toBeVisible()
  await expect(stage.locator('[data-page-slot-entity-id]')).toHaveCount(3)

  await editor.getByRole('button', { name: '打开预览' }).click()
  const previewDoc = page.getByTestId('compose-preview-document')
  await expect(previewDoc).toBeVisible()
  // 与画布逐个实体一致：两端共用同一个 page-slot 渲染实现
  await expect(previewDoc.locator('[data-page-slot-entity-id]')).toHaveCount(3)
})

test('OpenSpec: command-panel / 命令动作检索与执行 / 从命令面板执行文档与视口动作', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  const search = commandPanel.getByRole('combobox', { name: '检索命令' })

  // 空查询保持调试台形态：结果区不渲染。
  await expect(commandPanel.getByRole('listbox')).toHaveCount(0)

  // `/` 列出全部动作并按作用域分组。
  await search.fill('/')
  await expect(commandPanel.getByRole('listbox')).toBeVisible()
  await expect(commandPanel.getByRole('group', { name: '舞台' })).toBeVisible()
  await expect(commandPanel.getByRole('group', { name: '历史' })).toBeVisible()

  // 首屏没有选区，删除必须不可用并说明原因，而不是静默失败。
  await search.fill('删除')
  const deleteOption = commandPanel.getByRole('option', { name: /删除/ })
  await expect(deleteOption).toHaveAttribute('aria-disabled', 'true')
  await expect(deleteOption).toContainText('请先选中对象')

  // 事务证据取自命令面板自己的事件流水：每条被派发的命令产生一条，未派发则没有。
  // 历史面板与组件库共用一个 dock 分组，来回切标签会互相隐藏，因此不在此处使用它；
  // 「历史条目数」的直接断言由 command-panel-actions 的单元测试对 runtime 完成。
  const events = commandPanel.locator('.command-panel__events > li')
  await expect(commandPanel.getByText('暂无命令事件')).toBeVisible()

  // 视口动作：改变缩放，且不产生任何命令事件。
  const originBefore = await stage.locator('[data-testid="stage-origin-y"]').getAttribute('x1')
  await search.fill('放大')
  await commandPanel.getByRole('option', { name: /放大/ }).click()
  await expect(search).toHaveValue('')
  await expect
    .poll(async () => stage.locator('[data-testid="stage-origin-y"]').getAttribute('x1'))
    .not.toBe(originBefore)
  // 关键契约：缩放没有派发命令，撤销栈不被污染。
  await expect(events).toHaveCount(0)

  // 新建 Rectangle 会自动选中它；这一步本身派发一条命令。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const nodes = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await expect(nodes).toHaveCount(1)
  await expect(events).toHaveCount(1)

  // 文档动作：从命令面板删除，节点消失并新增一条事件。
  await search.fill('删除')
  const enabledDelete = commandPanel.getByRole('option', { name: /删除/ })
  await expect(enabledDelete).not.toHaveAttribute('aria-disabled', 'true')
  await enabledDelete.click()

  await expect(nodes).toHaveCount(0)
  await expect(events).toHaveCount(2)
})

test('OpenSpec: editor-preferences / 动作执行与呈现分层 / 键盘与命令面板结果一致', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)

  // 必须先展开命令面板：它会压缩 Stage 的可视尺寸，而适配结果依赖该尺寸。
  // 若在展开前后各测一次，比较的就不是同一个输入。
  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  const search = commandPanel.getByRole('combobox', { name: '检索命令' })
  await expect(search).toBeVisible()

  const originY = stage.locator('[data-testid="stage-origin-y"]')
  const originX = stage.locator('[data-testid="stage-origin-x"]')
  const viewportSignature = async () => [
    await originY.getAttribute('x1'),
    await originX.getAttribute('y1'),
  ].join('|')

  // 键盘路径：新建的 Rectangle 仍处于选中状态，直接按适配选择键位。
  await stage.press('f')
  const afterKeyboard = await viewportSignature()

  // 先把视口挪开，确保第二次适配是真的重新计算而不是原地不动。
  await stage.press('Control+Equal')
  await expect.poll(viewportSignature).not.toBe(afterKeyboard)

  // 命令面板路径：同一个动作。
  await search.fill('适配选择')
  await commandPanel.getByRole('option', { name: /适配选择/ }).click()

  // 两条路径必须落到同一个视口；此前键盘用 0.85 系数、工具栏用 128px 边距，结果不同。
  await expect.poll(viewportSignature).toBe(afterKeyboard)
})

test('OpenSpec: stage / 自适应网格标尺与世界原点 / Canvas 标尺对齐网格并显示选区与游标', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await stage.locator('.compose-stage__node.is-renderer').first().click()

  const horizontal = stage.getByTestId('stage-ruler-x')
  const vertical = stage.getByTestId('stage-ruler-y')
  // 容器语义必须在迁移到 Canvas 后保持不变；刻度本身不再是 DOM。
  await expect(horizontal).toHaveAttribute('aria-label', '水平标尺')
  await expect(vertical).toHaveAttribute('aria-label', '垂直标尺')
  await expect(horizontal.locator('canvas')).toHaveAttribute('aria-hidden', 'true')
  await expect(horizontal.locator('[data-world-value]')).toHaveCount(0)

  const surface = await stage.getByTestId('stage-surface').boundingBox()
  expect(surface).not.toBeNull()
  // 指针停在一个确定位置，让游标线进入黄金图。
  await page.mouse.move(surface!.x + 180, surface!.y + 140)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  await expect(page).toHaveScreenshot('stage-ruler-canvas.png', {
    animations: 'disabled',
    caret: 'hide',
    clip: { x: stageBox!.x, y: stageBox!.y, width: 320, height: 220 },
    maxDiffPixelRatio: 0.01,
  })
})
