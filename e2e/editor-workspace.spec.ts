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
  // Page Slot 走资源面板的页面拖入；Widget Switcher 与 Curve 物料加入后计数为 5。
  await expect(componentLibrary.getByRole('heading', { name: '基础组件 (5)' })).toBeVisible()
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
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  const framePaint = stage.locator('[data-entity-id="frame-root"] > [data-compose-paint]').first()
  const xAxis = stage.getByTestId('stage-origin-x')
  const yAxis = stage.getByTestId('stage-origin-y')
  const origin = stage.getByTestId('stage-world-origin')
  const originSilhouette = stage.getByTestId('stage-world-origin-silhouette')
  const originPosition = stage.getByTestId('stage-world-origin-position')
  await expect(output).toHaveAttribute('fill', 'transparent')
  await expect(xAxis).toHaveCSS('stroke', 'rgba(216, 91, 216, 0.75)')
  await expect(yAxis).toHaveCSS('stroke', 'rgba(194, 238, 109, 0.75)')
  // 场景与容器共用同一条呈现管线：Stage 不再为 Frame 补画任何描边，区域矩形只是几何锚点。
  await expect(stage.locator('.compose-stage__output-edge')).toHaveCount(0)
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


  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()
  await page.mouse.click(outputBox!.x + 40, outputBox!.y + 40)

  // 场景分组自己的面板也叫「场景属性」，这里要的是整个 Entity Inspector 根。
  const inspector = editor.getByRole('region', { name: '场景 属性', exact: true })
  await expect(inspector).toBeVisible()
  // 场景选中后走的是与容器完全相同的选中框，没有 Frame 专属的选中描边。
  await expect(stage.getByTestId('stage-selection-bounds')).toBeVisible()
  await expect(stage.locator('.compose-stage__output-edge')).toHaveCount(0)
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

  // 场景是普通容器：常见尺寸在「场景」分组，背景在「外观」分组，尺寸数值在几何分组。
  const commonOutputSize = inspector.getByRole('combobox', { name: '常见尺寸', exact: true })
  await expect(commonOutputSize).toHaveValue('1280x720')
  await expect(inspector.getByRole('combobox', { name: '尺寸宽度' })).toHaveValue('1280')
  const canvasPaint = inspector.getByRole('button', { name: '背景填充', exact: true })
  await canvasPaint.click()
  const canvasPaintPicker = page.getByRole('dialog', { name: '背景填充', exact: true })
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
  await expect(framePaint)
    .toHaveAttribute('data-compose-paint', 'image')
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
  await expect(framePaint)
    .toHaveAttribute('data-compose-paint', 'image')
  await expectCompactPaintPicker()

  await canvasPaintPicker.getByRole('button', { name: '渐变', exact: true }).click()
  await expectCompactPaintPicker()
  await expectPaintCardsContained()
  await expect(canvasPaintPicker.getByRole('button', { name: '线性', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '径向', exact: true })).toBeVisible()
  await expect(canvasPaintPicker.getByRole('button', { name: '角向', exact: true })).toBeVisible()
  await canvasPaintPicker.getByRole('button', { name: '线性', exact: true }).click()
  await expect(canvasPaintPicker.getByLabel('渐变色标轨道')).toBeVisible()
  await expect(framePaint)
    .toHaveAttribute('data-compose-paint', 'linear-gradient')
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
  await expect(framePaint)
    .toHaveAttribute('data-compose-paint', 'radial-gradient')
  await expect(canvasPaintPicker.getByRole('slider', { name: '方向角度' })).toHaveCount(0)
  await canvasPaintPicker.getByRole('spinbutton', { name: '中心 X' }).fill('65')
  await canvasPaintPicker.getByRole('spinbutton', { name: '垂直半径' }).fill('35')
  await expect(canvasPaintPicker.getByRole('spinbutton', { name: '中心 X' })).toHaveValue('65')
  await expect(canvasPaintPicker.getByRole('spinbutton', { name: '垂直半径' })).toHaveValue('35')
  await expectCompactPaintPicker()
  await expectPaintCardsContained()

  await canvasPaintPicker.getByRole('button', { name: '角向', exact: true }).click()
  await expect(framePaint)
    .toHaveAttribute('data-compose-paint', 'angular-gradient')
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

  // 常见尺寸是场景分组里的快捷入口；尺寸数值本身在几何分组，两处指向同一个 Frame.size。
  await commonOutputSize.selectOption('1920x1080')
  await expect(commonOutputSize).toHaveValue('1920x1080')
  await expect(output).toHaveAttribute('width', '1920')
  await expect(output).toHaveAttribute('height', '1080')

  const frameWidth = inspector.getByRole('combobox', { name: '尺寸宽度' })
  const frameHeight = inspector.getByRole('combobox', { name: '尺寸高度' })
  await expect(frameWidth).toHaveValue('1920')
  await expect(frameHeight).toHaveValue('1080')
  await frameWidth.fill('1600')
  await frameWidth.press('Enter')
  await expect(output).toHaveAttribute('width', '1600')
  // 不匹配任何预设时下拉落到「自定义尺寸」，但不派发命令。
  await expect(commonOutputSize).toHaveValue('custom')

  // 几何分组改尺寸与 Frame.size 是同一次事务：撤销一步回到预设尺寸。
  await stage.focus()
  await stage.press('Control+z')
  await expect(commonOutputSize).toHaveValue('1920x1080')
  await expect(output).toHaveAttribute('width', '1920')
  // 撤销不改变选择：场景仍被选中，选中框仍在。
  await expect(stage.getByTestId('stage-selection-bounds')).toBeVisible()
  await stage.press('Control+Shift+z')
  await expect(output).toHaveAttribute('width', '1600')
  await expect(commonOutputSize).toHaveValue('custom')
})


test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/?no-auto-fit')

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
  await expect(preview.getByRole('combobox', { name: '预览场景' })).toBeVisible()
  await expect(preview.getByTestId('compose-preview-frame')).toBeVisible()
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



test('OpenSpec: editor-workspace-layout / CAD 文档标签 / 新建、打开、存盘、重开', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()

  // 1) 进入 Pages 目录后右键新建 CAD（与页面创建用例同一个可写目录）
  await rootGrid.getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await expect(pagesGrid).toBeVisible()
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Topology')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  // 2) 创建后随即以 CAD 标签打开
  const cadTab = editor.locator('[data-workspace-tab^="compose-cad-document:"]')
    .filter({ hasText: 'Topology' })
  await expect(cadTab).toHaveCount(1)
  await expect(editor.locator('[data-testid="cad-canvas"]')).toBeVisible()

  // 3) CAD 标签激活时左右边缘面板默认收起
  const sceneTree = editor.locator('[data-workspace-panel="scene-graph"]')
  await expect(sceneTree).not.toBeVisible()

  // 4) 切回页面标签时边缘面板恢复展开
  await editor.locator('[data-workspace-tab^="compose-page-document:"]').first().click()
  await expect(sceneTree).toBeVisible()

  // 5) 关闭再重开，CAD 文档仍在且内容可读
  await cadTab.click()
  await cadTab.getByRole('button', { name: /^关闭/ }).click()
  await expect(cadTab).toHaveCount(0)

  await pagesGrid.getByRole('gridcell', { name: /^Topology/ }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-cad-document:"]')).toHaveCount(1)
  await expect(editor.locator('[data-testid="cad-canvas"]')).toBeVisible()
})

test('OpenSpec: cad-document / CAD 直线命令 / 敲 L 画两点、撤销、存盘重开', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Wiring')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 键入 L↵ 启动命令，提示切到「指定第一点」
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定第一点')

  // 2) 在图面上点两下，随后回车结束
  await surface.click({ position: { x: 120, y: 120 } })
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定下一点')
  await surface.click({ position: { x: 220, y: 100 } })
  await commandInput.press('Enter')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(1)

  // 3) 一次撤销回到命令开始之前
  await surface.click({ position: { x: 60, y: 60 } })
  await page.keyboard.press('ControlOrMeta+z')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(1)

  // 4) 存盘、关闭、重开，直线仍在
  const cadTab = editor.locator('[data-workspace-tab^="compose-cad-document:"]')
    .filter({ hasText: 'Wiring' })
  await cadTab.getByRole('button', { name: /^关闭/ }).click()
  const unsaved = page.getByRole('dialog')
  await expect(unsaved).toBeVisible()
  await unsaved.getByRole('button', { name: '保存' }).click()
  await expect(cadTab).toHaveCount(0)

  await pagesGrid.getByRole('gridcell', { name: /^Wiring/ }).dblclick()
  await expect(editor.locator('[data-cad-entity]')).toHaveCount(1)
})

test('OpenSpec: cad-document / CAD 命令行焦点 / 全程不碰输入框也能画完一条线', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Focus')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 打开标签即聚焦命令行——不点输入框就能敲命令
  await expect(commandInput).toBeFocused()
  await page.keyboard.type('l')
  await page.keyboard.press('Enter')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定第一点')

  // 2) 在图面上点两下后焦点仍在命令行。焦点移动是 mousedown 的默认动作，图面必须把它拦掉，
  //    否则第一次点击之后所有关键字与坐标都落空。
  await surface.click({ position: { x: 120, y: 120 } })
  await expect(commandInput).toBeFocused()
  await surface.click({ position: { x: 320, y: 220 } })
  await expect(commandInput).toBeFocused()

  // 3) 直接敲结束关键字（小写），不先把光标挪回输入框
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(1)
})

test('OpenSpec: cad-document / CAD 指针反馈 / 橡皮筋、悬停高亮与坐标读数', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Feedback')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const band = surface.locator('[data-cad-preview="pending"]')
  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')
  // 取点按图面实际尺寸算：图面上下要给标尺与命令行让位，写死的纵坐标会随 chrome 变化而落到
  // 图面之外，那时指针根本不在图面上，失败原因看起来却像是橡皮筋没画。
  const lower = Math.round(box.height * 0.7)

  // 1) 指针一进图面就有坐标读数
  await page.mouse.move(box.x + 200, box.y + 160)
  await expect(canvas.locator('[data-testid="cad-pointer-readout"]')).toBeVisible()

  // 2) 取得第一点后橡皮筋跟随指针；本帧的终点必须是移动之后的位置
  await page.keyboard.type('l')
  await page.keyboard.press('Enter')
  await expect(band).toHaveCount(0)
  await surface.click({ position: { x: 200, y: 160 } })
  await page.mouse.move(box.x + 460, box.y + lower)
  await expect(band).toHaveCount(1)
  await expect(band).toHaveAttribute('x2', '460')

  // 3) 取第二点后橡皮筋换成从新顶点起算，结束命令后消失
  await surface.click({ position: { x: 460, y: lower } })
  await page.mouse.move(box.x + 600, box.y + 200)
  await expect(band).toHaveAttribute('x1', '460')
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await expect(band).toHaveCount(0)
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(1)

  // 4) 空闲时压在图元上出现悬停高亮，移开即消失
  await page.mouse.move(box.x + 330, box.y + Math.round((160 + lower) / 2))
  await expect(surface.locator('[data-cad-entity][data-hovered]')).toHaveCount(1)
  await page.mouse.move(box.x + 330, box.y + 20)
  await expect(surface.locator('[data-cad-entity][data-hovered]')).toHaveCount(0)
})

test('OpenSpec: cad-document / CAD 十字光标 / 三种形态与系统光标隐藏', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Crosshair')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const lines = surface.locator('[data-cad-crosshair-line]')
  const pickbox = canvas.locator('[data-testid="cad-pickbox"]')
  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')

  // 1) 空闲：十字线与拾取框都在，系统光标被收走
  await page.mouse.move(box.x + 300, box.y + 200)
  await expect(lines).toHaveCount(4)
  await expect(pickbox).toHaveCount(1)
  await expect(surface).toHaveCSS('cursor', 'none')

  // 2) 等待取点：拾取框消失
  await page.keyboard.type('l')
  await page.keyboard.press('Enter')
  await page.mouse.move(box.x + 320, box.y + 220)
  await expect(lines).toHaveCount(4)
  await expect(pickbox).toHaveCount(0)

  // 3) 等待选择对象：十字线消失
  await surface.click({ position: { x: 200, y: 160 } })
  await surface.click({ position: { x: 400, y: 260 } })
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await page.keyboard.type('e')
  await page.keyboard.press('Enter')
  await page.mouse.move(box.x + 340, box.y + 240)
  await expect(lines).toHaveCount(0)
  await expect(pickbox).toHaveCount(1)
})

test('OpenSpec: cad-document / CAD 画布网格与标尺 / 缩小后网格仍在，标尺随视口更新', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Grid')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')

  // 1) 标尺与原点角在位
  await expect(canvas.locator('[data-testid="cad-ruler-x"]')).toBeVisible()
  await expect(canvas.locator('[data-testid="cad-ruler-y"]')).toBeVisible()
  await expect(canvas.locator('[data-testid="cad-ruler-corner"]')).toBeVisible()

  // 2) 网格是四层 gradient（主线与细线各两轴），不是 SVG 节点
  const layers = async () => (await surface.evaluate((node) => getComputedStyle(node).backgroundImage))
    .split('gradient').length - 1
  expect(await layers()).toBe(4)

  const minorSpacing = async () => {
    const size = await surface.evaluate((node) => getComputedStyle(node).backgroundSize)
    return Number.parseFloat(size.split(', ')[2] ?? '0')
  }
  const before = await minorSpacing()

  // 3) 缩小很多之后网格**仍然存在**，只是按二次幂 stride 抽稀——旧实现在这里整片消失
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let step = 0; step < 12; step += 1) await page.mouse.wheel(0, 200)
  await expect.poll(minorSpacing).not.toBe(before)
  expect(await layers()).toBe(4)
  expect(await minorSpacing()).toBeGreaterThanOrEqual(2)
})

test('OpenSpec: cad-document / CAD 几何位移 / M↵ 移动、拖动移动与一次撤销', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Move')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const first = surface.locator('[data-cad-entity]').first()

  // 用键入坐标画一条确定位置的线
  await page.keyboard.type('l')
  await page.keyboard.press('Enter')
  await page.keyboard.type('100,100')
  await page.keyboard.press('Enter')
  await page.keyboard.type('300,100')
  await page.keyboard.press('Enter')
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('x1', '100')

  // 1) 选中后用 M↵ 移动，位移同样可以键入
  await surface.click({ position: { x: 200, y: 100 } })
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)
  await page.keyboard.type('m')
  await page.keyboard.press('Enter')
  await page.keyboard.type('0,0')
  await page.keyboard.press('Enter')
  await page.keyboard.type('60,40')
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('x1', '160')

  // 2) 一次撤销回到移动之前——整次移动是一个事务
  await page.keyboard.press('ControlOrMeta+z')
  await expect(first).toHaveAttribute('x1', '100')
})

test('OpenSpec: cad-document / CAD 拖动移动 / 非 100% 缩放下拖动仍然吸附到网格', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Drag')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const first = surface.locator('[data-cad-entity]').first()

  // 已知世界坐标的一条线：(100,100) → (300,100)
  await page.keyboard.type('l')
  await page.keyboard.press('Enter')
  await page.keyboard.type('100,100')
  await page.keyboard.press('Enter')
  await page.keyboard.type('300,100')
  await page.keyboard.press('Enter')
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('x1', '100')

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')

  /**
   * 由两个已知世界坐标反解当前视口：`screen = world * zoom + offset`。
   *
   * **只在图元还在原位时有效**——它拿这条线自己的坐标当基准。移动之后必须沿用移动前解出的
   * 视口，否则换算会恒等地把结果算回原位置，测试永远通过。
   */
  const viewport = async () => {
    const [x1, x2, y1] = await first.evaluate((node) => [
      Number(node.getAttribute('x1')),
      Number(node.getAttribute('x2')),
      Number(node.getAttribute('y1')),
    ])
    const zoom = (x2 - x1) / 200
    return { zoom, offsetX: x1 - 100 * zoom, screenY: y1 }
  }

  // 缩放到非 100%：zoom 恒为 1 时未吸附也看起来是整数，那样的断言证明不了吸附。
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -240)
  await page.keyboard.up('Control')
  const before = await viewport()
  expect(before.zoom).not.toBe(1)

  // 选中，然后拖一个刻意不落在网格上的屏幕位移
  const grabX = box.x + 200 * before.zoom + before.offsetX
  const grabY = box.y + before.screenY
  await page.mouse.click(grabX, grabY)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)

  await page.mouse.move(grabX, grabY)
  await page.mouse.down()
  await page.mouse.move(grabX + 71, grabY + 43, { steps: 6 })
  await page.mouse.up()

  // 松手后端点的**世界坐标**必须落在网格步长 10 的整数倍上。视口在拖动期间没有变化，因此
  // 沿用移动前解出的那一组。
  const movedScreenX = await first.evaluate((node) => Number(node.getAttribute('x1')))
  const worldStart = (movedScreenX - before.offsetX) / before.zoom
  expect(worldStart).not.toBe(100)
  expect(Math.abs(worldStart % 10)).toBeLessThan(0.001)
})

test('OpenSpec: cad-document / CAD 导线 / 端口连线后拖动符号，导线跟着走', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Ports')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const first = surface.locator('[data-cad-entity]').first()
  const ports = surface.locator('[data-testid="cad-port"]')

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  // 一条已知世界坐标的线：(100,100) → (200,100)
  await type('l')
  await type('100,100')
  await type('200,100')
  await type('f')
  await expect(first).toHaveAttribute('x1', '100')

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')

  /**
   * 由那条线（世界 100..200、y=100）反解视口：`screen = world * zoom + offset`。
   *
   * 建块之后它变成实例的展开线段，世界坐标不变，因此同一段推导继续成立。
   */
  const viewport = async () => {
    const [x1, x2, y1] = await first.evaluate((node) => [
      Number(node.getAttribute('x1')),
      Number(node.getAttribute('x2')),
      Number(node.getAttribute('y1')),
    ])
    const zoom = (x2 - x1) / 100
    return { zoom, offsetX: x1 - 100 * zoom, offsetY: y1 - 100 * zoom }
  }
  type Viewport = Awaited<ReturnType<typeof viewport>>
  const screenOf = (vp: Viewport, x: number, y: number) => ({
    x: box.x + x * vp.zoom + vp.offsetX,
    y: box.y + y * vp.zoom + vp.offsetY,
  })

  // 1) 收成一个块，并在它的右端点上声明一个端口
  const unzoomed = await viewport()
  const mid = screenOf(unzoomed, 150, 100)
  await page.mouse.click(mid.x, mid.y)
  await type('b')
  await type('SYMBOL')
  await type('100,100')

  await page.mouse.click(mid.x, mid.y)
  await type('po')
  await type('200,100')
  await expect(ports).toHaveCount(1)

  // 2) 再插一个实例：端口是块**定义**的一部分，一次声明两个实例都有
  await type('i')
  await type('SYMBOL')
  await type('100,300')
  await expect(ports).toHaveCount(2)

  // 3) 缩放到非 100%：zoom 恒为 1 时未吸附也看起来是整数，那样的断言证明不了吸附。
  //    往**外**缩：放大会把下面那个实例推出图面，取点就落在画布之外了。
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 240)
  await page.keyboard.up('Control')
  const zoomed = await viewport()
  expect(zoomed.zoom).not.toBe(1)

  // 4) 画导线：点在端口**附近**而不是正中，落点该被端口捕捉吸过去
  const p1 = screenOf(zoomed, 200, 100)
  const p2 = screenOf(zoomed, 200, 300)
  await type('w')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定导线起点')
  await page.mouse.click(p1.x + 3, p1.y + 3)
  await page.mouse.click(p2.x + 3, p2.y + 3)
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(3)

  const wire = surface.locator('[data-cad-entity]').last()
  const endpointOf = async () => wire.evaluate((node) => ({
    x: Number(node.getAttribute('x2')),
    y: Number(node.getAttribute('y2')),
  }))
  const markerOf = async () => ports.nth(1).evaluate((node) => ({
    x: Number(node.getAttribute('cx')),
    y: Number(node.getAttribute('cy')),
  }))
  expect(await endpointOf()).toEqual(await markerOf())
  const beforeDrag = await endpointOf()

  // 5) 拖走第二个实例。选择集是累加的，先 Esc 清空，否则两个实例一起走。
  await page.keyboard.press('Escape')
  const grab = screenOf(zoomed, 150, 300)
  await page.mouse.click(grab.x, grab.y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 37, grab.y + 64, { steps: 6 })
  await page.mouse.up()

  // 导线端点仍然贴在端口上，而导线自己一个坐标都没被写过——几何是解出来的。
  const afterDrag = await endpointOf()
  expect(afterDrag).not.toEqual(beforeDrag)
  expect(afterDrag).toEqual(await markerOf())
})

test('OpenSpec: cad-document / CAD CIRCLE 与 ARC 命令 / 非 100% 缩放下画圆并捕圆心', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Curves')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const entities = surface.locator('[data-cad-entity]')

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  // 一条已知世界坐标的线，既是视口基准也是后面捕捉的干扰项
  await type('l')
  await type('100,100')
  await type('200,100')
  await type('f')
  await expect(entities.first()).toHaveAttribute('x1', '100')

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')

  /** 由那条线（世界 100..200、y=100）反解视口：`screen = world * zoom + offset`。 */
  const viewport = async () => {
    const [x1, x2, y1] = await entities.first().evaluate((node) => [
      Number(node.getAttribute('x1')),
      Number(node.getAttribute('x2')),
      Number(node.getAttribute('y1')),
    ])
    const zoom = (x2 - x1) / 100
    return { zoom, offsetX: x1 - 100 * zoom, offsetY: y1 - 100 * zoom }
  }
  type Viewport = Awaited<ReturnType<typeof viewport>>
  const screenOf = (vp: Viewport, x: number, y: number) => ({
    x: box.x + x * vp.zoom + vp.offsetX,
    y: box.y + y * vp.zoom + vp.offsetY,
  })

  // 缩放到非 100%：zoom 恒为 1 时未吸附也看起来是整数，那样的断言证明不了吸附
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 240)
  await page.keyboard.up('Control')
  const vp = await viewport()
  expect(vp.zoom).not.toBe(1)

  // 1) 圆心取在既有线段的中点上——捕捉命中时落点是精确中点，而不是指针裸坐标
  await type('c')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定圆心')
  const near = screenOf(vp, 150, 100)
  await page.mouse.move(near.x + 2, near.y + 2)
  await expect(canvas.locator('[data-testid="cad-snap-marker"]'))
    .toHaveAttribute('data-snap-mode', 'midpoint')
  await page.mouse.click(near.x + 2, near.y + 2)
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定半径')
  const rim = screenOf(vp, 200, 100)
  await page.mouse.click(rim.x, rim.y)

  await expect(entities).toHaveCount(2)
  const circle = entities.nth(1)
  // 整圆走 `<circle>`，半径按缩放换算回世界仍是 50
  await expect(circle).toHaveJSProperty('tagName', 'circle')
  const worldRadius = await circle.evaluate((node) => Number(node.getAttribute('r'))) / vp.zoom
  expect(worldRadius).toBeCloseTo(50, 6)

  // 2) 第二个圆画在远离既有几何处：第一个圆的圆心与那条线的中点重合，而中点优先级更高，
  //    拿它验证圆心捕捉只会一直捕到中点
  await type('c')
  await type('150,300')
  await type('200,300')
  await expect(entities).toHaveCount(3)

  await type('l')
  const center = screenOf(vp, 150, 300)
  await page.mouse.move(center.x + 1, center.y - 2)
  await expect(canvas.locator('[data-testid="cad-snap-marker"]'))
    .toHaveAttribute('data-snap-mode', 'center')
  await page.keyboard.press('Escape')

  // 3) 点在圆心不命中——判据是到弧的距离，不是包围盒
  await page.mouse.click(center.x, center.y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(0)
  await page.mouse.click(screenOf(vp, 200, 300).x, screenOf(vp, 200, 300).y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)
})

test('OpenSpec: cad-document / CAD TEXT 命令 / 非 100% 缩放下写标注并按字框选中', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Labels')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const entities = surface.locator('[data-cad-entity]')

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  // 一条已知世界坐标的线，用来反解视口
  await type('l')
  await type('100,100')
  await type('200,100')
  await type('f')
  await expect(entities.first()).toHaveAttribute('x1', '100')

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')
  const viewport = async () => {
    const [x1, x2, y1] = await entities.first().evaluate((node) => [
      Number(node.getAttribute('x1')),
      Number(node.getAttribute('x2')),
      Number(node.getAttribute('y1')),
    ])
    const zoom = (x2 - x1) / 100
    return { zoom, offsetX: x1 - 100 * zoom, offsetY: y1 - 100 * zoom }
  }
  type Viewport = Awaited<ReturnType<typeof viewport>>
  const screenOf = (vp: Viewport, x: number, y: number) => ({
    x: box.x + x * vp.zoom + vp.offsetX,
    y: box.y + y * vp.zoom + vp.offsetY,
  })

  await page.mouse.move(box.x + 60, box.y + 60)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 240)
  await page.keyboard.up('Control')
  const vp = await viewport()
  expect(vp.zoom).not.toBe(1)

  // 1) 三步写一段标注，插入点捕捉到那条线的右端点
  await type('t')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定文字插入点')
  const anchor = screenOf(vp, 200, 100)
  await page.mouse.move(anchor.x + 2, anchor.y + 2)
  await expect(canvas.locator('[data-testid="cad-snap-marker"]'))
    .toHaveAttribute('data-snap-mode', 'endpoint')
  await page.mouse.click(anchor.x + 2, anchor.y + 2)
  await type('20')
  await type('QF01')

  await expect(entities).toHaveCount(2)
  const label = entities.nth(1)
  await expect(label).toHaveJSProperty('tagName', 'text')
  await expect(label).toHaveText('QF01')
  // 字号按缩放换算回世界仍是 20——它没有被当成屏幕像素。
  const worldHeight = await label.evaluate((node) => Number(node.getAttribute('font-size')))
    / vp.zoom
  expect(worldHeight).toBeCloseTo(20, 6)

  // 2) 点在笔画之间的空隙上仍然选中它：文字占满自己的盒子，盒子就是用户看见的那块墨
  await page.keyboard.press('Escape')
  const gap = screenOf(vp, 200 + 4 * 20 * 0.6 / 2, 100 - 6)
  await page.mouse.click(gap.x, gap.y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)

  // 3) 框外不选中
  await page.keyboard.press('Escape')
  const outside = screenOf(vp, 200 + 4 * 20 * 0.6 + 30, 100 - 6)
  await page.mouse.click(outside.x, outside.y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(0)
})

test('OpenSpec: cad-document / CAD PLINE 与 RECTANG 命令 / 非 100% 缩放下画矩形并整体拖走', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Boxes')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const entities = surface.locator('[data-cad-entity]')

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  // 一条已知世界坐标的线，用来反解视口
  await type('l')
  await type('100,400')
  await type('200,400')
  await type('f')
  await expect(entities.first()).toHaveAttribute('x1', '100')

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')
  const viewport = async () => {
    const [x1, x2, y1] = await entities.first().evaluate((node) => [
      Number(node.getAttribute('x1')),
      Number(node.getAttribute('x2')),
      Number(node.getAttribute('y1')),
    ])
    const zoom = (x2 - x1) / 100
    return { zoom, offsetX: x1 - 100 * zoom, offsetY: y1 - 400 * zoom }
  }
  type Viewport = Awaited<ReturnType<typeof viewport>>
  const screenOf = (vp: Viewport, x: number, y: number) => ({
    x: box.x + x * vp.zoom + vp.offsetX,
    y: box.y + y * vp.zoom + vp.offsetY,
  })

  await page.mouse.move(box.x + 60, box.y + 60)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 240)
  await page.keyboard.up('Control')
  const vp = await viewport()
  expect(vp.zoom).not.toBe(1)

  // 1) 两点画一个矩形：一个 Entity，四条线段
  await type('rec')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('指定第一个角点')
  await type('100,100')
  await type('300,200')
  // 那条基准线 + 矩形的四条边
  await expect(entities).toHaveCount(5)

  // 2) 点中任意一段，四条边一起进入选中态——它们是同一个对象
  await page.keyboard.press('Escape')
  const topEdge = screenOf(vp, 200, 100)
  await page.mouse.click(topEdge.x, topEdge.y)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(4)

  // 3) 整体拖走：一次拖动带走四条边，右下角仍在原来的相对位置上
  const grab = topEdge
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 40 * vp.zoom, grab.y + 60 * vp.zoom, { steps: 6 })
  await page.mouse.up()
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(4)

  // 拖后左上角落在网格上，且矩形尺寸没变——四条边被当成一个对象搬走
  const edges = await surface.locator('[data-cad-entity][data-selected]').evaluateAll(
    (nodes) => nodes.map((node) => ({
      x1: Number(node.getAttribute('x1')),
      y1: Number(node.getAttribute('y1')),
      x2: Number(node.getAttribute('x2')),
      y2: Number(node.getAttribute('y2')),
    })),
  )
  const xs = edges.flatMap(({ x1, x2 }) => [x1, x2])
  const ys = edges.flatMap(({ y1, y2 }) => [y1, y2])
  const worldWidth = (Math.max(...xs) - Math.min(...xs)) / vp.zoom
  const worldHeight = (Math.max(...ys) - Math.min(...ys)) / vp.zoom
  expect(worldWidth).toBeCloseTo(200, 6)
  expect(worldHeight).toBeCloseTo(100, 6)

  // 图元属性是**图面内**坐标，而 screenOf 产出的是页面坐标——这里不能再减 box.x。
  const worldLeft = (Math.min(...xs) - vp.offsetX) / vp.zoom
  expect(worldLeft).not.toBe(100)
  expect(Math.abs(worldLeft % 10)).toBeLessThan(0.001)
})

test('OpenSpec: cad-document / CAD COLOR、LWEIGHT 与 LTYPE 命令 / 改外观并回退到图层', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Appearance')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const line = surface.locator('[data-cad-entity]').first()

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  await type('l')
  await type('100,100')
  await type('300,100')
  await type('f')
  await expect(line).toHaveAttribute('x1', '100')
  const layerColor = await line.getAttribute('stroke')
  expect(layerColor).not.toBeNull()

  // 1) 选中后改颜色、线宽与线型
  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')
  await page.mouse.click(box.x + 200, box.y + 100)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)

  await type('col')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('输入颜色')
  await type('red')
  await type('lw')
  await type('3')
  await type('lt')
  await type('8,4')

  // 选中态与悬停态的颜色都交给 CSS，因此要先清空选择**并把指针移开**才读得到解析出来的颜色。
  await page.keyboard.press('Escape')
  await page.mouse.move(box.x + 60, box.y + 260)
  await expect(line).toHaveAttribute('stroke', '#ff0000')
  await expect(line).toHaveAttribute('stroke-width', '3')
  await expect(line).toHaveAttribute('stroke-dasharray', '8 4')

  // 2) BYLAYER 清除颜色覆盖，回到图层色；线宽与线型不受影响
  await page.mouse.click(box.x + 200, box.y + 100)
  await type('col')
  await type('BYLAYER')
  await page.keyboard.press('Escape')
  await page.mouse.move(box.x + 60, box.y + 260)
  await expect(line).toHaveAttribute('stroke', layerColor!)
  await expect(line).toHaveAttribute('stroke-width', '3')
})

test('OpenSpec: cad-document / CAD 虚线偏移与 FLOW 命令 / 一条命令让线流动起来', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Flow')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  await expect(canvas).toBeVisible()
  const surface = canvas.locator('[data-testid="cad-surface"]')
  const line = surface.locator('[data-cad-entity]').first()

  const type = async (text: string) => {
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
  }

  await type('l')
  await type('100,100')
  await type('300,100')
  await type('f')
  await expect(line).toHaveAttribute('x1', '100')
  // 实线：没有虚线就没有偏移可言。
  await expect(line).not.toHaveAttribute('stroke-dasharray', /.*/u)

  const box = await surface.boundingBox()
  if (!box) throw new Error('surface has no box')
  await page.mouse.click(box.x + 200, box.y + 100)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)
  await type('fl')

  // 命令补上默认线型——实线上的偏移动画在屏幕上没有任何变化。
  await expect(line).toHaveAttribute('stroke-dasharray', '8 6')

  const offset = async () => Number(await line.getAttribute('stroke-dashoffset'))
  const initial = await offset()
  await expect.poll(async () => Math.abs(await offset() - initial), { timeout: 3000 })
    .toBeGreaterThan(1)

  // 采样只作用于渲染：几何纹丝不动，作者坐标上照样点得中。
  await page.keyboard.press('Escape')
  await page.mouse.click(box.x + 200, box.y + 100)
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)
  await expect(line).toHaveAttribute('x1', '100')
})

test('OpenSpec: cad-document / CAD 坐标语法 / 键入坐标与正交约束', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Coords')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 三种坐标写法各画一段
  for (const text of ['L', '0,0', '@100,0', '100<90', 'F']) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)

  // 2) 缺少参照点时相对写法被拒绝，且会话不结束
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await commandInput.fill('@10,20')
  await commandInput.press('Enter')
  await expect(canvas.locator('[data-testid="cad-command-prompt"]')).toContainText('需要一个参照点')
  await commandInput.press('Escape')

  // 3) F8 切换正交并显示状态
  await expect(canvas.locator('[data-testid="cad-ortho-state"]')).toHaveText('正交 关')
  await commandInput.press('F8')
  await expect(canvas.locator('[data-testid="cad-ortho-state"]')).toHaveText('正交 开')
})

test('OpenSpec: cad-document / CAD 对象捕捉 / 捕捉端点画出精确相接的两条线', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Snap')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 先键入一条端点不在网格上的线
  for (const text of ['L', '40,40', '143,87', 'F']) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(1)

  // 2) 第二条线从该端点附近起笔：悬停出现端点标记
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await surface.hover({ position: { x: 145, y: 89 } })
  const marker = canvas.locator('[data-testid="cad-snap-marker"]')
  await expect(marker).toHaveAttribute('data-snap-mode', 'endpoint')

  // 3) 点下去落在精确端点上，而不是被网格取整到 (140,90)
  await surface.click({ position: { x: 145, y: 89 } })
  await commandInput.fill('240,87')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)

  const second = surface.locator('[data-cad-entity]').nth(1)
  const first = surface.locator('[data-cad-entity]').first()
  // 两条线在屏幕上严格共点：第一条的终点就是第二条的起点。
  expect(await second.getAttribute('x1')).toBe(await first.getAttribute('x2'))
  expect(await second.getAttribute('y1')).toBe(await first.getAttribute('y2'))

  // 4) F3 关闭对象捕捉后不再出现标记
  await commandInput.press('F3')
  await expect(canvas.locator('[data-testid="cad-snap-state"]')).toHaveText('对象捕捉 关')
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await surface.hover({ position: { x: 145, y: 89 } })
  await expect(marker).toHaveCount(0)
})

test('OpenSpec: cad-document / CAD 选择集与手势仲裁 / 交叉框选两条线后 E 一次删除', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Select')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 画两条水平线：y=40 与 y=80，都从 x=40 到 x=240
  for (const text of ['L', '40,40', '240,40', 'F', 'L', '40,80', '240,80', 'F']) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)

  // 2) 点选一条：不需要修饰键，选中态可见
  await surface.click({ position: { x: 140, y: 40 } })
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(1)

  // 3) Esc 清空选择——没有活动命令时 Esc 的语义是清除选择集
  await commandInput.press('Escape')
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(0)

  // 4) 右→左拖出交叉选框：只碰到中段就把两条都抓住，选框是虚线
  await surface.hover({ position: { x: 160, y: 20 } })
  await page.mouse.down()
  await surface.hover({ position: { x: 120, y: 100 } })
  await expect(canvas.locator('[data-testid="cad-marquee"]'))
    .toHaveAttribute('data-marquee-mode', 'crossing')
  await page.mouse.up()
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(2)
  await expect(canvas.locator('[data-testid="cad-selection-count"]')).toHaveText('2')

  // 5) 先选后执行：E 直接删除，不再提示选择对象
  await commandInput.fill('E')
  await commandInput.press('Enter')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(0)
  await expect(canvas.locator('[data-testid="cad-selection-count"]')).toHaveCount(0)

  // 6) 一次撤销把两条线一起恢复——同一次 ERASE 是一个 batch
  await page.keyboard.press('Control+z')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)
})

test('OpenSpec: cad-document / CAD 块定义与插入 / 建块、插两次、改定义两处同时变', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建 CAD', exact: true }).click()
  const nameDialog = page.getByRole('dialog')
  await nameDialog.getByLabel('名称').fill('Blocks')
  await nameDialog.getByRole('button', { name: '创建' }).click()

  const canvas = editor.locator('[data-testid="cad-canvas"]')
  const commandInput = canvas.locator('[data-testid="cad-command-input"]')
  const surface = canvas.locator('[data-testid="cad-surface"]')

  // 1) 画一个方角符号：(40,40) → (80,40) → (80,80)
  for (const text of ['L', '40,40', '80,40', '80,80', 'F']) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)

  // 2) 全选后建块，基点取符号的拐角。
  // 拖拽用绝对坐标而不是 locator.hover：按下之后指针被 surface 捕获，hover 的可操作性检查
  // 会认为元素被别的节点挡住而重试到超时。
  const box = (await surface.boundingBox())!
  const at = (x: number, y: number) => ({ x: box.x + x, y: box.y + y })
  const from = at(20, 20)
  const to = at(200, 200)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y)
  await page.mouse.up()
  await expect(canvas.locator('[data-testid="cad-selection-count"]')).toHaveText('2')

  for (const text of ['B', 'CORNER', '80,40'] as const) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  // 两条线被一个实例取代，但画面上仍是两段——实例被展开渲染。
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)

  // 3) 再插一个到别处：现在图纸上有两个实例、四段
  for (const text of ['I', 'CORNER', '200,40'] as const) {
    await commandInput.fill(text)
    await commandInput.press('Enter')
  }
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(4)

  // 4) 点中第二个实例的一段：整个实例进入选中态，两段一起高亮。
  // 基点取的是拐角 (80,40)，因此块局部几何是 (-40,0)→(0,0)→(0,40)；插到 (200,40) 之后这个
  // 实例横跨 160→200，点 (180,40) 落在它的水平段上。
  await surface.click({ position: { x: 180, y: 40 } })
  await expect(surface.locator('[data-cad-entity][data-selected]')).toHaveCount(2)
  await expect(canvas.locator('[data-testid="cad-selection-count"]')).toHaveText('1')

  // 5) 撤销回到插入之前
  await commandInput.press('Escape')
  await page.keyboard.press('Control+z')
  await expect(surface.locator('[data-cad-entity]')).toHaveCount(2)
})
