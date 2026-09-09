import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * `POLYGON` 的纵向流程。
 *
 * 落点都收在 500×450 以内：默认视口下图面只有 566×537，再往外就落到右侧面板上了，而症状是
 * 「这一下什么都没发生」，与命令坏掉无法区分。
 */
async function openStage(page: Page) {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  // 命中与几何相关的断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`，zoom 恒为 1
  // 时漏乘 zoom 也看不出来。首次进入的自动取景已经把缩放压到 100% 以下。
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')
  const box = (await surface.boundingBox())!
  return {
    editor,
    stage,
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    stroke: stage.getByTestId('compose-material-curve-stroke'),
    click: (x: number, y: number) => page.mouse.click(box.x + x, box.y + y),
    move: (x: number, y: number) => page.mouse.move(box.x + x, box.y + y),
  }
}

/** 顶点数：闭合多段线渲染成一个 `<polygon>`，`points` 里有几对就是几个顶点。 */
async function vertexCount(stroke: Locator) {
  const points = await stroke.getAttribute('points')
  return points!.trim().split(/\s+/).length
}

/** 场景的平移量；判断滚轮有没有落到视口上。 */
async function sceneOffset(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform)
    return { x: matrix.e, y: matrix.f }
  })
}

test('OpenSpec: stage-engine / POLYGON 命令画正多边形 / 三步取值落地成闭合多段线', async ({ page }) => {
  const { editor, prompt, commandInput, stroke, click } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  // 默认值印在尖括号里：那正是「记住上一次用了几条边」这条记忆能够成立的前提。
  await expect(prompt).toContainText('输入边数或指定中心点 <6>')

  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定中心点')
  await click(250, 250)
  await expect(prompt).toContainText('指定内接圆半径')

  await click(350, 250)

  // 场景树零改动即可见——多边形是普通的闭合多段线，不另立类型。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Curve' })).toHaveCount(1)
  await expect(stroke).toHaveCount(1)
  expect(await vertexCount(stroke)).toBe(6)
})

/*
 * 闭合图形占据的就是它盒里那块面积，因此走与矩形、图片、容器完全相同的一套。判别点是**同时**
 * 断「有盒有手柄」与「没有圆角手柄」——后者的判据（`Composition.presetId`）与本条正交，
 * 一起放宽会让六边形多出六个用户不打算碰的点。
 */
test('OpenSpec: stage / 闭合曲线的选中呈现走盒那一套 / 多边形选中画盒', async ({ page }) => {
  const { editor, stage, commandInput, stroke, click } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await click(250, 250)
  await click(350, 250)

  /*
   * 点**最左**那个顶点。不能点最右——六边形的首顶点就落在刚才那个半径落点上，同一个像素上
   * 紧接着的第二下会被浏览器算成 `detail=2`，直接进几何编辑，而那一档盒与手柄本来就该让位。
   * 空心图形只有描边可点，因此落点必须压在顶点上。
   */
  const bb = (await stroke.boundingBox())!
  await page.mouse.click(bb.x + 1, bb.y + bb.height / 2)
  await expect(editor.getByRole('region', { name: 'Curve 属性', exact: true })).toBeVisible()

  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(stage.getByTestId('stage-resize-nw')).toHaveCount(1)
  await expect(stage.getByTestId('stage-selection-outline')).toHaveCount(0)
  await expect(stage.locator('[data-testid^="stage-curve-corner-"]')).toHaveCount(0)
})

test('OpenSpec: stage-engine / POLYGON 命令画正多边形 / 外切档同一落点画得更大', async ({ page }) => {
  const { prompt, commandInput, stroke, click } = await openStage(page)

  const draw = async (circumscribed: boolean) => {
    await commandInput.fill('POL')
    await commandInput.press('Enter')
    // 档位在**第一步**换：和边数一起问、一起印在光标旁，此后一路跟到提交。
    if (circumscribed) {
      await commandInput.fill('C')
      await commandInput.press('Enter')
    }
    await commandInput.press('Enter')
    await click(250, 250)
    await expect(prompt).toContainText(circumscribed ? '指定外切圆半径' : '指定内接圆半径')
    await click(350, 250)
  }

  await draw(false)
  const inscribed = (await stroke.first().boundingBox())!

  await draw(true)
  const circumscribed = (await stroke.nth(1).boundingBox())!

  /*
   * 判别点是**同一个落点画出不同的形状**：只断言「画出来了」两档都会绿。
   *
   * 看的必须是**高**而不是宽：落点在中心正右方时，内接的六边形有顶点落在 0° 与 180°，宽正好
   * 是 2R；外切的顶点转到 ±30°、外接圆放大 1/cos30°，宽算出来还是 2R——两者逐像素相同。
   * 高才分得开（1.73R 对 2.31R）。拿宽来断言会得到一条看似合理、实则永远分不出两档的用例。
   */
  expect(circumscribed.height).toBeGreaterThan(inscribed.height * 1.2)

  /*
   * 档位跨命令记住：原先「不跨命令记忆」的判据是**那份状态看不见**，而它挪到第一步、印成
   * 光标旁的胶囊之后那条理由不再成立。这一版更需要它——档位在第一步就定死，选错只能重来。
   */
  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await click(250, 250)
  await expect(prompt).toContainText('指定外切圆半径')
})

/*
 * 这一版真正要钉住的那条：后两步**收干净了**。半个残留最糟——列不出来却仍然受理，等于留一条
 * 只有读过源码的人才知道的暗门。因此断的是「按了也不起作用」而不只是「没列出来」。
 */
test('OpenSpec: stage-engine / POLYGON 命令画正多边形 / 半径步按 Tab 与敲 C 都不改变形状', async ({ page }) => {
  const { prompt, commandInput, stroke, click, move } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await click(250, 250)
  await expect(prompt).toContainText('指定内接圆半径')
  await move(350, 250)

  await commandInput.press('Tab')
  await commandInput.fill('C')
  await commandInput.press('Enter')
  // `C` 在这一步不是关键字，因此掉进「需要一个点」——它被**拒绝**了，而不是静默地生效。
  await expect(prompt).toContainText('需要一个点')

  await click(350, 250)
  const drawn = (await stroke.boundingBox())!

  // 再画一个没按过那两下的，逐像素相同即证明它们确实什么都没做。
  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await click(250, 250)
  await click(350, 250)
  const plain = (await stroke.nth(1).boundingBox())!
  expect(plain.width).toBeCloseTo(drawn.width, 1)
  expect(plain.height).toBeCloseTo(drawn.height, 1)
})

/*
 * 键入的值是**这一步的待定值**，而不是一句还没敲完的命令：结束这一步的那次输入必须把它带上。
 * 判别点是顶点数——框上写着 4、落地却是六边形，是屏幕上写着一件事、做的是另一件事。
 */
test('OpenSpec: stage / 光标旁的档位胶囊 / 键入的值不必按回车确认', async ({ page }) => {
  const { stage, prompt, commandInput, stroke, click, move } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await move(300, 260)
  // 只键入，不按回车。
  await commandInput.fill('4')
  await expect(stage.getByTestId('stage-dynamic-input-field-0')).toContainText('4')

  await click(300, 260)
  await expect(prompt).toContainText('4 边')
  await click(380, 260)
  expect(await vertexCount(stroke)).toBe(4)
})

test('OpenSpec: stage / 光标旁的档位胶囊 / 边数与档位并排，Tab 换档', async ({ page }) => {
  const { stage, prompt, commandInput, stroke, click, move } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await move(300, 260)

  const value = stage.getByTestId('stage-dynamic-input-field-0')
  const chip = stage.getByTestId('stage-dynamic-input-field-1')
  await expect(value).toContainText('6')
  await expect(chip).toContainText('内接')

  await commandInput.press('Tab')
  await expect(chip).toContainText('外切')
  // 命令行只列能切过去的那一个，两处读的是同一份事实。
  await expect(prompt).toContainText('内接(I)')

  await commandInput.press('Enter')
  await click(280, 260)
  await expect(prompt).toContainText('指定外切圆半径')
  await click(360, 260)
  expect(await vertexCount(stroke)).toBe(6)
})

/*
 * 十字光标在第一步是画着的，让它真的能落点比把它画成装饰要好——「鼠标动了也没反应」是屏幕上
 * 不该出现的状态。判别点是**那一下就是中心**，而不只是「进到了下一步」。
 */
test('OpenSpec: stage-engine / POLYGON 命令画正多边形 / 第一步点一下即以那一下为中心', async ({ page }) => {
  const { stage, prompt, commandInput, stroke, click } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await click(250, 250)
  await expect(prompt).toContainText('指定内接圆半径')
  await click(350, 250)

  const box = (await stroke.boundingBox())!
  const surface = (await stage.getByTestId('stage-surface').boundingBox())!
  // 中心落在第一下点的地方：包围盒的中心就是它。判别点在这里，而不是「进到了下一步」。
  // 容差放到半个网格步长之上：落点先在世界坐标里吸到网格，再按非 100% 的缩放投影回屏幕，
  // 中心离点击处最多差 zoom × 步长 / 2 像素，而这个数随图面尺寸（自动取景的缩放）变。
  expect(Math.abs(box.x + box.width / 2 - surface.x - 250)).toBeLessThan(4)
  expect(Math.abs(box.y + box.height / 2 - surface.y - 250)).toBeLessThan(4)
})

test('OpenSpec: stage / 修饰键滚轮在命令进行中增减数值 / Alt 加滚轮改边数，裸滚轮仍平移', async ({ page }) => {
  const { prompt, commandInput, stroke, click, move } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.press('Enter')
  await click(250, 250)
  await move(350, 250)

  // 裸滚轮照常平移：命令进行中仍要能去看远处那个点，这与「取点接管排在画布平移之下」同判。
  const start = await sceneOffset(page)
  await page.mouse.wheel(0, -120)
  await expect(prompt).toContainText('6 边')
  const panned = await sceneOffset(page)
  expect(panned.y).not.toBe(start.y)

  await page.keyboard.down('Alt')
  await page.mouse.wheel(0, -100)
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Alt')
  await expect(prompt).toContainText('8 边')
  // 判别点：这两下**只**改了边数——视口一动不动，说明它们没有落到画布导航上。
  expect(await sceneOffset(page)).toEqual(panned)

  await click(350, 250)
  expect(await vertexCount(stroke)).toBe(8)
})

test('OpenSpec: stage / 只要文本的一步由命令行原样交给会话 / 边数越界被拒绝且不结束会话', async ({ page }) => {
  const { prompt, commandInput } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  await commandInput.fill('2000')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('边数必须是 3 到 1024 之间的整数')

  // 拒绝不结束会话：打错一个数不该让已经走完的步骤重来。
  await commandInput.fill('5')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定中心点')
})


test('OpenSpec: stage / 光标旁的档位胶囊 / 边数不必回命令行看', async ({ page }) => {
  const { stage, commandInput, click, move } = await openStage(page)

  await commandInput.fill('POL')
  await commandInput.press('Enter')
  // 指针还没进过图面时不画：位置无从得知，先不画严格好过画在错误的地方再跳过去。
  await expect(stage.getByTestId('stage-dynamic-input-field-0')).toHaveCount(0)

  await move(300, 260)
  const badge = stage.getByTestId('stage-dynamic-input-field-0')
  await expect(badge).toHaveCount(1)
  await expect(badge).toContainText('6')

  // 正在键入时印缓冲：输入端仍然只有命令行一个，光标旁这个框只渲染。
  await commandInput.fill('9')
  await expect(badge).toContainText('9')

  await commandInput.press('Enter')
  // 走到中心步之后换回取点那条路：第 1 个框是 Y 坐标而不是胶囊，档位到这里就收干净了。
  await move(300, 260)
  await expect(
    stage.getByTestId('stage-dynamic-input-field-1').locator('.compose-stage__dynamic-input-box'),
  ).toHaveAttribute('data-variant', 'value')

  await click(300, 260)
  await click(380, 260)
  expect(await vertexCount(stage.getByTestId('compose-material-curve-stroke'))).toBe(9)
})
