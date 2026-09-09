import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 点亮之后的目标位置预览。
 *
 * @remarks
 * 判别点是**几何跟不跟光标走**：点亮之后只画一条橡皮筋是不够的，用户看不到「点下去会变成
 * 什么样」，而那条从旧位置指向光标的直线只在直线端点上勉强像结果——在弧的半径夹点、多段线
 * 顶点与直线的平移夹点上说的完全是另一回事。
 *
 * 预览读的必须是**解算后**的落点，与十字光标、橡皮筋终点和捕捉标记同一个值；各读各的会让
 * 预览停在用户不会落笔的地方，而这只在开着吸附时才现形。因此本文件在**非 100% 缩放**下断言，
 * 并专门用一条「靠近别的曲线端点但不在它上面」的用例去分辨这两者。
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

/** 用键入坐标画一条线，几何因此精确已知。 */
async function drawLine(
  commandInput: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await commandInput.fill(`${from.x},${from.y}`)
  await commandInput.press('Enter')
  await commandInput.fill(`${to.x},${to.y}`)
  await commandInput.press('Enter')
  await commandInput.press('Escape')
}

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    outline: stage.getByTestId('stage-editable-path-line'),
  }
}

async function gripCenter(stage: Locator, id: string) {
  const box = (await stage.getByTestId(`stage-path-vertex-${id}`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** 双击线身进入几何编辑，再原地单击某个夹点把它点亮。 */
async function armGrip(
  page: Page,
  stage: Locator,
  mid: { x: number; y: number },
  gripId: string,
) {
  if (await stage.getByTestId('stage-editable-path').count() === 0) {
    await page.mouse.dblclick(mid.x, mid.y)
    await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  }
  const grip = await gripCenter(stage, gripId)
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(stage.getByTestId(`stage-path-vertex-${gripId}`)).toHaveAttribute('data-vertex-hot')
}

const A = { x: 300, y: 300 }
const B = { x: 500, y: 400 }
const MID = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage / 顶点取点是一条命令会话 / 点亮后移动光标，几何跟着走', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, outline } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const drawn = (await stroke.boundingBox())!
  await armGrip(page, stage, view.at(MID.x, MID.y), 'end')
  const before = await outline.getAttribute('points')

  const away = view.at(624, 264)
  await page.mouse.move(away.x, away.y, { steps: 6 })

  await expect(outline).not.toHaveAttribute('points', before!)
  const moved = await gripCenter(stage, 'end')
  expect(Math.hypot(moved.x - away.x, moved.y - away.y)).toBeLessThan(12)

  // 预览是临时的：文档还没有改。
  const after = (await stroke.boundingBox())!
  expect(Math.abs(after.width - drawn.width)).toBeLessThan(0.5)
  expect(Math.abs(after.height - drawn.height)).toBeLessThan(0.5)
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 预览读解算后的落点', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  // 第二条线的起点落在网格之外：预览若读裸坐标，绝无可能停在那里。
  const target = { x: 611, y: 253 }
  await drawLine(commandInput, A, B)
  await drawLine(commandInput, target, { x: 700, y: 340 })
  const view = await worldToScreen(page)

  await armGrip(page, stage, view.at(MID.x, MID.y), 'end')

  // 停在那个端点**附近**而不是端点上：偏这几像素正是要让捕捉去纠正的。
  const near = view.at(target.x, target.y)
  await page.mouse.move(near.x + 4, near.y - 3, { steps: 4 })

  const moved = await gripCenter(stage, 'end')
  const want = view.at(target.x, target.y)
  expect(Math.hypot(moved.x - want.x, moved.y - want.y)).toBeLessThan(1.5)
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 点亮不等于拖动', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, outline } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  await armGrip(page, stage, view.at(MID.x, MID.y), 'end')
  const before = await outline.getAttribute('points')

  await page.mouse.move(view.at(624, 264).x, view.at(624, 264).y, { steps: 6 })
  await expect(outline).not.toHaveAttribute('points', before!)

  // 有预览不等于在拖动：热夹点还在，拾取框仍然不画。
  await expect(stage.getByTestId('stage-path-vertex-end')).toHaveAttribute('data-vertex-hot')
  await expect(stage.locator('[data-stage-crosshair-box]')).toHaveCount(0)
  await expect(stage.locator('[data-stage-crosshair-line]')).toHaveCount(4)
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 指针移出图面时预览退回文档几何', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, outline } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)

  // 文档几何要在**点亮之前**读：按下那一刻就解一次落点，而开着网格吸附时它已经把顶点挪了
  // 半格——与拖动按下即预览是同一条既有行为。
  await page.mouse.dblclick(view.at(MID.x, MID.y).x, view.at(MID.x, MID.y).y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  const documentPoints = await outline.getAttribute('points')
  await armGrip(page, stage, view.at(MID.x, MID.y), 'end')

  await page.mouse.move(view.at(624, 264).x, view.at(624, 264).y, { steps: 6 })
  await expect(outline).not.toHaveAttribute('points', documentPoints!)

  // 图面之外没有落点可言。
  const box = (await surface.boundingBox())!
  await page.mouse.move(box.x - 40, box.y + 60, { steps: 4 })
  await expect(outline).toHaveAttribute('points', documentPoints!)
  await expect(stage.getByTestId('stage-path-vertex-end')).toHaveAttribute('data-vertex-hot')
})
