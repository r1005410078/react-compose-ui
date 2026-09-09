import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 自定义工作区的纵向流程。
 *
 * 判别性用例是「切换不打断画布」：`LINE` 取到一个点之后切工作区（经 `fromJSON` 重建面板），
 * 命令行提示仍是「指定下一点」、第二个点落地成一段——这是「工作区不是模式」这句话在屏幕上
 * 唯一能被证伪的形式。
 */
async function openEditor(page: Page) {
  await page.goto('/?no-auto-fit')
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

/** 把基础组件面板拖进属性面板所在的组：落在组的正中就是「作为标签加入」。 */
async function dragLibraryToInspector(page: Page) {
  await page.dragAndDrop(
    '[data-workspace-tab="compose-component-library-panel"]',
    '[data-workspace-panel="inspector"]',
    { targetPosition: { x: 200, y: 300 } },
  )
}

async function saveAs(page: Page, editor: Locator, name: string) {
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitem', { name: '另存为工作区…' }).click()
  const dialog = page.getByRole('dialog', { name: '另存为工作区' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: '名称' }).fill(name)
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(dialog).toBeHidden()
}

test('OpenSpec: editor-workspace-layout / 面板拖拽与硬约束 / 把基础组件面板拖到右栏', async ({ page }) => {
  const { editor, stage, switcher } = await openEditor(page)
  // 给 Stage 元素打个记号：拖拽与切换都不得重建它。
  await stage.evaluate((element) => { element.setAttribute('data-probe', 'same') })
  const canvasTab = editor.locator('[data-workspace-tab="compose-canvas"]')
  // 画布面板可搬不可关：它的标签上没有关闭按钮（组头本来就是隐藏的）。
  await expect(canvasTab.getByRole('button')).toHaveCount(0)

  const before = (await libraryPanel(editor).boundingBox())!
  await dragLibraryToInspector(page)
  const after = (await libraryPanel(editor).boundingBox())!
  expect(before.x).toBeLessThan(300)
  expect(after.x).toBeGreaterThan(800)
  // 拖是搬不是复制：左栏只剩场景图，基础组件面板仍只有一份。
  await expect(editor.locator('[data-workspace-tab="compose-component-library-panel"]')).toHaveCount(1)
  await expect(editor.locator('[data-workspace-panel="scene-graph"]')).toBeVisible()
  await expect(stage).toHaveAttribute('data-probe', 'same')
  // 面板挪位：当前段出现修改点。
  await expect(switcher.getByRole('radio', { name: '页面' }).getByRole('img', { name: '布局已改动' })).toBeVisible()

  // 重置：回到内建的样子（布局与两条货架一起），修改点消失。
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitem', { name: '重置' }).click()
  await expect.poll(async () => (await libraryPanel(editor).boundingBox())?.x ?? -1).toBeLessThan(300)
  await expect(switcher.getByRole('img', { name: '布局已改动' })).toHaveCount(0)
  await expect(stage).toHaveAttribute('data-probe', 'same')
})

test('OpenSpec: editor-workspace-layout / 切换不打断画布 / 命令会话跨切换存活', async ({ page }) => {
  const { editor, stage, switcher } = await openEditor(page)
  await stage.evaluate((element) => { element.setAttribute('data-probe', 'same') })
  // 先造出第二个工作区：另存为之后布局与「页面」一样，再把基础组件拖到右栏让两者不同。
  await saveAs(page, editor, '变电站')
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')
  await dragLibraryToInspector(page)
  await expect.poll(async () => (await libraryPanel(editor).boundingBox())?.x ?? -1).toBeGreaterThan(800)

  // 操作日志的行数：切换前后不得变化。
  await editor.locator('[data-workspace-tab="compose-transaction-log"]').click()
  const log = editor.getByRole('region', { name: '操作日志' })
  await expect(log).toBeVisible()
  const rowsBefore = await log.getByRole('button').count()

  // LINE 取到一个点之后切工作区。
  await editor.getByRole('button', { name: '直线', exact: true }).click()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.click(surface.x + 200, surface.y + 200)
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  await expect(prompt).toContainText('指定下一点')

  await switcher.getByRole('radio', { name: '页面' }).click()
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')
  // 页面工作区：基础组件回到左栏——布局真的换了。
  await expect.poll(async () => (await libraryPanel(editor).boundingBox())?.x ?? -1).toBeLessThan(300)
  // 画布没有重挂载，命令还在等下一点，下一次点击落地成一段。
  await expect(stage).toHaveAttribute('data-probe', 'same')
  await expect(prompt).toContainText('指定下一点')
  await page.mouse.click(surface.x + 360, surface.y + 200)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)
  await page.keyboard.press('Escape')

  // 切换本身没有产生事务：多出来的只有画线那一条。
  await editor.locator('[data-workspace-tab="compose-transaction-log"]').click()
  await expect(log.getByRole('button')).toHaveCount(rowsBefore + 1)

  // 切回变电站：拖过的样子还在。
  await switcher.getByRole('radio', { name: '变电站' }).click()
  await expect.poll(async () => (await libraryPanel(editor).boundingBox())?.x ?? -1).toBeGreaterThan(800)
  await expect(stage).toHaveAttribute('data-probe', 'same')
})

test('OpenSpec: editor-workspace-layout / 工作区管理 / 另存为、内建不可删、删除自定义', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  // 内建的删除与重命名灰掉并标「内建」，仍可见。
  await editor.getByRole('button', { name: '管理工作区' }).click()
  const remove = editor.getByRole('menuitem', { name: '删除（内建）' })
  await expect(remove).toHaveAttribute('aria-disabled', 'true')
  await expect(editor.getByRole('menuitem', { name: '重命名…（内建）' })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  // 等菜单真的收起来：管理按钮是开关，菜单还开着时下一次点击关的是它。
  await expect(remove).toHaveCount(0)

  await saveAs(page, editor, '变电站')
  // 两个内建（页面 / 绘图）加上另存出来的这一个。
  await expect(switcher.getByRole('radio')).toHaveCount(3)
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')
  // 显示名重复不拒绝，自动加序号。
  await saveAs(page, editor, '变电站')
  await expect(switcher.getByRole('radio', { name: '变电站 2' })).toHaveAttribute('aria-checked', 'true')

  // 重命名自定义工作区。
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitem', { name: '重命名…' }).click()
  const rename = page.getByRole('dialog', { name: '重命名工作区' })
  await rename.getByRole('textbox', { name: '名称' }).fill('储能')
  await rename.getByRole('button', { name: '确定' }).click()
  await expect(switcher.getByRole('radio', { name: '储能' })).toHaveAttribute('aria-checked', 'true')

  // 删除要确认，确认框写明记着它的文档数与回退去处；删的是当前这个，回退到列表第一个（页面）。
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitem', { name: '删除', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: '删除工作区「储能」？' })
  await expect(confirm).toContainText('记着它的 1 个文档下次打开时回到「页面」')
  await confirm.getByRole('button', { name: '删除' }).click()
  await expect(switcher.getByRole('radio')).toHaveCount(3)
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')
  // 记着储能的文档（Home）改指页面：切走再切回 Home，仍在页面。
  await switcher.getByRole('radio', { name: '变电站' }).click()
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')
})

test('OpenSpec: editor-workspace-layout / 按文档记忆工作区 / 文档回到自己的工作区', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const homeTab = editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: 'Home' })
  // Home 在页面里打开，随后另存为「变电站」：Home 从此记着变电站。
  await saveAs(page, editor, '变电站')

  // 首次打开 Counter：没记过，不切换，从此记为变电站。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid', { name: 'Demo Assets' }).getByRole('gridcell', { name: /^Pages/ }).click()
  await assets.getByRole('grid', { name: 'Pages' }).getByRole('gridcell', { name: 'Counter', exact: true }).dblclick()
  const counterTab = editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: 'Counter' })
  await expect(counterTab).toHaveAttribute('aria-selected', 'true')
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')

  // 在 Counter 上切到页面：Counter 记成页面。
  await switcher.getByRole('radio', { name: '页面' }).click()
  await homeTab.click()
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')
  await counterTab.click()
  await expect(switcher.getByRole('radio', { name: '页面' })).toHaveAttribute('aria-checked', 'true')
  await homeTab.click()
  await expect(switcher.getByRole('radio', { name: '变电站' })).toHaveAttribute('aria-checked', 'true')
})

test('OpenSpec: editor-workspace-layout / 只看画布 / 画布组占满', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitemcheckbox', { name: '只看画布' }).click()
  await expect(libraryPanel(editor)).toBeHidden()
  await expect(editor.locator('[data-workspace-panel="inspector"]')).toBeHidden()
  // 工具栏行与命令行仍可见。
  await expect(editor.getByRole('toolbar', { name: 'Stage 工具栏' })).toBeVisible()
  await expect(stage.getByRole('textbox', { name: '命令行' })).toBeVisible()
  const canvasBox = (await editor.locator('[data-workspace-panel="canvas"]').boundingBox())!
  const editorBox = (await editor.boundingBox())!
  expect(canvasBox.width).toBeGreaterThan(editorBox.width - 20)

  await editor.getByRole('button', { name: '管理工作区' }).click()
  await editor.getByRole('menuitemcheckbox', { name: '只看画布' }).click()
  await expect(libraryPanel(editor)).toBeVisible()
  await expect(editor.locator('[data-workspace-panel="inspector"]')).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 工作区切换 / 会话开关随工作区记住', async ({ page }) => {
  const { editor, switcher } = await openEditor(page)
  const grid = editor.getByRole('button', { name: '显示网格', exact: true })
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await saveAs(page, editor, '变电站')
  await grid.click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')

  await switcher.getByRole('radio', { name: '页面' }).click()
  await expect(grid).toHaveAttribute('aria-pressed', 'true')
  await switcher.getByRole('radio', { name: '变电站' }).click()
  await expect(grid).toHaveAttribute('aria-pressed', 'false')
})
