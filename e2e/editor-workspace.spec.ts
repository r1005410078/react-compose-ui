import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { pointerDrop, drawContainer, drawText, expandInspectorSection, switchToDrawingWorkspace } from './support/test-helpers'


/**
 * 读出 X 轴上**最细**的那一层网格的屏幕间距。
 *
 * @remarks
 * 不能按固定下标取：网格的图层数会随缩放变化（细档淡到 0 时那一层被丢掉），
 * 而且大格分两级。X 轴的层写成 `<间距>px 100%`，取最后一条即最细的那层。
 */
const finestGridStepX = (element: Element) => {
  const sizes = getComputedStyle(element).backgroundSize.split(', ')
  const xs = sizes.filter((size) => size.endsWith('100%'))
  return Number.parseFloat(xs[xs.length - 1]!)
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
  /*
   * Palette 只保留在**当前工作区**没有工具栏入口的 Preset。页面工作区的货架上没有 `CIRCLE`，
   * 因此圆的瓦片在这里**出现**——`paletteHidden` 的判据按货架求值，不然页面里既没有按钮也
   * 没有瓦片。Text 与箭头的入口都在页面货架上，因此仍不出现；Wire 是自己的理由，恒不出现。
   */
  await expect(componentLibrary.getByRole('heading', { name: '基础组件 (6)' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 圆' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 矩形' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加 组件切换器' })).toBeVisible()
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

  // 左右两侧是普通组而不是边缘组：只有底部一个边缘组，它因此横跨整个编辑器宽度。
  const left = editor.locator('[data-workspace-panel="scene-graph"]')
  const right = editor.locator('[data-workspace-panel="inspector"]')
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
  // 页面模式下没有无文件的固定画布；画布组只承载画布，文档表面跟随活动页面。
  await expect(editor.locator('[data-workspace-panel="canvas-document"]')).toHaveCount(0)
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'Home' })).toBeVisible()
  expect(leftBox!.x).toBeLessThan(homeDocumentBox!.x)
  expect(rightBox!.x).toBeGreaterThanOrEqual(homeDocumentBox!.x + homeDocumentBox!.width)
  expect(bottomBox!.y).toBeGreaterThan(homeDocumentBox!.y)
  expect(bottomBox!.height).toBeLessThan(80)
  // 底部横跨全宽：它不被左右两栏夹着（两端各让出一条 6px 沟槽）。
  expect(Math.round(bottomBox!.width)).toBe(Math.round(editorBox!.width) - 12)
  // 单一 Dockview：整个编辑器只有一个 Dockview 根，左右没有竖向图标轨。
  await expect(editor.locator('.dv-dockview')).toHaveCount(1)
  await expect(editor.locator('.compose-editor__icon-tab')).toHaveCount(0)
  /*
   * 应用顶栏：标志 ▾ ｜ 工作区 ｜ 三个布局开关。它横贯全宽、在 Dockview 之外，**只**承载应用
   * 与视图作用域——文档标签、保存按钮与模式切换器都不在这里。
   */
  const topBar = editor.locator('.compose-editor__top-bar')
  const topBarBox = await topBar.boundingBox()
  expect(Math.round(topBarBox!.width)).toBe(Math.round(editorBox!.width))
  expect(Math.round(topBarBox!.height)).toBe(30)
  await expect(topBar.getByRole('button', { name: '应用菜单' })).toBeVisible()
  await expect(topBar.getByRole('radiogroup', { name: '工作区' })).toBeVisible()
  await expect(topBar.getByRole('button', { name: '新建工作区' })).toBeVisible()
  await expect(topBar.locator('.compose-editor__layout-toggles').getByRole('button')).toHaveCount(3)
  await expect(topBar.getByRole('tab')).toHaveCount(0)
  await expect(topBar.getByRole('button', { name: /保存/ })).toHaveCount(0)
  await expect(topBar.getByRole('button', { name: '设置', exact: true })).toHaveCount(0)
  await expect(topBar.getByRole('radiogroup', { name: '编辑模式' })).toHaveCount(0)

  /*
   * 文档标签条下沉到**画布列自己的头**上：它只占画布那一列，且与左右两栏的面板头顶边同 y、
   * 同高 30px——三列因此读成一行。
   */
  const documentTabs = editor.locator('.compose-editor__document-tabs')
  await expect(documentTabs.getByRole('tablist', { name: '文档' })).toBeVisible()
  const documentTabsBox = await documentTabs.boundingBox()
  expect(documentTabsBox!.width).toBeLessThan(editorBox!.width - 300)
  const sceneTab = editor.locator('[data-workspace-tab="compose-scene-content-panel"]').locator('xpath=ancestor::*[contains(@class, "dv-tabs-and-actions-container")][1]')
  const sceneHeadBox = await sceneTab.boundingBox()
  expect(Math.round(documentTabsBox!.y)).toBe(Math.round(sceneHeadBox!.y))
  expect(Math.round(documentTabsBox!.height)).toBe(30)
  expect(Math.round(sceneHeadBox!.height)).toBe(30)
  await expect(editor.locator('[data-workspace-tab="compose-canvas"]')).toBeHidden()
  await expect(documentTabs.getByRole('button', { name: /保存/ })).toHaveCount(0)
  await expect(documentTabs.getByRole('radiogroup', { name: '工作区' })).toHaveCount(0)
  await expect(editor.locator('.compose-editor__collapse-side')).toHaveCount(0)
  await expect(editor.locator('.compose-editor__side-handle')).toHaveCount(0)

  /*
   * 一种「被选中」的画法：顶栏、文档标签与面板头三处都是同一块柔和的圆角底，而画布工具栏的
   * 按下态**保持蓝底**——导航与状态是两个问题。断的是**计算后的颜色**：本仓库有过样式被一条
   * 无层规则静默压掉的先例（`@layer components` 输给无层的 `button { color: inherit }`），
   * 只断 class 的用例挡不住那一类。
   */
  const chromeSelectedBg = 'rgb(41, 46, 54)'
  const bg = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await bg(documentTabs.locator('[data-active="true"]').first())).toBe(chromeSelectedBg)
  expect(await bg(topBar.locator('[aria-checked="true"]').first())).toBe(chromeSelectedBg)
  expect(await bg(editor.locator('.dv-tab.dv-active-tab').first())).toBe(chromeSelectedBg)
  // 活动标签靠底而不是下划线：`box-shadow` 上没有任何东西。
  expect(await documentTabs.locator('[data-active="true"]').first()
    .evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  const pressedTool = editor.getByRole('toolbar', { name: 'Stage 工具栏' })
    .getByRole('button', { name: '选择' })
  expect(await pressedTool.evaluate((el) => getComputedStyle(el, '::before').backgroundColor))
    .toBe('rgb(27, 57, 95)')
  /*
   * 「设计 / 动画」模式切换器已删：动画的布局那一半归了工作区（内建「动画」带时间线面板），
   * 语义那一半是时间线 chrome 上的开关。标签行与工具栏行上都没有它。
   */
  await expect(editor.getByRole('radiogroup', { name: '编辑模式' })).toHaveCount(0)
  await expect(editor.getByRole('radiogroup', { name: '工作区' }).getByRole('radio', { name: '动画' }))
    .toBeVisible()
  /*
   * 工具栏行 36px 且**上下都不画线**：卡内不画横线，分层交给色阶——这一行取画布那一档
   * （`surface-sunken`），因为它服务的是画布而不是卡头。断计算值而不是 class：样式靠层叠
   * 生效，只断 class 挡不住被压掉的那一类。
   */
  const toolbarRow = editor.locator('.compose-editor__canvas-toolbar').first()
  expect(Math.round((await toolbarRow.boundingBox())!.height)).toBe(36)
  expect(await bg(toolbarRow)).toBe('rgb(21, 24, 29)')
  expect(await toolbarRow.evaluate((el) => {
    const style = getComputedStyle(el)
    return `${style.borderTopWidth}/${style.borderBottomWidth}`
  })).toBe('0px/0px')
  // 画布上方一共 102px：顶栏 30 + 沟槽 6 + 头部行 30 + 工具栏 36。卡的边框是 inset 阴影，不占布局。
  const canvasContentBox = await editor.locator('.compose-editor__canvas-content').first().boundingBox()
  expect(Math.round(canvasContentBox!.y - editorBox!.y)).toBe(102)
  /*
   * 两行的填充块左边落在同一个数上：活动标签的灰底与选中工具的蓝底是两块相距 30px 的实心
   * 矩形。此前一个在 5、一个在 6——看得出不对，但指不出哪里。
   */
  const activeTabBox = await documentTabs.locator('[data-active="true"]').first().boundingBox()
  const pressedToolBox = await pressedTool.boundingBox()
  expect(Math.round(activeTabBox!.x)).toBe(Math.round(pressedToolBox!.x))
  // 默认三栏下页面工作区那条货架放得下：没有「更多」。导线不在页面的货架上（接线是绘图的活儿），
  // 矩形在——它是大屏页面真会画的那一个。
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })
  // 按钮尺寸与命中区一个像素不改——省的只是留白。
  expect(Math.round((await toolbar.getByRole('button', { name: '选择' }).boundingBox())!.height)).toBe(30)
  await expect(toolbar.getByRole('button', { name: '更多', exact: true })).toHaveCount(0)
  await expect(toolbar.locator('[data-command-id="WIRE"]')).toHaveCount(0)
  await expect(toolbar.locator('[data-command-id="RECTANGLE"]')).toBeVisible()
  expect(await bottom.locator('[data-workspace-tab]').evaluateAll(
    (tabs) => tabs.map((tab) => tab.getAttribute('data-workspace-tab')),
  )).toEqual(['compose-assets', 'compose-command', 'compose-transaction-log'])
  await expect(componentLibrary).toHaveScreenshot('component-library-dock.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
})


test('OpenSpec: editor-workspace-layout / 面板卡片化 / 四张卡浮在更暗的桌面上', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor.getByRole('application', { name: 'Stage' })).toBeVisible()
  const box = async (locator: Locator) => (await locator.boundingBox())!
  const editorBox = await box(editor)
  const bg = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)

  /*
   * 一张卡 = 顶栏一颗折叠开关管的那一块，加上画布——因此恰好四张，而不是五个 Dockview 组：
   * 左边那颗开关一按收走两个组，画成两张卡等于让一颗按钮同时抓走两个看起来各自独立的对象。
   */
  const cards = editor.locator([
    '.dv-grid-view > .dv-branch-node > .dv-split-view-container > .dv-view-container',
    '> .dv-view > .dv-branch-node',
  ].join(' ')).or(editor.locator([
    '.dv-grid-view > .dv-branch-node > .dv-split-view-container > .dv-view-container',
    '> .dv-view > .dv-groupview',
  ].join(' '))).or(editor.locator('.dv-groupview.dv-edge-group'))
  await expect(cards).toHaveCount(4)

  /*
   * 桌面比卡片更暗。断**计算后的值**：两个 token 此前是同一个 `#101216`，看不出问题只是因为
   * 那时没有任何地方露出桌面；只断 class 的用例挡不住它退回同值。
   */
  const desk = await bg(editor)
  expect(desk).toBe('rgb(10, 12, 15)')
  const cardBoxes: { x: number, y: number, width: number, height: number }[] = []
  for (const card of await cards.all()) {
    expect(await bg(card)).toBe('rgb(16, 18, 22)')
    expect(await card.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('8px')
    cardBoxes.push(await box(card))
  }

  // 编辑器四边各留一条 6px 沟槽。
  const left = cardBoxes.reduce((a, b) => (a.x <= b.x ? a : b))
  const right = cardBoxes.reduce((a, b) => (a.x + a.width >= b.x + b.width ? a : b))
  expect(Math.round(left.x - editorBox.x)).toBe(6)
  expect(Math.round(editorBox.x + editorBox.width - right.x - right.width)).toBe(6)

  /*
   * 沟槽就是 sash：可见的 6px 与拖得到的 6px 是同一条。此前看得见 1px、拖得到 4px 且不可见,
   * 而在贴边布局里这个问题修不了——把 1px 线加粗到 6px，那 6px 就是一条粗黑线。
   */
  const canvasCard = editor.locator([
    '.dv-grid-view > .dv-branch-node > .dv-split-view-container > .dv-view-container',
    '> .dv-view > .dv-groupview',
  ].join(' ')).first()
  const canvasCardBox = await box(canvasCard)
  const gutter = Math.round(canvasCardBox.x - left.x - left.width)
  expect(gutter).toBe(6)
  const sash = editor.locator('.dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash').first()
  const sashBox = await box(sash)
  expect(Math.round(sashBox.width)).toBe(6)
  expect(Math.round(sashBox.x)).toBe(Math.round(left.x + left.width))
  // 沟槽里不再画线：它本身就是那条边界。
  await expect(editor.locator('.dv-splitview-has-margin > .dv-view-container > .dv-view')
    .first()).toHaveCSS('border-top-width', '0px')

  /*
   * 左区是**一张**卡：两段之间既不是沟槽也不是线，接缝处露出的仍是卡片自己的底。
   * 两个组本身不着色、不圆角——卡面画在它们上面那一层。
   */
  const leftGroups = editor.locator([
    '.dv-grid-view > .dv-branch-node > .dv-split-view-container > .dv-view-container',
    '> .dv-view > .dv-branch-node .dv-groupview',
  ].join(' '))
  await expect(leftGroups).toHaveCount(2)
  for (const group of await leftGroups.all()) {
    expect(await bg(group)).toBe('rgba(0, 0, 0, 0)')
    expect(await group.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px')
  }
  const sceneBox = await box(editor.locator('[data-workspace-panel="scene-graph"]'))
  const seamColor = await page.evaluate(([x, y]) => {
    const element = document.elementFromPoint(x, y)
    return element ? getComputedStyle(element).backgroundColor : null
  }, [Math.round(sceneBox.x + sceneBox.width / 2), Math.round(sceneBox.y + sceneBox.height + 3)])
  expect(seamColor).not.toBe(desk)
})

test('OpenSpec: property-panel / 属性面板视觉与样式隔离 / 拖窄到最小宽度不溢出', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor.getByRole('application', { name: 'Stage' })).toBeVisible()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const panel = inspector.locator('[data-compose-ui="property-panel"]')
  await expect(panel).toBeVisible()

  // 默认 288：标签列按比例算出来约 109（视图扣掉沟槽后约 284 × 0.38）。
  const labelWidth = () => panel.evaluate(
    (el) => getComputedStyle(el).getPropertyValue('--pp-label-width').trim(),
  )
  expect(Number.parseInt(await labelWidth(), 10)).toBeGreaterThanOrEqual(100)
  expect(Number.parseInt(await labelWidth(), 10)).toBeLessThanOrEqual(116)

  /*
   * 拖到最小宽度：面板自己的 `min-width` 必须跟着降到 264，否则面板会溢出到卡片外面被裁掉
   * ——那正是此前把右区拖窄时的样子。
   */
  const gutter = editor
    .locator('.dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash').nth(1)
  const gutterBox = (await gutter.boundingBox())!
  await page.mouse.move(gutterBox.x + 3, gutterBox.y + 200)
  await page.mouse.down()
  await page.mouse.move(gutterBox.x + 300, gutterBox.y + 200, { steps: 8 })
  await page.mouse.up()
  const inspectorBox = (await inspector.boundingBox())!
  expect(Math.round(inspectorBox.width)).toBeLessThanOrEqual(266)
  const panelBox = (await panel.boundingBox())!
  expect(Math.round(panelBox.width)).toBeLessThanOrEqual(Math.round(inspectorBox.width))
})

test('OpenSpec: editor-workspace-layout / 边缘工具区 / 收起再展开', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const scene = editor.locator('[data-workspace-panel="scene-graph"]')
  const canvasBefore = await editor.locator('[data-workspace-panel="canvas"]').boundingBox()
  const inspectorBefore = await inspector.boundingBox()

  /*
   * 折叠的入口只有顶栏那三颗开关一处：组头上的折叠按钮与收起后留在编辑器边缘的 8px 把手
   * 都删了——那两样是同一个动作的两个入口，而且不在同一个地方（收起用组头、展开用把手）。
   * 开关**位置不随面板存亡而移动**，因此这里收起与展开点的是同一颗。
   */
  const toggles = editor.locator('.compose-editor__layout-toggles')
  const rightToggle = toggles.getByRole('button', { name: /右侧面板$/ })
  await rightToggle.click()
  await expect(inspector).toBeHidden()
  await expect(rightToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(editor.locator('.compose-editor__side-handle')).toHaveCount(0)
  const canvasCollapsed = await editor.locator('[data-workspace-panel="canvas"]').boundingBox()
  // 收起让出的是右卡连同它那条沟槽：按实测宽度比，避免把 Inspector 的默认宽度写死在这里。
  expect(canvasCollapsed!.width).toBeGreaterThan(canvasBefore!.width + inspectorBefore!.width - 8)

  // 展开：恢复收起前的尺寸；面板内容没有重新挂载（同一个 Stage 元素还在）。
  const stageHandle = await stage.elementHandle()
  await rightToggle.click()
  await expect(inspector).toBeVisible()
  const inspectorBox = await inspector.boundingBox()
  // 网格的 sash 会把 1–2px 算进相邻的组，宽度按 ±4px 比较。
  expect(Math.abs(inspectorBox!.width - inspectorBefore!.width)).toBeLessThanOrEqual(4)
  expect(await stage.elementHandle().then((element) => element?.evaluate((el, prev) => el === prev, stageHandle))).toBe(true)

  // 左栏是两个组：一个按钮收起场景图与工具组两个。
  const leftToggle = toggles.getByRole('button', { name: /左侧面板$/ })
  await leftToggle.click()
  await expect(scene).toBeHidden()
  await expect(editor.locator('[data-workspace-panel="component-library"]')).toBeHidden()
  await leftToggle.click()
  await expect(scene).toBeVisible()
  expect(Math.abs((await scene.boundingBox())!.width - 280)).toBeLessThanOrEqual(4)
})


test('OpenSpec: editor-workspace-layout / 文档标签条 / 键盘在文档间移动', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' })
    .getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()

  const tablist = editor.getByRole('tablist', { name: '文档' })
  const tabs = tablist.getByRole('tab')
  await expect(tabs).toHaveCount(2)
  const counterTab = tabs.filter({ hasText: 'Counter' })
  const homeTab = tabs.filter({ hasText: 'Home' })
  await expect(counterTab).toHaveAttribute('aria-selected', 'true')
  await expect(editor.locator('[data-workspace-panel="page-document"][data-page-key="demo-counter-page"]'))
    .toBeVisible()

  // 只有活动标签在 Tab 序里；方向键在文档间移动并激活，画布跟随。
  await counterTab.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(homeTab).toHaveAttribute('aria-selected', 'true')
  await expect(homeTab).toBeFocused()
  await expect(editor.locator('[data-workspace-panel="page-document"][data-page-key="demo-home-page"]'))
    .toBeVisible()
  await expect(counterTab).toHaveAttribute('tabindex', '-1')
  // Delete 不关闭。
  await page.keyboard.press('Delete')
  await expect(tabs).toHaveCount(2)
  await page.keyboard.press('End')
  await expect(counterTab).toHaveAttribute('aria-selected', 'true')
})


test('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏 / 窄窗口收进更多', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await page.goto('/?no-auto-fit')
  // 溢出要在**装得最满**的那条货架上验：绘图有 15 格，页面只有 10 格，后者怎么都放得下。
  await switchToDrawingWorkspace(page)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })
  await expect(toolbar).toBeVisible()
  /*
   * 画布列由**拖沟槽**收窄，不靠改窗口：示例应用把编辑器钉在 `max(1180px, 100%)` 上，窗口再窄
   * 编辑器也不跟着窄，而 Inspector 收到 288 之后画布列比从前宽了一百多像素。这里顺带验了那条
   * 6px 沟槽真的是拖得到的。
   */
  const gutter = editor
    .locator('.dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash').nth(1)
  const gutterBox = (await gutter.boundingBox())!
  await page.mouse.move(gutterBox.x + 3, gutterBox.y + 200)
  await page.mouse.down()
  await page.mouse.move(gutterBox.x - 220, gutterBox.y + 200, { steps: 8 })
  await page.mouse.up()
  // 画布列放不下整条工具栏：尾部的绘图命令进「更多」，前面的照常。
  const more = toolbar.getByRole('button', { name: '更多', exact: true })
  await expect(more).toBeVisible()
  await expect(toolbar.locator('[data-command-id="ARROW"]')).toBeHidden()
  await expect(toolbar.getByRole('button', { name: '选择', exact: true })).toBeVisible()
  await more.click()
  const menu = toolbar.getByRole('menu', { name: '更多工具' })
  await expect(menu).toBeVisible()
  const arrowItem = menu.getByRole('menuitem', { name: '箭头' })
  await expect(arrowItem).toBeVisible()
  await expect(arrowItem.locator('svg')).toHaveCount(1)
  await arrowItem.click()
  // 菜单里的项就是那颗按钮：按下去启动同一条命令，命令行进入取点提示。
  await expect(editor.getByText(/指定/).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // 收起右栏之后画布变宽，整条工具栏放得下，「更多」消失。
  await editor.getByRole('button', { name: '收起右侧面板' }).click()
  await expect(more).toBeHidden()
  await expect(toolbar.locator('[data-command-id="ARROW"]')).toBeVisible()
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
  // 区域矩形只是几何锚点，描边是另一个元素——锚点带描边会把它的 boundingBox() 撑大半个像素。
  await expect(stage.locator('.compose-stage__output-edge')).toHaveCount(0)
  await expect(output).not.toHaveAttribute('stroke', /.+/)
  // 场景背景默认透明，边界只由这条 chrome 描边承担。
  await expect(stage.getByTestId('stage-frame-outline-frame-root')).toHaveCount(1)
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
  // 场景体不再是选中入口——裸点它是框选。选中走标题标签之外的第二个入口：command 点体。
  // 用 Meta 而不是 Control：macOS 上 Ctrl+左键会被 Chromium 翻译成右键。
  await page.keyboard.down('Meta')
  await page.mouse.click(outputBox!.x + 40, outputBox!.y + 40)
  await page.keyboard.up('Meta')

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
  // 细档间距恒在 [4, 8)：再密就翻倍 stride，因此缩到任何倍数下这个区间都成立。
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeGreaterThanOrEqual(4)
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeLessThan(8)
  for (let index = 0; index < 6; index += 1) {
    await stage.press('Control+-')
  }
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeGreaterThanOrEqual(4)
  await expect(editor).toHaveScreenshot('stage-workspace-canvas-inspector.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  for (let index = 0; index < 5; index += 1) {
    await stage.press('Control+-')
  }
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeGreaterThanOrEqual(4)
  await expect.poll(() => grid.evaluate(finestGridStepX)).toBeLessThan(8)
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
  // Text 与箭头在页面货架上有工具栏入口，因此不出现在 Palette；圆没有，因此出现。
  await expect(editor.getByRole('button').filter({ hasText: /Container|Rectangle|ECharts/ }))
    .toHaveCount(3)
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
    .toHaveCount(1)

  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  const containerTile = editor.getByRole('button', { name: '添加 容器' })
  // 先滚进视口再读盒：物料面板是可滚动的，前一步新建 Entity 会让场景树长一行、把面板整体推走，
  // 而读到的旧坐标此时落在瓦片之外——按下去打在面板底板上，拖拽根本不会开始。
  await containerTile.scrollIntoViewIfNeeded()
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

  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
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
  /*
   * 用宿主注册的**图表**物料而不是矩形：这条用例最后要给这个 Entity 加「容器」能力，而矩形
   * 现在是曲线，「`Curve` 不能与 Hierarchy 组合」——一条曲线不是容器。图表同样是叶子
   * Renderer，「一个 Entity 既是 Renderer 又是 Container」这件要验的事一个字不变。
   */
  await editor.getByRole('button', { name: '添加 图表' }).click()

  const rectangle = stage.locator('.compose-stage__node.is-renderer').first()
  await rectangle.click()
  const entityId = await rectangle.getAttribute('data-entity-id')
  expect(entityId).not.toBeNull()
  const inspector = editor.getByRole('region', { name: 'ECharts Chart 属性', exact: true })
  const propertyRoot = inspector.getByRole('region', { name: 'ECharts Chart 属性字段' })
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
  await expect(composed.locator('.stage-demo__chart')).toBeVisible()
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
  // 设置的入口是应用菜单里的一项：顶栏右端那颗齿轮已经删掉。
  const appMenuButton = editor.getByRole('button', { name: '应用菜单' })
  await appMenuButton.click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
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
  // 关掉之后焦点回到标志：它现在是设置的入口，也是它唯一的锚点。
  await expect(appMenuButton).toBeFocused()
  await expect(editor).toHaveScreenshot('editor-workspace-light.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
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

  await editor.getByRole('button', { name: 'Application menu' }).click()
  await editor.getByRole('menuitem', { name: 'Settings' }).click()
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

  await editor.getByRole('button', { name: 'Application menu' }).click()
  await editor.getByRole('menuitem', { name: 'Settings' }).click()
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
  // 宿主注入的 `editor.settings` 文案落在应用菜单那一项上——设置的入口现在在那里。
  await overriddenEditor.getByRole('button', { name: '应用菜单' }).click()
  await overriddenEditor.getByRole('menuitem', { name: '偏好设置' }).click()
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
  await expect(editor.locator('[data-workspace-panel="canvas-document"]')).toHaveCount(0)
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
  /*
   * 标签条右端那颗保存按钮已经删掉：「改没改过」标签上的脏点已经在回答，同一个问题不该在两处
   * 回答，而那颗按钮多数时候是禁用的、占的却是常驻位置。保存现在是 `document.save` 动作——
   * 键位（默认仍是 Cmd/Ctrl+S）与命令面板两条入口。
   */
  await expect(editor.locator('.compose-editor__document-tabs')
    .getByRole('button', { name: /保存/ })).toHaveCount(0)

  await drawContainer(page, editor)
  await expect(dirty).toBeVisible()

  // 命令面板保存：不关闭标签也能落盘
  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  await commandPanel.getByRole('combobox', { name: '检索命令' }).fill('保存文档')
  await commandPanel.getByRole('option', { name: /保存文档/ }).first().click()
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

  // 新建 Panel 会自动选中它；这一步本身派发一条命令。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
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
  await editor.getByRole('button', { name: '添加 矩形' }).click()
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

  // 键盘路径：新建的 Panel 仍处于选中状态，直接按适配选择键位。
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
