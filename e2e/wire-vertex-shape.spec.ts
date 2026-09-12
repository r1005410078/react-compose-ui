import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 导线的顶点模式恒保横平竖直。
 *
 * @remarks
 * 「只走横平竖直」是导线的**规范**而不是辅助，画线时钉住、进了顶点模式就掉一半，等于这条
 * 规范只在一半的入口上成立。两条用例各盯一处漏洞：内部拐点（它一个自由度都没有，因此不该
 * 出夹点），以及段夹点的平行平移（它让两头的相邻段一起变斜）。
 *
 * 落点断言在**非 100% 缩放**下做（默认路由带自动适配）。
 */

async function worldToScreen(page: Page) {
  const view = await page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform)
    const rect = (document.querySelector('[data-testid="stage-surface"]') as HTMLElement)
      .getBoundingClientRect()
    return { zoom: matrix.a, x: matrix.e, y: matrix.f, left: rect.left, top: rect.top }
  })
  return {
    zoom: view.zoom,
    at: (x: number, y: number) => ({
      x: view.left + view.x + x * view.zoom,
      y: view.top + view.y + y * view.zoom,
    }),
  }
}

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
  }
}

/** 用键入坐标画一条直角走线：A→B 横、B→C 竖。几何因此精确已知。 */
const A = { x: 300, y: 300 }
const B = { x: 500, y: 300 }
const C = { x: 500, y: 460 }

async function drawWire(commandInput: Locator, command: string) {
  await commandInput.fill(command)
  await commandInput.press('Enter')
  for (const point of [A, B, C]) {
    await commandInput.fill(`${point.x},${point.y}`)
    await commandInput.press('Enter')
  }
  await commandInput.press('Enter')
  await commandInput.press('Escape')
}

/** 图上那条折线的顶点，页面坐标。 */
function vertices(stage: Locator) {
  return stage.locator('polyline[data-testid="compose-material-curve-stroke"]')
    .first()
    .evaluate((node) => {
      const shape = node as unknown as SVGPolylineElement
      const ctm = shape.getScreenCTM()!
      return Array.from({ length: shape.points.numberOfItems }, (_, index) => {
        const point = shape.points.getItem(index).matrixTransform(ctm)
        return { x: point.x, y: point.y }
      })
    })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage / 曲线几何编辑会话 / 导线的内部拐点不出夹点', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await drawWire(commandInput, 'W')
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  // 双击第一段的中段进几何编辑。
  const onFirstSegment = view.at((A.x + B.x) / 2, A.y)
  await page.mouse.dblclick(onFirstSegment.x, onFirstSegment.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  // 两个端点顶点 + 两个段夹点；中间那个拐点一个自由度都没有，因此不画。
  await expect(stage.getByTestId('stage-path-vertex-v0')).toHaveCount(1)
  await expect(stage.getByTestId('stage-path-vertex-v2')).toHaveCount(1)
  await expect(stage.getByTestId('stage-path-vertex-v1')).toHaveCount(0)
  await expect(stage.getByTestId('stage-path-vertex-m0')).toHaveCount(1)
  await expect(stage.getByTestId('stage-path-vertex-m1')).toHaveCount(1)

  // 判别点：同样顶点数的普通多段线仍然出三个顶点夹点——收走的是导线那一档，不是所有折线。
  await page.keyboard.press('Escape')
  await drawWire(commandInput, 'PLINE')
  const second = view.at((A.x + B.x) / 2, A.y)
  await page.mouse.dblclick(second.x, second.y)
  await expect(stage.getByTestId('stage-path-vertex-v1')).toHaveCount(1)
})

test('OpenSpec: stage / 曲线几何编辑会话 / 拖导线的段只沿垂直方向走', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await drawWire(commandInput, 'W')
  const view = await worldToScreen(page)

  const onFirstSegment = view.at((A.x + B.x) / 2, A.y)
  await page.mouse.dblclick(onFirstSegment.x, onFirstSegment.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  const before = await vertices(stage)
  const grip = (await stage.getByTestId('stage-path-vertex-m0').boundingBox())!
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  /*
   * 往**右下**拖第一段（水平段）的夹点：水平那一半平行于它，会把 B 沿 x 拖走，而 B-C 是
   * 竖直的——那一段当场变斜。只取垂直分量时它只往下走。
   */
  const to = view.at((A.x + B.x) / 2 + 90, A.y + 70)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
  await expect(stage.getByTestId('stage-drafting-command-prompt')).not.toContainText('新位置')

  const after = await vertices(stage)
  expect(after).toHaveLength(3)
  // 第一段仍然是水平的，且真的往下挪了——不是被钉在原地。
  expect(Math.abs(after[0]!.y - after[1]!.y)).toBeLessThan(1)
  expect(after[0]!.y - before[0]!.y).toBeGreaterThan(20)
  // 判别点：水平位移被丢掉了，第二段因此仍然竖直。
  expect(Math.abs(after[1]!.x - after[2]!.x)).toBeLessThan(1)
  expect(Math.abs(after[2]!.x - before[2]!.x)).toBeLessThan(1)
})
