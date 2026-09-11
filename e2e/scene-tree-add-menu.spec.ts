import { expect, test } from '@playwright/test'

/**
 * 场景树检索栏的新增按钮弹出货架菜单，选中即添加到选区所在的容器。
 *
 * @remarks
 * 落点走的是与「点击物料面板瓦片」同一条路（不带画布落点），因此这里选中一个容器再新增，
 * 断言新对象成了它的子级——而不是被当成「在所有场景之外新建」升格出一块新场景。
 */
test('OpenSpec: scene-tree / 新增菜单与新增意图 / 从新增菜单添加到选中的容器', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor.getByRole('application', { name: 'Stage' })).toBeVisible()
  // 新增按钮住在检索栏上，不在 treegrid 里。
  const scenePanel = editor.locator('[data-compose-ui="scene-tree"]')
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  // 先放一个容器并选中它：它就是新对象该落进去的那一层。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const container = sceneTree.getByRole('row', { name: /Container/ }).last()
  await container.click()
  await expect(container).toHaveAttribute('aria-selected', 'true')
  const rowsBefore = await sceneTree.getByRole('row').count()

  // 新增按钮此刻是菜单触发器，不再当场建一个容器。
  const addButton = scenePanel.getByRole('button', { name: '新增节点' })
  await expect(addButton).toHaveAttribute('aria-haspopup', 'menu')
  // 菜单打开后外面的内容被标记为 inert，按钮的矩形量不到了——先量。
  const buttonBox = await addButton.boundingBox()
  await addButton.click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  // 菜单列的是与画布右键同一份货架：基础组件这一组一定在。
  await expect(menu.getByText('基础组件')).toBeVisible()

  /*
   * 菜单开在按钮附近而不是视口左上角——照指针坐标定位时，键盘激活会把它甩到 (0,0)。
   * 这里断言它没有贴着视口顶边，且横向落在按钮那一侧。
   */
  const menuBox = await menu.boundingBox()
  expect(menuBox!.y).toBeGreaterThan(buttonBox!.y)
  expect(Math.abs(menuBox!.x - buttonBox!.x)).toBeLessThan(400)

  await menu.getByRole('menuitem', { name: '矩形' }).click()
  await expect(menu).toBeHidden()

  /*
   * 新对象落进了选中的那个容器，而不是另起一块场景；而且它在树里**看得见**——被选中却藏在
   * 一个折叠的父级里，与什么都没发生在屏幕上没有区别，而用户此刻正看着树。
   */
  await expect(sceneTree.getByRole('row')).toHaveCount(rowsBefore + 1)
  const rect = sceneTree.getByRole('row', { name: /Rectangle/ }).last()
  await expect(rect).toBeVisible()
  await expect(rect).toHaveAttribute('aria-selected', 'true')
  expect(Number(await rect.getAttribute('aria-level')))
    .toBeGreaterThan(Number(await container.getAttribute('aria-level')))
})
