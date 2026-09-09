import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 导线的夹点会话钉死正交。
 *
 * @remarks
 * 画导线时从第二个点起钉住横平竖直，进了顶点模式这条规范不该消失。判别点选在**参照**上：
 * 拖动的竖直位移比水平位移大，相对端点原位置的正交会把它拖成竖直位移（线斜了），相对相邻
 * 顶点的正交才保住水平——两种做法在这一下上给出不同答案。
 *
 * 落点断言在**非 100% 缩放**下做（默认路由带自动适配），画线用键入坐标，几何精确已知。
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

async function typePoint(commandInput: Locator, x: number, y: number) {
  await commandInput.fill(`${x},${y}`)
  await commandInput.press('Enter')
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

async function gripCenter(stage: Locator, id: string) {
  const box = (await stage.getByTestId(`stage-path-vertex-${id}`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const A = { x: 300, y: 300 }
const B = { x: 500, y: 300 }
const MID = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
/** 竖直位移大于水平位移，但离 A 仍是横向更近：两种参照在这一下上给出不同答案。 */
const TARGET = { x: 520, y: 420 }

/** 把 `end` 夹点拖到目标世界坐标并松手，返回松手后夹点的屏幕位置。 */
async function dragEnd(page: Page, stage: Locator, at: (x: number, y: number) => { x: number; y: number }) {
  const end = await gripCenter(stage, 'end')
  const to = at(TARGET.x, TARGET.y)
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
  await expect(stage.getByTestId('stage-drafting-command-prompt')).not.toContainText('新位置')
  return gripCenter(stage, 'end')
}

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage / 曲线几何编辑会话 / 导线的端点拖成斜的仍然横平竖直', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  // `WIRE` 声明 `repeat`：这一条结束之后命令会重开，再按一次 Escape 才退出。
  await commandInput.fill('W')
  await commandInput.press('Enter')
  await typePoint(commandInput, A.x, A.y)
  await typePoint(commandInput, B.x, B.y)
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)
  const mid = view.at(MID.x, MID.y)
  await page.mouse.dblclick(mid.x, mid.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  const moved = await dragEnd(page, stage, view.at)
  const kept = view.at(TARGET.x, A.y)
  // 端点仍与 A 等高：正交相对相邻顶点 A 生效，水平位移保留、竖直位移被投影掉。
  expect(Math.abs(moved.y - kept.y)).toBeLessThan(0.6)
  // 网格可能把 x 取整，但它必须真的往右挪了——而不是被钉在原地。
  expect(moved.x).toBeGreaterThan(view.at(B.x + 10, A.y).x)
})

test('OpenSpec: stage / 曲线几何编辑会话 / 普通直线照旧跟随会话级角度约束', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await typePoint(commandInput, A.x, A.y)
  await typePoint(commandInput, B.x, B.y)
  await commandInput.press('Escape')

  const view = await worldToScreen(page)
  const mid = view.at(MID.x, MID.y)
  await page.mouse.dblclick(mid.x, mid.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  // 默认极轴（45° 增量）在这个方向上够不着：落点离 45° 与 90° 射线都远，端点因此斜了。
  const moved = await dragEnd(page, stage, view.at)
  const level = view.at(TARGET.x, A.y)
  expect(Math.abs(moved.y - level.y)).toBeGreaterThan(20)
})
