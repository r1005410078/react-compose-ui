import { expect, test } from '@playwright/test'

test('OpenSpec: stage / 绘图能力恒开 / L↵ 画线、捕捉端点、画出的是普通 Entity', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 命令行常驻：不进模式就看不见命令行，正是「能力不可发现」那条毛病。
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

  // 画出来的是普通页面 Entity——场景树里有、点得中、撤得掉。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(2)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(1)
})

test('OpenSpec: stage-engine / 取点接管排在画布平移之下 / 命令进行中仍可平移', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')

  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const before = await frame.boundingBox()
  expect(before).not.toBeNull()

  // 中键平移：命令进行中仍然要能去看远处那个目标点，AutoCAD 同样如此。
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
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

const LINES: readonly (readonly [readonly [number, number], readonly [number, number]])[] = [
  [[200, 180], [400, 180]],
  [[200, 300], [400, 300]],
]

/**
 * 用 `LINE` 命令画出 {@link LINES} 两条互不相交的线。
 *
 * @remarks
 * 返回按线身中点取的点击位置——**从实测包围盒算而不是从落笔坐标算**：落笔点会被网格吸附
 * 挪动最多半格，而线状节点的命中区只有十几个屏幕像素，按落笔坐标点会时中时不中。
 */
async function drawTwoLines(page: import('@playwright/test').Page, stage: import('@playwright/test').Locator) {
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  for (const [from, to] of LINES) {
    await commandInput.fill('L')
    await commandInput.press('Enter')
    await page.mouse.click(box.x + from[0], box.y + from[1])
    await page.mouse.click(box.x + to[0], box.y + to[1])
    await commandInput.press('Escape')
  }
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(2)
  const centers = await strokes.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }))
  return { strokes, centers }
}

test('OpenSpec: stage / 统一的替换选择语义 / 点击替换、Shift 累加', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  // 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  const { centers } = await drawTwoLines(page, stage)

  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const selectedRows = sceneTree.getByRole('row').and(page.locator('[aria-selected="true"]'))

  /*
   * 选择语义只剩一套：Figma 的替换 + Shift 累加。
   *
   * 曾经绘图模式有第二套 CAD 语义（点中即加入、Shift 移出），理由写的是「用户的肌肉记忆
   * 来自 AutoCAD」——而那条前提已被推翻（用户不熟 AutoCAD，判据换成「任务需要什么」）。
   * 任务需要的只是「能选中多个」，Shift 累加就够。
   */
  await page.mouse.click(centers[0]!.x, centers[0]!.y)
  await expect(selectedRows).toHaveCount(1)
  await page.mouse.click(centers[1]!.x, centers[1]!.y)
  await expect(selectedRows).toHaveCount(1)

  // Shift 累加。
  await page.keyboard.down('Shift')
  await page.mouse.click(centers[0]!.x, centers[0]!.y)
  await page.keyboard.up('Shift')
  await expect(selectedRows).toHaveCount(2)
})

test('OpenSpec: stage / 编辑命令 / MOVE 一步撤销、ERASE 先选后执行、COPY 连续放置', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const { strokes, centers } = await drawTwoLines(page, stage)

  const screenX = async () => strokes.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().x)))
  const before = await screenX()

  // 命令进行中选择对象：选择集归宿主，命令读的是宿主那一份。
  await commandInput.fill('M')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('选择对象')
  await page.mouse.click(centers[0]!.x, centers[0]!.y)
  // 多选走 Shift：选择语义只剩 Figma 那一套，命令读的仍是宿主那一份选择集。
  await page.keyboard.down('Shift')
  await page.mouse.click(centers[1]!.x, centers[1]!.y)
  await page.keyboard.up('Shift')
  await expect(stage.getByTestId('stage-drafting-selection-count')).toContainText('已选 2')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定基点')

  await commandInput.fill('0,0')
  await commandInput.press('Enter')
  await commandInput.fill('@60,0')
  await commandInput.press('Enter')

  // 两条线一起走同样的位移。屏幕位移是 60 × zoom，而 zoom 由自动适配决定，因此这里断言
  // 「两条相等且为正」——精确的 60 由 zoom 恒为 1 的组件测试钉住。
  const moved = await screenX()
  expect(moved[0]! - before[0]!).toBeGreaterThan(0)
  expect(moved[1]! - before[1]!).toBe(moved[0]! - before[0]!)

  // 多选移动只占一步撤销。
  await page.keyboard.press('Control+z')
  await expect.poll(screenX).toEqual(before)

  // 先选后执行：`M` 结束后选择集还在，`E↵` 当场删除并清空选择集。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const selectedRows = sceneTree.getByRole('row').and(page.locator('[aria-selected="true"]'))
  await expect(selectedRows).toHaveCount(2)
  await commandInput.fill('E')
  await commandInput.press('Enter')
  await expect(strokes).toHaveCount(0)
  await expect(selectedRows).toHaveCount(0)

  await page.keyboard.press('Control+z')
  await expect(strokes).toHaveCount(2)

  // COPY 连续放置：放下一份继续等下一个落点，位移始终相对最初的基点。
  await commandInput.press('Escape')
  await page.mouse.click(centers[0]!.x, centers[0]!.y)
  await commandInput.fill('CO')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定基点')
  await commandInput.fill('0,0')
  await commandInput.press('Enter')
  await commandInput.fill('0,40')
  await commandInput.press('Enter')
  await expect(strokes).toHaveCount(3)
  await commandInput.fill('0,80')
  await commandInput.press('Enter')
  await expect(strokes).toHaveCount(4)
  await commandInput.press('Escape')
})

/**
 * 动画开关打开时仍能画线。
 *
 * @remarks
 * 这是「动画是另一根轴」这句判断的实证。动画改变的是**拖动的结果落在哪里**（写关键帧而不是
 * 写 LayoutItem），而绘图改变的是**用什么方式输入**——两者正交，不该互斥。
 *
 * 取消绘图模式之前这条必然红：`setDrafting(mode === 'drafting')` 是三选一切换器的直接后果，
 * 切到动画就把绘图强制关掉了。
 */
test('OpenSpec: stage / 绘图能力恒开 / 动画开关打开时仍能画线', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(editor.locator('[data-workspace-panel="animation"]')).toBeVisible()

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(commandInput).toBeVisible()
  await commandInput.fill('L')
  await commandInput.press('Enter')

  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 200).x, at(440, 200).y)
  await commandInput.press('Escape')

  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)
  // 动画开关没有被画线这件事关掉——两根轴各自独立。
  await expect(editor.getByRole('radio', { name: '动画' })).toHaveAttribute('aria-checked', 'true')
})

/**
 * 宿主动作在命令行里敲得出来。
 *
 * @remarks
 * 合并之前这条必然红：`UNDO` 不在注册表里，命令行只会回「未知命令」。撤销住在命令面板，
 * 而面板在默认布局里是底部折叠组中的非活动标签——同一件事在两个入口里只有一个够得着。
 */
test('OpenSpec: stage / 命令词汇表合并 / 命令行键入 UNDO 撤销上一步', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')

  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = (await stage.getByTestId('stage-surface').boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 200).x, at(440, 200).y)
  await commandInput.press('Escape')

  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(1)

  await commandInput.fill('UNDO')
  await commandInput.press('Enter')

  await expect(strokes).toHaveCount(0)
  // 敲得出来的证据不止是结果：解析成功就不该留下「未知命令」。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).not.toContainText('未知命令')
})

/**
 * 三种拒绝互相可分。
 *
 * @remarks
 * 八条内建绘图命令恒可用，因此命令行至今只有「未知命令」一种拒绝。宿主动作不是——没选够
 * 对象时编组不能执行。没有可用性标记，敲 `GROUP` 会**什么都不发生**，而这在屏幕上与敲错字
 * 无法区分。
 */
test('OpenSpec: stage / 命令词汇表合并 / 不可用的命令给出原因而不是静默', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')

  // 词不在词汇表里。
  await commandInput.fill('NOSUCHCOMMAND')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('未知命令')

  // 词在词汇表里但此刻不可用：给的是缺什么，而不是「未知命令」，更不是静默。
  await commandInput.fill('GROUP')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('请至少选中两个对象')

  // 前提满足之后同一个词就执行了：可用性跟着选择集走，而不是停在启动那一刻的判断上。
  const { strokes, centers } = await drawTwoLines(page, stage)
  await page.mouse.click(centers[0]!.x, centers[0]!.y)
  await page.keyboard.down('Shift')
  await page.mouse.click(centers[1]!.x, centers[1]!.y)
  await page.keyboard.up('Shift')

  await commandInput.fill('GROUP')
  await commandInput.press('Enter')

  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Group' })).toHaveCount(1)
  await expect(strokes).toHaveCount(2)
})

/**
 * Stage 的十字光标。
 *
 * @remarks
 * 合并之前这条必然红：Stage 今天画的是**两条**贯穿视口的线（共享组件是两轴各两个方向，
 * 共四条），而且**没有收走系统光标**——绘图命令不改工具，游标推导只看 `isDrawingTool`，
 * 于是屏幕上一支箭头压着一副十字线。等待选择对象那一档更彻底：图面上什么都不画。
 */
test('OpenSpec: stage / Stage 十字光标 / 三形态与系统光标隐藏', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const lines = stage.locator('[data-stage-crosshair-line]')
  const pickbox = stage.getByTestId('stage-pickbox')

  await expect(surface).toBeVisible()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  // 1) 空闲：什么都不画，系统光标可见。这是与 CAD 刻意的不对称——页面编辑器的静息光标是箭头。
  await page.mouse.move(at(300, 220).x, at(300, 220).y)
  await expect(lines).toHaveCount(0)
  await expect(pickbox).toHaveCount(0)
  await expect(surface).not.toHaveCSS('cursor', 'none')

  // 2) 等待取点：四条线（两轴各两个方向），没有拾取框，系统光标被收走。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一点')
  await page.mouse.move(at(300, 220).x, at(300, 220).y)
  await expect(lines).toHaveCount(4)
  await expect(pickbox).toHaveCount(0)
  await expect(surface).toHaveCSS('cursor', 'none')

  // 3) 取消后回到空闲：不残留。
  await commandInput.press('Escape')
  await expect(lines).toHaveCount(0)
  await expect(surface).not.toHaveCSS('cursor', 'none')

  // 4) 等待选择对象：只剩拾取框。
  await commandInput.fill('E')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('选择对象')
  await page.mouse.move(at(320, 240).x, at(320, 240).y)
  await expect(lines).toHaveCount(0)
  await expect(pickbox).toHaveCount(1)
  await expect(surface).toHaveCSS('cursor', 'none')
})
