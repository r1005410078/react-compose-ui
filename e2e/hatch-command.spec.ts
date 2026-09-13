import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { switchToDrawingWorkspace } from './support/test-helpers'

/**
 * `HATCH`：一下填满光标底下围出来的那块面。
 *
 * @remarks
 * 只有端到端拦得住这条链：`pick` 由内核的插件接管 → 宿主把落点原样交给会话（**不找 target**，
 * 填充的落点在空处）→ 引擎在世界坐标里两两求交、射线找外环、绕行闭合 → 覆盖层画半透明预览
 * → 落地成改一个已有 `Appearance` 或新建一个带 `Hatch` 的 Entity。任何一段用替身都会把要证明
 * 的那件事假设掉。
 *
 * 断言在**非 100% 缩放**下做（默认路由带自动适配，缩放由它给出）：
 * `world = (屏幕 − 视口) / zoom`。落点一律从 Stage 当前的变换换算。
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
    strokes: stage.locator('[data-testid="compose-material-curve-stroke"]'),
    // 填充是唯一带实色 fill 的曲线：边界一律空心（`fill: none`）。
    fills: stage.locator('[data-testid="compose-material-curve-stroke"][fill^="#"]'),
    preview: stage.getByTestId('stage-hatch-preview'),
    gaps: stage.getByTestId('stage-hatch-gap'),
    badge: stage.getByTestId('stage-drafting-badge'),
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
  }
}

/** 场景里现有的 Entity id；用来断「新建了没有」而不是数形状。 */
function entityIds(stage: Locator) {
  return stage.locator('[data-entity-id]').evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute('data-entity-id')!),
  )
}

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage-engine / HATCH / 圆压在矩形上，填矩形内圆外那块', async ({ page }) => {
  const { commandInput, fills, prompt, stage, strokes } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(commandInput, 'CIRCLE', ['600,350', '680,350'], false)
  await expect(strokes).toHaveCount(2)
  const before = await entityIds(stage)
  const view = await worldToScreen(page)
  expect(view.zoom).not.toBe(1)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('点一下要填充的区域内部')
  await page.mouse.click(view.at(300, 350).x, view.at(300, 350).y)

  // 新建了一块填充，两个边界对象都还在、都还空心。
  await expect(fills).toHaveCount(1)
  const after = await entityIds(stage)
  expect(after.length).toBe(before.length + 1)
  expect(before.every((id) => after.includes(id))).toBe(true)
  // 圆咬掉了右边那一块，因此产物是 path（含弧边）而不是 polygon。
  await expect(fills.first()).toHaveJSProperty('tagName', 'path')
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / HATCH / 点没有东西穿过的矩形改它自己，不新建', async ({ page }) => {
  const { commandInput, fills, stage, strokes } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await expect(strokes).toHaveCount(1)
  const before = await entityIds(stage)
  const view = await worldToScreen(page)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 350).x, view.at(400, 350).y)

  // 矩形自己被填上，文档一个 Entity 都没多——没有这一支，场景树里会多出一个与它逐像素重合的东西。
  await expect(fills).toHaveCount(1)
  expect(await entityIds(stage)).toEqual(before)
  await expect(strokes).toHaveCount(1)
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / HATCH / 线穿过矩形时只填被点的那半边', async ({ page }) => {
  const { commandInput, fills, stage, strokes } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(commandInput, 'LINE', ['400,150', '400,550'])
  await expect(strokes).toHaveCount(2)
  const before = await entityIds(stage)
  const view = await worldToScreen(page)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 350).x, view.at(300, 350).y)

  // 边界跨了两个对象，因此新建；矩形仍然空心。
  expect((await entityIds(stage)).length).toBe(before.length + 1)
  await expect(fills).toHaveCount(1)
  // 全直边、没有岛，因此落成闭合多段线。
  await expect(fills.first()).toHaveJSProperty('tagName', 'polygon')
  const box = await fills.first().boundingBox()
  // 只填了左半边：宽度约为矩形的一半。
  expect(box!.width).toBeCloseTo(200 * view.zoom, 0)
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / HATCH / 矩形里的圆被挖空', async ({ page }) => {
  const { commandInput: input, fills, strokes } = await open(page)
  await run(input, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(input, 'CIRCLE', ['400,350', '460,350'], false)
  await expect(strokes).toHaveCount(2)
  const view = await worldToScreen(page)

  await input.fill('HATCH')
  await input.press('Enter')
  await page.mouse.click(view.at(250, 250).x, view.at(250, 250).y)

  await expect(fills).toHaveCount(1)
  const shape = fills.first()
  await expect(shape).toHaveJSProperty('tagName', 'path')
  // 岛靠 `evenodd` 挖空：看得见的洞与点不中的洞因此是同一个洞。
  await expect(shape).toHaveAttribute('fill-rule', 'evenodd')
  await input.press('Escape')
})

test('OpenSpec: stage-engine / HATCH / 不封闭时拒绝并画断口，补上那一段后即成', async ({ page }) => {
  const { commandInput, fills, gaps, prompt } = await open(page)
  // 左边缺一段：两个自由端隔着 40。
  await run(commandInput, 'LINE', ['200,200', '600,200'])
  await run(commandInput, 'LINE', ['600,200', '600,500'])
  await run(commandInput, 'LINE', ['600,500', '200,500'])
  await run(commandInput, 'LINE', ['200,500', '200,340'])
  await run(commandInput, 'LINE', ['200,300', '200,200'])
  const view = await worldToScreen(page)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 350).x, view.at(400, 350).y)

  // 没有间隙容差，因此拒绝；补偿是把断口画出来——一次挫败变成一次诊断。
  await expect(fills).toHaveCount(0)
  await expect(prompt).toContainText('边界没有闭合')
  await expect(gaps).toHaveCount(2)
  await commandInput.press('Escape')

  // 补上那一段，同一个位置再点即成。
  await run(commandInput, 'LINE', ['200,300', '200,340'])
  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 350).x, view.at(400, 350).y)
  await expect(fills).toHaveCount(1)
  await commandInput.press('Escape')
})

test('OpenSpec: stage / HATCH / 悬停即预览，落地是同一块面', async ({ page }) => {
  const { commandInput, fills, preview, badge } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(commandInput, 'LINE', ['400,150', '400,550'])
  const view = await worldToScreen(page)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.move(view.at(300, 350).x, view.at(300, 350).y, { steps: 4 })
  // 光标是拾取框加油漆桶徽标。
  await expect(badge).toHaveCount(1)
  await expect(preview).toHaveCount(1)
  const previewBox = await preview.boundingBox()

  await page.mouse.click(view.at(300, 350).x, view.at(300, 350).y)
  await expect(fills).toHaveCount(1)
  const landedBox = await fills.first().boundingBox()
  /*
   * 看见的那块面与填上的那块面是同一块：两者读的是同一份解算。
   *
   * 断的是**中心**而不是边缘：预览画在覆盖层上、带一圈虚线轮廓，落地那块描边宽度为 0，两个
   * 包围盒因此天生差几个设备像素。中心与轮廓无关，它回答的正是「是不是同一块面」；而求错一块
   * 面在这张图上会差出整整半个矩形（一百多像素），几个像素的余量挡不住任何真错误。
   */
  const center = (box: { x: number; y: number; width: number; height: number }) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  })
  expect(center(landedBox!).x).toBeCloseTo(center(previewBox!).x, 0)
  expect(center(landedBox!).y).toBeCloseTo(center(previewBox!).y, 0)
  expect(Math.abs(landedBox!.width - previewBox!.width)).toBeLessThanOrEqual(6)
  expect(Math.abs(landedBox!.height - previewBox!.height)).toBeLessThanOrEqual(6)
  await commandInput.press('Escape')
})

test('OpenSpec: stage-engine / HATCH / 填充压在边界之下', async ({ page }) => {
  const { commandInput, fills, stage } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  await run(commandInput, 'LINE', ['400,150', '400,550'])
  const view = await worldToScreen(page)

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(300, 350).x, view.at(300, 350).y)
  await expect(fills).toHaveCount(1)
  await commandInput.press('Escape')

  // 子级顺序就是绘制顺序：填充排在两条边界之前，因此画在它们底下。
  const ids = await entityIds(stage)
  const fillId = await fills.first().evaluate(
    (node) => node.closest('[data-entity-id]')!.getAttribute('data-entity-id')!,
  )
  expect(ids.indexOf(fillId)).toBeLessThan(ids.length - 1)
  expect(ids[ids.length - 1]).not.toBe(fillId)
})

test('OpenSpec: stage / HATCH / 换色有两条入口', async ({ page }) => {
  const { commandInput, editor, fills } = await open(page)
  await run(commandInput, 'RECTANGLE', ['200,200', '600,500'], false)
  const view = await worldToScreen(page)

  // 一、命令进行中的 `C` 关键字。
  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await commandInput.fill('C')
  await commandInput.press('Enter')
  await commandInput.fill('#a34b2f')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 350).x, view.at(400, 350).y)
  await expect(fills.first()).toHaveAttribute('fill', '#a34b2f')
  await commandInput.press('Escape')

  // 二、工具栏的色板；它列的是这一页已经用过的颜色，因此刚才那一档现在在上面。
  const swatchTrigger = editor.locator('[data-toolbar-item="HATCH"] .compose-editor__toolbar-menu-trigger')
  await swatchTrigger.click()
  await expect(editor.locator('[data-swatch="#a34b2f"]')).toHaveCount(1)
  await editor.locator('[data-swatch="#2f3b4d"]').click()

  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await page.mouse.click(view.at(400, 350).x, view.at(400, 350).y)
  await expect(fills.first()).toHaveAttribute('fill', '#2f3b4d')
  await commandInput.press('Escape')
})
