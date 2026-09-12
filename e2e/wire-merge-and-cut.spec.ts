import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { pointerDrop } from './support/test-helpers'

/**
 * 导线的分合：两条在一点相接即合并，段夹点上的 `Delete` 是剪断。
 *
 * @remarks
 * 只有端到端拦得住这三件事——它们各自要走完「取点捕捉 → 建节点 → 节点清理 → 合并 → 求解」
 * 这条链，而链上任何一环断掉的症状都一样：图上看着对，文档形态不对，直到用户按下 `Delete`
 * 才发现没掉的东西和他想的不是一回事。
 *
 * 断言在**非 100% 缩放**下做（默认路由带自动适配）：`world = (屏幕 − 视口) / zoom`。
 */

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    /** 两点导线画成 `<line>`，三顶点以上画成 `<polyline>`，节点是闭合方块、画成 `<polygon>`。 */
    lines: stage.locator('line[data-testid="compose-material-curve-stroke"]'),
    polylines: stage.locator('polyline[data-testid="compose-material-curve-stroke"]'),
    junctions: stage.locator('polygon[data-testid="compose-material-curve-stroke"]'),
  }
}

/** 用键入坐标画一条导线，画完退出会话。坐标精确已知，因此顶点可以逐个断言。 */
async function drawWire(
  commandInput: Locator,
  points: readonly { readonly x: number; readonly y: number }[],
) {
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  for (const point of points) {
    await commandInput.fill(`${point.x},${point.y}`)
    await commandInput.press('Enter')
  }
  await commandInput.press('Enter')
  await commandInput.press('Escape')
}

/** 一条折线的顶点，页面坐标。 */
function vertices(polyline: Locator) {
  return polyline.evaluate((node) => {
    const shape = node as unknown as SVGPolylineElement
    const ctm = shape.getScreenCTM()!
    return Array.from({ length: shape.points.numberOfItems }, (_, index) => {
      const point = shape.points.getItem(index).matrixTransform(ctm)
      return { x: point.x, y: point.y }
    })
  })
}

/** 一条 `<line>` 的两个端点，页面坐标。 */
function lineEndpoints(line: Locator) {
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

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage-engine / 节点在支路不足时自删 / 分两次画出的线合成一条', async ({ page }) => {
  await page.goto('/')
  const { surface, commandInput, lines, polylines, junctions } = setup(page)
  await expect(surface).toBeVisible()

  const A = { x: 300, y: 300 }
  const B = { x: 500, y: 300 }
  const C = { x: 500, y: 460 }

  await drawWire(commandInput, [A, B])
  await expect(lines).toHaveCount(1)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  /*
   * 第二条从 B 起笔：那一下用**指针**取点才有来源（键入的坐标永远不接），落在第一条的末顶点
   * 上因此记成一次接入，按既有规则建出来的正是一个两支路节点。
   */
  const at = view.at(B.x, B.y)
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.move(at.x, at.y)
  await page.mouse.click(at.x, at.y)
  await commandInput.fill(`${C.x},${C.y}`)
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  // 那个节点当场被合并掉：一条三顶点导线，图上没有实心点。
  await expect(junctions).toHaveCount(0)
  await expect(lines).toHaveCount(0)
  await expect(polylines).toHaveCount(1)
  const shape = await vertices(polylines.first())
  expect(shape).toHaveLength(3)
  const expected = [view.at(A.x, A.y), view.at(B.x, B.y), view.at(C.x, C.y)]
  shape.forEach((point, index) => {
    expect(Math.abs(point.x - expected[index]!.x)).toBeLessThan(2)
    expect(Math.abs(point.y - expected[index]!.y)).toBeLessThan(2)
  })
})

test('OpenSpec: stage-engine / 节点在支路不足时自删 / 删掉搭上去的那条之后两半合回一条', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, lines, polylines, junctions } = setup(page)
  await expect(surface).toBeVisible()

  const left = { x: 280, y: 320 }
  const right = { x: 640, y: 320 }
  await drawWire(commandInput, [left, right])
  await expect(lines).toHaveCount(1)
  const view = await worldToScreen(page)

  // 搭一条上去：被搭的那条断成两段，三条支路加一个节点。
  const tap = view.at((left.x + right.x) / 2, left.y)
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.move(tap.x, tap.y)
  await expect(stage.getByTestId('stage-drafting-tap-target')).toHaveCount(1)
  await page.mouse.click(tap.x, tap.y)
  await page.mouse.click(tap.x, tap.y + 140)
  await stage.press('Enter')
  await stage.press('Escape')
  await expect(lines).toHaveCount(3)
  await expect(junctions).toHaveCount(1)

  // 选中搭上去的那条（它是竖的，抓它中段）并删掉。
  const onBranch = { x: tap.x, y: tap.y + 90 }
  await page.mouse.click(onBranch.x, onBranch.y)
  await stage.press('Delete')

  /*
   * 两半合回**一个** Entity，节点消失。相接点作为一个共线顶点留着，因此它现在是一条三顶点
   * 折线而不是当初那条两点直线——图上逐像素相同，Entity 数目回到搭接之前。
   */
  await expect(junctions).toHaveCount(0)
  await expect(lines).toHaveCount(0)
  await expect(polylines).toHaveCount(1)
  const shape = await vertices(polylines.first())
  expect(shape).toHaveLength(3)
  expect(Math.abs(shape[0]!.y - shape[2]!.y)).toBeLessThan(2)
  expect(Math.abs(shape[1]!.y - shape[0]!.y)).toBeLessThan(2)
})

test('OpenSpec: stage / 导线在顶点模式里的 Delete / 点亮中间段按 Delete 剪断', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, polylines, lines } = setup(page)
  await expect(surface).toBeVisible()

  const A = { x: 280, y: 300 }
  const B = { x: 460, y: 300 }
  const C = { x: 460, y: 460 }
  const D = { x: 660, y: 460 }
  await drawWire(commandInput, [A, B, C, D])
  await expect(polylines).toHaveCount(1)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  // 双击第一段进顶点模式，再原地单击中间那一段的段夹点把它点亮。
  const onFirst = view.at((A.x + B.x) / 2, A.y)
  await page.mouse.dblclick(onFirst.x, onFirst.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  const grip = (await stage.getByTestId('stage-path-vertex-m1').boundingBox())!
  await page.mouse.click(grip.x + grip.width / 2, grip.y + grip.height / 2)

  await stage.press('Delete')

  // 中间那一整段没了：两条各两个顶点（两点取最窄的 kind，画成 <line>），剪口留下一个看得见的缺口。
  await expect(polylines).toHaveCount(0)
  await expect(lines).toHaveCount(2)
  const first = await lineEndpoints(lines.nth(0))
  const second = await lineEndpoints(lines.nth(1))
  const gap = Math.min(...first.flatMap((a) => second.map((b) => Math.hypot(a.x - b.x, a.y - b.y))))
  expect(gap).toBeGreaterThan(20)

  // 一步撤销回到一条。
  await stage.press('Control+z')
  await expect(polylines).toHaveCount(1)
  expect(await vertices(polylines.first())).toHaveLength(4)
})

test('OpenSpec: stage / 导线在顶点模式里的 Delete / 点亮绑定端的顶点按 Delete 只出说明', async ({ page }) => {
  await page.goto('/')
  const { editor, stage, surface, commandInput, lines } = setup(page)
  await expect(surface).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  // 一个带端口的矩形：端口默认落在 Entity 局部原点，也就是矩形左上角。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 矩形' }), {
    x: frameBox.x + 240,
    y: frameBox.y + 180,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const port = (await stage.getByTestId(rectangleId).boundingBox())!

  // 从端口起笔画一条导线：起点因此绑在端口上。
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.move(port.x, port.y)
  await page.mouse.click(port.x, port.y)
  await page.mouse.click(port.x + 240, port.y)
  await commandInput.press('Enter')
  await commandInput.press('Escape')
  await expect(lines).toHaveCount(1)

  // 双击进顶点模式，点亮起点方块，按 Delete。
  const wireBox = (await lines.first().boundingBox())!
  await page.mouse.dblclick(wireBox.x + wireBox.width / 2, wireBox.y + wireBox.height / 2)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  const grip = (await stage.getByTestId('stage-path-vertex-start').boundingBox())!
  await page.mouse.click(grip.x + grip.width / 2, grip.y + grip.height / 2)

  await stage.press('Delete')

  // 命令行说出理由，几何一个字节不动——删得掉的话求解会把这一段当场拉斜。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('绑在端口上')
  await expect(lines).toHaveCount(1)
  const after = (await lines.first().boundingBox())!
  expect(Math.abs(after.width - wireBox.width)).toBeLessThan(2)
})
