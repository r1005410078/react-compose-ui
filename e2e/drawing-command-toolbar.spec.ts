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

  // 启动的是**那条**命令：`RECTANGLE` 产出的是矩形物料，因此场景树里出现的是 Rectangle
  // 而不是 Curve。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(0)
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
  // 七条绘图命令各占一个按钮。
  for (const label of ['直线', '多段线', '矩形', '圆', '圆弧', '箭头', '导线']) {
    await expect(editor.getByRole('button', { name: label, exact: true })).toHaveCount(1)
  }
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

test('OpenSpec: stage / 会重开的命令与两级 Escape / 连画多条期间按钮一直按下', async ({ page }) => {
  const { editor, stage, at } = await openEditor(page)
  const wire = editor.getByRole('button', { name: '导线', exact: true })
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  const prompt = stage.getByTestId('stage-drafting-command-prompt')

  await wire.click()
  await expect(wire).toHaveAttribute('aria-pressed', 'true')

  /*
   * 连画三条，每条只按一次 `Enter` 结束——命令本身不必重启。`WIRE` 连续取点（可以有拐点），
   * 因此那一下回车是「这一条画完了」，而不是「结束命令」。
   */
  for (const y of [160, 220, 280]) {
    await page.mouse.click(at(160, y).x, at(160, y).y)
    await page.mouse.click(at(360, y).x, at(360, y).y)
    await stage.press('Enter')
    // 提示回到第一步，而不是停在「指定下一点」。
    await expect(prompt).toContainText('指定第一点')
    // 按下态读的是 Stage 上报的当前命令 id：重开若先报一次 null，这里就会抖。
    await expect(wire).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(strokes).toHaveCount(3)

  // 一个点都没取时 `Escape` 才退出命令。
  await stage.press('Escape')
  await expect(wire).toHaveAttribute('aria-pressed', 'false')
})
