import { expect, test } from '@playwright/test'
import { pointerDrop, drawContainer, drawText, expandInspectorSection } from './support/test-helpers'

test('OpenSpec: editor-workspace-layout / 启动时打开标记首页 / 根路径直接展示 Home 页面工作区', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)
  await expect(editor.locator('[data-workspace-tab="compose-component-library"]')).toHaveCount(0)
  const componentLibrary = editor.locator('[data-workspace-panel="component-library"]')
  await expect(componentLibrary).toBeVisible()
  // Palette 只保留没有专用创建入口的 Preset：Text/Line/Arrow/Circle 走工具栏绘制工具，
  // Page Slot 走资源面板的页面拖入；Widget Switcher 物料加入后计数为 4。
  await expect(componentLibrary.getByRole('heading', { name: '基础组件 (4)' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 Rectangle' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 Widget Switcher' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 Text' })).toHaveCount(0)

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


test('OpenSpec: editor-workspace-layout / 隐式 Canvas Inspector / 快捷选择常见 PC 尺寸', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  const xAxis = stage.getByTestId('stage-origin-x')
  const yAxis = stage.getByTestId('stage-origin-y')
  const bottomEdge = stage.getByTestId('stage-frame-edge-bottom-frame-root')
  const rightEdge = stage.getByTestId('stage-frame-edge-right-frame-root')
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


test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library-panel"]'),
  ).toHaveAttribute('title', '基础组件')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  // Text 已改由工具栏文字工具提供入口，不再出现在 Palette。
  await expect(editor.getByRole('button').filter({ hasText: /Container|Rectangle|ECharts/ }))
    .toHaveCount(3)
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
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
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-container')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveCSS('background-color', 'rgb(30, 34, 41)')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.25,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  await drawText(page, editor, {
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

  // 历史面板会占据组件库 Dock 的下半区；通过场景树完成等价的键盘可达多选，
  // 避免测试依赖被 Dock 覆盖的 Stage 像素位置。
  const firstComponentId = await components.nth(0).getAttribute('data-entity-id')
  const secondComponentId = await components.nth(1).getAttribute('data-entity-id')
  const containerId = await frame.getAttribute('data-entity-id')
  expect(firstComponentId).not.toBeNull()
  expect(secondComponentId).not.toBeNull()
  expect(containerId).not.toBeNull()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await sceneTree
    .locator(`[data-tree-item-id="${containerId}"]`)
    .getByRole('button', { name: '展开节点' })
    .click()
  await sceneTree.locator(`[data-tree-item-id="${firstComponentId}"]`).click()
  await sceneTree.locator(`[data-tree-item-id="${secondComponentId}"]`).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = frame.locator(':scope > .compose-stage__node.is-container')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-entity-id')
  expect(groupId).not.toBeNull()
  await expect(editor.getByRole('region', { name: 'Group 属性', exact: true })).toBeVisible()
  await expect(group).not.toHaveAttribute('data-compose-entity-border')
  await stage.press('Control+z')
  await expect(frame.locator(':scope > .compose-stage__node.is-container')).toHaveCount(0)
  await stage.press('Control+Shift+z')
  await expect(frame.locator(':scope > .compose-stage__node.is-container')).toHaveCount(1)

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
  await expect(log.getByRole('button', { name: /Undo · Update Text/ })).toBeVisible()
  await expect(log.getByText(/Reject .* outside a Container/)).toHaveCount(0)
  await log.getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }).last().click()
  const operationDetail = log.getByRole('region', { name: '操作详情' })
  await expect(operationDetail).toContainText('之前')
  await expect(operationDetail).toContainText('之后')
  await expect(operationDetail).toContainText('forwardPatches')

  // 容器缩小后 Group 的可见空白被子项占满，改从场景树选中它，避免依赖像素位置。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await sceneTree.locator(`[data-tree-item-id="${groupId}"]`).click()
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
  // First-class Group 是无 Appearance、无 Clip 的结构包装，不再继承历史 Container 的
  // 黑色背景与滚动语义；Preview 仍需输出其可见后代。
  await expect(previewGroup).toHaveCSS('overflow-y', 'visible')
  await expect(previewGroup).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
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
  // 分组现在默认展开；这里要验证的是「搜索自动展开命中分组、清空后恢复原状」，先手动折叠。
  await appearance.click()
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
  await page.getByRole('menu').getByRole('menuitem', { name: '打开页面 JSON' }).click()

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
  const nodes = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
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
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
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

  // Dockview 展开命令面板后 Stage 的尺寸收缩是异步布局：必须等尺寸连续两次
  // 读数一致再适配，否则键盘路径会以中间尺寸计算视口，与面板路径不可比。
  let lastStageSize = ''
  await expect.poll(async () => {
    const box = await stage.boundingBox()
    const size = box ? `${box.width}x${box.height}` : ''
    const stable = size !== '' && size === lastStageSize
    lastStageSize = size
    return stable
  }).toBe(true)

  // 键盘路径：新建的 Rectangle 仍处于选中状态，直接按适配选择键位。
  await stage.press('Shift+Digit2')
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


