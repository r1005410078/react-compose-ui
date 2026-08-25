import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 进入几何编辑那一刻的图面反馈。
 *
 * @remarks
 * 两条独立的缺陷在同一次双击里同时出现：十字光标画在一个很旧的位置上，以及空闲档在**别的**
 * 对象上亮起捕捉标记。
 */
async function drawLine(page: Page, from: { x: number, y: number }, to: { x: number, y: number }) {
  const stage = page.getByRole('region', { name: 'Compose editor' })
    .getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.click()
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x, to.y)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

/**
 * 十字光标的中心，页面坐标；不绘制时为 null。
 *
 * @remarks
 * **不能拿 `<g>` 的 `getBoundingClientRect`**：臂长按视口较短边取百分比，靠近图面边缘时那一
 * 侧会被裁掉，bbox 的中心因此不再是十字线的中心。改由四条线的 `x1`/`y1` 取平均——两条沿 x 轴
 * 的线在 `center.x ± gap`，两条沿 y 轴的在 `center.x`，四个数的平均恰好是 `center.x`，y 同理。
 */
function crosshairCenter(page: Page) {
  return page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('[data-stage-crosshair-line]'))
    if (lines.length === 0) return null
    const surface = document.querySelector('[data-testid="stage-surface"]')!.getBoundingClientRect()
    const average = (attribute: string) => lines.reduce(
      (total, line) => total + Number(line.getAttribute(attribute)),
      0,
    ) / lines.length
    return {
      x: Math.round(surface.x + average('x1')),
      y: Math.round(surface.y + average('y1')),
    }
  })
}

test('OpenSpec: stage / Stage 十字光标 / 位置只来自本次跟踪开始之后的观测', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  // 第一条命令留下一个「最后观测到的位置」。
  await drawLine(page, at(120, 120), at(320, 320))
  await page.keyboard.press('Escape')

  // 命令之间把指针移到别处：此刻没有命令在跑，因此这个位置也不被跟踪。
  await page.mouse.move(at(80, 420).x, at(80, 420).y)

  // 从命令行启动新命令且不移动指针：拿不到指针位置，因此什么都不该画。
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.click()
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')
  expect(await crosshairCenter(page)).toBeNull()

  // 指针一动就画，且画在指针附近。容差取一个网格步长——十字线钉在**解算后**的落点上，
  // 开着网格吸附时它与裸指针本就相差不到半步。判别性不在这几个像素上：陈旧位置来自上一条
  // 命令最后一次点击，与此处相距上百像素。
  const moved = at(200, 260)
  await page.mouse.move(moved.x, moved.y)
  await expect.poll(async () => await crosshairCenter(page) !== null).toBe(true)
  const drawn = (await crosshairCenter(page))!
  expect(Math.abs(drawn.x - Math.round(moved.x))).toBeLessThanOrEqual(8)
  expect(Math.abs(drawn.y - Math.round(moved.y))).toBeLessThanOrEqual(8)
  await page.keyboard.press('Escape')
})

test('OpenSpec: stage / 曲线几何编辑会话 / 双击就地绘制十字线，空闲档不画捕捉标记', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(60, 60), at(220, 180))
  await drawLine(page, at(100, 320), at(260, 440))
  await page.keyboard.press('Escape')

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)
  const second = (await strokes.nth(1).boundingBox())!

  // 双击第一条线的中点进入几何编辑。指针在双击之后一动不动。
  const first = (await strokes.first().boundingBox())!
  const target = {
    x: Math.round(first.x + first.width / 2),
    y: Math.round(first.y + first.height / 2),
  }
  await page.mouse.dblclick(target.x, target.y)
  await expect(stage.locator('.compose-stage__editable-path-vertex')).toHaveCount(3)

  // 十字线就在双击点上，不是上一条命令留下的那个位置。
  const center = (await crosshairCenter(page))!
  expect(Math.abs(center.x - target.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(center.y - target.y)).toBeLessThanOrEqual(1)

  // 空闲档（没有夹点被点亮或拖动）悬停在**另一条**线的端点上：不画捕捉标记。
  await page.mouse.move(second.x, second.y)
  await expect(stage.getByTestId('stage-drafting-snap')).toHaveCount(0)
  // 十字线与拾取框照常。
  expect(await crosshairCenter(page)).not.toBeNull()
  await expect(stage.getByTestId('stage-pickbox')).toHaveCount(1)
})
