import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 工具栏货架：两个内建各有一条，且收走按钮不收走能力。
 *
 * @remarks
 * 判别性用例是**「页面里被收走的命令仍可用」**：只断言「两边按钮不一样」的用例，在一个把绘图
 * 做成模式（真的关掉了那些命令）的实现上同样会绿。货架换的是入口，命令行、快捷键与命令面板
 * 三条路一条都不能少。
 */
async function openEditor(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]').first()).toBeVisible()
  return { editor, stage, switcher: editor.getByRole('radiogroup', { name: '工作区' }) }
}

/** 工具栏上此刻**列在栏上**的格；收进「更多」的不算。 */
function shelfItems(editor: Locator) {
  return editor.getByRole('toolbar', { name: 'Stage 工具栏' }).locator('[data-toolbar-item]:not([hidden])')
}

function itemIds(editor: Locator) {
  return shelfItems(editor).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-toolbar-item')))
}

/**
 * 货架上的全部格，含被溢出收进「更多」的那些。
 *
 * @remarks
 * 「货架里有哪几条」与「这一帧放不放得下」是两个问题。默认窗口下绘图货架的尾部会进「更多」
 * （行尾还钉着模式切换器），拿可见格去断货架内容会把这两件事混成一件——而它们各有各的用例。
 */
function shelfIds(editor: Locator) {
  return editor
    .getByRole('toolbar', { name: 'Stage 工具栏' })
    .locator('[data-toolbar-item]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-toolbar-item')))
}

test('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏 / 两个内建的默认货架不同', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)

  const pageShelf = await shelfIds(editor)
  // 页面：只画分区框与指示，因此绘图命令这一段只有矩形与箭头。
  expect(pageShelf).toContain('RECTANGLE')
  expect(pageShelf).toContain('ARROW')
  for (const id of ['LINE', 'PLINE', 'POLYGON', 'CIRCLE', 'ARC', 'WIRE']) {
    expect(pageShelf).not.toContain(id)
  }
  // 正交与极轴约束的是取点方向，页面留下的两条命令都用不上。
  expect(pageShelf).not.toContain('ortho')
  expect(pageShelf).not.toContain('polar')
  // 容器在页面上是主力。
  expect(pageShelf).toContain('draw-container')

  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')

  const drawingShelf = await shelfIds(editor)
  for (const id of ['LINE', 'PLINE', 'RECTANGLE', 'POLYGON', 'CIRCLE', 'ARC', 'ARROW', 'WIRE']) {
    expect(drawingShelf).toContain(id)
  }
  expect(drawingShelf).toContain('ortho')
  expect(drawingShelf).toContain('polar')
  // 接线图里的盒是矩形曲线，容器不在栏上。
  expect(drawingShelf).not.toContain('draw-container')
  expect(drawingShelf).toContain('draw-text')

  // 「选择」在两边都固定在第一位：取点命令结束之后用户回到的就是它。
  expect(pageShelf[0]).toBe('select')
  expect(drawingShelf[0]).toBe('select')
})

test('OpenSpec: editor-workspace-layout / 工具栏货架 / 页面里被收走的命令仍可用', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  expect(await itemIds(editor)).not.toContain('CIRCLE')

  const commandInput = stage.getByRole('textbox', { name: '命令行' })

  // 1) 命令行敲全名。
  await commandInput.click()
  await commandInput.fill('CIRCLE')
  await page.keyboard.press('Enter')
  await expect(stage.getByText('指定圆心')).toBeVisible()
  await page.keyboard.press('Escape')

  // 2) 单键：图面上按 C 直接开同一条会话。绘图键是七个裸字母，收走按钮不影响它们。
  // 落点要避开左上角的缩放控件组，它盖在图面上。
  await stage.getByTestId('stage-surface').click({ position: { x: 320, y: 260 } })
  await page.keyboard.press('c')
  await expect(stage.getByText('指定圆心')).toBeVisible()
  await page.keyboard.press('Escape')

  /*
   * 只有这两条，而且够了。`CIRCLE` **不在命令面板里**——面板列的是动作目录，而绘图命令刻意
   * 不建目录项（那会为已经能敲 `CIRCLE` 的东西造第二个词）。不变量是「至少还有一条入口」，
   * 不是「三条都在」。
   */
})

test('OpenSpec: editor-workspace-layout / 工具栏货架 / 收走容器之后动作目录里还在', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  expect(await itemIds(editor)).not.toContain('draw-container')

  // 容器没有命令词，它的第二条入口是**动作目录**：命令面板搜得到，快捷键也还在。
  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  await commandPanel.getByRole('combobox', { name: '检索命令' }).fill('容器工具')
  await expect(commandPanel.getByRole('option', { name: /容器工具/ }).first()).toBeVisible()
})

test('OpenSpec: component-library / 混合组件目录 / 圆的瓦片跟着货架出现与消失', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const library = editor.locator('[data-workspace-panel="component-library"]')
  await expect(library).toBeVisible()

  /*
   * 页面工作区的货架不含 `CIRCLE`，因此「工具栏已提供入口」这条理由在这里不成立，圆的瓦片
   * 要出现——否则页面里既没有按钮也没有瓦片，那条命令只剩键盘一条路。
   */
  await expect(library.getByRole('button', { name: 'Circle' })).toBeVisible()

  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  // 绘图的货架上有 `CIRCLE` 按钮，瓦片因此收起来：同一个入口不出现两次。
  await expect(library.getByRole('button', { name: 'Circle' })).toBeHidden()

  // 导线两边都不出现：它藏起来的理由是自己的（拖出来的导线不连着任何端口），与货架无关。
  await expect(library.getByRole('button', { name: 'Wire' })).toBeHidden()
  await switcher.getByRole('radio', { name: '页面' }).click()
  await expect(library.getByRole('button', { name: 'Wire' })).toBeHidden()
})

test('OpenSpec: editor-workspace-layout / 自定义工具栏 / 移除、重排与重置', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const openDialog = async () => {
    // 管理菜单的按钮在切换器**外面**（它管的是当前工作区，不是列表里的某一段）。
    await editor.getByRole('button', { name: '管理工作区' }).click()
    await editor.getByRole('menu', { name: '管理工作区' })
      .getByRole('menuitem', { name: '自定义工具栏…' })
      .click()
    return page.getByRole('dialog')
  }

  const dialog = await openDialog()
  await expect(dialog).toBeVisible()
  // 「选择」标为固定，且没有移除入口。
  await dialog.getByRole('option', { name: /矩形/ }).first().click()
  await dialog.getByRole('button', { name: '从货架移除' }).click()
  await dialog.getByRole('button', { name: '完成' }).click()

  expect(await itemIds(editor)).not.toContain('RECTANGLE')
  // 改过货架点亮修改点：它与面板挪位是同一个信号。
  await expect(switcher.getByRole('radio', { name: '页面' }).getByRole('img', { name: '布局已改动' }))
    .toBeVisible()

  // 收走按钮不收走能力：`RECTANGLE` 照样敲得动。
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.click()
  await commandInput.fill('RECTANGLE')
  await page.keyboard.press('Enter')
  await expect(stage.getByText(/指定/).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // 重置把它拿回来，修改点熄灭。
  const again = await openDialog()
  await again.getByRole('button', { name: '重置为默认' }).click()
  expect(await itemIds(editor)).toContain('RECTANGLE')
  await expect(switcher.getByRole('radio', { name: '页面' }).getByRole('img', { name: '布局已改动' }))
    .toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏 / 下拉菜单不被工具栏行裁掉', async ({ page }) => {
  const { editor } = await openEditor(page)
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })

  await toolbar.getByRole('button', { name: '网格大小' }).click()
  const menu = toolbar.getByRole('menu', { name: '网格大小' })
  await expect(menu).toBeVisible()

  const menuBox = (await menu.boundingBox())!
  const toolbarBox = (await toolbar.boundingBox())!
  // 工具栏行只有 48px 高，而菜单从锚点底下 5px 起、装着五项，因此它必然伸出行外。
  expect(menuBox.y + menuBox.height).toBeGreaterThan(toolbarBox.y + toolbarBox.height)

  /*
   * 判别性断言是**命中测试**，不是 `boundingBox()` 也不是 `toBeVisible()`：被裁掉时布局盒
   * 一个像素都不变、第一项也还露着，两者照样绿——那正是这条 bug 当初没被拦住的原因。
   * 只有「菜单底部那一点上真的是菜单自己」才分得出裁与不裁。
   */
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y)
    return element?.closest('[role="menu"]') !== null && element !== null
  }, { x: menuBox.x + 20, y: menuBox.y + menuBox.height - 10 })
  expect(hit, '菜单底部被工具栏行裁掉了').toBe(true)

  // 裁掉时靠下的那几项收不到点击。
  const items = menu.getByRole('menuitemradio')
  await expect(items).toHaveCount(4)
  await items.last().click()
  await expect(menu).toBeHidden()
})

test('OpenSpec: editor-workspace-layout / 自定义工具栏 / 右键工具栏就地改货架', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })

  // 1) 右键某一格：给出那一格的动作，外加自定义入口。
  await toolbar.locator('[data-toolbar-item="RECTANGLE"]').click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: '从工具栏移除' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '在此处插入分隔' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '自定义工具栏…' })).toBeVisible()

  await menu.getByRole('menuitem', { name: '从工具栏移除' }).click()
  expect(await itemIds(editor)).not.toContain('RECTANGLE')

  // 收走的是入口不是能力：这条命令照样敲得动。
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.click()
  await commandInput.fill('RECTANGLE')
  await page.keyboard.press('Enter')
  await expect(stage.getByText(/指定/).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // 2) 「选择」拿不掉：取点命令结束之后用户回到的就是它。
  await toolbar.locator('[data-toolbar-item="select"]').click({ button: 'right' })
  await expect(page.getByRole('menu').getByRole('menuitem', { name: '从工具栏移除' }))
    .toHaveAttribute('data-disabled', /.*/)
  await page.keyboard.press('Escape')

  // 3) 右键进对话框：与管理菜单那条路到达同一个地方。
  await toolbar.locator('[data-toolbar-item="grid"]').click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '自定义工具栏…' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: '自定义工具栏' })).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏 / 按下态分两种', async ({ page }) => {
  /*
   * 这一条只有端到端拦得住：它证明的是**层叠真的算到了这些规则**。工具栏的颜色规则住在
   * `@layer components` 里，而一条没有分层的裸 `button { color: inherit }` 会压过它们——
   * 与选择器权重无关。jsdom 不跑层叠，组件测试断不了；黄金图会变但读不出原因。
   */
  const { editor } = await openEditor(page)
  const read = (name: string) => editor.getByRole('button', { name }).evaluate((el) => ({
    role: el.getAttribute('data-toolbar-role'),
    pressed: el.getAttribute('aria-pressed'),
    color: getComputedStyle(el).color,
    fill: getComputedStyle(el, '::before').backgroundColor,
    fillWidth: getComputedStyle(el, '::before').width,
  }))

  const select = await read('选择')
  const snap = await read('吸附')
  const text = await read('文字')

  // 工具（单选）：底内缩到 26×26，相邻两块之间因此有 5px 而不是 1px。
  expect(select).toMatchObject({ role: 'tool', pressed: 'true', fillWidth: '26px' })
  expect(select.fill).not.toBe('rgba(0, 0, 0, 0)')

  // 开关（多选）：不给底，只把图标点亮——两者按下去做的事不同，因此不能长得一样。
  expect(snap).toMatchObject({ role: 'switch', pressed: 'true' })
  expect(snap.fill).toBe('rgba(0, 0, 0, 0)')

  // 点亮色与静息色**既是色相差也是明度差**：颜色是开关状态唯一的通道。
  expect(snap.color).not.toBe(text.color)
  expect(text.color).toBe('rgb(142, 152, 168)')
  expect(snap.color).toBe('rgb(140, 192, 255)')
})

test('OpenSpec: editor-workspace-layout / 自定义工具栏 / 右键收走容器之后快捷键仍可用', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })

  // 容器只在**页面**货架上——绘图那条默认就不含它（3.6 断的正是这件事）。
  await toolbar.locator('[data-toolbar-item="draw-container"]').click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '从工具栏移除' }).click()
  expect(await itemIds(editor)).not.toContain('draw-container')

  /*
   * 容器没有命令词，它的第二条入口是**动作目录**：默认键位 `F`，命令面板也搜得到。
   * 判别性在于按键之后工具真的切过去了——只断言「按钮没了」的用例，在一个连能力一起收走的
   * 实现上同样会绿。
   */
  await expect(page.getByRole('menu')).toHaveCount(0)
  await stage.press('f')
  // 容器工具接管之后「选择」就不再是按下的那一个：工具是单选，恒有至多一个按下。
  await expect(editor.getByRole('button', { name: '选择' })).toHaveAttribute('aria-pressed', 'false')

  // 重置把它拿回来。
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menu', { name: '管理工作区' })
    .getByRole('menuitem', { name: '自定义工具栏…' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '重置为默认' }).click()
  expect(await itemIds(editor)).toContain('draw-container')
})

test('OpenSpec: editor-workspace-layout / 工具栏货架 / 宿主注入的目录项可上架并启动命令', async ({ page }) => {
  const { editor, stage } = await openEditor(page)

  /*
   * 注入的是「目录里多一项可选的」而不是「工具栏上多一颗按钮」：示例应用的 `demo-circle`
   * 默认不在任何一条内建货架上，因此它此刻只在对话框的「未放入」那一列里。
   */
  expect(await shelfIds(editor)).not.toContain('demo-circle')
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menu', { name: '管理工作区' })
    .getByRole('menuitem', { name: '自定义工具栏…' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('[data-shelf-available="demo-circle"]').click()
  await dialog.getByRole('button', { name: '加入货架' }).click()
  await dialog.getByRole('button', { name: '完成' }).click()

  const button = editor.getByRole('toolbar', { name: 'Stage 工具栏' })
    .locator('[data-toolbar-item="demo-circle"]')
  await expect(button).toBeVisible()
  // 按下去启动的就是它指向的那条命令会话，与在命令行敲 `CIRCLE` 到达同一个地方。
  await button.click()
  await expect(stage.getByText(/指定圆心/).first()).toBeVisible()
  await page.keyboard.press('Escape')
})

test('OpenSpec: editor-workspace-layout / 自定义工具栏 / 重排跨越工作区切换后仍在', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menu', { name: '管理工作区' })
    .getByRole('menuitem', { name: '自定义工具栏…' })
    .click()
  const dialog = page.getByRole('dialog')

  // 把 `ARROW` 一路上移到第二位（「选择」钉在第一位，谁都挪不到它前面去）。
  await dialog.locator('[data-shelf-item="ARROW"]').click()
  const moveUp = dialog.getByRole('button', { name: '上移' })
  // 按到禁用为止：「选择」钉在第一位，因此 `ARROW` 最远只能到第二位。
  await expect(moveUp).toBeEnabled()
  while (await moveUp.isEnabled()) await moveUp.click()
  await dialog.getByRole('button', { name: '完成' }).click()
  expect((await itemIds(editor)).indexOf('ARROW')).toBe(1)

  // 切走再切回：货架住在偏好里、按工作区索引，不是一份会话状态。
  await switcher.getByRole('radio', { name: '绘图' }).click()
  await expect(switcher.getByRole('radio', { name: '绘图' })).toHaveAttribute('aria-checked', 'true')
  await switcher.getByRole('radio', { name: '页面' }).click()
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')
  expect((await itemIds(editor)).indexOf('ARROW')).toBe(1)
})

test('OpenSpec: editor-preferences / 工作区管理 / 另存为带走改过的货架', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const toolbar = editor.getByRole('toolbar', { name: 'Stage 工具栏' })

  // 先改一格，让页面工作区与它的基线不同。
  await toolbar.locator('[data-toolbar-item="ARROW"]').click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '从工具栏移除' }).click()
  expect(await itemIds(editor)).not.toContain('ARROW')

  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitem', { name: '另存为工作区…' }).click()
  const dialog = page.getByRole('dialog', { name: '另存为工作区' })
  await dialog.getByRole('textbox', { name: '名称' }).fill('接线现场')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(dialog).toBeHidden()

  const saved = switcher.getByRole('radio', { name: '接线现场' })
  await expect(saved).toHaveAttribute('aria-checked', 'true')
  // 另存为复制的是「此刻这个工作区的样子」，货架是其中一样。
  expect(await itemIds(editor)).not.toContain('ARROW')

  // 回到来源工作区并重置它：新工作区是一份副本，不跟着源走。
  await switcher.getByRole('radio', { name: '页面' }).click()
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menu', { name: '管理工作区' })
    .getByRole('menuitem', { name: '自定义工具栏…' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '重置为默认' }).click()
  expect(await itemIds(editor)).toContain('ARROW')

  await saved.click()
  await expect(saved).toHaveAttribute('aria-checked', 'true')
  expect(await itemIds(editor)).not.toContain('ARROW')
})

test('OpenSpec: component-library / 自定义物料面板 / 右键隐藏、只看这一组与对话框', async ({ page }) => {
  const { editor } = await openEditor(page)
  const library = editor.locator('[data-workspace-panel="component-library"]')
  await expect(library).toBeVisible()

  // 1) 基础瓦片右键即隐藏；同一个 Preset 的别的入口（快捷键 / 动作目录）不受影响。
  const container = library.getByRole('button', { name: /Container/ })
  await container.click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '从面板隐藏' }).click()
  await expect(container).toBeHidden()

  /*
   * 2) 文件夹来源那一段只给整段的两件事——单个隐藏会让「往这个文件夹里再导十个符号，它们
   * 自动出现」变成谎言。右键落在**那一段**上即可（菜单的目标是段，不是某一块瓦片），因此
   * 这条不需要示例应用先有项目组件：示例的项目组件段本来就是空的（写着 0）。
   */
  const project = library.locator('[data-shelf-section="components"]')
  await project.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: '从面板隐藏' })).toHaveCount(0)
  await menu.getByRole('menuitem', { name: '只看这一组' }).click()
  // 只剩那一段：基础组件那一段整段消失。
  await expect(library.getByRole('heading', { name: /基础组件/ })).toHaveCount(0)

  // 3) 右键进对话框，重置把两样都拿回来。
  await project.click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '自定义物料面板…' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '自定义物料面板' })).toBeVisible()
  await dialog.getByRole('button', { name: '重置为默认' }).click()
  await expect(library.getByRole('heading', { name: /基础组件/ })).toBeVisible()
  await expect(library.getByRole('button', { name: /Container/ })).toBeVisible()
})

test('OpenSpec: component-library / 自定义物料面板 / 对话框排序、标题与添加来源', async ({ page }) => {
  const { editor } = await openEditor(page)
  const library = editor.locator('[data-workspace-panel="component-library"]')
  await expect(library.getByRole('heading', { name: /基础组件/ })).toBeVisible()

  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menu', { name: '管理工作区' })
    .getByRole('menuitem', { name: '自定义物料面板…' })
    .click()
  const dialog = page.getByRole('dialog')

  // 面板标题同时是它在 Dockview 上的标签名：面板内部不再画第二遍。
  await dialog.getByRole('textbox').first().fill('现场物料')
  // 把「基础组件」那一段挪到后面去。
  await dialog.locator('[data-palette-section="basics"]').click()
  await dialog.getByRole('button', { name: '下移' }).click()
  await dialog.getByRole('button', { name: '完成' }).click()

  await expect(editor.locator('[data-workspace-tab="compose-component-library-panel"]'))
    .toContainText('现场物料')
  const headings = await library.getByRole('heading').allInnerTexts()
  expect(headings.findIndex((text) => text.includes('基础组件')))
    .toBeGreaterThan(headings.findIndex((text) => text.includes('项目组件')))
})
