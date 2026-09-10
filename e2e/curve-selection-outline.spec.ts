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
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
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

/*
 * 判别性**不在「多边形画了盒」**——那条对「按 Preset id 判」这种错误实现同样绿。真正分辨得
 * 出来的是：同一条命令（`PLINE`）画出的两条折线，只差闭没闭合，呈现就不同。
 */
test('OpenSpec: stage / 闭合曲线的选中呈现走盒那一套 / 只差闭合就换一套呈现', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  /** 连点四下的折线；`close` 为真时以 `C` 闭合，否则回车结束。 */
  const drawPolyline = async (origin: number, close: boolean) => {
    await commandInput.click()
    await commandInput.fill('PLINE')
    await commandInput.press('Enter')
    for (const [dx, dy] of [[0, 0], [160, 0], [160, 90], [0, 90]] as const) {
      const point = at(100 + dx, origin + dy)
      await page.mouse.click(point.x, point.y)
    }
    if (close) {
      await commandInput.fill('C')
      await commandInput.press('Enter')
    } else {
      await commandInput.press('Enter')
    }
    await page.keyboard.press('Escape')
  }

  /*
   * 点顶边的中点选中它：两条折线都空心，盒内部不拦截指针（外框套在符号外面时让它可点会抢走
   * 里面每一个符号的点击），因此那一圈描边是唯一可点的几个像素。
   */
  const selectByTopEdge = async (index: number) => {
    const stroke = stage.getByTestId('compose-material-curve-stroke').nth(index)
    const bb = (await stroke.boundingBox())!
    await page.mouse.click(bb.x + bb.width / 2, bb.y + 1)
    await expect(editor.getByRole('region', { name: 'Curve 属性', exact: true })).toBeVisible()
  }

  await drawPolyline(120, true)
  await selectByTopEdge(0)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)

  await drawPolyline(340, false)
  await selectByTopEdge(1)
  // 同样四个点、同一条命令，只差 `closed`——盒里大半是空的，因此画轮廓。
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(0)
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
  await editor.getByRole('button', { name: '添加 矩形' }).click()

  // 单选一个矩形 Entity：判据是「盒是不是这个对象的轮廓」，矩形的答案是「是」。
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)

  /*
   * 多选：整体框回答的是「这一堆的范围」，不宣称任何单个对象的轮廓。用**两条曲线**而不是
   * 曲线加矩形——后者要先知道新矩形落在哪，而它可能压在线身上，Shift 点过去就点到了它自己。
   */
  // 只数**两点直线**：矩形现在也是曲线（`<polygon>`），拿总数会把它一起算进来。
  const strokes = stage.locator('line[data-testid="compose-material-curve-stroke"]')
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

/*
 * 复现的症状不是「拖不动」：从选中的空心矩形内部起手拖动，会拉出一个框选、顺带把自己**取消
 * 选中**——用户读到的是「我抓着这个东西拖了一下，它跑了」。判别性因此有两半：动了要移动，
 * 没动要保持单击原来的含义；只断前一半的话，「盒内部一律拦截指针」那种过宽的实现也会绿，
 * 而那正是被否掉的做法。
 */
test('OpenSpec: stage / 选中的空心图形盒内部起手即移动 / 拖动移动它，单击含义不变', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const s = (await stage.getByTestId('stage-surface').boundingBox())!

  await commandInput.click()
  await commandInput.fill('RECTANGLE')
  await commandInput.press('Enter')
  await page.mouse.click(s.x + 120, s.y + 120)
  await page.mouse.click(s.x + 380, s.y + 300)
  await page.keyboard.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const bb = (await stroke.boundingBox())!
  // 空心图形只有那一圈描边可点。
  await page.mouse.click(bb.x + bb.width / 2, bb.y + 1)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  const center = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 30, center.y + 30, { steps: 5 })
  // 拖动中是移动而不是框选：框选框在场就说明这一下又走回老路了。
  await expect(stage.getByTestId('stage-marquee')).toHaveCount(0)
  await page.mouse.move(center.x + 60, center.y + 60, { steps: 5 })
  await page.mouse.up()

  const moved = (await stroke.boundingBox())!
  expect(Math.round(moved.x - bb.x)).toBeCloseTo(60, -1)
  expect(Math.round(moved.y - bb.y)).toBeCloseTo(60, -1)
  // 还选中着：原来的症状里它把自己取消选中了。
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  // 另一半：一步没动的那一下仍然是单击——落在空白上，因此清空选区。
  await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(0)
  const after = (await stroke.boundingBox())!
  expect(after.x).toBeCloseTo(moved.x, 0)
})
