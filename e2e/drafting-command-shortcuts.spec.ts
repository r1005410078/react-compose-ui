import { expect, test } from '@playwright/test'

/**
 * 绘图命令的单键快捷键。
 *
 * 焦点必须在图面上：命令行输入框里的字母是文本，这正是 `isEditableTarget` 守卫的作用。
 */
test('OpenSpec: stage / 绘图命令的单键快捷键 / 按 R 画出一个矩形', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  await expect(prompt).toContainText('命令：')

  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  // 先把焦点放到图面上——用户此刻的手在鼠标上，不在命令行。
  await page.mouse.click(at(200, 420).x, at(200, 420).y)
  await page.keyboard.press('r')
  await expect(prompt).toContainText('指定第一个角点')

  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await expect(prompt).toContainText('指定对角点')
  await page.mouse.click(at(420, 320).x, at(420, 320).y)

  // 取够两个点即结束，回到空闲提示。
  await expect(prompt).toContainText('命令：')
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)
})

test('OpenSpec: stage / 绘图命令的单键快捷键 / 焦点在命令行时字母是文本', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('textbox', { name: '命令行' })

  await commandInput.click()
  await commandInput.press('r')
  await expect(commandInput).toHaveValue('r')
  // 没有任何命令被启动：用户正在敲的是命令名。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')
})

test('OpenSpec: stage / 绘图命令的单键快捷键 / 按 L 与敲 LINE 是同一条会话', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!

  await page.mouse.click(box.x + 200, box.y + 420)
  await page.keyboard.press('l')
  await expect(prompt).toContainText('指定第一点')

  // 命令进行中再按一个绘图键不替换会话——已取的点不能被静默丢弃。
  await page.mouse.click(box.x + 240, box.y + 200)
  await expect(prompt).toContainText('指定下一点')
  await page.keyboard.press('r')
  await expect(prompt).toContainText('指定下一点')

  await page.mouse.click(box.x + 420, box.y + 200)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)
})
