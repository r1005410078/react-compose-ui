import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 顶点模式的光标与选中呈现。
 *
 * @remarks
 * 四条断言各自对应一处今天的行为：拖动中十字线断掉（且系统光标仍被收走，屏幕上一个光标
 * 都没有）、悬停期没有拾取框、夹点没有悬停反馈、Shift 累加之后会话不退出而选中呈现全空。
 *
 * 命中相关断言在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */

/** 画一条线并回到空闲。 */
async function drawLine(
  page: Page,
  commandInput: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x, to.y)
  await commandInput.press('Escape')
}

test('OpenSpec: stage / Stage 十字光标 / 拖夹点期间十字线不断且与系统光标同真同假', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const lines = stage.locator('[data-stage-crosshair-line]')
  const cursorHidden = async () => (await surface.evaluate(
    (element) => getComputedStyle(element).cursor,
  )) === 'none'

  await drawLine(page, commandInput, at(240, 160), at(440, 260))

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const drawn = (await stroke.boundingBox())!
  const center = { x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2 }

  await page.mouse.dblclick(center.x, center.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  await page.mouse.move(center.x + 24, center.y - 18)
  await expect(lines).toHaveCount(4)
  expect(await cursorHidden()).toBe(true)

  const grip = stage.getByTestId('stage-path-vertex-hit-move')
  const gripBox = (await grip.boundingBox())!
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripBox.x + 70, gripBox.y + 50, { steps: 6 })

  // 用户此刻正在做最需要看清落点的那一下。
  await expect(lines).toHaveCount(4)
  expect(await cursorHidden()).toBe(true)
  await page.mouse.move(gripBox.x + 110, gripBox.y + 20, { steps: 4 })
  await expect(lines).toHaveCount(4)
  await page.mouse.up()

  // 退出之后两者一起消失：同真同假的另一半。
  await page.keyboard.press('Escape')
  await expect(lines).toHaveCount(0)
  expect(await cursorHidden()).toBe(false)
})

test('OpenSpec: stage / 曲线几何编辑会话 / 悬停期画线加框，拖动期只剩线', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()

  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const lines = stage.locator('[data-stage-crosshair-line]')
  const pickbox = stage.getByTestId('stage-pickbox')

  await drawLine(page, commandInput, at(240, 160), at(440, 260))

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const drawn = (await stroke.boundingBox())!
  const center = { x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2 }

  await page.mouse.dblclick(center.x, center.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)
  await page.mouse.move(center.x + 24, center.y - 18)

  // 会话在等着抓点什么，框表达可抓的靶区。
  await expect(lines).toHaveCount(4)
  await expect(pickbox).toHaveCount(1)

  const grip = stage.getByTestId('stage-path-vertex-hit-move')
  const gripBox = (await grip.boundingBox())!
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripBox.x + 70, gripBox.y + 50, { steps: 6 })

  // 抓住了，那件事已经发生；框只会挡住落点。
  await expect(pickbox).toHaveCount(0)
  await expect(lines).toHaveCount(4)
  await page.mouse.up()
})

test('OpenSpec: stage / 曲线几何编辑会话 / 悬停在夹点上改变它的呈现', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()

  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  await drawLine(page, commandInput, at(240, 160), at(440, 260))

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const drawn = (await stroke.boundingBox())!
  const center = { x: drawn.x + drawn.width / 2, y: drawn.y + drawn.height / 2 }

  await page.mouse.dblclick(center.x, center.y)
  const diamond = stage.getByTestId('stage-path-vertex-move')
  await expect(diamond).toHaveCount(1)
  const fillOf = async () => diamond.evaluate((element) => getComputedStyle(element).fill)

  await page.mouse.move(center.x + 40, center.y - 30)
  const idle = await fillOf()

  const gripBox = (await stage.getByTestId('stage-path-vertex-hit-move').boundingBox())!
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)
  // 夹点的可见图形比命中区小，没有反馈时唯一的确认办法是按下去试。
  await expect.poll(fillOf).not.toBe(idle)

  await page.mouse.move(center.x + 40, center.y - 30)
  await expect.poll(fillOf).toBe(idle)
})

test('OpenSpec: stage / 曲线几何编辑会话 / Shift 累加退出会话并恢复多选呈现', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()

  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  await drawLine(page, commandInput, at(240, 150), at(440, 190))
  await drawLine(page, commandInput, at(240, 360), at(440, 400))

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)
  const centerOf = async (index: number) => {
    const rect = (await strokes.nth(index).boundingBox())!
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }
  const a = await centerOf(0)
  const b = await centerOf(1)

  await page.mouse.dblclick(a.x, a.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  await page.keyboard.down('Shift')
  await page.mouse.click(b.x, b.y)
  await page.keyboard.up('Shift')

  // 会话的全部呈现都只描述一个对象；按在多选上会让 B 在图面上彻底隐身。
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(0)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(
    sceneTree.getByRole('row').and(page.locator('[aria-selected="true"]')),
  ).toHaveCount(2)
})
