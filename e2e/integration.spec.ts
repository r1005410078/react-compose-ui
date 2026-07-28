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

test('OpenSpec: asset-browser / Editor 资源面板 / 浏览 SVG 并显式保存 Monaco 脚本', async ({ page }) => {
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
  await rootGrid.getByRole('gridcell', { name: /Images/ }).click()
  await assets.getByRole('grid', { name: 'Images' })
    .getByRole('gridcell', { name: /compose-grid.svg/ }).click()
  await expect(assets.getByRole('img', { name: 'compose-grid.svg' })).toBeVisible()
  await expect(assets).toHaveScreenshot('asset-browser-svg-preview.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })

  await assets.getByRole('row', { name: /dashboard.ts/ }).click()
  const monaco = assets.locator('.monaco-editor')
  await expect(monaco).toBeVisible()
  await expect(assets).toHaveScreenshot('asset-browser-monaco-editor.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await monaco.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\n// saved from e2e')
  await assets.getByRole('row', { name: /Images/ }).click()
  await expect(assets.getByRole('alertdialog', { name: '文件尚未保存' })).toBeVisible()
  await assets.getByRole('button', { name: '取消' }).click()
  await monaco.click()
  await page.keyboard.press('Control+S')
  await assets.getByRole('row', { name: /Images/ }).click()
  await expect(assets.getByRole('alertdialog', { name: '文件尚未保存' })).toHaveCount(0)
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
  const svgRow = assets.getByRole('row', { name: /compose-grid\.svg/ })
  const imageRow = assets.getByRole('row', { name: /dashboard\.bmp/ })
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
  const inspector = editor.getByRole('region', { name: 'compose-grid.svg 属性' })
  await inspector.getByRole('checkbox', { name: '覆盖填充' }).check()
  await expect(stage.getByTestId('compose-material-svg').locator('rect').last())
    .toHaveAttribute('fill', '#ffffff')
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

test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', '组件库')

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await expect(editor.getByRole('button').filter({ hasText: /Frame|Rectangle|Text|ECharts/ }))
    .toHaveCount(4)
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-component'))
    .toHaveCount(1)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Frame' }), {
    x: stageBox!.x + stageBox!.width / 2,
    y: stageBox!.y + stageBox!.height / 2,
  })
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node.is-frame')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveCSS('background-color', 'rgb(248, 250, 252)')
  await editor.getByRole('button', { name: '适配 Frame' }).click()
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
  await expect(stage.locator('.compose-stage__node.is-component')).toHaveCount(3)

  const components = frame.locator(':scope > .compose-stage__node.is-component')
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
  const group = frame.locator(':scope > .compose-stage__node.is-frame')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-node-id')
  expect(groupId).not.toBeNull()
  const groupBackground = editor.getByRole('button', { name: '选择背景颜色', exact: true })
  await groupBackground.click()
  const colorPicker = page.getByRole('dialog', { name: '背景颜色', exact: true })
  await expect(colorPicker.getByRole('textbox')).toHaveCount(0)
  await colorPicker.getByLabel('背景色盘').press('ArrowRight')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await stage.press('Control+z')
  await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await stage.press('Control+Shift+z')
  await expect(group).toHaveCSS('background-color', 'rgb(0, 0, 0)')

  await stage.locator('.compose-stage__node.is-component').filter({
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
  await expect(log.getByRole('button', { name: /Create Frame/ })).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^属性 Update Text ·/ }),
  ).toBeVisible()
  await expect(log.getByRole('button', { name: /^属性 Update Frame ·/ })).toBeVisible()
  await expect(log.getByRole('button', { name: /Undo · Update Text/ })).toBeVisible()
  await expect(log.getByText(/Reject .* outside a Frame/)).toHaveCount(0)
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
  const previewGroup = preview.getByTestId(`compose-preview-node-${groupId}`)
  await expect(previewGroup).toBeVisible()
  await expect(previewGroup).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(previewRegion).toHaveScreenshot('document-preview.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await preview.getByRole('button', { name: '选中 Frame' }).click()
  await expect(preview.getByTestId('compose-preview-frame')).toBeVisible()
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
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  const frameBox = await stage.getByTestId('stage-frame').boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 ECharts Chart' }), {
    x: frameBox!.x + 320,
    y: frameBox!.y + 240,
  })

  const chart = stage.getByRole('img', { name: 'Quarterly data' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()
})

test('OpenSpec: stage / 八向缩放 / resize 手柄在预览阶段跟随鼠标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()
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
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-component')
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

test('OpenSpec: stage / Pointer 手势原子性与取消 / 高速 move 与 resize 松手后不回弹', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const historyEntries = editor.locator('[data-compose-ui="history"] li')
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()
  const frame = stage.getByTestId('stage-frame')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.35,
    y: frameBox!.y + frameBox!.height * 0.4,
  })
  const rectangle = stage.locator('.compose-stage__node.is-component').filter({
    hasText: 'Rectangle',
  })
  await rectangle.click()
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()

  let expectedHistoryCount = await historyEntries.count()
  for (let round = 0; round < 20; round += 1) {
    const before = await rectangle.boundingBox()
    expect(before).not.toBeNull()
    const delta = round % 2 === 0 ? 24 : -24
    const start = {
      x: before!.x + before!.width / 2,
      y: before!.y + before!.height / 2,
    }
    await page.keyboard.down('Control')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + delta, start.y, { steps: 1 })
    await page.mouse.up()
    await page.keyboard.up('Control')
    expectedHistoryCount += 1

    await expect.poll(async () => {
      const after = await rectangle.boundingBox()
      return after
        ? Math.abs(after.x - before!.x - delta)
        : Number.POSITIVE_INFINITY
    }).toBeLessThanOrEqual(1.5)
    await expect(historyEntries).toHaveCount(expectedHistoryCount)
  }

  const latestFrameBox = await frame.boundingBox()
  expect(latestFrameBox).not.toBeNull()
  await page.mouse.click(latestFrameBox!.x + 8, latestFrameBox!.y + 8)
  const resize = stage.getByTestId('stage-resize-se')
  expectedHistoryCount = await historyEntries.count()
  for (let round = 0; round < 20; round += 1) {
    const before = await resize.boundingBox()
    expect(before).not.toBeNull()
    const delta = round % 2 === 0 ? 20 : -20
    const start = {
      x: before!.x + before!.width / 2,
      y: before!.y + before!.height / 2,
    }
    await page.keyboard.down('Control')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + delta, start.y + delta, { steps: 1 })
    await page.mouse.up()
    await page.keyboard.up('Control')
    expectedHistoryCount += 1

    await expect.poll(async () => {
      const after = await resize.boundingBox()
      return after
        ? Math.max(
            Math.abs(after.x + after.width / 2 - (start.x + delta)),
            Math.abs(after.y + after.height / 2 - (start.y + delta)),
          )
        : Number.POSITIVE_INFINITY
    }).toBeLessThanOrEqual(1.5)
    await expect(historyEntries).toHaveCount(expectedHistoryCount)
  }

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  const resizedFrameBox = await frame.boundingBox()
  expect(resizedFrameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: resizedFrameBox!.x + resizedFrameBox!.width * 0.65,
    y: resizedFrameBox!.y + resizedFrameBox!.height * 0.55,
  })
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  const rectangles = stage.locator('.compose-stage__node.is-component').filter({
    hasText: 'Rectangle',
  })
  await rectangles.nth(0).click()
  await rectangles.nth(1).click({ modifiers: ['Shift'] })
  expectedHistoryCount = await historyEntries.count()
  for (let round = 0; round < 6; round += 1) {
    const firstBefore = await rectangles.nth(0).boundingBox()
    const secondBefore = await rectangles.nth(1).boundingBox()
    expect(firstBefore).not.toBeNull()
    expect(secondBefore).not.toBeNull()
    const delta = round % 2 === 0 ? 18 : -18
    const start = {
      x: firstBefore!.x + firstBefore!.width / 2,
      y: firstBefore!.y + firstBefore!.height / 2,
    }
    await page.keyboard.down('Control')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + delta, start.y, { steps: 1 })
    await page.mouse.up()
    await page.keyboard.up('Control')
    expectedHistoryCount += 1

    await expect.poll(async () => {
      const firstAfter = await rectangles.nth(0).boundingBox()
      const secondAfter = await rectangles.nth(1).boundingBox()
      return firstAfter && secondAfter
        ? Math.max(
            Math.abs(firstAfter.x - firstBefore!.x - delta),
            Math.abs(secondAfter.x - secondBefore!.x - delta),
          )
        : Number.POSITIVE_INFINITY
    }).toBeLessThanOrEqual(1.5)
    await expect(historyEntries).toHaveCount(expectedHistoryCount)
  }
})

test('OpenSpec: stage / 组合 Frame 直接操纵 / 舞台可拖动组合 Frame 且子节点保持可命中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()
  const frame = stage.locator('.compose-stage__scene > .compose-stage__node.is-frame')
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

  const components = stage.locator('.compose-stage__node.is-component')
  await components.nth(0).click()
  await components.nth(1).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = frame.locator(':scope > .compose-stage__node.is-frame')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-node-id')
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
      ?.closest('[data-node-id]')
      ?.getAttribute('data-node-id'),
    point,
  )
  expect(await nodeAt(gapPoint)).toBe(groupId)

  const groupBefore = await group.boundingBox()
  expect(groupBefore).not.toBeNull()
  await page.keyboard.down('Control')
  await page.mouse.move(gapPoint.x, gapPoint.y)
  await page.mouse.down()
  await page.mouse.move(gapPoint.x + 80, gapPoint.y + 40, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect.poll(async () => {
    const box = await group.boundingBox()
    return box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
    }
  }).toEqual({
    x: Math.round(groupBefore!.x + 80),
    y: Math.round(groupBefore!.y + 40),
  })

  const child = components.nth(0)
  const childBefore = await child.boundingBox()
  expect(childBefore).not.toBeNull()
  const childPoint = {
    x: childBefore!.x + childBefore!.width / 2,
    y: childBefore!.y + childBefore!.height / 2,
  }
  expect(await nodeAt(childPoint)).toBe(await child.getAttribute('data-node-id'))
  await page.keyboard.down('Control')
  await page.mouse.move(childPoint.x, childPoint.y)
  await page.mouse.down()
  await page.mouse.move(childPoint.x + 40, childPoint.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect.poll(async () => {
    const box = await child.boundingBox()
    return box
      ? Math.max(
          Math.abs(box.x - (childBefore!.x + 40)),
          Math.abs(box.y - (childBefore!.y + 20)),
        )
      : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(1)
})

test('OpenSpec: stage / 网格标尺辅助线与滚动导航 / 完成 Godot 风格纵向流程', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()

  await editor.getByRole('button', { name: '智能吸附' }).click()
  await editor.getByRole('button', { name: '画布设置' }).click()
  const settings = editor.getByRole('dialog', { name: '画布网格与吸附设置' })
  await settings.getByRole('textbox', { name: 'X 步长' }).fill('16')
  await settings.getByRole('textbox', { name: 'Y 步长' }).fill('16')
  await settings.getByRole('button', { name: '应用' }).click()
  await expect(editor.getByRole('button', { name: '智能吸附' }))
    .toHaveAttribute('aria-pressed', 'false')

  const frame = stage.getByTestId('stage-frame')
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + frameBox!.width * 0.3,
    y: frameBox!.y + frameBox!.height * 0.35,
  })
  const rectangle = stage.locator('.compose-stage__node.is-component').filter({
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
  const settingsDialog = editor.getByRole('dialog', { name: '设置' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog.getByRole('searchbox', { name: '搜索设置' })).toBeFocused()
  await expect(editor.locator('.compose-editor__workspace')).toHaveAttribute('inert', '')
  await expect(editor).toHaveScreenshot('editor-preferences-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('radio', { name: '浅色' }).click()
  await expect(editor).toHaveAttribute('data-compose-theme', 'light')
  await editor.getByRole('button', { name: '关闭设置' }).click()
  await expect(settingsButton).toBeFocused()
  await expect(editor).toHaveScreenshot('editor-workspace-light.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: '设置', exact: true }).click()
  await editor.getByRole('button', { name: '语言', exact: true }).click()
  await editor.getByRole('radio', { name: 'English' }).click()
  await expect(editor).toHaveAttribute('lang', 'en-US')
  await expect(editor.getByRole('button', { name: 'Canvas settings' })).toBeVisible()
  await editor.getByRole('button', { name: 'Close settings' }).click()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', 'Component Library')
  await expect(editor).toHaveScreenshot('editor-workspace-english.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: 'Settings', exact: true }).click()
  await editor.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  const temporaryPanBinding = editor.getByRole('button', {
    name: 'Change Temporary pan shortcut',
  })
  await temporaryPanBinding.click()
  await page.keyboard.press('p')
  await expect(temporaryPanBinding).toHaveText('P')
  await editor.getByRole('button', { name: 'Close settings' }).click()

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
  await expect(editor.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await editor.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click()
  await editor.getByRole('button', {
    name: 'Restore default Temporary pan shortcut',
  }).click()
  await expect(editor.getByRole('button', {
    name: 'Change Temporary pan shortcut',
  })).toHaveText('Space')
  await editor.getByRole('button', { name: 'Close settings' }).click()

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
    overriddenEditor.getByRole('dialog', { name: '偏好设置' }),
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
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-component'))
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

  await editor.getByRole('button', { name: '创建 Frame' }).click()
  const frameBox = await stage.getByTestId('stage-frame').boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + 160,
    y: frameBox!.y + 180,
  })
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Text' }), {
    x: frameBox!.x + 480,
    y: frameBox!.y + 180,
  })
  const frame = stage.getByTestId('stage-frame')
  const frameComponents = frame.locator(':scope > .compose-stage__node.is-component')
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
  await expect(stage.locator('.compose-stage__node.is-frame .compose-stage__node.is-frame'))
    .toHaveCount(1)
  await expect(editor).toHaveScreenshot('stage-workspace-nested-frame.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.press('Control+Shift+g')

  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  await editor.getByRole('row', { name: /Frame/ })
    .getByRole('button', { name: '展开节点' })
    .click()
  await editor.getByRole('row', { name: /Rectangle/ }).last().click()
  const rectangle = frame.locator(':scope > .compose-stage__node.is-component').filter({
    hasText: 'Rectangle',
  })
  const rectangleBox = await rectangle.boundingBox()
  expect(rectangleBox).not.toBeNull()
  await expect(editor.getByRole('region', { name: 'Rectangle 属性' })).toBeVisible()
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
