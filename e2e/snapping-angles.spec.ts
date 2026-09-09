import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 特征点捕捉的多角度覆盖。
 *
 * @remarks
 * 单看一条水平线或 45 度线的捕捉是**不够的**：那两个角度上包围盒的退化轴、几何的归一化与
 * 投影分母恰好都取到好写的值。这两条用例走一圈方位角，两条消费路径各一条：
 *
 * 1. **命令取点**——`LINE` 等着第一点时靠近别的线的端点/中点；
 * 2. **拖夹点**——几何编辑会话里把一个夹点拖到别的线的端点/中点上。
 *
 * 两条都在**非 100% 缩放**下断言：`world = (屏幕 − 视口) / zoom`，zoom 恒为 1 时漏乘 zoom
 * 也看不出来，而捕捉容差本身就是按屏幕像素除以 zoom 换算的。
 *
 * 拖夹点那条同时断言**拖动全程有捕捉标记**：标记是「吸上了没有」的唯一凭据，落点对而标记
 * 缺席时用户只会认为没吸上——那正是它曾经的样子（指针跟踪挂在图面上，一取得指针捕获就断）。
 */

const ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 225, 270, 315]
const CENTER = { x: 400, y: 400 }
const RADIUS = 150

interface Target {
  readonly angle: number
  readonly kind: 'endpoint' | 'midpoint'
  readonly x: number
  readonly y: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

async function typePoint(commandInput: Locator, x: number, y: number) {
  await commandInput.fill(`${x},${y}`)
  await commandInput.press('Enter')
}

/**
 * 从同一个圆心画出一把扇形的线，返回每条的端点与中点。
 *
 * @remarks
 * 用**键入坐标**落点：键入的坐标不被任何吸附改写，因此目标坐标是精确已知的，断言才敢用
 * 「偏差小于 0.05」而不是一个宽到没有判别力的范围。
 */
async function drawFan(page: Page, commandInput: Locator): Promise<readonly Target[]> {
  const targets: Target[] = []
  for (const angle of ANGLES) {
    const radians = (angle * Math.PI) / 180
    const end = {
      x: round2(CENTER.x + RADIUS * Math.cos(radians)),
      y: round2(CENTER.y + RADIUS * Math.sin(radians)),
    }
    await commandInput.fill('L')
    await commandInput.press('Enter')
    await typePoint(commandInput, CENTER.x, CENTER.y)
    await typePoint(commandInput, end.x, end.y)
    await commandInput.press('Escape')
    targets.push({ angle, kind: 'endpoint', ...end })
    targets.push({
      angle,
      kind: 'midpoint',
      x: round2((CENTER.x + end.x) / 2),
      y: round2((CENTER.y + end.y) / 2),
    })
  }
  return targets
}

/** 世界坐标 → 屏幕坐标，读的是 Scene 真实的变换矩阵而不是重算一遍。 */
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

test('OpenSpec: stage-engine / 特征点捕捉 / 命令取点在各方位角都吸到端点与中点', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const marker = stage.getByTestId('stage-drafting-snap')

  const targets = await drawFan(page, commandInput)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(ANGLES.length)

  for (const zoomStep of ['ZOOMIN', 'ZOOMOUT ZOOMOUT']) {
    for (const command of zoomStep.split(' ')) {
      await commandInput.fill(command)
      await commandInput.press('Enter')
    }
    const view = await worldToScreen(page)
    expect(view.zoom).not.toBe(1)

    await commandInput.fill('L')
    await commandInput.press('Enter')
    const missed: string[] = []
    for (const target of targets) {
      const screen = view.at(target.x, target.y)
      // 停在目标**旁边**几个像素：容差之内但不在点上，正是要让捕捉去纠正的距离。
      await page.mouse.move(screen.x + 3, screen.y - 2)
      const mode = await marker.count() === 1 ? await marker.getAttribute('data-snap-mode') : null
      if (mode !== target.kind) missed.push(`${target.angle}°${target.kind}→${mode ?? '无'}`)
    }
    await commandInput.press('Escape')
    expect(missed, `zoom ${view.zoom.toFixed(3)}`).toEqual([])
  }
})

test('OpenSpec: stage / 曲线几何编辑会话 / 拖夹点在各方位角都吸上且全程有标记', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const marker = stage.getByTestId('stage-drafting-snap')

  const targets = await drawFan(page, commandInput)
  // 被拖的那条画在扇形之外：正在编辑的对象不参与捕捉，但它压在扇形上会挡住双击。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await typePoint(commandInput, 160, 640)
  await typePoint(commandInput, 220, 670)
  await commandInput.press('Escape')

  await commandInput.fill('ZOOMIN')
  await commandInput.press('Enter')
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  const probe = (await strokes.nth(ANGLES.length).boundingBox())!
  await page.mouse.dblclick(probe.x + probe.width / 2, probe.y + probe.height / 2)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })
  const value = async (name: string) => Number(
    await inspector.getByRole('spinbutton', { name }).inputValue(),
  )

  const missed: string[] = []
  for (const target of targets) {
    const grip = (await stage.getByTestId('stage-path-vertex-hit-start').boundingBox())!
    const screen = view.at(target.x, target.y)
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(screen.x + 3, screen.y - 2, { steps: 4 })
    const marked = await marker.count() === 1
    await page.mouse.up()
    const offset = Math.hypot(
      (await value('起点 X')) - target.x,
      (await value('起点 Y')) - target.y,
    )
    if (offset > 0.05 || !marked) {
      missed.push(`${target.angle}°${target.kind}:偏${offset.toFixed(2)}${marked ? '' : '/无标记'}`)
    }
  }
  expect(missed, `zoom ${view.zoom.toFixed(3)}`).toEqual([])
})

test('OpenSpec: stage-engine / 特征点捕捉 / 靶区随网格步长放大，网格拽不走端点', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const marker = stage.getByTestId('stage-drafting-snap')

  // 端点刻意**不落在网格上**（步长 8）：落在网格上时网格与捕捉给出同一个答案，这条就没有
  // 判别力了。真实图纸上的端点本来也很少正好是步长的倍数。
  const end = { x: 403, y: 305 }
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await typePoint(commandInput, 250, 500)
  await typePoint(commandInput, end.x, end.y)
  await commandInput.press('Escape')

  const view = await worldToScreen(page)
  const screen = view.at(end.x, end.y)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  // 15 屏幕像素：**超出**基础靶区（12），但仍在「网格反正也要把点搬走」那段之内。
  // 网格吸附开着时这里必须仍然吸到端点，而不是被拽到最近的格点上。
  for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const radians = (angle * Math.PI) / 180
    await page.mouse.move(screen.x + 15 * Math.cos(radians), screen.y + 15 * Math.sin(radians))
    await expect(marker, `${angle}°`).toHaveCount(1)
    expect(await marker.getAttribute('data-snap-mode'), `${angle}°`).toBe('endpoint')
  }

  // 关掉网格吸附，靶区退回基数：同样的 15 像素不再吸得上。这一条钉住「放大量来自网格」，
  // 而不是「把靶区一律调大了」。
  await commandInput.press('Escape')
  await commandInput.fill('GRIDSNAP')
  await commandInput.press('Enter')
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.move(screen.x + 15, screen.y)
  await expect(marker).toHaveCount(0)
  await page.mouse.move(screen.x + 6, screen.y)
  await expect(marker).toHaveCount(1)
})

test('OpenSpec: stage / 曲线几何编辑会话 / 同一个形状的其他顶点仍可捕捉', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const marker = stage.getByTestId('stage-drafting-snap')

  // 闭合多段线 = 一个 Entity 上的四个顶点。坐标刻意**都不在网格上**（步长 8）：落在网格上时
  // 网格与捕捉给出同一个答案，这条就没有判别力了——而「顶点不在网格上就永远落不上去」
  // 正是这个缺陷在屏幕上的样子。
  //
  // 用 `PLINE` + `C` 而不是 `RECTANGLE`：后者产出的是矩形**物料**，没有顶点可编辑。
  const corner = { x: 203, y: 305 }
  const opposite = { x: 403, y: 505 }
  await commandInput.fill('PL')
  await commandInput.press('Enter')
  await typePoint(commandInput, corner.x, corner.y)
  await typePoint(commandInput, opposite.x, corner.y)
  await typePoint(commandInput, opposite.x, opposite.y)
  await typePoint(commandInput, corner.x, opposite.y)
  await commandInput.fill('C')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)

  const view = await worldToScreen(page)
  const shape = (await stage.getByTestId('compose-material-curve-stroke').boundingBox())!
  await page.mouse.dblclick(shape.x + shape.width / 2, shape.y + 2)
  const grips = stage.locator('[data-testid^="stage-path-vertex-hit-"]')
  // 闭合四顶点多段线：四个顶点夹点加四段的中点夹点（收尾那一段也算）。
  await expect(grips).toHaveCount(8)

  /*
   * 观察点落在**点亮之后**而不是空闲档：空闲档既不解算落点也不画捕捉标记（那一档的命令行
   * 提示就是「命令：」），因此「排不排除」在那里没有任何可观察后果。点亮一个夹点之后才真的
   * 在取点，此时本对象自己的其他顶点与边中点仍该能吸——排除是点级的，只挡被作用的那一个。
   */
  const armed = (await stage.getByTestId('stage-path-vertex-hit-v0').boundingBox())!
  await page.mouse.move(armed.x + armed.width / 2, armed.y + armed.height / 2)
  await page.mouse.down()
  // 原地松手即点亮：一步没动的松手不提交，会话留着等下一次取点。
  await page.mouse.up()
  for (const [label, target, mode] of [
    ['对角顶点', opposite, 'endpoint'],
    ['边中点', { x: (corner.x + opposite.x) / 2, y: corner.y }, 'midpoint'],
  ] as const) {
    const screen = view.at(target.x, target.y)
    await page.mouse.move(screen.x + 4, screen.y - 3)
    await expect(marker, label).toHaveCount(1)
    expect(await marker.getAttribute('data-snap-mode'), label).toBe(mode)
  }
  // 熄灭点亮，回到空闲档；几何编辑会话仍在，夹点还在原处。
  await page.keyboard.press('Escape')
  /*
   * 跨过双击窗口再按下一次。上面点亮用的按下就落在同一个夹点上，两次按下的间隔与位移都在
   * 连击判定之内（500ms / 5px）时，这一下会被算成第二击——而夹点上的第二击是顶点开关，
   * 手势根本不会开始。症状很有欺骗性：下面几条「不该出现捕捉标记」会因为压根没在拖动而
   * **全部通过**。
   */
  await page.waitForTimeout(600)

  const grip = (await stage.getByTestId('stage-path-vertex-hit-v0').boundingBox())!
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()

  // 先验**排除仍然挡得住被拖的那一个点**：刚离开原位置几个像素时不该被吸回去。
  // 这一条与「其他顶点恢复可捕捉」是一对——粒度放宽之后它最容易被顺手放掉，而且要在同一次
  // 拖动里、在拖远之前查，绕开撤销那种脆弱的往返。
  for (const distance of [3, 6, 10]) {
    await page.mouse.move(from.x + distance, from.y + distance, { steps: 2 })
    await expect(marker, `离原位置 ${distance}px`).toHaveCount(0)
  }

  // 再拖到对角顶点上：落点要精确落上去。
  const screen = view.at(opposite.x, opposite.y)
  await page.mouse.move(screen.x + 4, screen.y - 3, { steps: 4 })
  await expect(marker).toHaveCount(1)
  expect(await marker.getAttribute('data-snap-mode')).toBe('endpoint')
  await page.mouse.up()

  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })
  const vertex0 = inspector.getByRole('spinbutton', { name: '顶点 1 X' })
  await expect.poll(async () => Number(await vertex0.inputValue())).toBeCloseTo(opposite.x, 1)
})

