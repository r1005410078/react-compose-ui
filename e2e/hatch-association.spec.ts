import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { switchToDrawingWorkspace } from './support/test-helpers'

/**
 * 填充跟着边界走。
 *
 * @remarks
 * 只有端到端拦得住这条链：一次编辑改了边界 → 布局 Runtime 在 `resolveComposeWires` 之后跑
 * `resolveComposeHatches` → 清单比对决定跟不跟 → 文档与快照成对产出 → 场景按新几何渲染。
 * 中间任何一段用替身，要证明的正是被假设掉的那件事——**跟随不挂在任何一条编辑路径上**，
 * 而「挂在事务上」与「每帧派生」在单测里看起来一模一样。
 *
 * 断言一律在**非 100% 缩放**下做（默认路由带自动适配，缩放由它给出）：
 * `world = (屏幕 − 视口) / zoom`，落点全部从 Stage 当前的变换换算。
 */

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    strokes: stage.locator('[data-testid="compose-material-curve-stroke"]'),
    // 填充是唯一带实色 fill 的曲线：边界一律空心（`fill: none`）。
    fills: stage.locator('[data-testid="compose-material-curve-stroke"][fill^="#"]'),
    state: editor.getByTestId('compose-material-hatch-state'),
    anchor: editor.getByTestId('compose-material-hatch-seed'),
    regenerate: editor.getByTestId('compose-material-hatch-regenerate'),
    detach: editor.getByTestId('compose-material-hatch-detach'),
  }
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
  }
}

/**
 * 一个矩形被一条竖线切开，左半边填上色。
 *
 * @returns 视口换算与填充的初始宽度（屏幕 px，等于世界 200）。
 */
async function bisectedFill(
  page: Page,
  /** 填之前再画的那些；它们一并成为这块面的边界。 */
  extra: readonly { readonly command: string; readonly points: readonly string[] }[] = [],
) {
  await page.goto('/')
  const view0 = setup(page)
  await expect(view0.surface).toBeVisible()
  await switchToDrawingWorkspace(page)

  await run(view0.commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(view0.commandInput, 'LINE', ['400,150', '400,550'])
  for (const step of extra) await run(view0.commandInput, step.command, step.points, false)
  await expect(view0.strokes).toHaveCount(2 + extra.length)

  const view = await worldToScreen(page)
  // 非 100% 缩放：命中与几何相关的用例必须在这一档断言。
  expect(view.zoom).not.toBe(1)
  await view0.commandInput.fill('HATCH')
  await view0.commandInput.press('Enter')
  await page.mouse.click(view.at(300, 350).x, view.at(300, 350).y)
  await expect(view0.fills).toHaveCount(1)
  await view0.commandInput.press('Escape')

  return { ...view0, view }
}

/** 填充当前的屏幕宽度；轮询是因为跟随发生在下一次 solve 之后。 */
function fillWidth(fills: Locator) {
  return fills.first().boundingBox().then((box) => Math.round(box?.width ?? -1))
}

/** 选中这块填充，让 Inspector 画出那一格。 */
async function selectFill(page: Page, at: (x: number, y: number) => { x: number; y: number }) {
  // 点在填色区域内部而不是描边上：填过色的内部同样命中，而那正是这块墨。
  await page.mouse.click(at(300, 450).x, at(300, 450).y)
}

/**
 * 清空选区。
 *
 * @remarks
 * `MOVE` 与 `ERASE` 共用那条两次序的状态机：已经选好就当场进入「指定基点」。读完 Inspector
 * 直接敲 `M` 的话，接下来那一下点击会被当成**基点**，于是挪走的是刚读过状态的那块填充——
 * 而用例看起来只是「状态没变」。
 */
async function deselect(page: Page, at: (x: number, y: number) => { x: number; y: number }) {
  // 落点要落在图面**之内**：落在图面外的那一下根本到不了画布，选区纹丝不动。
  await page.mouse.click(at(800, 650).x, at(800, 650).y)
}

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: compose-document / 填充跟随 / 拖边界的夹点：手势期不动，松手才跟上，撤销一步回去', async ({ page }) => {
  const { commandInput, fills, stage, view } = await bisectedFill(page)
  const before = await fillWidth(fills)
  expect(before).toBe(Math.round(200 * view.zoom))

  // 双击线身进几何编辑；落点在矩形之上，只可能命中那条线。
  await page.mouse.dblclick(view.at(400, 170).x, view.at(400, 170).y)
  const grip = stage.getByTestId('stage-path-vertex-hit-move')
  await expect(grip).toBeAttached()
  // 跨过双击窗口再按下：紧接着的按下会被算成同一串连击里的下一击。
  await page.waitForTimeout(600)

  const box = (await grip.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(view.at(460, 350).x, view.at(460, 350).y, { steps: 6 })
  /*
   * 手势期填充一个像素都不动：夹点拖动走的是本地几何预览，文档还没有变，因此求解根本没有
   * 新的输入。松手之前就跟着变形是另一个产品决定（要先量候选数量），不是这一版的行为。
   */
  expect(await fillWidth(fills)).toBe(before)
  await page.mouse.up()

  // 松手即跟上：线挪到 460，左半边从 200 宽变成 260 宽。
  await expect.poll(() => fillWidth(fills)).toBe(Math.round(260 * view.zoom))
  await commandInput.press('Escape')

  /*
   * 撤销一步就回去，而这是**白拿的**：跟随不进历史，撤销回到改动之前，填充跟着回去是求解的
   * 结果而不是第二条历史记录。两步才回去的话说明跟随被写进了另一个事务。
   */
  await page.keyboard.press('Control+z')
  await expect.poll(() => fillWidth(fills)).toBe(before)
})

test('OpenSpec: compose-document / 填充跟随 / 不相干的对象动了，填充一个字节不变', async ({ page }) => {
  const { commandInput, fills, stage, view } = await bisectedFill(page)
  const before = await fillWidth(fills)

  // 画一个与这块面毫无关系的矩形，再把它整个挪走。
  await run(commandInput, 'RECTANGLE', ['900,200', '1100,400'], false)
  await commandInput.fill('M')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(1000, 200).x, view.at(1000, 200).y)
  await expect(stage.getByTestId('stage-drafting-selection-count')).toContainText('已选 1')
  await commandInput.press('Enter')
  await commandInput.fill('0,0')
  await commandInput.press('Enter')
  await commandInput.fill('@0,300')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  // 它不在任何填充的清单里，因此连求都不求。
  expect(await fillWidth(fills)).toBe(before)
})

test('OpenSpec: compose-document / 填充跟随 / 清单变了不改动几何，重新生成之后换成新清单', async ({ page }) => {
  // 在左半边的上沿咬一口：边界是三个，产物因此含弧边。
  const { commandInput, fills, regenerate, stage, state, view } = await bisectedFill(page, [
    { command: 'CIRCLE', points: ['300,200', '360,200'] },
  ])
  await expect(fills.first()).toHaveJSProperty('tagName', 'path')

  await selectFill(page, view.at)
  await expect(state).toHaveAttribute('data-hatch-state', 'current')

  // 把圆整个挪出去：清单从三个变回两个。
  await deselect(page, view.at)
  await commandInput.fill('M')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 140).x, view.at(300, 140).y)
  await expect(stage.getByTestId('stage-drafting-selection-count')).toContainText('已选 1')
  await commandInput.press('Enter')
  await commandInput.fill('0,0')
  await commandInput.press('Enter')
  await commandInput.fill('@0,-400')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  /*
   * 拓扑变了，因此几何一个字节不变——跟上就意味着一次用户没有要求过的形状改变（那口咬痕
   * 会被自动补平）。产物仍然是 `path`，而补平之后它会是 `polygon`。
   */
  await selectFill(page, view.at)
  await expect(fills.first()).toHaveJSProperty('tagName', 'path')
  await expect(state).toHaveAttribute('data-hatch-state', 'stale')

  // 按一下「重新生成」：咬痕补平，同一块面落成闭合多段线。
  await regenerate.click()
  await expect(fills.first()).toHaveJSProperty('tagName', 'polygon')
  await expect(state).toHaveAttribute('data-hatch-state', 'current')

  /*
   * 清单真的换了没有——这一段才是判别性的那一半。只写几何的话清单里还记着那个已经挪走的圆，
   * 此后每次重求都对不上，这块填充**永远跟不上**；用户按下那一下想说的正是「现在这几个才
   * 是我的边界」。
   */
  await deselect(page, view.at)
  await commandInput.fill('M')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 170).x, view.at(400, 170).y)
  await expect(stage.getByTestId('stage-drafting-selection-count')).toContainText('已选 1')
  await commandInput.press('Enter')
  await commandInput.fill('0,0')
  await commandInput.press('Enter')
  await commandInput.fill('@60,0')
  await commandInput.press('Enter')
  await commandInput.press('Escape')
  await expect.poll(() => fillWidth(fills)).toBe(Math.round(260 * view.zoom))
})

test('OpenSpec: basic-materials / 填充状态 / 边界断开是自己的一档，不是「过期」', async ({ page }) => {
  const { commandInput, fills, regenerate, state, view } = await bisectedFill(page)
  const before = await fillWidth(fills)
  await selectFill(page, view.at)
  await expect(state).toHaveAttribute('data-hatch-state', 'current')

  // 把矩形底边靠左那一截剪掉：从落点望出去不再有封闭的面。
  await deselect(page, view.at)
  await run(commandInput, 'LINE', ['300,450', '300,550'])
  await commandInput.fill('TRIM')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(250, 500).x, view.at(250, 500).y)
  await commandInput.press('Escape')

  await selectFill(page, view.at)
  /*
   * 「边界没了」与「跟不上了」必须分得开：前者按多少下「重新生成」都没用，得先去把那条缝
   * 补上。收成一个「过期」时这两句话读起来一模一样。
   */
  await expect(state).toHaveAttribute('data-hatch-state', 'broken')
  // 几何仍在，`Hatch` 也仍在——MUST NOT 静默留在原地，也 MUST NOT 自动断开关联。
  await expect(fills).toHaveCount(1)
  expect(await fillWidth(fills)).toBe(before)

  // 把那一截补回去，「重新生成」即回来：断开不是终点，它只是一句说出来的话。
  await deselect(page, view.at)
  await run(commandInput, 'LINE', ['200,500', '300,500'])
  await selectFill(page, view.at)
  await regenerate.click()
  await expect(state).toHaveAttribute('data-hatch-state', 'current')
  await expect.poll(() => fillWidth(fills)).toBe(before)
})

test('OpenSpec: basic-materials / 断开关联 / 断了之后边界怎么动它都不动', async ({ page }) => {
  const { commandInput, detach, fills, state, stage, view } = await bisectedFill(page)
  const before = await fillWidth(fills)
  await selectFill(page, view.at)
  await detach.click()
  // `Hatch` 没了，因此那一格整个消失；几何与填充色都还在。
  await expect(state).toHaveCount(0)
  await expect(fills).toHaveCount(1)
  expect(await fillWidth(fills)).toBe(before)

  // 再挪那条线：它已经不是谁的边界了。
  await page.mouse.dblclick(view.at(400, 170).x, view.at(400, 170).y)
  const grip = stage.getByTestId('stage-path-vertex-hit-move')
  await expect(grip).toBeAttached()
  await page.waitForTimeout(600)
  const box = (await grip.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(view.at(460, 350).x, view.at(460, 350).y, { steps: 6 })
  await page.mouse.up()
  await commandInput.press('Escape')

  await expect.poll(() => fillWidth(fills)).toBe(before)
})

