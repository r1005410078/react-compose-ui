import { expect, test } from '@playwright/test'
import { pointerDrop, drawContainer, enableAutoLayout, expandInspectorSection, openPageInspector } from './support/test-helpers'

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
    await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
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


test('OpenSpec: basic-materials / 第一方图表物料 / 在 Stage 中画出 Canvas 并分别绑定数据', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: '添加 柱状图' }), {
    x: frameBox!.x + 320,
    y: frameBox!.y + 240,
  })

  // 图表是一块真的 canvas，不是占位。
  const chart = stage.getByTestId('compose-material-chart')
  await expect(chart).toBeVisible()
  await expect(chart).toHaveAttribute('data-chart-kind', 'bar')
  await expect(chart.locator('canvas')).toBeVisible()

  const inspector = editor.getByRole('region', { name: '柱状图 属性', exact: true })
  await expandInspectorSection(inspector, '图表')
  /*
   * OpenSpec: property-panel / 自定义 Renderer 子目标绑定 / 图表输入分别绑定
   * 「数据从哪儿来」是类目与系列两个问题，页面脚本喂进来的正是它们，因此两个入口各自独立。
   */
  const categoryActions = inspector.getByRole('button', { name: '绑定 类目' })
  const seriesActions = inspector.getByRole('button', { name: '绑定 系列' })
  const categoryHeader = categoryActions.locator('..').locator('..')
  await expect(categoryActions).toHaveCSS('opacity', '0')
  await expect(seriesActions).toHaveCSS('opacity', '0')
  await categoryHeader.hover()
  await expect(categoryActions).toHaveCSS('opacity', '1')
  await categoryActions.click()
  await expect(inspector.getByRole('dialog', { name: '绑定 类目' })).toBeVisible()
  // Escape 关闭：关闭按钮被变量选择器自己的浮层压住，而 Escape 本来就是它的关闭语义。
  await page.keyboard.press('Escape')
  await expect(inspector.getByRole('dialog', { name: '绑定 类目' })).toHaveCount(0)
  const seriesHeader = seriesActions.locator('..').locator('..')
  await seriesHeader.hover()
  await expect(seriesActions).toHaveCSS('opacity', '1')
  await seriesActions.click()
  await expect(inspector.getByRole('dialog', { name: '绑定 系列' })).toBeVisible()
})


test('OpenSpec: basic-materials / 第一方图表物料 / 三格各画出对应的图，改类型不丢数据', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()

  for (const [label, kind] of [['折线图', 'line'], ['柱状图', 'bar'], ['饼图', 'pie']] as const) {
    await editor.getByRole('button', { name: `添加 ${label}` }).click()
    const node = stage.locator(`[data-chart-kind="${kind}"]`)
    await expect(node).toBeVisible()
    await expect(node.locator('canvas')).toBeVisible()
  }

  // 用户找的是「饼图」，不是「图表，然后去属性面板改类型」——三格各出一个 Entity。
  await expect(stage.getByTestId('compose-material-chart')).toHaveCount(3)
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


test('OpenSpec: basic-materials / 关联组件实例物料 / 实例暴露组件根属性且可 Resize', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
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

  // 嵌套矩形画在它自己的 SVG 上——矩形现在是曲线，默认空心，看得见的墨只有描边。
  const material = stage.getByTestId('compose-material-curve-stroke')
  await expect(material).toBeVisible()
  await expect(material).toHaveAttribute('fill', 'none')
  await expect(material).toHaveAttribute('stroke', '#d8e2f1')
  const nestedRect = material.locator(
    'xpath=ancestor::*[@data-component-instance-entity-id][1]',
  )
  // 宿主盒**不画**曲线的背景（盒是矩形而形状不是），也不裁它（描边以几何为中心画，
  // 必然向外超出半个线宽）。两条都是嵌套渲染路径与 Stage 共用的那一份判断。
  await expect(nestedRect).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(nestedRect).toHaveCSS('overflow', 'visible')
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
  await pointerDrop(page, editor.getByRole('button', { name: '添加 组件切换器' }), {
    x: outputBox!.x + 260,
    y: outputBox!.y + 300,
  })
  const switcher = stage.getByTestId('stage-container')
  await expect(switcher).toBeVisible()

  const rootRenderers = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  for (const x of [80, 300]) {
    await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
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
    /*
     * 抓**下边线**：矩形默认空心，盒内部不命中，可拖的只有那一圈描边；取下边而不是上边，
     * 是因为这两个矩形以落点为中心放置，上边线落在场景之外。
     */
    await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height - 1)
    await page.mouse.down()
    // 抓点在下边线而不是盒中心，因此终点也要按同一个偏移落——挂载按对象落在哪里判定，
    // 直接把下边线拖到 switcher 中心会让盒中心落到它上面去。
    await page.mouse.move(dropPoint.x, dropPoint.y + rectBox!.height / 2 - 1, { steps: 8 })
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


