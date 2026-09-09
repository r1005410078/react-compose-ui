import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 取点过程中的动态输入。
 *
 * 值取的是**解算之后**的落点，因此这些用例都把落点放在网格步长 8 的整数倍上——不然读数会
 * 被吸附挪走，断言就变成在考吸附而不是考动态输入。
 */
async function openStage(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  return {
    editor,
    stage,
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    /*
     * 落点走 `hover` / `click` 的 `position` 而不是先量一次 `boundingBox()` 再算绝对坐标：
     * 编辑器的面板布局在首帧之后还会动一下，并行跑满时那一下可能晚于测量，绝对坐标于是落到
     * 图面之外——指针被判成「不在图面上」，动态输入一个字都不画。`position` 每次重新定位。
     */
    hover: (x: number, y: number) => surface.hover({ position: { x, y } }),
    click: (x: number, y: number) => surface.click({ position: { x, y } }),
  }
}

/** 读出一个数值框里的文字。 */
async function fieldText(stage: Locator, index: 0 | 1) {
  return (await stage.getByTestId(`stage-dynamic-input-field-${index}`).locator('text').last()
    .textContent())?.trim()
}

test('OpenSpec: stage / 取点过程中的动态输入 / 画线时长度与角度一直在屏幕上', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')

  // 第一个点没有「上一点」，这一档是绝对坐标。
  await hover(240, 200)
  await expect(stage.getByTestId('stage-dynamic-input')).toHaveCount(1)
  await expect(stage.locator('.compose-stage__dynamic-input-prefix')).toHaveCount(2)

  await click(240, 200)
  await hover(440, 200)

  // 水平向右 200：长度 200、角度 0°。
  expect(await fieldText(stage, 0)).toBe('200')
  expect(await fieldText(stage, 1)).toBe('0°')

  // 长度标注线与角度弧都画出来了。
  const guides = stage.locator('.compose-stage__dynamic-input-guide')
  expect(await guides.count()).toBeGreaterThan(2)
  const arcs = await guides.evaluateAll((nodes) =>
    nodes.filter((node) => (node.getAttribute('d') ?? '').includes('A')).length)
  expect(arcs).toBeGreaterThan(0)
})

test('OpenSpec: stage / 命令行是动态输入的输入端 / 裸数字是直接距离输入', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(240, 200)
  // 方向由鼠标定好：向右。
  await hover(440, 200)

  await commandInput.fill('120')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  // 只打一个长度就落点：这正是画元器件时最高频的输入方式。
  // 包围盒含描边宽度，因此比几何长度大一点点。
  const drawn = (await stroke.boundingBox())!
  expect(Math.abs(drawn.width - 120)).toBeLessThan(2)
})

test('OpenSpec: stage / 命令行是动态输入的输入端 / Tab 锁定之后指针跑远几何不跟', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(240, 200)
  await hover(440, 200)

  await commandInput.fill('160')
  await commandInput.press('Tab')

  // 锁定的字段变成实心，活动字段移到角度。
  await expect(stage.getByTestId('stage-dynamic-input-field-0').locator('.compose-stage__dynamic-input-box'))
    .toHaveAttribute('data-state', 'locked')
  await expect(stage.getByTestId('stage-dynamic-input-field-1').locator('.compose-stage__dynamic-input-box'))
    .toHaveAttribute('data-state', 'active')
  // 锁死长度时画一个半径等于该长度的圆——「长度已定、方向还在跟鼠标」唯一说得清的画法。
  await expect(stage.locator('.compose-stage__dynamic-input-lock')).toHaveCount(1)

  // 指针走到 300 远处，长度仍读作 160。
  await hover(540, 200)
  expect(await fieldText(stage, 0)).toBe('160')

  await commandInput.fill('90')
  await commandInput.press('Enter')
  await commandInput.press('Escape')

  // 90° 是正上方：一条竖直的线，长度 160。
  const drawn = (await stage.getByTestId('compose-material-curve-stroke').boundingBox())!
  expect(Math.abs(drawn.height - 160)).toBeLessThan(2)
})

test('OpenSpec: stage / 取点过程中的动态输入 / 矩形显示宽高且不画角度', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('R')
  await commandInput.press('Enter')
  await click(240, 200)
  await hover(440, 320)

  expect(await fieldText(stage, 0)).toBe('200')
  expect(await fieldText(stage, 1)).toBe('120')
  const arcs = await stage.locator('.compose-stage__dynamic-input-guide').evaluateAll((nodes) =>
    nodes.filter((node) => (node.getAttribute('d') ?? '').includes('A')).length)
  expect(arcs).toBe(0)
})

test('OpenSpec: stage / 命令行是动态输入的输入端 / 焦点在图面时坐标字符与 Tab 都转交命令行', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  // 点一下画布之后焦点就在图面上了——这正是用户画完第一个点的真实处境。
  await click(240, 200)
  await hover(440, 200)
  await expect(commandInput).not.toBeFocused()

  // 数字直接打在图面上：转交之后它落进命令行，用户不必把手移回去。
  await page.keyboard.press('1')
  await expect(commandInput).toBeFocused()
  await page.keyboard.type('20')
  await expect(commandInput).toHaveValue('120')

  await commandInput.press('Enter')
  await commandInput.press('Escape')
  const drawn = (await stage.getByTestId('compose-material-curve-stroke').boundingBox())!
  expect(Math.abs(drawn.width - 120)).toBeLessThan(2)
})

test('OpenSpec: stage / 命令行是动态输入的输入端 / 图面上按 Tab 直接锁定当前字段', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(240, 200)
  await hover(440, 200)
  await expect(commandInput).not.toBeFocused()

  // 缓冲为空时 `Tab` 锁定它此刻的值：拖个大概再打精确的另一个，是两步。
  await page.keyboard.press('Tab')
  await expect(stage.getByTestId('stage-dynamic-input-field-0').locator('.compose-stage__dynamic-input-box'))
    .toHaveAttribute('data-state', 'locked')
  expect(await fieldText(stage, 0)).toBe('200')
  await expect(commandInput).toBeFocused()
})

test('OpenSpec: stage / 取点过程中的动态输入 / 数值框看得见：不是黑底黑字', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(240, 200)
  await hover(440, 200)

  /*
   * `var()` 解析不到且没有兜底时整条声明在计算期失效，`fill` 退回初值**黑色**——那正好是
   * 深色画布上「什么都看不见」的样子，而它在浅色主题下反而正常，因此极容易漏掉。
   */
  const fill = await stage.getByTestId('stage-dynamic-input-field-0').locator('.compose-stage__dynamic-input-box')
    .evaluate((node) => getComputedStyle(node).fill)
  expect(fill).not.toBe('rgb(0, 0, 0)')
  const color = await stage.getByTestId('stage-dynamic-input-field-0').locator('text')
    .first().evaluate((node) => getComputedStyle(node).fill)
  expect(color).not.toBe('rgb(0, 0, 0)')
})

test('OpenSpec: stage / 命令行是动态输入的输入端 / 连按两次 Tab 不会两个字段都锁上', async ({ page }) => {
  const { stage, commandInput, hover, click } = await openStage(page)
  const boxState = (index: 0 | 1) => stage
    .getByTestId(`stage-dynamic-input-field-${index}`)
    .locator('.compose-stage__dynamic-input-box')

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await click(240, 200)
  await hover(440, 200)

  await commandInput.press('Tab')
  await expect(boxState(0)).toHaveAttribute('data-state', 'locked')
  await expect(boxState(1)).toHaveAttribute('data-state', 'active')

  /*
   * 第二次 `Tab` 回到长度：它必须**解锁**。两个都锁死时落点已经完全确定，光标再也带不动
   * 任何东西，而屏幕上没有任何东西在说这件事。
   */
  await commandInput.press('Tab')
  await expect(boxState(0)).toHaveAttribute('data-state', 'active')
  await expect(boxState(1)).toHaveAttribute('data-state', 'locked')

  // 长度确实又跟着光标走了。
  await hover(520, 200)
  expect(await fieldText(stage, 0)).toBe('280')
})
