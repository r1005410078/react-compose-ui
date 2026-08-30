import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 选中一条曲线时画它的轮廓，不画包围盒。
 *
 * @remarks
 * 判别性**不在「矩形不见了」**——把轮廓画成盒的四条边同样能通过那一条。真正分辨得出来的是
 * 「包围盒的空角处有没有轮廓」：斜线的盒角与几何相距最远，沿盒画时那里距离为 0，沿几何画时
 * 那里是半条对角线。
 *
 * 用 `?no-auto-fit` 把缩放钉在 1，屏幕像素因此就是世界像素。
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
  await page.keyboard.press('Escape')
}

/** 世界点到轮廓折线的最短距离（屏幕像素）。 */
function outlineDistance(page: Page, point: { x: number, y: number }) {
  return page.evaluate((probe) => {
    const outline = document.querySelector('[data-testid="stage-selection-outline"]')
    if (!outline) return null
    const surface = document.querySelector('[data-testid="stage-surface"]')!.getBoundingClientRect()
    const points = (outline.getAttribute('points') ?? '').trim().split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x: surface.x + x!, y: surface.y + y! }
      })
    let nearest = Number.POSITIVE_INFINITY
    for (let index = 0; index + 1 < points.length; index += 1) {
      const start = points[index]!
      const end = points[index + 1]!
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lengthSquared = dx * dx + dy * dy
      const t = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((probe.x - start.x) * dx + (probe.y - start.y) * dy) / lengthSquared))
      const distance = Math.hypot(probe.x - (start.x + t * dx), probe.y - (start.y + t * dy))
      nearest = Math.min(nearest, distance)
    }
    return nearest
  }, point)
}

test('OpenSpec: stage / 受控工具模式与专属选区反馈 / 选中曲线画轮廓而不是包围盒', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(100, 100), at(300, 300))
  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  const bb = (await stroke.boundingBox())!

  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await expect(editor.getByRole('region', { name: 'Curve 属性', exact: true })).toBeVisible()

  // 盒与手柄都让位。
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(0)
  await expect(stage.getByTestId('stage-resize-edge-n')).toHaveCount(0)

  // 轮廓落在线身上：线身中点处距离约为 0。
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(1)
  expect(await outlineDistance(page, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }))
    .toBeLessThan(2)

  /*
   * 判别性所在：右上角是斜线包围盒里离线身最远的点。沿盒画轮廓时它的距离是 0，沿几何画时
   * 是半条对角线。只断言「矩形不见了」的用例分辨不出这两种实现。
   */
  const corner = { x: bb.x + bb.width, y: bb.y }
  expect(await outlineDistance(page, corner)).toBeGreaterThan(bb.width / 4)
})

test('OpenSpec: stage / 受控工具模式与专属选区反馈 / 指示器打开时盒与手柄回来', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(100, 100), at(300, 300))
  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const bb = (await stroke.boundingBox())!
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await expect(editor.getByRole('region', { name: 'Curve 属性', exact: true })).toBeVisible()

  // 能力没有消失，只是从「随时都在」变成「打开指示器」。`scale` 工具已并进指示器：
  // 一个只为「让手柄显出来」而存在的模式，与「打开一层 chrome」是同一件事的两种说法。
  await editor.getByRole('button', { name: '变换指示器' }).click()
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)
})

test('OpenSpec: stage / 受控工具模式与专属选区反馈 / 非曲线与多选都照旧画盒', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(100, 100), at(300, 300))
  await drawLine(page, at(100, 380), at(300, 460))
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()

  // 单选一个矩形 Entity：判据是「盒是不是这个对象的轮廓」，矩形的答案是「是」。
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)

  /*
   * 多选：整体框回答的是「这一堆的范围」，不宣称任何单个对象的轮廓。用**两条曲线**而不是
   * 曲线加矩形——后者要先知道新矩形落在哪，而它可能压在线身上，Shift 点过去就点到了它自己。
   */
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)
  const first = (await strokes.first().boundingBox())!
  const second = (await strokes.nth(1).boundingBox())!
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2)
  await page.keyboard.down('Shift')
  await page.mouse.click(second.x + second.width / 2, second.y + second.height / 2)
  await page.keyboard.up('Shift')
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)
})
