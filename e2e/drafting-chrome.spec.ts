import { expect, test } from '@playwright/test'

/**
 * 绘图模式的 chrome 与键盘。
 *
 * @remarks
 * 这两条都**只有端到端拦得住**：组件测试里 `fireEvent` 想在哪个节点上触发就在哪个节点上
 * 触发，因此「取完点之后焦点到底在谁身上」这个问题在 jsdom 里根本不会被问；布局遮盖同理，
 * jsdom 不做排版，所有元素的盒都是零。
 */

async function enterDrafting(page: import('@playwright/test').Page) {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('radio', { name: '绘图' }).click()
  return { editor, stage }
}

test('OpenSpec: stage / 绘图模式 / 手在画布上时 Enter 结束命令', async ({ page }) => {
  const { stage } = await enterDrafting(page)

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(200, 160).x, at(200, 160).y)
  await page.mouse.click(at(340, 240).x, at(340, 240).y)
  await expect(prompt).toContainText('指定下一点')

  // 取点用的是鼠标，焦点因此在图面上而不是命令行输入框里——真实操作里用户此刻不会先把
  // 光标点回输入框再按 Enter。
  await page.keyboard.press('Enter')

  // 正常结束回到空闲提示。文案是判别点：结束与中止都留住已画的线，两者只能靠这里区分。
  await expect(prompt).toContainText('命令：')
  await expect(prompt).not.toContainText('已取消')

  // 会话确实结束了：再点一下画布只是普通点选，不会续上第三点。
  await page.mouse.click(at(460, 300).x, at(460, 300).y)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)
})

test('OpenSpec: stage / 绘图模式 / 命令行不被标尺与图面压住', async ({ page }) => {
  const { stage } = await enterDrafting(page)

  const commandLine = (await stage.getByTestId('stage-drafting-command-line').boundingBox())!
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  const verticalRuler = (await stage.getByTestId('stage-ruler-y').boundingBox())!

  // 命令行独占底部一条：图面与竖标尺都必须停在它上边缘之前。原先它是 `bottom: 0` 的浮层，
  // 左端 24px 压在竖标尺下、底部 10px 压在横滚动条下，第一个字与整条下边框都看不见。
  expect(surface.y + surface.height).toBeLessThanOrEqual(commandLine.y + 0.5)
  expect(verticalRuler.y + verticalRuler.height).toBeLessThanOrEqual(commandLine.y + 0.5)

  // 提示文字完整可见——被压住时它的左端会落在竖标尺的宽度之内。
  const promptBox = (await stage.getByTestId('stage-drafting-command-prompt').boundingBox())!
  expect(promptBox.y).toBeGreaterThanOrEqual(commandLine.y - 0.5)
})
