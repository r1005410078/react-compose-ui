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
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
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
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
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
