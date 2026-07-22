import { expect, test } from '@playwright/test'

test('mounts ComposeEditor as the full-screen demo', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)

  const editorBox = await editor.boundingBox()
  const viewport = page.viewportSize()
  expect(editorBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(editorBox!.x).toBe(0)
  expect(editorBox!.y).toBe(0)
  expect(editorBox!.width).toBe(viewport!.width)
  expect(editorBox!.height).toBe(viewport!.height)

  await expect(
    editor.locator('[data-workspace-tab="compose-scene-graph"]'),
  ).toHaveAttribute('title', 'Scene Graph')
  await expect(editor.getByText('Canvas', { exact: true })).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-inspector"]'),
  ).toHaveAttribute('title', 'Component')
  await expect(editor.getByRole('img', { name: '设置' })).toBeVisible()
  await expect(editor.getByText('日志', { exact: true })).toBeVisible()
  await expect(editor.getByText('命令', { exact: true })).toBeVisible()
})

test('uses fixed edge groups around the central canvas', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const right = page.getByTestId('dv-edge-group-compose-inspector-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const canvas = page.locator('[data-workspace-panel="canvas"]')
  const scenePanel = page.locator('[data-workspace-panel="scene-graph"]')

  await expect(left).toHaveClass(/dv-edge-group/)
  await expect(right).toHaveClass(/dv-edge-group/)
  await expect(bottom).toHaveClass(/dv-edge-group/)
  expect(
    await scenePanel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    })),
  ).toEqual(
    expect.objectContaining({
      overflowY: 'hidden',
    }),
  )
  expect(
    await scenePanel.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true)

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

  const sceneTabBox = await left
    .locator('[data-workspace-tab="compose-scene-graph"]')
    .boundingBox()
  const settingsBox = await left.getByLabel('设置').boundingBox()
  expect(sceneTabBox).not.toBeNull()
  expect(settingsBox).not.toBeNull()
  expect(settingsBox!.y).toBeGreaterThan(sceneTabBox!.y)
})

test('resizes and collapses edge groups without losing content', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const initialLeftBox = await left.boundingBox()
  const initialBottomBox = await bottom.boundingBox()

  expect(initialLeftBox).not.toBeNull()
  expect(initialBottomBox).not.toBeNull()

  await page.mouse.move(
    initialLeftBox!.x + initialLeftBox!.width,
    initialLeftBox!.y + initialLeftBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    initialLeftBox!.x + initialLeftBox!.width + 60,
    initialLeftBox!.y + initialLeftBox!.height / 2,
  )
  await page.mouse.up()

  await expect.poll(async () => (await left.boundingBox())?.width).toBeGreaterThan(
    initialLeftBox!.width + 40,
  )
  await expect(left.getByText('Page 1', { exact: true })).toBeVisible()

  const sceneTab = left.locator('[data-workspace-tab="compose-scene-graph"]')
  await sceneTab.click()
  await expect.poll(async () => (await left.boundingBox())?.width).toBeLessThan(60)

  await sceneTab.click()
  await expect.poll(async () => (await left.boundingBox())?.width).toBeGreaterThan(
    initialLeftBox!.width + 40,
  )

  await bottom.getByText('日志', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeLessThan(60)

  await bottom.getByText('日志', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeGreaterThan(
    initialBottomBox!.height - 10,
  )
  await expect(bottom.getByRole('region', { name: '操作日志' })).toBeVisible()
})

test('adds and edits a text component inside the editor', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })

  await editor.getByRole('button', { name: '添加文本组件' }).click()

  const textNode = editor
    .getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
  await expect(textNode).toBeVisible()

  await textNode.click()
  await editor.getByLabel('文本内容', { exact: true }).fill('客户现场大屏')

  await expect(
    editor
      .getByRole('region', { name: '编辑画布' })
      .getByRole('button', { name: '客户现场大屏' }),
  ).toBeVisible()
  await expect(editor.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /修改 文本内容/ })).toBeVisible()
})

test('OpenSpec: operation-log / 示例成功提交集成 / 记录编辑器纵向操作并在刷新后恢复', async ({ page }) => {
  await page.goto('/?workspace=operation-log-e2e')

  const log = page.getByRole('region', { name: '操作日志' })
  await expect(log).toBeVisible()
  await expect(log.getByText('暂无操作日志')).toBeVisible()

  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
    .click()
  const input = page.getByLabel('文本内容', { exact: true })
  await input.fill('审计')
  await input.fill('审计日志')

  await expect(log.getByRole('button', { name: /新增文本组件/ })).toBeVisible()
  const propertyEntry = log.getByRole('button', { name: /修改 文本内容/ })
  await expect(propertyEntry).toBeVisible()
  await expect(propertyEntry.getByText('×2')).toBeVisible()
  await propertyEntry.click()
  await expect(log.getByRole('region', { name: '日志详情' })).toContainText('审计日志')

  const entryCount = await log.getByRole('button', { name: /新增文本组件|修改 文本内容/ }).count()
  await page.getByRole('button', { name: '审计日志', exact: true }).click()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(log.getByRole('button', { name: /新增文本组件|修改 文本内容/ })).toHaveCount(entryCount)

  await page.reload()
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /修改 文本内容/ })).toBeVisible()

  await page.goto('/?workspace=operation-log-isolated')
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByText('暂无操作日志')).toBeVisible()
})

test('OpenSpec: operation-log / 示例成功提交集成 / 记录 reset 和绑定并忽略无效草稿与 UI 操作', async ({ page }) => {
  await page.goto('/?workspace=operation-log-actions')
  const log = page.getByRole('region', { name: '操作日志' })
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })

  const invalidOpacity = panel.getByLabel('不透明度 Opacity', { exact: true })
  await invalidOpacity.fill('2')
  await invalidOpacity.blur()
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect(log.locator('.operation-log__entry')).toHaveCount(0)

  await panel.getByRole('button', { name: 'Advanced', exact: true }).click()
  await panel.getByRole('separator', { name: '调整属性名列宽' }).press('ArrowRight')
  await expect(log.locator('.operation-log__entry')).toHaveCount(0)

  const angle = panel.getByLabel('旋转 Angle', { exact: true })
  await angle.fill('5')
  await angle.blur()
  await panel.getByRole('button', { name: '重置 Transform', exact: true }).click()
  await expect(log.getByRole('button', { name: /修改 旋转/ })).toBeVisible()
  await expect(log.getByRole('button', { name: /重置 Transform/ })).toBeVisible()

  const position = panel.locator('[data-property-path="transform.position"]')
  await position.getByRole('button', { name: '绑定 X' }).click()
  await page.getByRole('button', { name: /页面偏移 X/ }).click()
  await expect(log.getByRole('button', { name: /绑定 位置/ })).toBeVisible()
})

test('OpenSpec: operation-log / 可访问日志查看面板 / 搜索和筛选日志 - 紧凑视觉', async ({ page }) => {
  await page.goto('/?workspace=operation-log-visual')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('button', { name: '默认文本', exact: true }).click()
  await page.getByLabel('文本内容', { exact: true }).fill('日志视觉示例')

  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  await expect(bottom.getByRole('region', { name: '操作日志' })).toBeVisible()
  await expect(bottom).toHaveScreenshot('operation-log-panel.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: property-panel / 独立受控属性面板 / 宿主挂载属性面板 - 示例文本', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
    .click()

  const panel = page.locator('[data-compose-ui="property-panel"]')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('searchbox', { name: '搜索属性' })).toBeVisible()
  await panel.getByLabel('文本内容', { exact: true }).fill('Schema 驱动文本')
  await expect(page.getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: 'Schema 驱动文本', exact: true })).toBeVisible()
})

test('OpenSpec: property-panel / ECharts 自定义类型示例 / 编辑 ECharts 配置', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加 ECharts 图表' }).click()

  const panel = page.locator('[data-compose-ui="property-panel"]')
  await expect(panel.getByLabel('图表标题', { exact: true })).toHaveValue('季度销售额')
  await panel.getByLabel('图表标题', { exact: true }).fill('区域营收')
  await panel.getByLabel('系列数据', { exact: true }).fill('18, 32, 27, 41')

  const chart = page.getByRole('img', { name: '区域营收 ECharts 图表' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toHaveCount(1)

  await panel.getByLabel('系列数据', { exact: true }).fill('18, 无效')
  await expect(panel.getByRole('alert')).toContainText('请输入逗号分隔的数字')
  await expect(chart).toBeVisible()
})

test('OpenSpec: property-panel / 双分隔线三列布局 / 键盘调整分隔线 - 示例应用', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
    .click()
  const labelSeparator = page.getByRole('separator', { name: '调整属性名列宽' })
  const actionSeparator = page.getByRole('separator', { name: '调整操作列宽' })

  await labelSeparator.focus()
  await labelSeparator.press('ArrowRight')
  await actionSeparator.focus()
  await actionSeparator.press('Shift+ArrowLeft')

  await expect(labelSeparator).toHaveAttribute('aria-valuenow', '168')
  await expect.poll(async () => Number(await actionSeparator.getAttribute('aria-valuenow')))
    .toBeGreaterThan(36)
  expect(Number(await actionSeparator.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(
    Number(await actionSeparator.getAttribute('aria-valuemax')),
  )
})

test('OpenSpec: property-panel / 嵌套与集合属性编辑 / 修改数组和元组 - 示例数组', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('button', { name: '默认文本', exact: true }).click()

  await page.getByRole('button', { name: '添加 关键词' }).click()
  await page.getByRole('textbox', { name: '关键词 3' }).fill('可视化')
  await expect(page.getByRole('textbox', { name: '关键词 3' })).toHaveValue('可视化')
})

test('OpenSpec: property-panel / 自适应属性操作轨道 / 窄列溢出并随列宽展开', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  await page.getByRole('button', { name: '默认文本', exact: true }).click()
  const panel = page.getByRole('region', { name: '文本组件属性' })

  await expect(panel.getByRole('button', { name: '更多 关键词 1 操作' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '删除 关键词 1' })).toHaveCount(0)
  const separator = panel.getByRole('separator', { name: '调整操作列宽' })
  await separator.focus()
  await separator.press('Shift+ArrowLeft')

  await expect(panel.getByRole('button', { name: '删除 关键词 1' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '更多 关键词 1 操作' })).toBeVisible()
})

test('OpenSpec: property-panel / 属性面板视觉与样式隔离 / 宿主加载属性面板样式', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: '添加矩形组件' }).click()
  const panel = page.locator('[data-compose-ui="property-panel"]')
  const inspector = page.locator('.inspector-panel')
  const inspectorEdge = page.getByTestId('dv-edge-group-compose-inspector-edge')
  await expect(panel.getByText('Rectangle', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Transform' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Appearance' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '属性层级 Property Demo' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Layout' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'State' })).toBeVisible()
  await expect.poll(async () => Math.round((await inspectorEdge.boundingBox())?.width ?? 0)).toBe(400)
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(365)
  await expect(panel.getByRole('separator', { name: '调整属性名列宽' }))
    .toHaveAttribute('aria-valuenow', '160')
  await expect(panel.getByRole('separator', { name: '调整操作列宽' }))
    .toHaveAttribute('aria-valuenow', '36')
  const labelSeparator = panel.getByRole('separator', { name: '调整属性名列宽' })
  const resizeHandle = labelSeparator.locator('.property-panel__resize-handle')
  await expect(resizeHandle).toHaveCSS('opacity', '0')
  await labelSeparator.hover()
  await expect(resizeHandle).toHaveCSS('opacity', '1')
  await expect(panel).toHaveCSS('font-size', '12px')
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__header').boundingBox())?.height ?? 0)).toBe(52)
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__toolbar').boundingBox())?.height ?? 0)).toBe(36)
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__group-header').first().boundingBox())?.height ?? 0)).toBe(28)
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__group .property-panel__group .property-panel__group-header').first().boundingBox())?.height ?? 0)).toBe(26)
  const appearanceButton = panel.getByRole('button', { name: 'Appearance', exact: true })
  const appearanceHeader = appearanceButton.locator('..')
  const appearanceGroup = appearanceHeader.locator('..')
  await expect(appearanceHeader).toHaveCSS('background-image', 'none')
  await expect(appearanceHeader).toHaveCSS('background-color', 'rgb(42, 42, 42)')
  await expect(appearanceGroup).toHaveCSS('box-shadow', 'none')
  await expect(appearanceGroup).toHaveCSS('border-bottom-width', '0px')
  await expect(appearanceButton.locator('svg path')).toHaveAttribute('fill', 'currentColor')
  await expect(appearanceButton.locator('svg path')).toHaveAttribute('stroke', 'none')

  const nestedHeader = panel.getByRole('button', { name: '边框 Border', exact: true }).locator('..')
  await expect(nestedHeader).toHaveCSS('background-image', 'none')
  await expect(nestedHeader).toHaveCSS('background-color', 'rgb(27, 28, 28)')

  const advancedButton = panel.getByRole('button', { name: 'Advanced', exact: true })
  const advancedHeader = advancedButton.locator('..')
  const collapsedBackground = await advancedHeader.evaluate((element) => getComputedStyle(element).backgroundColor)
  await advancedButton.click()
  await expect(advancedHeader).toHaveCSS('background-color', collapsedBackground)
  await advancedButton.click()
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__field').first().boundingBox())?.height ?? 0)).toBe(26)
  const opacityInput = panel.locator('[data-property-path="appearance.opacity"] input')
  await expect.poll(async () => Math.round((await opacityInput.boundingBox())?.height ?? 0)).toBe(22)
  await expect.poll(async () => Math.round((await panel.getByRole('checkbox', { name: '交互状态 Is Enabled' }).boundingBox())?.height ?? 0)).toBe(16)
  await opacityInput.fill('0.5')
  await opacityInput.blur()
  const opacityReset = panel.getByRole('button', { name: '重置 不透明度 Opacity' })
  await expect.poll(async () => Math.round((await opacityReset.boundingBox())?.height ?? 0)).toBe(22)
  await opacityReset.click()
  await opacityInput.fill('1.0')
  await opacityInput.blur()
  await expect(opacityInput).toHaveValue('1.0')
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__control').first().boundingBox())?.width ?? 0)).toBeLessThanOrEqual(234)
  const topEditorX = await panel.locator('[data-property-path="appearance.opacity"] .property-panel__editor').boundingBox()
  const deepEditorX = await panel.locator('[data-property-path="propertyDemo.border.stroke.width"] .property-panel__editor').boundingBox()
  expect(Math.round(deepEditorX?.x ?? 0)).toBe(Math.round(topEditorX?.x ?? 0))
  const deepFieldLocator = panel.locator('[data-property-path="propertyDemo.border.stroke.width"]')
  const deepLabelLocator = deepFieldLocator.locator('.property-panel__label')
  const deepLabel = await deepLabelLocator.boundingBox()
  const deepLabelPadding = await deepLabelLocator.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).paddingLeft)
  ))
  const panelBox = await panel.boundingBox()
  expect(Math.round((deepLabel?.x ?? 0) - (panelBox?.x ?? 0) + deepLabelPadding)).toBeLessThanOrEqual(90)
  const treeLineGeometry = await deepFieldLocator.evaluate((field) => {
    const branch = getComputedStyle(field, '::before')
    const parentGroup = field.closest('.property-panel__group')
    const groupContent = parentGroup?.querySelector(':scope > .property-panel__group-content')
    const guide = groupContent ? getComputedStyle(groupContent, '::before') : null
    return {
      branchLeft: Number.parseFloat(branch.left),
      branchWidth: Number.parseFloat(branch.width),
      fieldIndent: Number.parseFloat(getComputedStyle(
        field.querySelector('.property-panel__label') ?? field,
      ).paddingLeft),
      guideLeft: guide ? Number.parseFloat(guide.left) : Number.NaN,
    }
  })
  expect(treeLineGeometry.branchLeft).toBe(treeLineGeometry.guideLeft)
  expect(treeLineGeometry.branchLeft + treeLineGeometry.branchWidth + 4)
    .toBe(treeLineGeometry.fieldIndent)
  expect(treeLineGeometry.branchLeft).toBe(44)

  const appearance = panel.locator('[data-property-path="appearance.opacity"]')
  const bindingSlot = appearance.locator('.property-panel__binding-slot')
  await expect(bindingSlot).toHaveCSS('opacity', '1')
  await expect.poll(async () => Math.round((await bindingSlot.boundingBox())?.width ?? 0)).toBe(36)
  await expect.poll(async () => Math.round((await appearance.locator('.property-panel__binding-trigger').boundingBox())?.height ?? 0)).toBe(20)
  await expect.poll(async () => appearance.evaluate((element) => ({
    compactSlot: getComputedStyle(element).getPropertyValue('--pp-binding-slot-compact-width').trim(),
    slot: getComputedStyle(element).getPropertyValue('--pp-binding-slot-width').trim(),
  }))).toEqual({ compactSlot: '20px', slot: '36px' })

  await panel.evaluate((element) => element.style.setProperty('--pp-row-height', '30px'))
  await expect.poll(async () => Math.round((await panel.locator('.property-panel__field').first().boundingBox())?.height ?? 0)).toBe(30)
  await panel.evaluate((element) => element.style.removeProperty('--pp-row-height'))
  await panel.evaluate((element) => element.style.setProperty('--pp-tree-indent', '10px'))
  const overriddenTreeIndent = await deepLabelLocator.evaluate((label) => ({
    fieldIndent: getComputedStyle(label).getPropertyValue('--pp-field-indent'),
    treeStep: getComputedStyle(label).getPropertyValue('--pp-tree-indent'),
  }))
  expect(overriddenTreeIndent.treeStep.trim()).toBe('10px')
  expect(overriddenTreeIndent.fieldIndent).toContain('10px')
  await panel.evaluate((element) => element.style.removeProperty('--pp-tree-indent'))
  await page.mouse.move(800, 400)
  await expect(inspector).toHaveScreenshot('property-panel-default.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  // 元素级截图会调整滚动容器；重新挂载保证 resize 基线从顶部开始。
  await page.reload()
  await page.getByRole('button', { name: '添加矩形组件' }).click()
  await expect(panel.getByText('Rectangle', { exact: true })).toBeVisible()
  await panel.getByRole('separator', { name: '调整属性名列宽' }).dispatchEvent('keydown', {
    key: 'ArrowRight',
    shiftKey: true,
  })
  await panel.getByRole('separator', { name: '调整操作列宽' }).dispatchEvent('keydown', {
    key: 'ArrowLeft',
  })
  await panel.evaluate((element) => {
    element.scrollTop = 0
    element.style.overflow = 'hidden'
  })
  await inspector.evaluate((element) => {
    element.scrollTop = 0
    element.style.overflow = 'hidden'
  })
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0)
  await page.mouse.move(800, 400)
  await expect(inspector).toHaveScreenshot('property-panel-resized.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: property-panel / 默认节点类型覆盖 / 展开默认节点的完整类型展厅', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })

  await expect(panel.getByText('Rectangle', { exact: true })).toBeVisible()

  const supportedTypes = panel.getByRole('button', {
    name: '支持类型 Supported Types',
    exact: true,
  })
  await expect(supportedTypes).toHaveAttribute('aria-expanded', 'false')
  await supportedTypes.click()

  for (const groupName of [
    '基础类型 Primitives',
    '存在性包装 Presence',
    '集合结构 Collections',
    '联合结构 Unions',
    '自定义类型 Custom',
  ]) {
    await expect(panel.getByRole('button', { name: groupName, exact: true })).toBeVisible()
  }

  await panel.getByRole('button', { name: '基础类型 Primitives', exact: true }).click()
  await expect(panel.getByLabel('字符串 String', { exact: true })).toHaveAttribute('type', 'text')
  await expect(panel.getByLabel('数字 Number', { exact: true })).toHaveAttribute('type', 'number')
  await expect(panel.getByLabel('大整数 BigInt', { exact: true })).toHaveAttribute('type', 'number')
  await expect(panel.getByLabel('日期 Date', { exact: true })).toHaveAttribute('type', 'date')
  await expect(panel.getByLabel('选择 Picklist', { exact: true })).toHaveRole('combobox')
  await expect(panel.getByLabel('枚举 Enum', { exact: true })).toHaveRole('combobox')
  await expect(panel.getByLabel('固定值 Literal', { exact: true })).toHaveText('rectangle')

  await panel.getByRole('button', { name: '存在性包装 Presence', exact: true }).click()
  await expect(panel.getByRole('checkbox', { name: '可选文本 Optional 存在' })).toBeVisible()
  await expect(panel.getByRole('checkbox', { name: '可空文本 Nullable 存在' })).toBeVisible()
  await expect(panel.getByRole('checkbox', { name: '空值文本 Nullish 存在' })).toBeVisible()

  await panel.getByRole('button', { name: '集合结构 Collections', exact: true }).click()
  await expect(panel.getByRole('button', { name: '列表 Array', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: '元组 Tuple', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: '可变元组 Tuple Rest', exact: true })).toBeVisible()
  const recordButton = panel.getByRole('button', { name: '记录 Record', exact: true })
  await expect(recordButton).toBeVisible()
  await recordButton.click()
  const recordKey = panel.getByRole('textbox', { name: '记录 Record 键 1' })
  await expect(recordKey).toBeVisible()
  await expect(recordKey).toHaveCSS('position', 'relative')
  await expect(recordKey).toHaveCSS('z-index', '2')
  const recordStacking = await recordKey.evaluate((input) => {
    const group = input.closest('.property-panel__group')
    const content = group?.querySelector(':scope > .property-panel__group-content')
    return {
      guideZIndex: content ? Number.parseFloat(getComputedStyle(content, '::before').zIndex) : Number.NaN,
      inputZIndex: Number.parseFloat(getComputedStyle(input).zIndex),
      pointerEvents: getComputedStyle(input).pointerEvents,
    }
  })
  expect(recordStacking.inputZIndex).toBeGreaterThan(recordStacking.guideZIndex)
  expect(recordStacking.pointerEvents).not.toBe('none')
  await expect(recordKey.locator('..')).toHaveScreenshot('property-panel-record-lines.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })

  await panel.getByRole('button', { name: '联合结构 Unions', exact: true }).click()
  await expect(panel.getByRole('button', { name: '联合 Union', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: '变体 Variant', exact: true })).toBeVisible()

  await panel.getByRole('button', { name: '自定义类型 Custom', exact: true }).click()
  await expect(panel.getByLabel('图表标题', { exact: true })).toBeVisible()
  const customField = panel.locator(
    '[data-property-path="supportedTypes.custom.chartOption"][data-property-layout="full-width"]',
  )
  await expect(customField.getByRole('group', { name: '图表配置 EChartsOption' })).toBeVisible()
  const customTreeGeometry = await customField.evaluate((field) => {
    const branch = getComputedStyle(field, '::before')
    const parentGroup = field.closest('.property-panel__group')
    const groupContent = parentGroup?.querySelector(':scope > .property-panel__group-content')
    const guide = groupContent ? getComputedStyle(groupContent, '::before') : null
    return {
      branchLeft: Number.parseFloat(branch.left),
      branchTop: Number.parseFloat(branch.top),
      guideLeft: guide ? Number.parseFloat(guide.left) : Number.NaN,
    }
  })
  expect(customTreeGeometry.branchLeft).toBe(customTreeGeometry.guideLeft)
  expect(customTreeGeometry.branchTop).toBe(13)
})

test('OpenSpec: property-panel / 属性面板视觉与样式隔离 / 显示 UE4 参考控件细节', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })

  await expect(panel.locator('[data-property-path="transform.position"]').getByLabel('X', { exact: true }))
    .toHaveValue('0.0')
  await expect(panel.locator('[data-property-path="transform.size"]').getByLabel('W', { exact: true }))
    .toHaveValue('100.0')
  await expect(panel.getByLabel('旋转 Angle', { exact: true })).toHaveValue('0.0')
  await expect(panel.locator('[data-property-path="appearance.opacity"] input'))
    .toHaveValue('1.0')
  await expect(panel.locator('[data-property-path="appearance.cornerRadius"] input'))
    .toHaveValue('4.0')
  await expect(panel.locator('[data-property-path="propertyDemo.border.stroke.width"]'))
    .toContainText('px')

  const enabled = panel.getByRole('checkbox', { name: '交互状态 Is Enabled' })
  await expect(enabled).toHaveCSS('appearance', 'none')
  await expect(enabled).toHaveCSS('background-image', /svg/)
  await expect(panel.locator('.visibility-property-editor svg').first()).toBeVisible()
  await expect(panel.locator(
    '.alignment-property-editor > button:not(.property-panel__binding-trigger) svg',
  )).toHaveCount(8)
  await expect.poll(async () => Math.round(
    (await panel.locator('.color-property-editor input[type="color"]').first().boundingBox())?.width ?? 0,
  )).toBe(22)
  await expect.poll(async () => Math.round(
    (await panel.locator('.compound-number-editor label').first().boundingBox())?.height ?? 0,
  )).toBe(22)
  await expect.poll(async () => Math.round(
    (await panel.locator('.scalar-number-editor').first().boundingBox())?.height ?? 0,
  )).toBe(22)
  await expect.poll(async () => Math.round(
    (await panel.locator('.alignment-property-editor').first().boundingBox())?.height ?? 0,
  )).toBe(22)
  await expect.poll(async () => Math.round(
    (await panel.locator('.visibility-property-editor').first().boundingBox())?.height ?? 0,
  )).toBe(22)

  await expect(panel.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'false')
  await expect(panel.getByRole('button', { name: 'Diagnostics' })).toHaveAttribute('aria-expanded', 'false')
  await expect(panel.getByRole('button', { name: '支持类型 Supported Types' }))
    .toHaveAttribute('aria-expanded', 'false')

  const opacity = panel.locator('[data-property-path="appearance.opacity"] input')
  await opacity.fill('2.0')
  await opacity.blur()
  await expect(opacity).toHaveValue('2.0')
  await expect(panel.getByRole('alert')).toContainText('完整属性值不符合 Schema')
})

test('OpenSpec: property-panel / 搜索筛选与默认值重置 / 外部重置清除数值 renderer 草稿', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })
  const angle = panel.getByLabel('旋转 Angle', { exact: true })
  const scale = panel.locator('[data-property-path="transform.scale"]')
  const scaleX = scale.getByLabel('X', { exact: true })
  const scaleY = scale.getByLabel('Y', { exact: true })

  await angle.fill('5')
  await angle.blur()
  await scaleX.fill('222')
  await scaleX.blur()
  await scaleY.fill('333')
  await scaleY.blur()
  await expect(angle).toHaveValue('5.0')
  await expect(scaleX).toHaveValue('222.0')
  await expect(scaleY).toHaveValue('333.0')

  await panel.getByRole('button', { name: '重置 Transform', exact: true }).click()

  await expect(angle).toHaveValue('0.0')
  await expect(scaleX).toHaveValue('1.0')
  await expect(scaleY).toHaveValue('1.0')
})

test('OpenSpec: property-panel / 受控属性变量绑定 / Rectangle 逻辑输入绑定到页面变量', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })
  const canvasRectangle = page.getByRole('button', { name: '选择 Rectangle' })
  const position = panel.locator('[data-property-path="transform.position"]')
  const xTarget = position.locator('.property-panel__binding-target').first()
  const xSlot = xTarget.locator('.property-panel__binding-slot')
  const xInput = position.getByLabel('X', { exact: true })
  const initialXInputBox = await xInput.boundingBox()

  await expect(xSlot).toHaveCSS('opacity', '1')
  await xSlot.getByRole('button', { name: '绑定 X' }).click()
  await page.getByRole('button', { name: /页面偏移 X/ }).click()

  await expect(xInput).toHaveValue('24.0')
  await expect(xInput).toHaveAttribute('readonly')
  await expect(xSlot).toHaveCSS('opacity', '1')
  await expect(xSlot.locator('.property-panel__binding-trigger > span')).toHaveCSS('display', 'none')
  const boundXInputBox = await xInput.boundingBox()
  const boundXTriggerBox = await xSlot.getByRole('button', { name: '更换绑定 X' }).boundingBox()
  expect(Math.round(boundXInputBox?.x ?? 0)).toBe(Math.round(initialXInputBox?.x ?? 0))
  expect(Math.round(boundXInputBox?.width ?? 0)).toBe(Math.round(initialXInputBox?.width ?? 0))
  expect((boundXInputBox?.x ?? 0) + (boundXInputBox?.width ?? 0))
    .toBeLessThanOrEqual((boundXTriggerBox?.x ?? 0) - 2)
  await expect(canvasRectangle).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 24, 0\)/)

  const opacity = panel.locator('[data-property-path="appearance.opacity"]')
  const opacityInput = opacity.getByLabel('不透明度 Opacity', { exact: true })
  const initialOpacityInputBox = await opacityInput.boundingBox()
  await opacity.getByRole('button', { name: '绑定 不透明度 Opacity' }).click()
  await page.getByRole('button', { name: /页面透明度/ }).click()
  await expect(opacityInput).toHaveValue('0.7')
  const opacityTrigger = opacity.getByRole('button', { name: '更换绑定 不透明度 Opacity' })
  await expect(opacityTrigger).toContainText('页面透明度')
  await expect(opacityTrigger.locator('span')).toHaveCSS('display', 'none')
  const boundOpacityInputBox = await opacityInput.boundingBox()
  const boundOpacityTriggerBox = await opacityTrigger.boundingBox()
  expect(Math.round(boundOpacityInputBox?.width ?? 0)).toBe(Math.round(initialOpacityInputBox?.width ?? 0))
  expect((boundOpacityInputBox?.x ?? 0) + (boundOpacityInputBox?.width ?? 0))
    .toBeLessThanOrEqual((boundOpacityTriggerBox?.x ?? 0) - 2)

  const color = panel.locator('[data-property-path="appearance.color"]')
  await color.getByRole('button', { name: '绑定 颜色 Color' }).click()
  await page.getByRole('button', { name: /页面强调色/ }).click()
  await expect(color.getByLabel('颜色值', { exact: true })).toHaveValue('#22C55E')
  await expect(canvasRectangle).toHaveCSS('background-color', 'rgb(34, 197, 94)')
  await expect(page.locator('.inspector-panel')).toHaveScreenshot('property-panel-bound.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: property-panel / 自定义 Renderer 子目标绑定 / ECharts 标题与数据独立绑定', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加 ECharts 图表' }).click()
  const panel = page.getByRole('region', { name: 'ECharts 图表属性' })
  const optionField = panel.locator('[data-property-path="chart.option"]')

  await optionField.hover()
  await panel.getByRole('button', { name: '绑定 图表标题' }).click()
  await page.getByRole('button', { name: /全局图表标题/ }).click()
  const titleInput = panel.getByLabel('图表标题', { exact: true })
  const titleTrigger = panel.getByRole('button', { name: '更换绑定 图表标题' })
  await expect(titleInput).toHaveValue('全局季度销售额')
  await expect(titleInput).toHaveAttribute('readonly')
  await expect(titleTrigger).toContainText('全局图表标题')
  const titleInputBox = await titleInput.boundingBox()
  const titleTriggerBox = await titleTrigger.boundingBox()
  expect((titleInputBox?.x ?? 0) + (titleInputBox?.width ?? 0))
    .toBeLessThanOrEqual((titleTriggerBox?.x ?? 0) - 2)
  await expect(page.getByRole('img', { name: '全局季度销售额 ECharts 图表' })).toBeVisible()

  await optionField.hover()
  await panel.getByRole('button', { name: '绑定 系列数据' }).click()
  await page.getByRole('button', { name: /全局图表数据/ }).click()
  await expect(panel.getByLabel('系列数据', { exact: true })).toHaveValue('18, 30, 22, 42')
  await expect(panel.getByLabel('系列数据', { exact: true })).toHaveAttribute('readonly')
})

test('OpenSpec: property-panel / 受控属性变量绑定 / 默认变量选择器视觉', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Rectangle 属性' })
  const inspector = page.locator('.inspector-panel')
  const color = panel.locator('[data-property-path="appearance.color"]')
  await color.hover()
  await color.getByRole('button', { name: '绑定 颜色 Color' }).click()
  await expect(page.getByRole('dialog', { name: '绑定 颜色 Color' })).toBeVisible()
  await expect(inspector).toHaveScreenshot('property-panel-binding-picker.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('OpenSpec: property-panel / ECharts 自定义类型示例 / 选择 ECharts 图表组件', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加 ECharts 图表' }).click()
  const panel = page.locator('[data-compose-ui="property-panel"]')
  const fullWidthField = panel.locator(
    '[data-property-path="chart.option"][data-property-layout="full-width"]',
  )
  const rendererContent = fullWidthField.getByRole('group', { name: '图表配置' })
  await expect(rendererContent).toBeVisible()

  const panelBox = await panel.boundingBox()
  const rendererBox = await rendererContent.locator('.echart-option-editor').boundingBox()
  expect(panelBox).not.toBeNull()
  expect(rendererBox).not.toBeNull()
  expect(rendererBox!.x).toBeLessThan(panelBox!.x + 80)
  expect(rendererBox!.x + rendererBox!.width).toBeGreaterThan(panelBox!.x + panelBox!.width - 12)
  const rendererWidth = Math.round(rendererBox!.width)
  await expect.poll(async () => Math.round(
    (await rendererContent.locator('.echart-option-editor input').first().boundingBox())?.height ?? 0,
  )).toBe(22)
  await expect.poll(async () => Math.round(
    (await rendererContent.locator('.echart-editor-preview').boundingBox())?.height ?? 0,
  )).toBe(120)

  await panel.getByRole('separator', { name: '调整属性名列宽' }).dispatchEvent('keydown', {
    key: 'ArrowRight',
    shiftKey: true,
  })
  await panel.getByRole('separator', { name: '调整操作列宽' }).dispatchEvent('keydown', {
    key: 'ArrowLeft',
  })
  await expect.poll(async () => Math.round(
    (await rendererContent.locator('.echart-option-editor').boundingBox())?.width ?? 0,
  )).toBe(rendererWidth)
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  const fullWidthContentWinsHitTest = await panel.evaluate((element) => {
    const preview = element.querySelector('.echart-editor-preview')
    if (!preview) return false
    const panelRect = element.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()
    const labelWidth = Number.parseFloat(
      getComputedStyle(element).getPropertyValue('--pp-label-width'),
    )
    const hit = document.elementFromPoint(
      panelRect.left + labelWidth,
      previewRect.top + previewRect.height / 2,
    )
    return Boolean(hit?.closest('[data-property-renderer-content]'))
  })
  expect(fullWidthContentWinsHitTest).toBe(true)

  await page.getByLabel('图表类型', { exact: true }).selectOption('line')
  await page.mouse.move(800, 400)

  await expect(panel).toHaveScreenshot(
    'property-panel-echart-editor.png',
    { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
  )
  await expect(page.getByRole('img', { name: '季度销售额 ECharts 图表' })).toHaveScreenshot(
    'property-panel-echart-canvas.png',
    { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
  )
})

test('OpenSpec: property-panel / ECharts 自定义类型示例 / 选择 ECharts 图表组件 - 复制后仍受控', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加 ECharts 图表' }).click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const row = tree.getByRole('row', { name: /ECharts 图表/ })
  await row.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '复制' }).click()
  await row.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '粘贴为兄弟节点' }).click()

  await expect(page.getByRole('img', { name: '季度销售额 ECharts 图表' })).toHaveCount(2)
  await expect(tree.getByRole('row', { name: /ECharts 图表/ })).toHaveCount(2)
})

test('OpenSpec: scene-tree / 新增节点入口 / 连续新增多个节点', async ({ page }) => {
  await page.goto('/')

  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  await expect(addNode).toHaveCount(1)
  for (let index = 0; index < 20; index += 1) await addNode.click()

  const tree = page.getByRole('treegrid', { name: '场景树' })
  const canvas = page.getByRole('region', { name: '编辑画布' })
  await expect(tree.getByRole('row')).toHaveCount(22)
  await expect(canvas.getByRole('button')).toHaveCount(21)
  await expect(tree.getByRole('row', { name: /默认文本 20/ })).toBeVisible()

  await tree.getByRole('row', { name: /默认文本 3/ }).click()
  await page.getByLabel('文本内容', { exact: true }).fill('第三个文本')
  await expect(tree.getByRole('row', { name: /第三个文本/ })).toBeVisible()
  await expect(canvas.getByRole('button', { name: '第三个文本' })).toBeVisible()
  await expect(canvas.getByRole('button', { name: '默认文本 2', exact: true })).toBeVisible()
  await expect(canvas.getByRole('button', { name: '默认文本 4', exact: true })).toBeVisible()

  await tree.getByRole('row', { name: /第三个文本/ }).press('Delete')
  await expect(tree.getByRole('row')).toHaveCount(21)
  await expect(canvas.getByRole('button')).toHaveCount(20)
  await expect(canvas.getByRole('button', { name: '第三个文本' })).toHaveCount(0)
})

test('OpenSpec: scene-tree / 新增节点入口 / 从选中节点右键新增子节点', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '添加文本组件' }).click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const parent = tree.locator('[data-scene-node-id="text-1"]')
  await parent.click()
  await parent.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '新增子节点' }).click()

  await expect(parent).toHaveAttribute('aria-expanded', 'true')
  await expect(tree.getByRole('row', { name: /默认文本 2/ })).toHaveAttribute('aria-level', '3')
})

test('OpenSpec: scene-tree / 默认编辑器复制节点 / 复制文本组件并继续编辑', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  await addNode.click()
  await addNode.click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const first = tree.locator('[data-scene-node-id="text-1"]')
  const second = tree.locator('[data-scene-node-id="text-2"]')

  await first.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '复制' }).click()
  await second.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '粘贴为兄弟节点' }).click()

  const copy = tree.locator('[data-scene-node-id="text-3"]')
  await expect(copy).toBeVisible()
  await expect(copy).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('文本内容', { exact: true }).fill('复制后的文本')
  await expect(copy).toContainText('复制后的文本')
  await expect(first).toContainText('默认文本')
  await expect(page.getByRole('region', { name: '编辑画布' }).getByRole('button', { name: '复制后的文本' })).toBeVisible()
  // OpenSpec: operation-log / 示例成功提交集成 / 记录编辑器纵向操作
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /复制 1 个组件/ })).toBeVisible()
})

test('deleting a parent removes its complete subtree from the tree and canvas', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  await addNode.click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const parent = tree.locator('[data-scene-node-id="text-1"]')
  await parent.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '新增子节点' }).click()
  await expect(tree.locator('[data-scene-node-id="text-2"]')).toHaveAttribute('aria-level', '3')

  await parent.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '删除' }).click()

  await expect(tree.locator('[data-scene-node-id="text-1"]')).toHaveCount(0)
  await expect(tree.locator('[data-scene-node-id="text-2"]')).toHaveCount(0)
  const canvas = page.getByRole('region', { name: '编辑画布' })
  await expect(canvas.getByRole('button')).toHaveCount(1)
  await expect(canvas.getByRole('button', { name: '选择 Rectangle' })).toBeVisible()
  // OpenSpec: operation-log / 示例成功提交集成 / 记录编辑器纵向操作
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /删除 2 个组件/ })).toBeVisible()
})

test('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 打开节点命令菜单', async ({ page }) => {
  await page.goto('/')
  const pageRow = page.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id="page"]')
  await pageRow.click({ button: 'right', position: { x: 150, y: 12 } })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(7)
  await expect(menu.getByRole('menuitem', { name: '剪切' })).toBeDisabled()
  await expect(menu.getByRole('menuitem', { name: '删除' })).toHaveAttribute('data-danger', 'true')
  await page.mouse.move(900, 400)
  await expect(page).toHaveScreenshot('scene-tree-context-menu.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})

test('keeps the node context menu within the viewport edges', async ({ page }) => {
  await page.goto('/')
  const pageRow = page.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id="page"]')
  await pageRow.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: window.innerWidth - 2,
      clientY: window.innerHeight - 2,
    }))
  })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  await expect.poll(async () => {
    const box = await menu.boundingBox()
    return Boolean(
      box
      && box.x >= 8
      && box.y >= 8
      && box.x + box.width <= viewport!.width - 8
      && box.y + box.height <= viewport!.height - 8,
    )
  }).toBe(true)
})

test('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 使用场景树命令快捷键', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  await addNode.click()
  await addNode.click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const first = tree.locator('[data-scene-node-id="text-1"]')
  const second = tree.locator('[data-scene-node-id="text-2"]')
  await first.click()
  await second.click({ modifiers: ['Control'] })
  await second.press('Control+c')
  await second.press('Control+v')

  await expect(tree.locator('[data-scene-node-id="text-3"]')).toHaveAttribute('aria-level', '3')
  await expect(tree.locator('[data-scene-node-id="text-4"]')).toHaveAttribute('aria-level', '3')
})

test('OpenSpec: scene-tree / 场景树命令菜单与快捷键 / 打开空白区命令菜单', async ({ page }) => {
  await page.goto('/')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  await tree.click({ button: 'right', position: { x: 210, y: 300 } })
  await expect(page.getByRole('menuitem').allTextContents()).resolves.toEqual([
    '新增根节点',
    '粘贴到根级',
  ])
  await page.getByRole('menuitem', { name: '新增根节点' }).click()
  await expect(tree.locator('[data-scene-node-id="text-1"]')).toHaveAttribute('aria-level', '1')
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 使用平台键位开始重命名', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新增节点', exact: true }).click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const row = tree.getByRole('row', { name: /默认文本/ }).first()

  await row.dblclick()
  await expect(tree.getByRole('textbox', { name: /重命名/ })).toHaveCount(0)

  const renameKey = await page.evaluate(() => (
    /^Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent)
      ? 'F2'
      : 'Enter'
  ))
  await row.press(renameKey)
  const input = tree.getByRole('textbox', { name: /重命名/ })
  await expect(input).toBeVisible()
  await input.fill('键盘重命名')
  await input.press('Enter')
  await expect(tree.getByRole('row', { name: /键盘重命名/ })).toBeVisible()
  // OpenSpec: operation-log / 示例成功提交集成 / 记录编辑器纵向操作
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /重命名 默认文本/ })).toBeVisible()
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 默认编辑器应用多选移动意图', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const pageNode = tree.locator('[data-scene-node-id="page"]')
  for (let index = 0; index < 5; index += 1) {
    await pageNode.click()
    await addNode.click()
  }

  const second = tree.locator('[data-scene-node-id="text-2"]')
  const third = tree.locator('[data-scene-node-id="text-3"]')
  const fourth = tree.locator('[data-scene-node-id="text-4"]')
  const fifth = tree.locator('[data-scene-node-id="text-5"]')
  await second.click()
  await fourth.click({ modifiers: ['Shift'] })

  await expect(second).toHaveAttribute('aria-selected', 'true')
  await expect(third).toHaveAttribute('aria-selected', 'true')
  await expect(fourth).toHaveAttribute('aria-selected', 'true')

  const sourceBox = await second.boundingBox()
  const sourceLabelBox = await second.getByRole('gridcell').boundingBox()
  const targetBox = await fifth.boundingBox()
  const treeBox = await tree.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(sourceLabelBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  expect(treeBox).not.toBeNull()
  await page.mouse.move(sourceLabelBox!.x + 30, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    sourceLabelBox!.x + 30,
    targetBox!.y + targetBox!.height - 2,
    { steps: 5 },
  )
  await expect(page.getByTestId('scene-tree-drop-indicator')).toBeVisible()
  await page.mouse.up()

  await expect.poll(async () => {
    const labels = await tree.getByRole('row').allTextContents()
    return labels.map((label) => label.match(/默认文本(?: [2-5])?/)?.[0]).filter(Boolean)
  }).toEqual(['默认文本', '默认文本 5', '默认文本 2', '默认文本 3', '默认文本 4'])
  // OpenSpec: operation-log / 示例成功提交集成 / 记录编辑器纵向操作
  await expect(page.getByRole('region', { name: '操作日志' })
    .getByRole('button', { name: /移动 3 个场景节点/ })).toBeVisible()
})

test('OpenSpec: scene-tree / 树选择与导航 / Ctrl 点击切换多选且不打开菜单', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  await addNode.click()
  await addNode.click()
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const first = tree.locator('[data-scene-node-id="text-1"]')
  const second = tree.locator('[data-scene-node-id="text-2"]')

  await first.click()
  await second.click({ modifiers: ['Control'] })

  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 从文字区域快速拖动并改变层级', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  for (let index = 0; index < 5; index += 1) await addNode.click()

  const tree = page.getByRole('treegrid', { name: '场景树' })
  const source = tree.locator('[data-scene-node-id="text-2"]')
  const target = tree.locator('[data-scene-node-id="text-5"]')
  const sourceBox = await source.boundingBox()
  const sourceLabelBox = await source.getByRole('gridcell').boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(sourceLabelBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  expect(await source.evaluate((element) => getComputedStyle(element).userSelect)).toBe('none')
  const startX = sourceLabelBox!.x + 30
  await page.mouse.move(startX, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(startX + 16, targetBox!.y + targetBox!.height / 2)

  await expect(page.getByTestId('scene-tree-drag-preview')).toContainText('默认文本 2')
  await expect(target).toHaveAttribute('data-scene-drop-target', 'inside')
  await expect(page.getByTestId('scene-tree-drop-indicator')).toHaveCount(0)
  await page.mouse.up()

  await expect(source).toHaveAttribute('aria-level', '3')
  await expect(target).toHaveAttribute('aria-expanded', 'true')
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 显示单节点和多节点拖拽预览', async ({ page }) => {
  await page.goto('/?sceneDrag=1')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const first = tree.getByRole('row', { name: /Layer 1/ })
  const second = tree.getByRole('row', { name: /Layer 2/ })
  const target = tree.getByRole('row', { name: /Group B/ })
  await first.click()
  await second.click({ modifiers: ['Shift'] })

  const firstBox = await first.boundingBox()
  const targetBox = await target.boundingBox()
  expect(firstBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(firstBox!.x + 120, firstBox!.y + firstBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox!.x + 120, targetBox!.y + targetBox!.height / 2)

  await expect(page.getByTestId('scene-tree-drag-preview')).toContainText('2')
  await expect(target).toHaveAttribute('data-scene-drop-target', 'inside')
  await expect(page.getByTestId('scene-tree-drop-indicator')).toHaveCount(0)
  await expect(page).toHaveScreenshot('scene-tree-drag-preview-multi.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await page.mouse.up()

  await target.getByRole('button', { name: '展开节点' }).click()
  await expect(first).toHaveAttribute('aria-level', '3')
  await expect(second).toHaveAttribute('aria-level', '3')
})

test('OpenSpec: scene-tree / 拖动多个选中节点 / 拖拽保持纵向排序轴', async ({ page }) => {
  await page.goto('/')
  const addNode = page.getByRole('button', { name: '新增节点', exact: true })
  for (let index = 0; index < 6; index += 1) await addNode.click()

  const tree = page.getByRole('treegrid', { name: '场景树' })
  const draggedRow = tree.locator('[data-scene-node-id="text-5"]')
  const initialBox = await draggedRow.boundingBox()
  expect(initialBox).not.toBeNull()
  expect(await tree.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
    await tree.evaluate((element) => element.clientWidth),
  )

  await page.mouse.move(initialBox!.x + initialBox!.width / 2, initialBox!.y + 16)
  await page.mouse.down()
  await page.mouse.move(initialBox!.x + initialBox!.width + 160, initialBox!.y + 16, {
    steps: 5,
  })

  await expect.poll(async () => {
    const currentBox = await draggedRow.boundingBox()
    return Math.abs((currentBox?.x ?? 0) - initialBox!.x)
  }).toBeLessThanOrEqual(1)
  expect(await tree.evaluate((element) => element.scrollLeft)).toBe(0)
  await page.mouse.up()
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽', async ({ page }) => {
  await page.goto('/?sceneDrag=1')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const source = tree.getByRole('row', { name: /Layer 1/ })
  const target = tree.getByRole('row', { name: /Layer 3/ })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  const treeBox = await tree.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  expect(treeBox).not.toBeNull()

  const before = await tree.getByRole('row').allTextContents()
  await page.mouse.move(sourceBox!.x + 120, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    sourceBox!.x + 120,
    targetBox!.y + targetBox!.height - 2,
    { steps: 5 },
  )

  await expect(page.getByTestId('scene-tree-drop-indicator')).toBeVisible()
  const preview = page.getByTestId('scene-tree-drag-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Layer 1')
  await expect.poll(async () => (await preview.boundingBox())?.width).toBeGreaterThan(50)
  await expect(preview).toHaveScreenshot('scene-tree-drag-preview-single.png', {
    animations: 'disabled',
    caret: 'hide',
  })
  expect(await tree.getByRole('row').allTextContents()).toEqual(before)
  expect((await source.boundingBox())?.y).toBeCloseTo(sourceBox!.y, 0)
  await expect(page).toHaveScreenshot('scene-tree-drag-indicator.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.mouse.up()
  await expect(page.getByTestId('scene-tree-drop-indicator')).toHaveCount(0)
  await expect.poll(async () => {
    const labels = await tree.getByRole('row').allTextContents()
    return labels.map((label) => label.match(/Layer \d/)?.[0]).filter(Boolean)
  }).toEqual(['Layer 2', 'Layer 3', 'Layer 1'])
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 使用静态节点和落点横线拖拽 - 插入嵌套首项之前', async ({ page }) => {
  await page.goto('/?sceneDrag=1')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const source = tree.getByRole('row', { name: /Loose/ })
  const target = tree.getByRole('row', { name: /Layer 1/ })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + 120, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox!.x + 120, targetBox!.y + 1)
  const indicator = page.getByTestId('scene-tree-drop-indicator')
  await expect(indicator).toBeVisible()
  await expect.poll(async () => (await indicator.boundingBox())?.y).toBeCloseTo(targetBox!.y - 2, 0)
  await page.mouse.up()

  await expect(source).toHaveAttribute('aria-level', '3')
  await expect.poll(async () => {
    const labels = await tree.getByRole('row').allTextContents()
    return labels.map((label) => label.match(/(?:Loose|Layer [123])/)?.[0]).filter(Boolean)
  }).toEqual(['Loose', 'Layer 1', 'Layer 2', 'Layer 3'])
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 展开节点底部落点紧邻节点行', async ({ page }) => {
  await page.goto('/?sceneDrag=1')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const source = tree.getByRole('row', { name: /Loose/ })
  const target = tree.getByRole('row', { name: /Group A/ })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  const treeBox = await tree.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  expect(treeBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + 120, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(treeBox!.x + 20, targetBox!.y + targetBox!.height - 2)

  const indicator = page.getByTestId('scene-tree-drop-indicator')
  await expect(indicator).toBeVisible()
  await expect.poll(async () => (await indicator.boundingBox())?.y).toBeCloseTo(
    targetBox!.y + targetBox!.height,
    0,
  )
  await page.mouse.up()

  await expect(source).toHaveAttribute('aria-level', '3')
  await expect.poll(async () => {
    const labels = await tree.getByRole('row').allTextContents()
    return labels.map((label) => label.match(/(?:Loose|Layer [123])/)?.[0]).filter(Boolean)
  }).toEqual(['Loose', 'Layer 1', 'Layer 2', 'Layer 3'])
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 通过横向位置改变层级', async ({ page }) => {
  await page.goto('/?sceneDrag=1')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const layer1 = tree.getByRole('row', { name: /Layer 1/ })
  const layer2 = tree.getByRole('row', { name: /Layer 2/ })
  const loose = tree.getByRole('row', { name: /Loose/ })

  await layer1.click()
  await layer2.click({ modifiers: ['Shift'] })
  await expect(layer1).toHaveAttribute('aria-selected', 'true')
  await expect(layer2).toHaveAttribute('aria-selected', 'true')

  const sourceBox = await layer1.boundingBox()
  const looseBox = await loose.boundingBox()
  const treeBox = await tree.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(looseBox).not.toBeNull()
  expect(treeBox).not.toBeNull()
  await page.mouse.move(sourceBox!.x + 120, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    sourceBox!.x + 120 - 16,
    looseBox!.y + looseBox!.height - 2,
    { steps: 5 },
  )
  await page.mouse.up()

  await expect(layer1).toHaveAttribute('aria-level', '2')
  await expect(layer2).toHaveAttribute('aria-level', '2')
  await expect.poll(async () => {
    const labels = await tree.getByRole('row').allTextContents()
    return labels.map((label) => label.match(/(?:Loose|Layer [12])/)?.[0]).filter(Boolean)
  }).toEqual(['Loose', 'Layer 1', 'Layer 2'])
})

test('OpenSpec: scene-tree / 场景节点操作意图 / 拖拽期间展开和滚动', async ({ page }) => {
  await page.goto('/?sceneSize=5000')
  const tree = page.getByRole('treegrid', { name: '场景树' })
  const source = tree.locator('[data-scene-node-id="node-1"]')
  const sourceBox = await source.boundingBox()
  const treeBox = await tree.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(treeBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + 100, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + 100, treeBox!.y + treeBox!.height - 4, { steps: 5 })
  await expect.poll(async () => tree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await tree.evaluate((element) => element.scrollLeft)).toBe(0)
  await page.mouse.up()
})

test('OpenSpec: scene-tree / 节点检索 / 使用普通与组合检索', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '新增节点', exact: true }).click()

  const search = page.getByRole('searchbox', { name: '搜索节点' })
  await page.getByRole('button', { name: '大小写敏感' }).click()
  await page.getByRole('button', { name: '全词匹配' }).click()
  await search.fill('默认文本')

  await expect(page.getByRole('button', { name: '大小写敏感' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: '全词匹配' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('treegrid', { name: '场景树' }).getByRole('row')).toHaveCount(2)

  await page.getByRole('button', { name: '正则表达式' }).click()
  await expect(page.getByRole('button', { name: '正则表达式' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(async () => page.getByRole('button', { name: '正则表达式' }).evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )).not.toBe('rgba(0, 0, 0, 0)')
  await search.fill('[')
  await expect(search).toHaveAttribute('aria-invalid', 'true')
  await expect(
    page.locator('[data-compose-ui="scene-tree"]').getByRole('alert'),
  ).toContainText('正则表达式无效')
})

test('OpenSpec: scene-tree / 大规模虚拟化树 / 渲染 5000 个展开节点', async ({ page }) => {
  const initialStartedAt = Date.now()
  await page.goto('/?sceneSize=5000')

  const tree = page.getByRole('treegrid', { name: '场景树' })
  await expect(tree).toBeVisible()
  expect(Date.now() - initialStartedAt).toBeLessThan(1500)
  await expect.poll(async () => tree.getByRole('row').count()).toBeLessThanOrEqual(80)

  await tree.getByRole('row', { name: /Page 1/ }).press('End')
  await expect(tree.getByRole('row', { name: /Node 4999/ })).toBeVisible()

  const startedAt = Date.now()
  await page.getByRole('searchbox', { name: '搜索节点' }).fill('Node 4999')
  await expect(tree.getByRole('row', { name: /Node 4999/ })).toBeVisible()
  expect(Date.now() - startedAt).toBeLessThan(500)
})

test('OpenSpec: scene-tree / 场景树视觉与样式隔离 / 显示默认场景树外观', async ({ page }) => {
  await page.goto('/')
  const pageRow = page.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id="page"]')
  await page.mouse.move(800, 400)
  const addButton = page.getByRole('button', { name: '新增节点', exact: true })
  const toolbar = addButton.locator('..')
  const search = page.getByRole('searchbox', { name: '搜索节点' })
  const searchField = search.locator('..')
  await expect.poll(async () => (await toolbar.boundingBox())?.height).toBe(32)
  await expect.poll(async () => (await addButton.boundingBox())?.height).toBe(24)
  await expect.poll(async () => (await searchField.boundingBox())?.height).toBe(24)
  await expect.poll(async () => (await addButton.locator('svg').boundingBox())?.height).toBe(14)
  await expect(search).toHaveCSS('font-size', '11px')
  await expect(addButton).toHaveCSS('border-top-width', '0px')
  await expect(addButton).toHaveCSS('cursor', 'pointer')
  await expect.poll(async () => {
    const buttonBox = await addButton.boundingBox()
    const iconBox = await addButton.locator('svg').boundingBox()
    if (!buttonBox || !iconBox) return Infinity
    return Math.max(
      Math.abs(buttonBox.x + buttonBox.width / 2 - (iconBox.x + iconBox.width / 2)),
      Math.abs(buttonBox.y + buttonBox.height / 2 - (iconBox.y + iconBox.height / 2)),
    )
  }).toBeLessThanOrEqual(0.5)
  await expect(page).toHaveScreenshot('scene-tree-default.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await pageRow.hover()
  await expect(pageRow).toHaveCSS('background-color', 'rgb(42, 45, 46)')

  await addButton.click()
  const selectedRow = page.getByRole('treegrid', { name: '场景树' }).getByRole('row', { name: /默认文本/ })
  await expect(selectedRow).toHaveCSS('cursor', 'default')
  await selectedRow.click()
  await page.mouse.move(800, 400)
  await expect(selectedRow).toHaveCSS('height', '22px')
  await expect(selectedRow).toHaveCSS('margin-top', '1px')
  await expect(selectedRow).toHaveCSS('margin-bottom', '1px')
  await expect(selectedRow).toHaveCSS('margin-left', '4px')
  await expect(selectedRow).toHaveCSS('margin-right', '4px')
  await expect(selectedRow).toHaveCSS('border-radius', '5px')
  await expect.poll(async () => {
    const pageBox = await pageRow.boundingBox()
    const selectedBox = await selectedRow.boundingBox()
    return (selectedBox?.y ?? 0) - (pageBox?.y ?? 0)
  }).toBe(48)
  await expect(selectedRow).toHaveCSS('background-color', 'rgb(55, 55, 61)')
  await expect(selectedRow).toHaveCSS('box-shadow', 'none')
  await expect(page).toHaveScreenshot('scene-tree-selected.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await selectedRow.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(pageRow).toBeFocused()
  await expect(pageRow).toHaveCSS('background-color', 'rgb(6, 47, 74)')
  await expect.poll(async () => pageRow.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  )).toContain('rgb(0, 127, 212) 0px 0px 0px 1px inset')
  await expect(page).toHaveScreenshot('scene-tree-focused.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await page.getByRole('button', { name: '大小写敏感' }).click()
  await page.getByRole('button', { name: '全词匹配' }).click()
  await page.getByRole('button', { name: '正则表达式' }).click()
  await page.getByRole('searchbox', { name: '搜索节点' }).fill('默认文本')
  await expect(page).toHaveScreenshot('scene-tree-search.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})
