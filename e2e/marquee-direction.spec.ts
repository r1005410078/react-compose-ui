import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 框选的两个方向。
 *
 * @remarks
 * 判别点是**两个方向必须真的不一样**——今天它们逐字相同：颜色、虚实、判定一处不差。判定那半
 * 是因为默认落在相交上，方向决定这套代数虽然在，却要用户先去菜单里手动选一次；呈现那半是因为
 * 两种判定共用同一个蓝，只靠虚实区分。
 *
 * 每条都同时断言**颜色**与**结果**：只断言其中一样时，另一样退化了也照样全绿。
 */

async function worldToScreen(page: Page) {
  const view = await page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform)
    const rect = (document.querySelector('[data-testid="stage-surface"]') as HTMLElement)
      .getBoundingClientRect()
    return { zoom: matrix.a, x: matrix.e, y: matrix.f, left: rect.left, top: rect.top }
  })
  return (x: number, y: number) => ({
    x: view.left + view.x + x * view.zoom,
    y: view.top + view.y + y * view.zoom,
  })
}

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    surface: stage.getByTestId('stage-surface'),
    commandInput: stage.getByRole('textbox', { name: '命令行' }),
    marquee: stage.locator('.compose-stage__marquee'),
    selection: stage.getByTestId('stage-selection-bounds'),
  }
}

/** 画一个矩形当靶子，几何精确已知。 */
async function drawRect(commandInput: Locator) {
  await commandInput.fill('REC')
  await commandInput.press('Enter')
  await commandInput.fill('300,300')
  await commandInput.press('Enter')
  await commandInput.fill('500,420')
  await commandInput.press('Enter')
  await commandInput.press('Escape')
}

interface DragResult {
  readonly fill: string
  readonly stroke: string
  readonly dash: string
  readonly selected: number
}

/** 拖一个框，途中读下它的样式，松手后读选中数。 */
async function dragMarquee(
  page: Page,
  { marquee, selection }: { marquee: Locator; selection: Locator },
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<DragResult> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await expect(marquee).toHaveCount(1)
  const style = await marquee.first().evaluate((element) => {
    const computed = getComputedStyle(element)
    return { fill: computed.fill, stroke: computed.stroke, dash: computed.strokeDasharray }
  })
  await page.mouse.up()
  return { ...style, selected: await selection.count() }
}

/** 只盖住矩形左半边 / 右半边的两个框；两次覆盖的都是它的一部分。 */
const HALF = { lo: { x: 250, y: 260 }, hi: { x: 400, y: 460 } }

test.use({ viewport: { width: 1600, height: 1000 } })

test('OpenSpec: stage / 选择与框选 / 缺省下两个方向的框与结果都不同', async ({ page }) => {
  await page.goto('/')
  const view = setup(page)
  await expect(view.surface).toBeVisible()
  await drawRect(view.commandInput)
  const at = await worldToScreen(page)

  // 左→右：只有**完全框住**才选中，因此半个框选不中。
  const ltr = await dragMarquee(page, view, at(HALF.lo.x, HALF.lo.y), at(HALF.hi.x, HALF.hi.y))
  expect(ltr.selected).toBe(0)

  await page.keyboard.press('Escape')

  // 右→左：碰到就选中。
  const rtl = await dragMarquee(page, view, at(HALF.hi.x, HALF.hi.y), at(HALF.lo.x, HALF.lo.y))
  expect(rtl.selected).toBe(1)

  // 颜色是主区分：两个方向的填充与描边都不同。
  expect(ltr.fill).not.toBe(rtl.fill)
  expect(ltr.stroke).not.toBe(rtl.stroke)
  // 虚实是同一句话的第二遍：包含实线、相交虚线。
  expect(ltr.dash === 'none' || ltr.dash === '').toBe(true)
  expect(rtl.dash).not.toBe('none')
})

test('OpenSpec: stage / 选择与框选 / 钉死相交后两个方向同色同结果', async ({ page }) => {
  await page.goto('/')
  const view = setup(page)
  await expect(view.surface).toBeVisible()
  await drawRect(view.commandInput)
  const at = await worldToScreen(page)

  await view.editor.getByRole('button', { name: '框选模式' }).click()
  await view.editor.getByRole('menuitemradio', { name: '相交选中' }).click()

  const ltr = await dragMarquee(page, view, at(HALF.lo.x, HALF.lo.y), at(HALF.hi.x, HALF.hi.y))
  await page.keyboard.press('Escape')
  const rtl = await dragMarquee(page, view, at(HALF.hi.x, HALF.hi.y), at(HALF.lo.x, HALF.lo.y))

  // 分色的依据是**生效判定**而不是方向：钉死相交时它一直是窗交色。
  expect(ltr.fill).toBe(rtl.fill)
  expect(ltr.selected).toBe(1)
  expect(rtl.selected).toBe(1)
})
