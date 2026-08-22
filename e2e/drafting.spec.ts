import { expect, test } from '@playwright/test'

test('OpenSpec: stage / 绘图模式纵向流程 / 进入模式、L↵ 画线、捕捉端点、切回设计模式', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 设计模式下没有命令行——绘图模式换的是输入方式，而不是常驻多一条工具栏。
  await expect(stage.getByTestId('stage-drafting-command-input')).toHaveCount(0)

  await editor.getByRole('radio', { name: '绘图' }).click()
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(commandInput).toBeVisible()
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')

  // 场景树与属性面板不受模式影响：对象世界归页面。
  await expect(editor.getByRole('treegrid', { name: '场景树' })).toBeVisible()

  // L↵ 启动命令，画布上点两下画出第一条线。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')

  const surface = stage.getByTestId('stage-surface')
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()
  const at = (dx: number, dy: number) => ({ x: box!.x + dx, y: box!.y + dy })

  const first = at(240, 200)
  const second = at(440, 200)
  await page.mouse.click(first.x, first.y)
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定下一点')
  await page.mouse.click(second.x, second.y)

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)
  await commandInput.press('Escape')

  // 第二条线的起点落在第一条的终点附近：对象捕捉必须把它吸到那个端点上，而不是光标裸坐标。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  const nearSecond = at(444, 203)
  await page.mouse.click(nearSecond.x, nearSecond.y)
  await page.mouse.click(at(440, 340).x, at(440, 340).y)
  await expect(strokes).toHaveCount(2)
  await commandInput.press('Escape')

  // 两条线共享同一个端点：捕捉生效时它们逐像素相接，没生效则差着光标的那几个像素。
  const endpoints = await strokes.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }))
  const firstEnd = endpoints[0]!.x + endpoints[0]!.width
  const secondStart = endpoints[1]!.x + endpoints[1]!.width
  expect(Math.abs(firstEnd - secondStart)).toBeLessThan(1.5)

  // 切回设计模式：画出来的是普通页面 Entity——场景树里有、点得中、撤得掉。
  await editor.getByRole('radio', { name: '设计' }).click()
  await expect(stage.getByTestId('stage-drafting-command-input')).toHaveCount(0)
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(2)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(1)
})

test('OpenSpec: stage-engine / 取点接管排在画布平移之下 / 命令进行中仍可平移', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('radio', { name: '绘图' }).click()

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const before = await frame.boundingBox()
  expect(before).not.toBeNull()

  // 中键平移：命令进行中仍然要能去看远处那个目标点，AutoCAD 同样如此。
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  await page.mouse.move(box.x + 300, box.y + 240)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(box.x + 380, box.y + 300, { steps: 6 })
  await page.mouse.up({ button: 'middle' })

  await expect.poll(async () => Math.round((await frame.boundingBox())!.x))
    .toBeGreaterThan(Math.round(before!.x))
  // 平移没有把命令吃掉。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')
})
