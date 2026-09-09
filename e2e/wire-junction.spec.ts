import { expect, test } from '@playwright/test'

/**
 * 导线接到导线：节点、断线与「接头不裂开」。
 *
 * @remarks
 * 只有端到端拦得住：接线要真的走一遍「捕捉到线身 → 建节点 → 断线 → 三条支路绑上去 →
 * 求解把端点解算回端口」，而这条链上任何一环断掉的症状都是同一个——图上看起来接上了，
 * 一挪就散开。
 *
 * 自动适配把 1280×720 的场景缩到图面里，因此**断言发生在非 100% 缩放下**：`world =
 * (屏幕 - 视口) / zoom`，zoom 恒为 1 时命中相关的缺陷不会现形。
 */
test('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 接上之后挪节点，三条支路都跟着', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const frameBox = (await frame.boundingBox())!
  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  // 1) 一条水平导线。
  const left = { x: Math.round(frameBox.x + 80), y: Math.round(frameBox.y + 160) }
  const right = { x: Math.round(frameBox.x + 320), y: left.y }
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(left.x, left.y)
  await page.mouse.click(right.x, right.y)
  await stage.press('Enter')
  await stage.press('Escape')

  const lines = stage.locator('line[data-testid="compose-material-curve-stroke"]')
  await expect(lines).toHaveCount(1)

  // 2) 第二条导线的第一个点落在第一条的线身上：这一下就是接线。
  const tap = { x: Math.round((left.x + right.x) / 2) - 20, y: left.y }
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.move(tap.x, tap.y)
  // 落笔之前先看见它：整条高亮 + 最近点的沙漏记号。
  await expect(stage.getByTestId('stage-drafting-tap-target')).toHaveCount(1)
  await page.mouse.click(tap.x, tap.y)
  await page.mouse.click(tap.x, tap.y + 120)
  await stage.press('Enter')
  await stage.press('Escape')

  /*
   * 被接入的那条断成了两段，加上新画的这条——三条线。不断的话节点只是**压在**线上，
   * 那条线一移动就与它分家。
   */
  await expect(lines).toHaveCount(3)
  // 节点是填实的整圆，因此渲染成 `<circle>`；图上那个实心点就是它自己。
  const junction = stage.locator('circle[data-testid="compose-material-curve-stroke"]')
  await expect(junction).toHaveCount(1)

  /** 三条线的端点，页面坐标。 */
  const endpoints = () => lines.evaluateAll((elements) => elements.map((element) => {
    const line = element as SVGLineElement
    const ctm = line.getScreenCTM()!
    const map = (x: number, y: number) => {
      const point = new DOMPoint(x, y).matrixTransform(ctm)
      return [Math.round(point.x), Math.round(point.y)] as const
    }
    return [
      map(line.x1.baseVal.value, line.y1.baseVal.value),
      map(line.x2.baseVal.value, line.y2.baseVal.value),
    ]
  }))

  const junctionBox = (await junction.boundingBox())!
  const center = {
    x: junctionBox.x + junctionBox.width / 2,
    y: junctionBox.y + junctionBox.height / 2,
  }
  const meetsAt = (
    ends: readonly (readonly (readonly [number, number])[])[],
    point: { readonly x: number; readonly y: number },
  ) => ends.filter((line) => line.some(([x, y]) =>
    Math.abs(x - point.x) <= 4 && Math.abs(y - point.y) <= 4)).length

  // 接上之后：三条线各有一端落在节点上。
  expect(meetsAt(await endpoints(), center)).toBe(3)

  /*
   * 3) 拖走节点：三条支路都跟着走。
   *
   *    抓得住它本身就是一条断言——节点排在事务的最后，因此它在三条支路之上；排在新画的那条
   *    导线之前时，这一下按在接头正中央抓到的是那条线，节点纹丝不动。
   */
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 70, center.y + 50, { steps: 8 })
  await page.mouse.up()

  const movedBox = (await junction.boundingBox())!
  const moved = {
    x: movedBox.x + movedBox.width / 2,
    y: movedBox.y + movedBox.height / 2,
  }
  // 节点真的挪走了；否则下一条断言会在原地假通过。
  expect(Math.hypot(moved.x - center.x, moved.y - center.y)).toBeGreaterThan(20)
  // 三条支路的端点跟着端口走——接头不裂开。
  expect(meetsAt(await endpoints(), moved)).toBe(3)
})
