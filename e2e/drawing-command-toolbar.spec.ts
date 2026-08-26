import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 工具栏上的绘图命令组。
 *
 * @remarks
 * 这几条只有端到端拦得住：按钮住在 `editor`、命令会话住在 `stage`，而这一刀要证明的正是
 * 「点按钮启动的与敲名字启动的是**同一条**会话」。组件测试里两个包各自 mock 掉对方，恰好
 * 把要证明的那件事假设掉了。
 */

async function boxOf(locator: Locator) {
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null
  await expect.poll(async () => {
    box = await locator.boundingBox()
    return box !== null
  }).toBe(true)
  return box!
}

async function openEditor(page: Page) {
  // 关掉自动适配：这几条要在确定的缩放下取点，留白比例不该进断言。
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = await boxOf(stage.getByTestId('stage-surface'))
  return { editor, stage, at: (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy }) }
}

test('OpenSpec: editor-workspace-layout / 绘图命令组 / 点按钮启动的是那条命令的会话', async ({ page }) => {
  const { editor, stage, at } = await openEditor(page)
  const prompt = stage.getByTestId('stage-drafting-command-prompt')

  await editor.getByRole('button', { name: '矩形', exact: true }).click()

  // 提示文本是判别点：它来自 `RECTANGLE` 会话自己的第一步，工具栏说不出这句话。
  await expect(prompt).toContainText('指定第一个角点')

  await page.mouse.click(at(220, 180).x, at(220, 180).y)
  await page.mouse.click(at(360, 280).x, at(360, 280).y)

  // 启动的是**那条**命令：矩形是四顶点的闭合多段线，因此画出来的是一个 polygon 而不是别的。
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)
  expect(await strokes.first().evaluate((node) => node.tagName.toLowerCase())).toBe('polygon')
})

test('OpenSpec: editor-workspace-layout / 绘图命令组 / 会话进行中按钮按下，Escape 之后不按下', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const circle = editor.getByRole('button', { name: '圆', exact: true })

  await circle.click()
  await expect(circle).toHaveAttribute('aria-pressed', 'true')

  // 判别点在后半句：按下态若由工具栏自己记「我刚点了哪个」，前半句照样通过，只有命令被
  // `Escape` 结束之后那一份才会停在过去。
  //
  // `Escape` 按在 Stage 根节点上：键盘能力挂在那里，而点完工具栏按钮之后焦点还在按钮上，
  // 真实操作里用户此刻的手已经回到画布。
  await stage.press('Escape')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('已取消')
  await expect(circle).toHaveAttribute('aria-pressed', 'false')
})

test('OpenSpec: editor-workspace-layout / 绘图命令组 / 形状 split button 已删除', async ({ page }) => {
  const { editor } = await openEditor(page)

  await expect(editor.getByRole('button', { name: '形状' })).toHaveCount(0)
  // 六条绘图命令各占一个按钮。
  for (const label of ['直线', '多段线', '矩形', '圆', '圆弧', '箭头']) {
    await expect(editor.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
  // 导线已合并进直线：两者画的时候一模一样，而选错的后果在屏幕上完全不可见。
  await expect(editor.getByRole('button', { name: '导线', exact: true })).toHaveCount(0)
})

test('OpenSpec: stage / ARROW / 画出的曲线带终点箭头', async ({ page }) => {
  const { editor, stage, at } = await openEditor(page)

  await editor.getByRole('button', { name: '箭头', exact: true }).click()
  await page.mouse.click(at(200, 200).x, at(200, 200).y)
  await page.mouse.click(at(340, 200).x, at(340, 200).y)

  // 能力没有随 `draw-arrow` 工具一起消失：`LINE` 产出的曲线不带 marker，箭头必须自己带。
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)
  expect(await strokes.first().getAttribute('marker-end')).toMatch(/^url\(#/)
})

test('OpenSpec: editor-workspace-layout / 绘图命令组 / 图标夹点用 accent 而不是描边色', async ({ page }) => {
  const { editor } = await openEditor(page)

  const icon = editor.getByRole('button', { name: '直线', exact: true }).locator('svg')
  const [grip, stroke] = await Promise.all([
    icon.locator('rect').first().evaluate((node) => getComputedStyle(node).fill),
    icon.evaluate((node) => getComputedStyle(node).stroke),
  ])

  // 判别点是**两者不同**而不是某个具体的颜色值：夹点跟着描边色走时这条才有意义，
  // 而 accent 的字面值随主题变，写死它等于把 token 抄第二遍。
  expect(grip).not.toBe(stroke)
  expect(grip).toBe('rgb(54, 135, 255)')
})

test('OpenSpec: editor-workspace-layout / 工具栏提示 / 悬停给出名称与怎么敲出来', async ({ page }) => {
  const { editor } = await openEditor(page)
  const tooltip = editor.getByRole('tooltip')

  await expect(tooltip).toHaveCount(0)
  const line = editor.getByRole('button', { name: '直线', exact: true })
  await line.hover()

  // 判别点是**命令名在提示里**：这几条命令没有键位，敲 LINE 就是启动它的办法，而在此之前
  // 提示里只有「直线」，用户无从知道该敲什么。
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('直线')
  await expect(tooltip).toContainText('LINE')
  await expect(line).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') ?? '')

  // 有键位的按钮给键位，不是命令名。
  await editor.getByRole('button', { name: '选择', exact: true }).hover()
  await expect(tooltip).toContainText('选择')

  // 提示会盖住下一步要点的地方，而此刻焦点在按钮上——Escape 是唯一能把它收走的办法。
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 工具栏提示 / 键盘聚焦也出，点击之后不出', async ({ page }) => {
  const { editor } = await openEditor(page)
  const tooltip = editor.getByRole('tooltip')
  const rectangle = editor.getByRole('button', { name: '矩形', exact: true })

  // 原生 title 在键盘聚焦时根本不出现，这正是自建它的一半理由。
  await rectangle.focus()
  await expect(tooltip).toContainText('RECTANGLE')

  // 点过之后不该再弹：用户已经点了，提示只会盖住刚点的东西。
  await rectangle.click()
  await expect(tooltip).toHaveCount(0)
})
