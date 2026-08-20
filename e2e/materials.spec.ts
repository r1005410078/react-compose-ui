import { expect, test } from '@playwright/test'
import { pointerDrop, drawContainer, drawText, enableAutoLayout, selectAxisSizing, expandInspectorSection, openPageInspector } from './support/test-helpers'

test('OpenSpec: Preview 原生 Container 滚动 / 滚动范围保留底部内边距', async ({ page }) => {
  await page.goto('/?no-auto-fit')

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
  await expandInspectorSection(inspector, '布局')
  const layoutHeader = inspector.getByRole('button', { name: '布局', exact: true })
  const layoutSection = layoutHeader.locator('..').locator('..')
  await layoutSection.getByRole('radiogroup', { name: '方向' })
    .getByRole('radio', { name: '纵向', exact: true })
    .click()
  const padding = layoutSection.getByRole('spinbutton', { name: '内边距' })
  await padding.fill('40')
  await padding.blur()

  // 启用 Auto Layout 时容器还是横向，交叉轴是高度，子项高度因此被采纳为 Fill；切成纵向后
  // 高度变成主轴，Fill 会让子项均分容器高度而不再溢出。本用例验证的是滚动范围与底部内边距，
  // 因此按用户会做的操作把子项高度显式设回固定值。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  // 场景树里容器默认折叠，不展开就取不到子行。
  await sceneTree.getByRole('row').filter({ hasText: 'Container' })
    .getByRole('button', { name: /展开/ }).click()
  const rectangleRows = sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })
  await expect(rectangleRows.first()).toBeVisible()
  const rectangleCount = await rectangleRows.count()
  for (let index = 0; index < rectangleCount; index += 1) {
    await rectangleRows.nth(index).click()
    const rectangleInspector = editor.getByRole('region', { name: 'Rectangle 属性', exact: true })
    const height = rectangleInspector.getByRole('combobox', { name: '尺寸高度' })
    await height.fill('120')
    await height.press('Enter')
  }
  await editor.getByRole('treegrid', { name: '场景树' })
    .getByRole('row')
    .filter({ hasText: 'Container' })
    .click()
  await expandInspectorSection(inspector, '容器')
  await inspector.getByRole('combobox', { name: '纵向溢出', exact: true })
    .selectOption('scroll')
  await expect(container.getByTestId('stage-overflow-indicator-y')).toBeVisible()
  // 预览目标收敛为画板；容器在预览里是普通 Entity 节点，按实体 ID 定位。
  const containerId = await container.getAttribute('data-entity-id')
  expect(containerId).not.toBeNull()
  await editor.getByRole('button', { name: '打开预览' }).click()
  const dialog = page.getByRole('dialog', { name: '文档预览对话框' })
  await dialog.getByRole('combobox', { name: '预览缩放' }).selectOption('1')
  // 预览目标是场景选择器，默认就是激活场景；这里只有一块场景，无需切换。
  await expect(dialog.getByRole('combobox', { name: '预览场景' })).toBeVisible()
  const preview = dialog.getByTestId(`compose-preview-entity-${containerId}`)
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
  await expandInspectorSection(inspector, '图表')
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
  await openPageInspector(page, editor)
  const canvasInspector = editor.getByRole('region', { name: '页面属性' })
  const pageScriptProperty = canvasInspector.locator('.property-panel__group')
    .filter({ hasText: '页面脚本' })
  await expect(canvasInspector.getByRole('searchbox', { name: '搜索属性' })).toHaveCount(1)
  await expect(canvasInspector.getByRole('combobox', { name: '脚本文件' }))
    .toHaveValue('demo-home-setup')
  await expect(pageScriptProperty.getByRole('list', { name: '页面脚本返回成员' }))
    .toContainText('onAdd')
  await expect(pageScriptProperty.getByRole('button', { name: '重新加载脚本' })).toBeVisible()
  // 返回成员贴边占满整行：内容盒左右边界与所在属性行一致。
  const membersRow = (await pageScriptProperty.locator('[data-property-path="exports"]').boundingBox())!
  const membersBox = (await pageScriptProperty
    .locator('.compose-editor__page-script-members').boundingBox())!
  expect(Math.abs(membersBox.x - membersRow.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((membersBox.x + membersBox.width) - (membersRow.x + membersRow.width)))
    .toBeLessThanOrEqual(1)
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
  await openPageInspector(page, editor)
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
  await openPageInspector(page, editor)
  await expect(pageScriptProperty)
    .toContainText('页面脚本导入失败')
  await expect(stage.getByTestId('compose-material-text')).toHaveText('0')
  await expect.poll(() => page.evaluate(() => (
    globalThis as typeof globalThis & { __composeCounterDisposed?: boolean }
  ).__composeCounterDisposed)).toBe(true)

  await pageTab.getByRole('button', { name: '关闭页面 Counter' }).click()
  await expect(pageTab).toHaveCount(0)
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

  // 2) 在 Counter 页面里把 Home 页面拖进画布创建 Page Slot；Page Slot 没有 Palette 入口，
  //    拖入资源才是它的正式创建路径，并且会顺带带上页面引用。
  await pagesGrid.getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')).toHaveCount(2)
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).dragTo(stage, {
    targetPosition: { x: 220, y: 160 },
  })

  // 3) 属性面板的 node 字段直接反映拖入时写入的引用
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expandInspectorSection(inspector, '页面')
  const nodeField = inspector.getByTestId('semantic-editor-node')
  await expect(nodeField).toBeVisible()
  await expect(nodeField.getByRole('combobox')).toContainText('Home')

  // 4) 画布上实时渲染被引用页面的内容
  await expect(stage.getByTestId('compose-page-slot-content')).toBeVisible()
  await selectAxisSizing(inspector, '宽度', 'Hug')
  await selectAxisSizing(inspector, '高度', 'Hug')
  await expect(stage.getByTestId('stage-layout-diagnostics')).toHaveCount(0)

  // 5) 预览中同样渲染
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog').or(page.getByTestId('compose-preview-frame'))
  await expect(preview.getByTestId('compose-page-slot-content').first()).toBeVisible()
})


test('回归：Page Slot / A → B → Home 冷加载不会被 StrictMode 取消', async ({ page }) => {
  await page.goto('/?deep-page-slot')
  const preview = page.getByTestId('compose-preview-frame')
  await expect(page.getByTestId('deep-page-slot-demo')).toBeVisible()
  await expect(preview.getByTestId('compose-page-slot-content')).toHaveCount(3)
  await expect(preview.getByTestId('compose-page-slot-error')).toHaveCount(0)
  // 每个被引用页面的根 Frame 现在也是一个被渲染实体：3 个页面各多一层。
  await expect(preview.locator('[data-page-slot-entity-id]')).toHaveCount(7)
})


test('OpenSpec: basic-materials / Page Slot / 画布与预览的嵌套内容完全一致', async ({ page }) => {
  await page.goto('/?no-auto-fit')
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
  const homeContainerBox = await stage.getByTestId('stage-container').boundingBox()
  await drawText(page, editor, {
    x: homeContainerBox!.x + 200,
    y: homeContainerBox!.y + 120,
  })

  const tab = editor.locator('[data-workspace-tab^="compose-page-document:"]')
  await page.keyboard.press('Control+S')
  await expect(tab.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // Counter 页面里把 Home 拖进画布，得到一个指向 Home 的 Page Slot。
  const pagesGrid = assets.getByRole('grid', { name: 'Pages' })
  await pagesGrid.getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()
  await pagesGrid.getByRole('gridcell', { name: 'Home' }).dragTo(stage, {
    targetPosition: { x: 220, y: 160 },
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expandInspectorSection(inspector, '页面')
  await expect(inspector.getByTestId('semantic-editor-node').getByRole('combobox'))
    .toContainText('Home')

  // 嵌套内容必须逐个实体渲染并各自定位；缺少定位包装或递归时数量会少于 3
  await expect(stage.getByTestId('compose-page-slot-content')).toBeVisible()
  // 被引用页面的根 Frame 也参与渲染，因此是画板 + 三个实体。
  await expect(stage.locator('[data-page-slot-entity-id]')).toHaveCount(4)

  await editor.getByRole('button', { name: '打开预览' }).click()
  const previewDoc = page.getByTestId('compose-preview-frame')
  await expect(previewDoc).toBeVisible()
  // 与画布逐个实体一致：两端共用同一个 page-slot 渲染实现
  await expect(previewDoc.locator('[data-page-slot-entity-id]')).toHaveCount(4)
})


test('OpenSpec: basic-materials / 关联组件实例物料 / 实例暴露组件根属性且可 Resize', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Root Card')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // 单选提取复用容器作为组件根，因此实例只有一层，展开即是内容；另一行是根画板。
  await expect(sceneTree.getByRole('row')).toHaveCount(2)

  await sceneTree.getByRole('row').last().click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  // 组件根的容器属性在实例上可见；名称与位置只出现一次，来自宿主实例。
  await expect(inspector).toContainText('外观')
  await expect(inspector).toContainText('容器')
  await expect(inspector.getByLabel('名称')).toHaveCount(1)
  // 合成表面：禁止双 EntityInspector / 双搜索栏。
  await expect(inspector.locator('.compose-editor__entity-inspector')).toHaveCount(1)
  await expect(inspector.getByRole('searchbox')).toHaveCount(1)

  // 根可缩放，实例继承该能力并显示手柄。
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(1)

  // 嵌套矩形 Appearance 驱动填色；默认无圆角，Material 不得盖默认蓝底。
  const material = stage.getByTestId('compose-material-rectangle')
  await expect(material).toBeVisible()
  await expect(material).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const nestedRect = material.locator(
    'xpath=ancestor::*[@data-component-instance-entity-id][1]',
  )
  await expect(nestedRect).toHaveCSS('overflow', 'hidden')
  await expect(nestedRect).toHaveCSS('border-radius', '0px')
})


test('OpenSpec: WidgetSwitcher 物料 / 只显示活动子项并按选择临时预览', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  // 1) 从组件库放一个 Widget Switcher，再在它外面放两个矩形。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const outputBox = await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox()
  expect(outputBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Widget Switcher' }), {
    x: outputBox!.x + 260,
    y: outputBox!.y + 300,
  })
  const switcher = stage.getByTestId('stage-container')
  await expect(switcher).toBeVisible()

  const rootRenderers = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  for (const x of [80, 300]) {
    await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
      x: outputBox!.x + x,
      y: outputBox!.y + 24,
    })
  }
  await expect(rootRenderers).toHaveCount(2)

  // 2) 依次把两个矩形拖进 switcher；第二个进去后立刻被隐藏，因为活动索引仍是 0。
  const switcherBox = await switcher.boundingBox()
  const dropPoint = {
    x: switcherBox!.x + switcherBox!.width / 2,
    y: switcherBox!.y + switcherBox!.height / 2,
  }
  const children = switcher.locator(':scope > .compose-stage__node.is-renderer')
  for (const index of [0, 1]) {
    const rectBox = await rootRenderers.first().boundingBox()
    await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(dropPoint.x, dropPoint.y, { steps: 8 })
    await page.mouse.up()
    await expect(rootRenderers).toHaveCount(1 - index)
    // 第二个子项落进去时不渲染：活动索引仍指向第一个。
    await expect(children).toHaveCount(1)
  }

  // 3) Inspector 把活动索引改到 1，显示的分支随之切换。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const switcherRow = sceneTree.getByRole('row', { name: /Widget Switcher/ })
  await switcherRow.click()
  const inspector = editor.getByRole('region', { name: 'Widget Switcher 属性', exact: true })
  const activeIndex = inspector.getByRole('spinbutton', { name: '活动索引' })
  await activeIndex.fill('1')
  await activeIndex.blur()
  await expect(activeIndex).toHaveValue('1')
  await expect(children).toHaveCount(1)

  // 4) 在场景树选中非活动的第一个子项：它临时显示出来，且不产生可撤销事务。
  const activeChildId = await children.first().getAttribute('data-entity-id')
  await switcherRow.getByRole('button', { name: '展开节点' }).click()
  const rectangleRows = sceneTree.getByRole('row', { name: /Rectangle/ })
  await expect(rectangleRows).toHaveCount(2)
  await rectangleRows.nth(0).click()
  await expect(children).toHaveCount(1)
  await expect(children.first()).not.toHaveAttribute('data-entity-id', activeChildId!)

  // 5) 取消选择（改选 switcher 自身）后回到活动索引，且这一路没有写过文档：
  //    一次撤销撤掉的仍是第 3 步的索引修改。
  await switcherRow.click()
  await expect(children.first()).toHaveAttribute('data-entity-id', activeChildId!)
  await expect(activeIndex).toHaveValue('1')
  await page.keyboard.press('Control+z')
  await expect(activeIndex).toHaveValue('0')
  await expect(children.first()).not.toHaveAttribute('data-entity-id', activeChildId!)
})


