import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 两个内建工作区：页面与绘图。
 *
 * @remarks
 * 判别性用例是「同一条命令在两边都启动得了」与「事务日志没有新行」：工作区不是模式——它换的是
 * 面板、货架与会话开关，换不了**命令可用性**，也不碰文档。只断言「布局变了」的用例在一个把
 * 绘图做成模式的实现上同样会绿。
 *
 * 命令一律从**命令行**启动而不是点工具栏按钮：工具栏货架按工作区不同（见
 * `add-shelf-customization`），而「这条命令还在不在」正是这里要断的那件事——它与那颗按钮在不在
 * 货架上无关。
 */
async function openEditor(page: Page, query = '?no-auto-fit') {
  await page.goto(`/${query}`)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  // 等首页文档真的打开：那一步会换掉运行时并重建 Stage，早打的记号会跟着没掉，而那与切换无关。
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]').first()).toBeVisible()
  const switcher = editor.getByRole('radiogroup', { name: '工作区' })
  return { editor, stage, switcher }
}

function libraryPanel(editor: Locator) {
  return editor.locator('[data-workspace-panel="component-library"]')
}

/** 从命令行启动一条命令；与点工具栏上那颗按钮等价，但不依赖它在不在货架上。 */
async function startCommand(page: Page, stage: Locator, name: string) {
  const input = stage.getByRole('combobox', { name: '命令行' })
  await input.click()
  await input.fill(name)
  await page.keyboard.press('Enter')
}

/** 十字光标一条臂的屏幕长度；命令取点期间才画。 */
async function crosshairReach(page: Page) {
  return page.evaluate(() => {
    const line = document.querySelector('[data-stage-crosshair-line]')
    if (!line) return 0
    const box = line.getBoundingClientRect()
    return Math.max(box.width, box.height)
  })
}

test('OpenSpec: editor-workspace-layout / 内建工作区 / 绘图的初始布局与命令可用性不变', async ({ page }) => {
  const { editor, stage, switcher } = await openEditor(page)
  // 内建恰好三个：页面、绘图、动画。
  await expect(switcher.getByRole('radio')).toHaveCount(3)
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')

  const pageLibrary = (await libraryPanel(editor).boundingBox())!

  // 页面：十字光标贯穿图面——三个内建工作区的会话开关此后逐字相同，臂长不再分叉。
  await startCommand(page, stage, 'LINE')
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.move(surface.x + 300, surface.y + 240)
  await expect.poll(async () => await crosshairReach(page) > 0).toBe(true)
  const pageReach = await crosshairReach(page)
  await page.keyboard.press('Escape')

  await editor.locator('[data-workspace-tab="compose-transaction-log"]').click()
  const log = editor.getByRole('region', { name: '操作日志' })
  await expect(log).toBeVisible()
  const rowsBefore = await log.getByRole('button').count()

  // 给 Stage 打个记号：切换不得重建它。
  await stage.evaluate((element) => { element.setAttribute('data-probe', 'same') })
  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')

  // 1) 工具组标题变成「符号库」且是活动标签。
  const shelfTab = editor.locator('[data-workspace-tab="compose-component-library-panel"]')
  await expect(shelfTab).toContainText('符号库')
  await expect(libraryPanel(editor)).toBeVisible()

  // 2) 分栏拉高：工具组比页面工作区高，左栏仍在左边。
  const drawingLibrary = (await libraryPanel(editor).boundingBox())!
  expect(drawingLibrary.height).toBeGreaterThan(pageLibrary.height)
  expect(drawingLibrary.x).toBeLessThan(300)

  // 3) 底部边缘组折叠：上一步展开过底部（点了日志标签），切到绘图之后它按 preset 收回去，
  //    面板体不占地方（标签仍在，收起的是内容）。
  const bottomHeight = async () => editor.locator('[data-workspace-panel="asset-browser"]')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(await bottomHeight()).toBeLessThan(40)

  /*
   * 4) 十字光标与页面工作区**一样长**。
   *
   * 这里曾经断「绘图 > 页面的 5 倍」——臂长是三边唯一剩下的默认值差异，而那个分叉在屏幕上
   * 无法解释：臂长没有工具栏开关，用户读不出「这是我自己设的」还是「这个工作区本来就这样」。
   */
  await startCommand(page, stage, 'LINE')
  await page.mouse.move(surface.x + 300, surface.y + 240)
  await expect.poll(async () => await crosshairReach(page)).toBeCloseTo(pageReach, 0)
  await page.keyboard.press('Escape')

  // 5) 命令可用性一个字节不变：在页面里启动得了的命令，在绘图里同样启动得了。这是「不是模式」
  //    在屏幕上唯一能被证伪的那一半——货架换不换是另一件事。
  await startCommand(page, stage, 'CIRCLE')
  // 断的是**提示**而不是十字光标：命令行启动的命令此刻还不知道指针在哪，按既有规则先不画，
  // 要等第一次 pointermove。会话起没起来，只有提示这一处说得准。
  await expect(stage.getByText('指定圆心')).toBeVisible()
  await page.keyboard.press('Escape')

  // 6) 画布没有重挂载，事务日志没有新行。
  await expect(stage).toHaveAttribute('data-probe', 'same')
  await editor.locator('[data-workspace-tab="compose-transaction-log"]').click()
  await expect(log.getByRole('button')).toHaveCount(rowsBefore)
})

test('OpenSpec: component-library / 混合组件目录 / 符号库按子文件夹分组、搜索与找不到', async ({ page }) => {
  const { editor, switcher } = await openEditor(page, '?symbols&no-auto-fit')
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await expect(assets).toBeVisible()

  // 先把两个不同分类下的符号导入成项目组件：符号就是项目组件，分类就是它所在的文件夹。
  const importSymbol = async (folder: string, file: RegExp) => {
    // 从左边的树进 Symbols：网格里的单击要目标行还没被选中才进得去，而这个流程要来回走
    // 好几趟，树是它唯一每次都成立的入口。
    await assets.getByRole('treegrid').getByRole('row', { name: 'Symbols' }).click()
    const symbolsGrid = assets.getByRole('grid', { name: 'Symbols' })
    await expect(symbolsGrid).toBeVisible()
    const folderGrid = assets.getByRole('grid', { name: folder })
    // 目录刚重新列举完时，落在正在被替换的那一行上的点击会丢掉：进不去就再点一次。
    await expect(async () => {
      await symbolsGrid.getByRole('gridcell', { name: new RegExp(`^${folder}`) }).click()
      await expect(folderGrid).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })
    await folderGrid.getByRole('gridcell', { name: file }).click({ button: 'right' })
    await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()
    await expect(folderGrid.getByRole('gridcell', { name: /\.component\.json/ }).first()).toBeVisible()
    // 导入的诊断提示浮在右下角，正好压在资源面板上：不关掉它，下一次点击会落在提示上。
    const notice = editor.locator('.compose-editor__page-notice')
    if (await notice.count() > 0) await notice.getByRole('button', { name: '关闭' }).click()
  }
  await importSymbol('bandaoti-dianziguan', /^电缆终端头\.svg/)
  await importSymbol('kaiguan-baohu', /^断路器1\.svg/)

  await switcher.getByRole('radio', { name: '绘图' }).click()
  const shelf = libraryPanel(editor)
  // 段标题是文件夹名；组按一级子文件夹分，空的分类也占一组（写着 0）。
  await expect(shelf.getByRole('heading', { name: 'Symbols (2)' })).toBeVisible()
  await expect(shelf.getByRole('heading', { name: 'bandaoti-dianziguan (1)' })).toBeVisible()
  await expect(shelf.getByRole('heading', { name: 'kaiguan-baohu (1)' })).toBeVisible()
  await expect(shelf.getByRole('heading', { name: 'sign (0)' })).toBeVisible()

  // 搜索跨段：只剩名称匹配的那一项，它所在的组保留。
  await shelf.getByTestId('component-library-search').fill('终端')
  await expect(shelf.getByRole('heading', { name: 'Symbols (1)' })).toBeVisible()
  // 段内计数：符号库那一段只剩命中的那一项。（同一个组件也出现在「项目组件」那一段——
  //  它列的是全部项目组件，符号库是它的一个按文件夹取的快捷入口。）
  const symbolsSection = shelf.locator('[data-shelf-section="symbols"]')
  await expect(symbolsSection.getByRole('button', { name: '添加主组件 电缆终端头' })).toHaveCount(1)
  await expect(symbolsSection.getByRole('button', { name: '添加主组件 断路器1' })).toHaveCount(0)
  await shelf.getByTestId('component-library-search').fill('')

  // 选文件夹不选文件：往同一个文件夹里再导一个，不改任何设置它就出现在那一组里。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await expect(assets).toBeVisible()
  await importSymbol('kaiguan-baohu', /^刀闸1\.svg/)
  await expect(shelf.getByRole('heading', { name: 'kaiguan-baohu (2)' })).toBeVisible()
})

test('OpenSpec: component-library / 混合组件目录 / 货架引用的文件夹不在资源里', async ({ page }) => {
  // 没有 `?symbols` 的项目里根本没有 Symbols 文件夹：那一段说找不到并可去掉，其余段照常。
  const { editor, switcher } = await openEditor(page)
  await switcher.getByRole('radio', { name: '绘图' }).click()
  const shelf = libraryPanel(editor)
  await expect(shelf.getByRole('heading', { name: 'Symbols' })).toBeVisible()
  await expect(shelf.getByText('找不到这个文件夹')).toBeVisible()
  await expect(shelf.getByRole('heading', { name: '项目组件 (0)' })).toBeVisible()
  await shelf.getByRole('button', { name: '去掉' }).click()
  await expect(shelf.getByRole('heading', { name: 'Symbols' })).toHaveCount(0)
  await expect(shelf.getByRole('heading', { name: '项目组件 (0)' })).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 新建文档种子 / 绘图里新建页面网格读 10 且不开对齐吸附', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')

  const createPage = async (name: string) => {
    await editor.locator('[data-workspace-tab="compose-assets"]').click()
    await expect(assets).toBeVisible()
    // 资源浏览器的当前目录是会话状态（面板不重挂载），因此每次都从左边的树进 Pages。
    await assets.getByRole('treegrid').getByRole('row', { name: 'Pages' }).click()
    const pages = assets.getByRole('grid', { name: 'Pages' })
    await expect(pages).toBeVisible()
    await pages.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
    await page.getByRole('menu').getByRole('menuitem', { name: '创建页面', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('名称').fill(name)
    await dialog.getByRole('button', { name: '创建' }).click()
    await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: name }))
      .toHaveCount(1)
  }

  /** 画布设置里这份文档的网格步长与两个吸附开关。 */
  const canvasSettings = async () => {
    await editor.getByRole('button', { name: '网格大小' }).click()
    await editor.getByRole('menu', { name: '网格大小' })
      .getByRole('menuitem', { name: '画布设置' })
      .click()
    const settings = editor.getByRole('dialog', { name: '画布网格与吸附设置' })
    const read = {
      stepX: await settings.getByRole('textbox', { name: 'X 步长' }).inputValue(),
      nodes: await settings.getByRole('checkbox', { name: '节点吸附' }).isChecked(),
      guides: await settings.getByRole('checkbox', { name: '辅助线吸附' }).isChecked(),
    }
    // 一定要按「取消」关掉：弹框的草稿是打开那一刻的快照，留着不关下一次读到的还是它。
    await settings.getByRole('button', { name: '取消' }).click()
    await expect(settings).toBeHidden()
    return read
  }

  await createPage('页面种子')
  // 页面：8 格，对齐吸附两项都开——它是搭大屏时把控件对齐到邻居的那一层。
  expect(await canvasSettings()).toEqual({ stepX: '8', nodes: true, guides: true })

  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  await createPage('绘图种子')
  // 绘图：10 格，对齐吸附关。关的只是 Figma 式参考线那一层——网格吸附与端点/端口捕捉照旧，
  // 后者正是接线图上每一次落笔真正依赖的东西。
  expect(await canvasSettings()).toEqual({ stepX: '10', nodes: false, guides: false })

  // 种子只在新建时落地：切回页面工作区不改这份文档的网格与吸附，一个字节都不动。
  await switcher.getByRole('radio', { name: '页面' }).click()
  expect(await canvasSettings()).toEqual({ stepX: '10', nodes: false, guides: false })
})

test('OpenSpec: editor-workspace-layout / 工作区切换 / 按文档记住是哪个工作区', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const shelfTab = editor.locator('[data-workspace-tab="compose-component-library-panel"]')
  const homeTab = editor.locator('[data-workspace-tab^="compose-page-document:"]').first()
  await expect(homeTab).toBeVisible()

  // A 页（首页）在绘图。
  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(shelfTab).toContainText('符号库')

  // B 页新建出来之后停在页面工作区。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await assets.getByRole('treegrid').getByRole('row', { name: 'Pages' }).click()
  const pages = assets.getByRole('grid', { name: 'Pages' })
  await expect(pages).toBeVisible()
  await pages.getByRole('gridcell', { name: 'Home' }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '创建页面', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('接线图 B')
  await dialog.getByRole('button', { name: '创建' }).click()
  const secondTab = editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: '接线图 B' })
  await expect(secondTab).toHaveCount(1)
  await switcher.getByRole('radio', { name: '页面' }).click()
  await expect(shelfTab).toContainText('基础组件')

  // A → B → A：回到 A 时左栏回到符号库。
  await homeTab.click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  await expect(shelfTab).toContainText('符号库')
  await secondTab.click()
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')
  await homeTab.click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  await expect(shelfTab).toContainText('符号库')
})

test('OpenSpec: editor-workspace-layout / 内建工作区 / 两张工作区黄金图', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  await expect(editor.locator('[data-workspace-panel="component-library"]')).toBeVisible()
  await expect(editor).toHaveScreenshot('workspace-page.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(editor.locator('[data-workspace-tab="compose-component-library-panel"]')).toContainText('符号库')
  /*
   * OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / 绘图货架不再溢出
   * 模式切换器搬去标签行之后，它连同那条竖线腾出的约 87px 还给了货架——正是此前把这条 16 格
   * 货架挤进「更多」的那 87px。
   */
  await expect(editor.getByRole('toolbar', { name: 'Stage 工具栏' })
    .getByRole('button', { name: '更多', exact: true })).toHaveCount(0)
  await expect(editor).toHaveScreenshot('workspace-drawing.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
})
