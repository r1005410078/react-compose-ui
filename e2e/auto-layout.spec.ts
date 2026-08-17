import { expect, test } from '@playwright/test'
import { pointerDrop, drawContainer, drawText, enableAutoLayout, selectAxisSizing, expandInspectorSection } from './support/test-helpers'

test('OpenSpec: 自动布局显式启用 / 自由 Container 添加、移除并可撤销重做', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const inspector = editor.getByRole('region', { name: 'Container 属性', exact: true })

  const emptyLayoutHeader = inspector.getByRole('button', { name: '布局', exact: true })
  const emptyLayoutSection = emptyLayoutHeader.locator('..').locator('..')
  // 缺失 Component 的引导分组默认折叠，展开后才呈现引导内容。
  await expandInspectorSection(inspector, '布局')
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
  await expandInspectorSection(inspector, '布局')
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
  await drawText(page, editor, {
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


test('OpenSpec: basic-materials / Auto Layout 按需启用 / 启用后固定尺寸子项填满交叉轴', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await drawContainer(page, editor)
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()
  expect(outputBox).not.toBeNull()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })

  const frame = stage.getByTestId('stage-container')
  const children = frame.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)
  const frameBox = await frame.boundingBox()
  const beforeHeight = (await children.nth(0).boundingBox())!.height
  expect(beforeHeight).toBeLessThan(frameBox!.height)

  await frame.click({ position: { x: 8, y: 8 } })
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(containerInspector)

  // 默认 Layout 是 row + alignItems stretch。子项 Preset 交叉轴是 fixed，若不在采纳时改成
  // fill，stretch 对它们就是空操作——这正是启用自动布局后「拉伸没反应」的原因。
  // 子项填满的是容器内容区。Yoga 会扣掉容器 Appearance.borderWidth，而该边框在 DOM 侧不是
  // 真实 CSS border，因此实测高度比容器 boundingBox 少几个像素；这里断言「几乎填满且明显
  // 高于启用前」，而不是钉死一个依赖边框宽度的数值。
  for (const index of [0, 1]) {
    await expect.poll(async () => (await children.nth(index).boundingBox())!.height)
      .toBeGreaterThan(frameBox!.height - 8)
  }
  const stretched = (await children.nth(0).boundingBox())!.height
  expect(stretched).toBeGreaterThan(beforeHeight)
  expect((await children.nth(1).boundingBox())!.height).toBe(stretched)

  await children.nth(0).click()
  const rectInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
  await expect(rectInspector.getByRole('combobox', { name: '尺寸高度' })).toHaveValue('Fill')
  await expect(rectInspector.getByRole('combobox', { name: '尺寸宽度' })).not.toHaveValue('Fill')
})


