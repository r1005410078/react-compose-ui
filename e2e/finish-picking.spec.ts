import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { switchToDrawingWorkspace } from './support/test-helpers'

/**
 * 取点命令怎么结束。
 *
 * @remarks
 * `PLINE` 攒到结束才提交一个 Entity，因此结束方式一旦走错就是全损——这几条钉住的正是那些
 * 「用户以为自己画完了」的路径。
 */

async function boxOf(locator: Locator) {
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null
  await expect.poll(async () => {
    box = await locator.boundingBox()
    return box !== null
  }).toBe(true)
  return box!
}

async function openEditor(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  // 制图命令与角度约束的按钮只在绘图工作区的货架上；用例显式说明自己站在哪里。
  await switchToDrawingWorkspace(page)
  const box = await boxOf(stage.getByTestId('stage-surface'))
  return {
    editor,
    stage,
    at: (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy }),
    strokes: stage.getByTestId('compose-material-curve-stroke'),
  }
}

test('OpenSpec: stage / 取点命令进行中右键即结束', async ({ page }) => {
  const { editor, at, strokes } = await openEditor(page)

  await editor.getByRole('button', { name: '多段线', exact: true }).click()
  await page.mouse.click(at(160, 160).x, at(160, 160).y)
  await page.mouse.click(at(300, 260).x, at(300, 260).y)
  await page.mouse.click(at(420, 140).x, at(420, 140).y)
  await page.mouse.click(at(500, 240).x, at(500, 240).y, { button: 'right' })

  await expect(strokes).toHaveCount(1)
  const raw = (await strokes.first().getAttribute('points'))!.trim().split(/\s+/)
  expect(raw).toHaveLength(3)
  // 右键只做一件事：菜单盖住的正是用户刚落笔的地方。
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('OpenSpec: stage / 命令不在跑时右键仍开菜单', async ({ page }) => {
  const { at } = await openEditor(page)

  // 护栏：这一刀最容易做过头的方向就是「右键在画布上从此不开菜单了」。
  await page.mouse.click(at(300, 240).x, at(300, 240).y, { button: 'right' })
  await expect(page.getByRole('menu').first()).toBeVisible()
  // 菜单是模态：它一开，祖先节点就被 aria-hidden，任何 `getByRole` 都找不回来。收键盘事件
  // 因此走 `page`，不走 Stage 定位器。
  await page.keyboard.press('Escape')
})

test('OpenSpec: stage / 夹点会话进行中右键不提交', async ({ page }) => {
  const { editor, stage, at } = await openEditor(page)

  await editor.getByRole('button', { name: '直线', exact: true }).click()
  await page.mouse.click(at(200, 200).x, at(200, 200).y)
  await page.mouse.click(at(400, 200).x, at(400, 200).y)
  await stage.press('Escape')

  // 双击进入几何编辑，原地按一下点亮端点夹点。
  await page.mouse.dblclick(at(300, 200).x, at(300, 200).y)
  const grip = stage.locator('[data-testid^="stage-path-vertex-hit-"]').first()
  await expect(grip).toBeAttached()
  // 右键之后菜单是模态，祖先被 aria-hidden，`getByRole` 全部失效；因此改用 CSS 定位器读几何。
  const stroke = page.locator('[data-testid="compose-material-curve-stroke"]').first()
  const before = await stroke.getAttribute('x2')
  const gripBox = await boxOf(grip)
  await page.mouse.click(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2)

  // 护栏：夹点会话由**手势**启动，右键在那里不表达「我说完了」；拖动中途提交更会把顶点
  // 丢在用户没打算落笔的地方。
  await page.mouse.click(at(520, 360).x, at(520, 360).y, { button: 'right' })
  expect(await stroke.getAttribute('x2')).toBe(before)
})

test('OpenSpec: stage / 从工具栏启动命令后焦点落在命令行', async ({ page }) => {
  const { editor, stage } = await openEditor(page)
  const prompt = stage.getByTestId('stage-drafting-command-prompt')

  await editor.getByRole('button', { name: '多段线', exact: true }).click()
  await expect(stage.getByRole('combobox', { name: '命令行' })).toBeFocused()

  // 判别点：焦点留在按钮上时，`Enter` 就是再点一次按钮，提示会停在「指定第一点」不动——
  // 连续取点的命令因此永远结束不了。
  await expect(prompt).toContainText('指定第一点')
  await page.keyboard.press('Enter')

  // 一个点都没取就空确认，`PLINE` 以「已取消」收场——不留下屏幕上看不见的幽灵。这句话是
  // **会话**说的，而那正是要证明的：这一下 `Enter` 到了命令手里，不是又点了一次按钮。
  await expect(prompt).toContainText('已取消')
  await expect(prompt).not.toContainText('指定第一点')
})
