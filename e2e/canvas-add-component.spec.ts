import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 画布右键「添加组件」。
 *
 * @remarks
 * 两条判别性用例：**落点**（组件出现在右键那一下，而不是画布中心或场景原点）与**同源**
 * （菜单那棵树与物料面板读同一份货架，藏掉一个物料两处一起消失）。只断言「菜单里有这一项」
 * 的用例在一个自己另建一份树、落点写死中心的实现上同样会绿。
 */
async function openEditor(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]').first()).toBeVisible()
  return { editor, stage }
}

/** 在画布某点右键并展开「添加组件」，返回那个二级菜单。 */
async function openAddMenu(page: Page, stage: Locator, at: { x: number, y: number }) {
  await page.mouse.click(at.x, at.y, { button: 'right' })
  const trigger = page.getByRole('menuitem', { name: '添加组件' })
  await expect(trigger).toBeVisible()
  await trigger.hover()
  // 二级菜单是后挂上去的那一个；一级菜单仍在。
  await expect(page.locator('[role="menu"]')).toHaveCount(2)
  return page.locator('[role="menu"]').last()
}

test('OpenSpec: stage / 画布右键添加组件 / 落在右键那一下，实体名仍是英文', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = { x: box.x + 420, y: box.y + 260 }

  const submenu = await openAddMenu(page, stage, at)
  // 一层展开：分组标题 + 条目，没有可再展开的第三级。
  await expect(submenu.getByText('基础组件', { exact: true })).toBeVisible()
  await submenu.getByRole('menuitem', { name: '容器', exact: true }).click()

  // 落点是右键那一下：新容器的盒把那个点框在里面。画布中心或场景原点都不满足这一条。
  const created = stage.locator('[data-entity-id]').filter({ hasText: '' }).last()
  await expect(created).toBeVisible()
  const createdBox = (await created.boundingBox())!
  expect(createdBox.x).toBeLessThanOrEqual(at.x + 2)
  expect(createdBox.y).toBeLessThanOrEqual(at.y + 2)
  expect(createdBox.x + createdBox.width).toBeGreaterThanOrEqual(at.x - 2)
  expect(createdBox.y + createdBox.height).toBeGreaterThanOrEqual(at.y - 2)

  /*
   * 面板显示名是中文，写进文档的实体名仍是英文：后者改起来会动到既有页面与用户已经命名过的
   * 对象，本次只改前者。这条边界必须有用例钉住。
   */
  await expect(editor.getByRole('treegrid', { name: '场景树' })
    .getByText('Container', { exact: true })).toBeVisible()
})

test('OpenSpec: stage / 画布右键添加组件 / 菜单树与物料面板同源', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const panel = editor.locator('[data-workspace-panel="component-library"]')
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = { x: box.x + 420, y: box.y + 260 }

  // 页面工作区：工具栏上没有 CIRCLE，因此「圆」在面板上有，菜单里也该有。
  await expect(panel.getByRole('button', { name: '添加 圆' })).toBeVisible()
  let submenu = await openAddMenu(page, stage, at)
  await expect(submenu.getByRole('menuitem', { name: '圆', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 切到绘图工作区：那里工具栏上有 CIRCLE，面板因此收走这块瓦片——菜单必须跟着一起收。
  await editor.getByRole('radiogroup', { name: '工作区' }).getByRole('radio', { name: '绘图' }).click()
  await expect(panel.getByRole('button', { name: '添加 圆' })).toHaveCount(0)
  submenu = await openAddMenu(page, stage, at)
  await expect(submenu.getByRole('menuitem', { name: '圆', exact: true })).toHaveCount(0)
  // 同一份树里其余物料照旧：收走的是一项，不是整棵树。
  await expect(submenu.getByRole('menuitem', { name: '容器', exact: true })).toBeVisible()
})

/**
 * 菜单字号与周围 chrome 同一档。
 *
 * @remarks
 * 只有端到端量得到：jsdom 不排版，Tailwind 的类名在那里算不出字号，断言类名等于把实现细节
 * 当契约。这里量的是浏览器画出来的那一份。
 */
test('OpenSpec: components / 共享右键菜单 / 字号与行高与编辑器 chrome 一致', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.click(box.x + 420, box.y + 260, { button: 'right' })

  const item = page.getByRole('menuitem', { name: '复制' })
  await expect(item).toBeVisible()
  const metrics = await item.evaluate((el) => ({
    font: getComputedStyle(el).fontSize,
    height: Math.round(el.getBoundingClientRect().height),
  }))
  expect(metrics.font).toBe('13px')
  expect(metrics.height).toBe(28)

  // 菜单是模态的：先关掉再去量它旁边的东西，否则树被挡在 inert 后面。
  await page.keyboard.press('Escape')
  await expect(item).toHaveCount(0)

  // 判别性：菜单不再是这块界面上最大的一号字——场景树行就是 13px。
  const treeRow = editor.getByRole('treegrid', { name: '场景树' }).getByRole('row').first()
  expect(await treeRow.evaluate((el) => getComputedStyle(el).fontSize)).toBe('13px')
})
