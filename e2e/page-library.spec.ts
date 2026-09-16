import { expect, test } from '@playwright/test'

/*
 * 页面库在示例应用里由 `?library` 接上：默认关着，否则每一条以「打开就在画布上」起手的既有
 * 用例都要先经过一屏页面库。示例应用是集成示例，不是正式产品的形态决定。
 */
const LIBRARY = '/?library&no-auto-fit'

test('OpenSpec: library-browser / 页面库是应用入口，左栏两段的选中画法可分', async ({ page }) => {
  await page.goto(LIBRARY)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const library = editor.locator('.compose-library')
  await expect(library).toBeVisible()

  /*
   * 顶栏不变，body 换成页面库：标志成为回库的门，标签条照常（此刻还没开文件），而工作区切换器
   * 不渲染——那一屏没有画布，因而没有工作区。
   */
  const topBar = editor.locator('.compose-editor__top-bar')
  await expect(topBar.getByRole('button', { name: '返回页面库' })).toBeVisible()
  await expect(topBar.getByRole('button', { name: '应用菜单' })).toBeVisible()
  await expect(topBar.getByRole('radiogroup', { name: '工作区' })).toHaveCount(0)
  // 首页没有被自动打开：页面库才是入口。
  await expect(topBar.getByRole('tab')).toHaveCount(0)

  /*
   * 两段的语义不同，画法也不同：去处是导航（`aria-current`，一块实底），筛选是开关
   * （`aria-pressed`，左边一条竖条）。断的是**计算后的值**——本仓库有过样式被层叠静默压掉的
   * 先例，只断 class 的用例挡不住那一类。
   */
  const project = library.getByRole('button', { name: /^项目/ })
  await project.click()
  await expect(project).toHaveAttribute('aria-current', 'page')
  const filter = library.getByRole('group', { name: '场景类型' })
    .getByRole('button').first()
  await expect(filter).toHaveAttribute('aria-pressed', 'false')
  const style = (locator: typeof project, property: string) =>
    locator.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property)
  // 去处画实底，筛选不画底——同一种画法会让两段读成并列的两个选项。
  expect(await style(project, 'background-color')).not.toBe('rgba(0, 0, 0, 0)')
  expect(await style(filter, 'background-color')).toBe('rgba(0, 0, 0, 0)')
  await filter.click()
  await expect(filter).toHaveAttribute('aria-pressed', 'true')
  expect(await style(filter, 'background-color')).toBe('rgba(0, 0, 0, 0)')
  // 竖条是选中那一格的 ::before，一条 2px 宽的圆角。
  expect(await filter.evaluate((el) =>
    getComputedStyle(el, '::before').width)).toBe('2px')
})

test('OpenSpec: library-browser / 从库打开一页即离开库，点标志回去标签还在', async ({ page }) => {
  await page.goto(LIBRARY)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const topBar = editor.locator('.compose-editor__top-bar')
  const library = editor.locator('.compose-library')

  /*
   * 先移上去再点：两颗按钮**静息时不吃指针**（否则点图面本身会误触），因此「指过去」是这条
   * 路径的一部分而不是测试的方便——键盘用户走的是另一条（聚焦即 `:focus-within`）。
   */
  const homeTile = library.locator('.compose-library__tile').filter({ hasText: 'Home' })
  await homeTile.hover()
  await homeTile.getByRole('button', { name: '打开 Home' }).click()
  await expect(library).toHaveCount(0)
  // 画布回来了，列头上是这份文档的面包屑。
  await expect(editor.locator('.compose-editor__canvas-head')
    .getByRole('navigation', { name: '文档位置' })).toContainText('Home')
  await expect(topBar.getByRole('tab', { name: /Home/ })).toBeVisible()
  await expect(topBar.getByRole('radiogroup', { name: '工作区' })).toBeVisible()

  await topBar.getByRole('button', { name: '返回页面库' }).click()
  await expect(library).toBeVisible()
  /*
   * 标签一个都没关——它正是「我手上开着哪几张图」，去库里找下一张时最需要它，而这正是标签条
   * 从画布列头搬进顶栏的全部理由。
   */
  await expect(topBar.getByRole('tab', { name: /Home/ })).toBeVisible()
  await expect(topBar.getByRole('radiogroup', { name: '工作区' })).toHaveCount(0)
})

test('OpenSpec: library-browser / 演示屏上只有图、序号与一条控制条', async ({ page }) => {
  await page.goto(LIBRARY)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const library = editor.locator('.compose-library')

  await library.getByRole('button', { name: '演示' }).click()
  const demo = page.getByRole('dialog')
  await expect(demo).toBeVisible()
  // 位置只写序号与总数：文件名与修改时间是我们自己的记账，而屏幕此刻正对着客户。
  await expect(demo).toContainText('方案 1 / 2')
  await expect(demo).not.toContainText('.page.json')
  await expect(demo).not.toContainText('未分类')

  // ←/→ 翻页，Escape 退回页面库。
  await page.keyboard.press('ArrowRight')
  await expect(demo).toContainText('方案 2 / 2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(library).toBeVisible()
})
