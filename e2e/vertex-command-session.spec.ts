import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 顶点取点走命令那一套。
 *
 * @remarks
 * 今天顶点是 Stage 里唯一一处「人在取点、键盘却进不来」的地方：`LINE`、`ARC`、`MOVE` 都能
 * 键入精确坐标，唯独「把这个顶点放到 100,50」做不到——命令行答的是「未知命令」。这几条各自
 * 钉住那条链上的一环：提示、点亮、键入坐标、两级 `Escape`、拾取框的第三态与命令入口。
 *
 * 落点断言一律在**非 100% 缩放**下做：`world = (屏幕 − 视口) / zoom`。画线用**键入坐标**，
 * 因此目标世界坐标是精确已知的，断言才敢用亚像素容差而不是一个宽到没有判别力的范围。
 */

/** 世界坐标 → 屏幕坐标，读 Scene 真实的变换矩阵而不是重算一遍。 */
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

/** 用键入坐标画一条线，几何因此精确已知。 */
async function drawLine(
  commandInput: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await typePoint(commandInput, from.x, from.y)
  await typePoint(commandInput, to.x, to.y)
  await commandInput.press('Escape')
}

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('textbox', { name: '命令行' }),
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    editablePath: stage.getByTestId('stage-editable-path'),
  }
}

/** 夹点的屏幕中心。 */
async function gripCenter(stage: Locator, id: string) {
  const box = (await stage.getByTestId(`stage-path-vertex-${id}`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** 双击线身进入几何编辑。 */
async function enterGeometryEditing(page: Page, stage: Locator, at: (x: number, y: number) => { x: number; y: number }, mid: { x: number; y: number }) {
  const point = at(mid.x, mid.y)
  await page.mouse.dblclick(point.x, point.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
}

const A = { x: 300, y: 300 }
const B = { x: 500, y: 400 }
const MID = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage / 顶点取点是一条命令会话 / 按下夹点即出提示，原地松手点亮', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, prompt, editablePath } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)
  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const drawn = (await stroke.boundingBox())!
  await enterGeometryEditing(page, stage, view.at, MID)

  // 进入会话要清掉上一条命令留下的残句：用户此刻站在一个会取点的状态里。
  await expect(prompt).not.toHaveText('已取消')

  const end = await gripCenter(stage, 'end')
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await expect(prompt).toContainText('新位置')

  await page.mouse.up()
  await expect(stage.getByTestId('stage-path-vertex-end')).toHaveAttribute('data-vertex-hot')
  await expect(prompt).toContainText('新位置')
  // 原地松手 MUST NOT 改动几何。量的是**画出来的那条线**而不是夹点：夹点跟着预览走，而按下
  // 那一刻就解了一次落点，开着网格吸附时它已经把顶点挪了半格——与拖动按下即预览同一条行为。
  const after = (await stroke.boundingBox())!
  expect(Math.abs(after.width - drawn.width)).toBeLessThan(0.5)
  expect(Math.abs(after.height - drawn.height)).toBeLessThan(0.5)
  expect(Math.abs(after.x - drawn.x)).toBeLessThan(0.5)
  await expect(editablePath).toHaveCount(1)
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 点亮后键入坐标精确落点', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  await enterGeometryEditing(page, stage, view.at, MID)

  const end = await gripCenter(stage, 'end')
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.up()

  // 键入的坐标不被捕捉、正交或网格改写——603,317 两轴都不在网格上。
  await typePoint(commandInput, 603, 317)
  const moved = await gripCenter(stage, 'end')
  const want = view.at(603, 317)
  expect(Math.hypot(moved.x - want.x, moved.y - want.y)).toBeLessThan(0.6)

  // 三条路径汇到同一条 `entity.curve.set`：撤销一步回到原几何。
  await page.keyboard.press('Control+z')
  const undone = await gripCenter(stage, 'end')
  const origin = view.at(B.x, B.y)
  expect(Math.hypot(undone.x - origin.x, undone.y - origin.y)).toBeLessThan(0.6)
})

test('OpenSpec: stage / 曲线几何编辑会话 / Escape 分两级', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, editablePath } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  await enterGeometryEditing(page, stage, view.at, MID)

  const end = await gripCenter(stage, 'end')
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(stage.getByTestId('stage-path-vertex-end')).toHaveAttribute('data-vertex-hot')

  await page.keyboard.press('Escape')
  await expect(stage.getByTestId('stage-path-vertex-end')).not.toHaveAttribute('data-vertex-hot')
  await expect(editablePath).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(editablePath).toHaveCount(0)
})

test('OpenSpec: stage / 曲线几何编辑会话 / 点亮期不画拾取框', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  await enterGeometryEditing(page, stage, view.at, MID)

  const lines = stage.locator('[data-stage-crosshair-line]')
  const box = stage.locator('[data-stage-crosshair-box]')
  await page.mouse.move(view.at(MID.x + 60, MID.y - 40).x, view.at(MID.x + 60, MID.y - 40).y)
  await expect(lines).toHaveCount(4)
  await expect(box).toHaveCount(1)

  const end = await gripCenter(stage, 'end')
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.up()
  await page.mouse.move(view.at(MID.x + 60, MID.y - 40).x, view.at(MID.x + 60, MID.y - 40).y)
  await expect(lines).toHaveCount(4)
  // 点亮同样是「已经抓住了」，框只会挡住落点。
  await expect(box).toHaveCount(0)
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 连击中的那一下不点亮夹点', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput, prompt } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)

  // 先单击选中、再双击进入——这是用户最自然的次序，而第三下正好落在**刚显形**的中点夹点上：
  // 直线的中点就在包围盒中心，与前两下同一个像素。它显然不是用户对那个夹点的点击。
  const center = view.at(MID.x, MID.y)
  await page.mouse.click(center.x, center.y)
  await page.mouse.dblclick(center.x, center.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  await expect(stage.getByTestId('stage-path-vertex-move')).not.toHaveAttribute('data-vertex-hot')
  await expect(prompt).not.toContainText('新位置')

  // 紧接着拖中点仍然照常工作：双击进入之后马上拖是常用手法，不能连它一起挡掉。
  const grip = await gripCenter(stage, 'move')
  const target = view.at(MID.x + 90, MID.y + 60)
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.mouse.up()
  const moved = await gripCenter(stage, 'move')
  expect(Math.hypot(moved.x - target.x, moved.y - target.y)).toBeLessThan(12)
})

test('OpenSpec: stage / 几何编辑有键盘入口 / VERTEX 进入，多选被拒而不是静默', async ({ page }) => {
  await page.goto('/')
  const { surface, commandInput, prompt, editablePath } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  await drawLine(commandInput, { x: 300, y: 500 }, { x: 500, y: 600 })
  const view = await worldToScreen(page)

  // 选中一条：当场进入。
  const first = view.at(MID.x, MID.y)
  await page.mouse.click(first.x, first.y)
  await commandInput.fill('VERTEX')
  await commandInput.press('Enter')
  await expect(editablePath).toHaveCount(1)
  await expect(prompt).not.toHaveText('未知命令')

  await page.keyboard.press('Escape')
  // 选中两条：给出说明，而不是什么都不发生。
  const second = view.at(400, 550)
  await page.mouse.click(first.x, first.y)
  await page.keyboard.down('Shift')
  await page.mouse.click(second.x, second.y)
  await page.keyboard.up('Shift')
  await commandInput.fill('VE')
  await commandInput.press('Enter')
  await expect(editablePath).toHaveCount(0)
  await expect(prompt).not.toHaveText('未知命令')
  await expect(prompt).not.toHaveText('')
})

test('OpenSpec: stage / 顶点取点是一条命令会话 / 拖动的手感不变', async ({ page }) => {
  await page.goto('/')
  const { stage, surface, commandInput } = setup(page)
  await expect(surface).toBeVisible()

  await drawLine(commandInput, A, B)
  const view = await worldToScreen(page)
  await enterGeometryEditing(page, stage, view.at, MID)

  const end = await gripCenter(stage, 'end')
  const target = view.at(620, 260)
  await page.mouse.move(end.x, end.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.mouse.up()

  const moved = await gripCenter(stage, 'end')
  expect(Math.hypot(moved.x - target.x, moved.y - target.y)).toBeLessThan(12)
  // 拖完不留点亮：那件事已经结束了。
  await expect(stage.getByTestId('stage-path-vertex-end')).not.toHaveAttribute('data-vertex-hot')

  await page.keyboard.press('Control+z')
  const undone = await gripCenter(stage, 'end')
  const origin = view.at(B.x, B.y)
  expect(Math.hypot(undone.x - origin.x, undone.y - origin.y)).toBeLessThan(0.6)
})
