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

  // 臂长贯穿图面：渐变的跨度就是图面短边，衰减因此必须在可见的那半段里完成。
  const reach = await stage.locator('linearGradient').first().evaluate((gradient) => Math.hypot(
    Number(gradient.getAttribute('x2')) - Number(gradient.getAttribute('x1')),
    Number(gradient.getAttribute('y2')) - Number(gradient.getAttribute('y1')),
  ))
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  expect(reach).toBeCloseTo(Math.min(surface.width, surface.height), 0)

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
