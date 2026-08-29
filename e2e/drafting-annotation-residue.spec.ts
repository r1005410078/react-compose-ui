import { expect, test } from '@playwright/test'

/**
 * 连续取点时，上一步的标注不留在图上。
 *
 * @remarks
 * **轴向段是判别性的**：它让角度弧的两段退化成同一条路径，而覆盖层的 key 曾经取的是路径
 * 内容——重复 key 下 React 不保证移除多出来的节点，于是每取一个点就在那个点上留一条竖虚线
 * 加一个圆点。直角走线让每一段都退化，因此这个缺陷在接线图上必现；拿斜线做用例会得到一条
 * 永远绿的假断言。
 *
 * 只有端到端拦得住：jsdom 下 React 对重复 key 的处理与浏览器不同，组件测试两边都绿。
 */
test('OpenSpec: stage / 取点过程中的动态输入 / 连续取点不留下上一步的标注', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')

  const ticks = stage.locator('.compose-stage__dynamic-input-tick')
  /*
   * 走直角折线，**每一步都换方向**（横、竖、横、竖）。两个条件缺一不可：上一步是轴向的
   * （角度弧退化成同一条路径，键才会撞），这一步换了方向（新旧路径不同，漏掉的那条才留得下来）。
   * 一路走同一个方向的话，新旧路径逐字相同，漏与不漏在屏幕上看不出来——那会是一条假用例。
   */
  const points: readonly (readonly [number, number])[] = [
    [80, 80], [200, 80], [200, 200], [320, 200], [320, 320],
  ]
  for (const [index, [x, y]] of points.entries()) {
    await page.mouse.click(at(x, y).x, at(x, y).y)
    const next = points[index + 1] ?? [x + 60, y + 60] as const
    await page.mouse.move(at(next[0]!, next[1]!).x, at(next[0]!, next[1]!).y)
    // 一步标注恒有两个原点标记（两端各一个），与已经取过几个点无关。
    await expect(ticks).toHaveCount(2)
  }
})
