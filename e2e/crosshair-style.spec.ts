import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 启动一条取点命令并把指针停在图面上：十字光标只在「正在取点」时绘制。
 *
 * 从命令行启动而不是点工具栏按钮——那颗按钮在不在货架上是另一回事。
 */
async function awaitPoint(page: Page) {
  const stage = page.getByRole('region', { name: 'Compose editor' })
    .getByRole('application', { name: 'Stage' })
  const input = stage.getByRole('combobox', { name: '命令行' })
  await input.click()
  await input.fill('LINE')
  await page.keyboard.press('Enter')
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.move(box.x + 340, box.y + 260)
  return stage
}

test('OpenSpec: editor-preferences / 十字光标样式是编辑器偏好 / 默认渐隐，设置里切成晕圈', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = await awaitPoint(page)
  const crosshair = stage.getByTestId('stage-crosshair')
  const halos = stage.locator('[data-stage-crosshair-halo]')

  /*
   * 默认渐隐：四条臂各一份渐变，描边指向它。
   *
   * 只断言「有四条线」不够——这一整条能力合并时 322 条端到端全绿，而样式在实机上根本看不
   * 出来：线的条数在两种样式下都是四。因此这里断的是**画笔**（渐变存在且被引用），以及
   * 切换之后图面真的换了一副画笔。
   */
  await expect(crosshair).toHaveAttribute('data-crosshair-style', 'fade')
  await expect(halos).toHaveCount(0)
  const fadeStroke = await stage.locator('[data-stage-crosshair-line]').first()
    .evaluate((line) => (line as SVGLineElement).style.stroke)
  expect(fadeStroke).toMatch(/^url\(/)

  /*
   * 渐隐的衰减必须落在图面内看得见的那一段里：臂从光标最远只走到图面边缘，而 `reach` 是
   * 图面短边，因此竖直臂的可见部分最多只到 offset 0.5。衰减排在那之后就整个发生在图面之外
   * ——那正是第二版的缺陷，绘图工作区里渐隐与晕圈逐像素难分。
   */
  const stops = await stage.locator('linearGradient').first().evaluate((gradient) =>
    Array.from(gradient.querySelectorAll('stop'), (stop) => ({
      offset: Number(stop.getAttribute('offset')),
      opacity: Number(stop.getAttribute('stop-opacity')),
    })))
  const opacityAt = (offset: number) => {
    const upper = stops.findIndex((stop) => stop.offset >= offset)
    const before = stops[upper - 1]
    const after = stops[upper]!
    if (!before) return after.opacity
    return before.opacity
      + (after.opacity - before.opacity) * ((offset - before.offset) / (after.offset - before.offset))
  }
  expect(opacityAt(0.1)).toBe(1)
  expect(opacityAt(0.5)).toBeLessThanOrEqual(0.5)
  expect(stops[stops.length - 1]?.opacity).toBeGreaterThan(0)

  // 设置 › 画布 › 晕圈：整条链路是 偏好 → controller → Stage。
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog', { name: '设置' })
  await dialog.getByRole('button', { name: '画布' }).click()
  await expect(dialog.getByRole('radio', { name: '渐隐（默认）' })).toBeChecked()
  await dialog.getByRole('radio', { name: '晕圈' }).click()
  await dialog.getByRole('button', { name: '关闭设置' }).click()

  await awaitPoint(page)
  await expect(crosshair).toHaveAttribute('data-crosshair-style', 'halo')
  await expect(halos).toHaveCount(4)
  await expect(stage.locator('[data-stage-crosshair-line]')).toHaveCount(4)
  await expect(stage.locator('linearGradient')).toHaveCount(0)
})

/*
 * 绘图工作区是另一条呈现路径：臂长从 5% 变成贯穿图面，而渐隐的可辨识度恰恰依赖臂长与图面
 * 的比例。上一版在页面工作区看得出、在绘图工作区看不出，就是因为只测了前者。
 */
test('OpenSpec: editor-preferences / 十字光标样式是编辑器偏好 / 绘图工作区里样式同样换笔', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.getByRole('radiogroup', { name: '工作区' })
    .getByRole('radio', { name: '绘图' }).click()

  const stage = await awaitPoint(page)
  const crosshair = stage.getByTestId('stage-crosshair')
  await expect(crosshair).toHaveAttribute('data-crosshair-style', 'fade')

  /*
   * 渐变的跨度就是臂长，而臂长现在由编辑器偏好 `crosshairSize` 承载、默认 5%——它已经不是
   * 工作区会话开关，因此绘图工作区与页面工作区一样长。
   */
  const reach = await stage.locator('linearGradient').first().evaluate((gradient) => Math.hypot(
    Number(gradient.getAttribute('x2')) - Number(gradient.getAttribute('x1')),
    Number(gradient.getAttribute('y2')) - Number(gradient.getAttribute('y1')),
  ))
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  expect(reach).toBeCloseTo(Math.min(surface.width, surface.height) * 0.05, 0)

  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog', { name: '设置' })
  await dialog.getByRole('button', { name: '画布' }).click()
  await dialog.getByRole('radio', { name: '晕圈' }).click()
  await dialog.getByRole('button', { name: '关闭设置' }).click()

  await awaitPoint(page)
  await expect(crosshair).toHaveAttribute('data-crosshair-style', 'halo')
  await expect(stage.locator('[data-stage-crosshair-halo]')).toHaveCount(4)
  await expect(stage.locator('linearGradient')).toHaveCount(0)
})

/*
 * 剪刀徽标与拾取框「同一支笔」曾经只是一句注释：徽标读 `--compose-stage-crosshair`、拾取框
 * 读 `--compose-canvas-crosshair`，两个谁也没被定义过的 token 落到不同的兜底。深色主题下
 * 两者恰好同值，缺陷因此藏着——只有浅色主题会暴露：徽标 rgb(230,237,247) 画在近白的图面上，
 * 对比度 1.08:1，等于没画。因此这条用例 MUST 在浅色主题下断。
 */
test('OpenSpec: stage / Stage 十字光标 / 剪刀徽标与拾取框同一支笔', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog', { name: '设置' })
  await dialog.getByRole('radio', { name: '浅色' }).click()
  await dialog.getByRole('button', { name: '关闭设置' }).click()

  const stage = editor.getByRole('application', { name: 'Stage' })
  const input = stage.getByRole('combobox', { name: '命令行' })
  await input.click()
  await input.fill('TRIM')
  await page.keyboard.press('Enter')
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.move(surface.x + 340, surface.y + 260)

  const stroke = (selector: string) =>
    stage.locator(selector).first().evaluate((el) => getComputedStyle(el).stroke)
  const badge = await stroke('.compose-stage__drafting-badge')
  const pickbox = await stroke('[data-stage-crosshair-box]')
  expect(badge).toBe(pickbox)
  // 并且那支笔在浅色图面上读得出来：它不能与图面底色同属一端。
  const surfaceBg = await stage.locator('.compose-stage__surface').first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(badge).not.toBe(surfaceBg)
})

/*
 * 坐标轴与十字光标在屏幕上难以区分——都是贯穿图面的亮线，而坐标轴永远在、光标只在取点时
 * 出现。这条断的是开关真的到达了画布，以及它**同时**收走两条轴线与原点标记：只关一半会
 * 留下一个孤零零的小十字。网格必须不受影响。
 */
test('OpenSpec: editor-preferences / 世界坐标轴显示是编辑器偏好 / 在设置里关掉', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const axes = stage.locator('.compose-stage__axis')
  const origin = stage.getByTestId('stage-world-origin')
  const grid = stage.getByTestId('stage-grid')

  await expect(axes).toHaveCount(2)
  await expect(origin).toHaveCount(1)

  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog', { name: '设置' })
  await dialog.getByRole('button', { name: '画布' }).click()
  const toggle = dialog.getByRole('checkbox', { name: '显示世界坐标轴' })
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await dialog.getByRole('button', { name: '关闭设置' }).click()

  await expect(axes).toHaveCount(0)
  await expect(origin).toHaveCount(0)
  // 网格回答的是别的问题，不受影响。
  await expect(grid).toBeVisible()
})

/*
 * 画笔与长度是两个正交的维度。用户把「渐隐 / 晕圈」读成了长短，选晕圈期待短十字、得到的
 * 仍是长十字——因为那一组选的是画笔。这条断两件事：长度真的可选，且改长度不动画笔。
 */
test('OpenSpec: editor-preferences / 十字光标长度是编辑器偏好 / 数值框与滑块联动，改完画布真的变长', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = await awaitPoint(page)
  const armLength = () => stage.locator('[data-stage-crosshair-line]').first()
    .evaluate((line) => {
      const box = line.getBoundingClientRect()
      return Math.round(Math.max(box.width, box.height))
    })
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const shorterEdge = Math.min(surface.width, surface.height)

  // 默认是 AutoCAD 的 5%：只在光标附近画一小截。
  expect(await armLength()).toBeCloseTo(Math.round(shorterEdge * 0.05), -1)

  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '应用菜单' }).click()
  await editor.getByRole('menuitem', { name: '设置' }).click()
  const dialog = page.getByRole('dialog', { name: '设置' })
  await dialog.getByRole('button', { name: '画布' }).click()
  // 画笔与长度是两个独立的维度：改长度不动画笔。
  await dialog.getByRole('radiogroup', { name: '画笔' })
    .getByRole('radio', { name: '晕圈' }).click()

  // 数值框与滑块是同一个值的两个入口，照抄 AutoCAD 的 Crosshair size。
  const slider = dialog.getByRole('slider', { name: '长度' })
  const box = dialog.getByRole('spinbutton', { name: '长度百分比' })
  await expect(slider).toHaveValue('5')
  await expect(box).toHaveValue('5')
  await box.fill('100')
  await expect(slider).toHaveValue('100')
  await dialog.getByRole('button', { name: '关闭设置' }).click()

  await awaitPoint(page)
  expect(await armLength()).toBeCloseTo(Math.round(shorterEdge), -1)
  await expect(stage.getByTestId('stage-crosshair')).toHaveAttribute('data-crosshair-style', 'halo')

  // 切换工作区不再把长度改回去：它已经不是会话开关。
  await page.keyboard.press('Escape')
  await editor.getByRole('radiogroup', { name: '工作区' }).getByRole('radio', { name: '绘图' }).click()
  await awaitPoint(page)
  expect(await armLength()).toBeCloseTo(Math.round(shorterEdge), -1)
})
