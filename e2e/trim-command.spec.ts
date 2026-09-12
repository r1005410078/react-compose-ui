import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { switchToDrawingWorkspace } from './support/test-helpers'

/**
 * `TRIM`：一下点掉光标底下的那一截。
 *
 * @remarks
 * 只有端到端拦得住这条链：`pick` 由内核的插件接管 → 宿主按拾取框命中一条曲线 → 引擎按世界
 * 坐标求交解算出一截 → 覆盖层画幽灵与剪口 → 落地成 `entity.curve.set` / 新建 / 删除。任何一段
 * 用替身都会把要证明的那件事假设掉。
 *
 * 断言在**非 100% 缩放**下做（默认路由带自动适配，缩放由它给出）：`world = (屏幕 − 视口) / zoom`。
 * 落点一律从 Stage 当前的变换换算，因此不依赖确定性取景。
 */

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    lines: stage.locator('line[data-testid="compose-material-curve-stroke"]'),
    polylines: stage.locator('polyline[data-testid="compose-material-curve-stroke"]'),
    polygons: stage.locator('polygon[data-testid="compose-material-curve-stroke"]'),
    circles: stage.locator('circle[data-testid="compose-material-curve-stroke"]'),
    arcs: stage.locator('path[data-testid="compose-material-curve-stroke"]'),
    pieces: stage.getByTestId('stage-trim-piece'),
    cuts: stage.getByTestId('stage-trim-cut'),
    trail: stage.getByTestId('stage-trim-trail'),
    badge: stage.getByTestId('stage-drafting-badge'),
    pickbox: stage.getByTestId('stage-pickbox'),
    crosshairLines: stage.locator('[data-stage-crosshair-line]'),
  }
}

async function open(page: Page) {
  await page.goto('/')
  const view = setup(page)
  await expect(view.surface).toBeVisible()
  await switchToDrawingWorkspace(page)
  return view
}

/** 键入坐标跑一条命令；坐标精确已知，因此几何可以逐个断言。 */
async function run(commandInput: Locator, command: string, points: readonly string[], finish = true) {
  await commandInput.fill(command)
  await commandInput.press('Enter')
  for (const point of points) {
    await commandInput.fill(point)
    await commandInput.press('Enter')
  }
  if (finish) await commandInput.press('Enter')
  await commandInput.press('Escape')
}

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
    toWorld: (x: number, y: number) => ({
      x: (x - view.left - view.x) / view.zoom,
      y: (y - view.top - view.y) / view.zoom,
    }),
  }
}

/** 一条 `<line>` 的两个端点，页面坐标。 */
function endpoints(line: Locator) {
  return line.evaluate((node) => {
    const shape = node as unknown as SVGLineElement
    const ctm = shape.getScreenCTM()!
    const point = (x: number, y: number) => {
      const p = new DOMPoint(x, y).matrixTransform(ctm)
      return { x: p.x, y: p.y }
    }
    return [
      point(shape.x1.baseVal.value, shape.y1.baseVal.value),
      point(shape.x2.baseVal.value, shape.y2.baseVal.value),
    ]
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage-engine / TRIM / 两线相交去掉交点一侧', async ({ page }) => {
  const { commandInput, lines, pieces, cuts, prompt } = await open(page)
  await run(commandInput, 'LINE', ['100,300', '500,300'])
  await run(commandInput, 'LINE', ['300,100', '300,500'])
  await expect(lines).toHaveCount(2)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('选择要修剪的一截')
  await page.mouse.move(view.at(400, 300).x, view.at(400, 300).y, { steps: 4 })
  // 悬停即预览：光标底下那一截淡成幽灵，交点处一道剪口。
  await expect(pieces).toHaveCount(1)
  await expect(cuts).toHaveCount(1)
  await page.mouse.click(view.at(400, 300).x, view.at(400, 300).y)

  // 横线缩到交点，竖线不动，仍是两个 Entity；会话留着继续剪下一截。
  await expect(lines).toHaveCount(2)
  await expect(prompt).toContainText('选择要修剪的一截')
  const [first, second] = await Promise.all([endpoints(lines.nth(0)), endpoints(lines.nth(1))])
  const worlds = [first, second].map((pair) => pair.map(({ x, y }) => view.toWorld(x, y)))
  const horizontal = worlds.find((pair) => Math.abs(pair[0]!.y - pair[1]!.y) < 1)!
  const xs = horizontal.map(({ x }) => x).sort((a, b) => a - b)
  expect(xs[0]).toBeCloseTo(100, 0)
  expect(xs[1]).toBeCloseTo(300, 0)
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / TRIM / 线穿过矩形挖掉中间，一条变两条且撤销一步', async ({ page }) => {
  const { commandInput, lines, polygons } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '400,400'], false)
  await run(commandInput, 'LINE', ['100,300', '500,300'])
  await expect(polygons).toHaveCount(1)
  await expect(lines).toHaveCount(1)
  const view = await worldToScreen(page)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 300).x, view.at(300, 300).y)
  await expect(lines).toHaveCount(2)
  await expect(polygons).toHaveCount(1)
  await commandInput.press('Escape')

  await page.keyboard.press('Control+z')
  await expect(lines).toHaveCount(1)
})

test('OpenSpec: stage-engine / TRIM / 圆被线穿过变成弧', async ({ page }) => {
  const { commandInput, circles, arcs, lines } = await open(page)
  await run(commandInput, 'CIRCLE', ['300,300', '400,300'], false)
  await run(commandInput, 'LINE', ['100,300', '500,300'])
  await expect(circles).toHaveCount(1)
  const view = await worldToScreen(page)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 200).x, view.at(300, 200).y)
  // kind 仍是 arc：整圆画成 <circle>，一段弧画成 <path>；直线不动。
  await expect(circles).toHaveCount(0)
  await expect(arcs).toHaveCount(1)
  await expect(lines).toHaveCount(1)
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / TRIM / 矩形的一条边：闭合变开放', async ({ page }) => {
  const { commandInput, polygons, polylines } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '400,400'], false)
  await expect(polygons).toHaveCount(1)
  const view = await worldToScreen(page)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 300).x, view.at(400, 300).y)
  await expect(polygons).toHaveCount(0)
  await expect(polylines).toHaveCount(1)
  await commandInput.press('Escape')
})

test('OpenSpec: stage / TRIM 的悬停预览与拖动 / 拖过多条一个事务', async ({ page }) => {
  const { commandInput, lines, trail, pieces } = await open(page)
  await run(commandInput, 'LINE', ['100,200', '500,200'])
  await run(commandInput, 'LINE', ['100,400', '500,400'])
  await run(commandInput, 'LINE', ['300,100', '300,500'])
  await expect(lines).toHaveCount(3)
  const view = await worldToScreen(page)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  const from = view.at(150, 150)
  const to = view.at(250, 450)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  // 拖动中画轨迹，碰到的两截都淡。
  await expect(trail).toHaveCount(1)
  await expect(pieces).toHaveCount(2)
  await page.mouse.up()
  await expect(trail).toHaveCount(0)
  await commandInput.press('Escape')

  // 两条横线各去掉左半：仍是三个 Entity，两条横线的左端都挪到了竖线上。
  await expect(lines).toHaveCount(3)
  const leftEnds = await Promise.all([0, 1, 2].map(async (index) => {
    const pair = (await endpoints(lines.nth(index))).map(({ x, y }) => view.toWorld(x, y))
    return Math.abs(pair[0]!.y - pair[1]!.y) < 1 ? Math.min(pair[0]!.x, pair[1]!.x) : null
  }))
  expect(leftEnds.filter((value) => value !== null).map((value) => Math.round(value!))).toEqual([300, 300])

  // 一个事务：撤销一步两截都回来。
  await page.keyboard.press('Control+z')
  const restored = await Promise.all([0, 1, 2].map(async (index) => {
    const pair = (await endpoints(lines.nth(index))).map(({ x, y }) => view.toWorld(x, y))
    return Math.abs(pair[0]!.y - pair[1]!.y) < 1 ? Math.min(pair[0]!.x, pair[1]!.x) : null
  }))
  expect(restored.filter((value) => value !== null).map((value) => Math.round(value!))).toEqual([100, 100])
})

test('OpenSpec: stage / Stage 十字光标 / 等待 pick 时是拾取框加徽标', async ({ page }) => {
  const { commandInput, pickbox, badge, crosshairLines, pieces, lines } = await open(page)
  await run(commandInput, 'LINE', ['100,300', '500,300'])
  await expect(lines).toHaveCount(1)
  const view = await worldToScreen(page)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.move(view.at(200, 150).x, view.at(200, 150).y, { steps: 3 })
  await expect(pickbox).toHaveCount(1)
  await expect(badge).toHaveCount(1)
  await expect(crosshairLines).toHaveCount(0)
  // 空白处没有预览；压住线时出现，移开即消失。
  await expect(pieces).toHaveCount(0)
  await page.mouse.move(view.at(200, 300).x, view.at(200, 300).y, { steps: 3 })
  await expect(pieces).toHaveCount(1)
  await page.mouse.move(view.at(200, 150).x, view.at(200, 150).y, { steps: 3 })
  await expect(pieces).toHaveCount(0)
  await commandInput.press('Escape')
  await expect(badge).toHaveCount(0)
})

test('OpenSpec: stage / TRIM 的悬停预览与拖动 / 接线点在命令行说明', async ({ page }) => {
  const { commandInput, prompt, lines, polygons } = await open(page)
  await run(commandInput, 'WIRE', ['100,300', '500,300'])
  const view = await worldToScreen(page)
  // 第二条的末端**用指针**落在第一条的线身上：接入来自取点时的捕捉来源，键入的坐标不接入。
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await commandInput.fill('300,100')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 300).x, view.at(300, 300).y)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(polygons).toHaveCount(1)
  await expect(lines).toHaveCount(3)

  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 300).x, view.at(300, 300).y)
  await expect(prompt).toContainText('接线点不能修剪')
  await expect(polygons).toHaveCount(1)
  await expect(lines).toHaveCount(3)
  await commandInput.press('Escape')
})
