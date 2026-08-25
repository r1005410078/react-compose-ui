import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 多段线的夹点。
 *
 * @remarks
 * 顶点方块加段中点条形，与 AutoCAD 一致。段中点表达的是**在这里插入一个顶点**——那是我们
 * 当初把它留白时写下的用途。
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
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = await boxOf(stage.getByTestId('stage-surface'))
  return {
    editor,
    stage,
    at: (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy }),
    strokes: stage.getByTestId('compose-material-curve-stroke'),
  }
}

/** 画一条三顶点开放多段线，并停在它的几何编辑会话里。 */
async function drawPolyline(page: Page, ctx: Awaited<ReturnType<typeof openEditor>>) {
  const { editor, stage, at } = ctx
  await editor.getByRole('button', { name: '多段线', exact: true }).click()
  await page.mouse.click(at(160, 400).x, at(160, 400).y)
  await page.mouse.click(at(320, 240).x, at(320, 240).y)
  await page.mouse.click(at(480, 400).x, at(480, 400).y)
  await page.keyboard.press('Enter')
  // 命令产出的对象不进几何编辑；双击线身进去。
  await page.mouse.dblclick(at(240, 320).x, at(240, 320).y)
  await expect(stage.locator('[data-testid^="stage-path-vertex-"]').first()).toBeAttached()
}

function vertexCount(stroke: Locator) {
  return stroke.getAttribute('points').then((raw) => (raw ? raw.trim().split(/\s+/).length : 0))
}

test('OpenSpec: stage-engine / 多段线夹点 / 顶点之外还有每段的中点', async ({ page }) => {
  const ctx = await openEditor(page)
  await drawPolyline(page, ctx)

  // 三个顶点 v0/v1/v2 加两段的中点 m0/m1。
  for (const id of ['v0', 'v1', 'v2', 'm0', 'm1']) {
    await expect(ctx.stage.getByTestId(`stage-path-vertex-${id}`)).toHaveCount(1)
  }
  await expect(ctx.stage.locator('[data-testid^="stage-path-vertex-hit-"]')).toHaveCount(5)
})

test('OpenSpec: stage-engine / 多段线夹点 / 拖段中点插入一个顶点', async ({ page }) => {
  const ctx = await openEditor(page)
  await drawPolyline(page, ctx)
  const stroke = ctx.strokes.first()
  expect(await vertexCount(stroke)).toBe(3)

  const grip = await boxOf(ctx.stage.getByTestId('stage-path-vertex-hit-m0'))
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  const to = ctx.at(240, 480)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()

  // 判别点是**四**：拖段中点是插入而不是平移。平移的话顶点数不变。
  await expect.poll(async () => vertexCount(stroke)).toBe(4)
})

test('OpenSpec: stage / 多段线夹点 / 顶点画方块，段中点画条形', async ({ page }) => {
  const ctx = await openEditor(page)
  await drawPolyline(page, ctx)

  const shapeOf = async (id: string) => ctx.stage
    .getByTestId(`stage-path-vertex-${id}`)
    .getAttribute('data-vertex-role')

  // 两个夹点长得一样而按下去做的事不同，是最难自己发现的一类缺陷。
  expect(await shapeOf('v0')).toBe('vertex')
  expect(await shapeOf('m0')).toBe('insert')

  /*
   * 量元素自己的 `width`/`height` 而不是 `boundingBox()`：条形是**转过角度**的，而
   * `boundingBox()` 给的是旋转之后的轴对齐外框——45 度的条形算出来恰好接近正方形，
   * 那样这条用例会在最该报警的排布上变成恒绿。
   */
  const sizeOf = async (id: string) => {
    const rect = ctx.stage.getByTestId(`stage-path-vertex-${id}`)
    return {
      width: Number(await rect.getAttribute('width')),
      height: Number(await rect.getAttribute('height')),
    }
  }
  const vertex = await sizeOf('v1')
  const insert = await sizeOf('m0')
  expect(vertex.width).toBe(vertex.height)
  // 长宽比是条形与方块唯一的区别，形状一样就等于没有区别。
  expect(insert.width).toBeGreaterThan(insert.height * 2)

  // 而且它沿段的方向摆：第一段是 45 度下坡，条形跟着转过去。
  const transform = await ctx.stage.getByTestId('stage-path-vertex-m0').getAttribute('transform')
  expect(Number(/rotate\(([-\d.]+)/.exec(transform ?? '')?.[1])).toBeCloseTo(-45, 0)
})

test('OpenSpec: stage-engine / 多段线夹点 / 直线的中点仍是平移', async ({ page }) => {
  const ctx = await openEditor(page)
  const { editor, stage, at } = ctx

  await editor.getByRole('button', { name: '直线', exact: true }).click()
  await page.mouse.click(at(200, 200).x, at(200, 200).y)
  await page.mouse.click(at(400, 200).x, at(400, 200).y)
  await page.keyboard.press('Escape')
  await page.mouse.dblclick(at(300, 200).x, at(300, 200).y)

  // 护栏：直线插一个顶点就不是直线了。这一刀不得顺手把它也改成插入。
  await expect(stage.getByTestId('stage-path-vertex-move')).toHaveCount(1)
  await expect(stage.getByTestId('stage-path-vertex-m0')).toHaveCount(0)

  const grip = await boxOf(stage.getByTestId('stage-path-vertex-hit-move'))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(ctx.at(300, 320).x, ctx.at(300, 320).y, { steps: 6 })
  await page.mouse.up()

  // 平移：整条线搬走，长度不变。
  const stroke = ctx.strokes.first()
  await expect.poll(async () => stroke.getAttribute('y1')).not.toBe(null)
  const width = Number(await stroke.getAttribute('x2')) - Number(await stroke.getAttribute('x1'))
  expect(Math.abs(width)).toBeGreaterThan(0)
})
