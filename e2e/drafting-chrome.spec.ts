import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

/**
 * 绘图模式的 chrome 与键盘。
 *
 * @remarks
 * 这两条都**只有端到端拦得住**：组件测试里 `fireEvent` 想在哪个节点上触发就在哪个节点上
 * 触发，因此「取完点之后焦点到底在谁身上」这个问题在 jsdom 里根本不会被问；布局遮盖同理，
 * jsdom 不做排版，所有元素的盒都是零。
 */

/**
 * 量一个元素的盒，直到量得到为止。
 *
 * @remarks
 * `toBeVisible()` 之后紧跟 `boundingBox()` **仍可能读到 null**：编辑器挂载后 Stage 还会按
 * 量到的 surface 尺寸重排一次，两次调用之间落在那一帧上就读到空盒。实测在未改动的主干上
 * 约六次隔离运行抖一次，与删除 CAD 无关。把读取放进 poll 里，读到的就是同一次成功的那个盒。
 */
async function boxOf(locator: Locator) {
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null
  await expect.poll(async () => {
    box = await locator.boundingBox()
    return box !== null
  }).toBe(true)
  return box!
}

async function enterDrafting(page: import('@playwright/test').Page) {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return { editor, stage }
}

test('OpenSpec: stage / 绘图模式 / 手在画布上时 Enter 结束命令', async ({ page }) => {
  const { stage } = await enterDrafting(page)

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = await boxOf(stage.getByTestId('stage-surface'))
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

  const commandLine = await boxOf(stage.getByTestId('stage-drafting-command-line'))
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = await boxOf(stage.getByTestId('stage-surface'))
  const verticalRuler = await boxOf(stage.getByTestId('stage-ruler-y'))

  // 命令行独占底部一条：图面与竖标尺都必须停在它上边缘之前。原先它是 `bottom: 0` 的浮层，
  // 左端 24px 压在竖标尺下、底部 10px 压在横滚动条下，第一个字与整条下边框都看不见。
  expect(surface.y + surface.height).toBeLessThanOrEqual(commandLine.y + 0.5)
  expect(verticalRuler.y + verticalRuler.height).toBeLessThanOrEqual(commandLine.y + 0.5)

  // 提示文字完整可见——被压住时它的左端会落在竖标尺的宽度之内。
  const promptBox = await boxOf(stage.getByTestId('stage-drafting-command-prompt'))
  expect(promptBox.y).toBeGreaterThanOrEqual(commandLine.y - 0.5)
})

test('OpenSpec: materials / 曲线线宽 / 放大后描边的实际触达不变', async ({ page }) => {
  const { stage } = await enterDrafting(page)

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = await boxOf(stage.getByTestId('stage-surface'))
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(120, 340).x, at(120, 340).y)
  await page.mouse.click(at(400, 180).x, at(400, 180).y)
  await page.keyboard.press('Enter')

  /**
   * 量的是**实际触达**而不是属性。
   *
   * 这里踩过一次：`vector-effect: non-scaling-stroke` 只中和 SVG 文档片段*内部*的变换，
   * 而 Stage 的缩放来自 SVG 之外的 HTML 祖先——computed 值老老实实是 `non-scaling-stroke`，
   * 描边照样跟着涨。只断言属性生效的用例在那个错误实现下是全绿的。
   *
   * 沿法向逐像素扫 `elementFromPoint`，答案是浏览器画出来的那一份。
   */
  const measure = () => page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    const hit = document.querySelector('[data-testid="compose-material-curve-hit"]')!
    const rect = hit.getBoundingClientRect()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    let reach = -1
    for (let dy = 0; dy <= 80; dy += 1) {
      if (document.elementFromPoint(cx, cy - dy) !== hit) break
      reach = dy
    }
    return { zoom: new DOMMatrixReadOnly(getComputedStyle(scene).transform).a, reach }
  })

  const before = await measure()
  await page.keyboard.down('Control')
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.move(at(260, 260).x, at(260, 260).y)
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(30)
  }
  await page.keyboard.up('Control')
  const after = await measure()

  // 判据是缩放：两次 zoom 一样的话下面那条断言什么也证明不了。
  expect(after.zoom / before.zoom).toBeGreaterThan(3)

  // 线宽是显示宽度（AutoCAD 的 lineweight），不跟着图纸放大——否则一根 2px 的线在 4 倍下
  // 变成 8px 的色带，而用户放大恰恰是为了看清结构。容 1px 的光栅化误差。
  //
  // 下限只用来挡住「量了个零」——沿 y 扫出来的触达等于命中半宽除以线的倾角余弦，具体是几
  // 取决于这条线的角度；本条真正断言的是**放大前后不变**。
  expect(before.reach).toBeGreaterThanOrEqual(2)
  expect(Math.abs(after.reach - before.reach)).toBeLessThanOrEqual(1)
})

test('OpenSpec: materials / 曲线的盒不裁描边 / 水平线在容差内点得中', async ({ page }) => {
  const { stage } = await enterDrafting(page)

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const box = await boxOf(stage.getByTestId('stage-surface'))
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  // 水平线的紧包围盒高度被钳到 `COMPOSE_CURVE_MIN_EXTENT`，是「盒裁掉描边」最极端的一例：
  // 裁剪生效时命中区只剩几何那一条线，偏 2 个像素就点不中，而接线图里水平与垂直最常见。
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(at(120, 260).x, at(120, 260).y)
  await page.mouse.click(at(420, 260).x, at(420, 260).y)
  await page.keyboard.press('Enter')

  const reach = await page.evaluate(() => {
    const hit = document.querySelector('[data-testid="compose-material-curve-hit"]')!
    const rect = hit.getBoundingClientRect()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    let found = -1
    for (let dy = 0; dy <= 40; dy += 1) {
      if (document.elementFromPoint(cx, cy - dy) !== hit) break
      found = dy
    }
    return found
  })

  // 命中 stroke 的半宽是 COMPOSE_CURVE_PICK_TOLERANCE（屏幕像素）。裁剪生效时这个数是 0，
  // 而本条要挡的正是「盒把描边裁没了」，不是容差的具体大小。
  expect(reach).toBeGreaterThanOrEqual(2)
})
