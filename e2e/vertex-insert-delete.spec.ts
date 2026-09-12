import { expect, test } from '@playwright/test'

/**
 * 几何编辑会话内插入与删除顶点。
 *
 * @remarks
 * 顶点数今天是创建那一刻定死的：`RECTANGLE` 画出来的永远是四个角。判别点因此是**顶点数
 * 真的变了**，而且新的那一个落在被双击的那条边上——只断「还能拖动」的用例在一个什么都没插
 * 的实现上同样会绿。
 *
 * 双击的位置要避开**段中点夹点**：它就坐在每条边的正中，那一下会被它接管、开成一次段平移。
 * 因此落在边的 25% 处。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */
test('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 矩形边上加点再删掉', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 320).x, at(440, 320).y)
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')

  // 盒内部双击进几何编辑：四个角顶点。
  await page.mouse.dblclick(at(340, 260).x, at(340, 260).y)
  const vertices = stage.locator('[data-testid^="stage-path-vertex-hit-v"]')
  await expect(vertices).toHaveCount(4)

  /*
   * 在上边的 25% 处双击：落点在段上、离段中点夹点与两个角顶点都足够远。
   *
   * 边的位置从**量到的**顶点算而不是写死落笔坐标：落笔点会被网格吸附挪动最多半格，而这条
   * 用例跑在非 100% 缩放下。
   */
  const cornerOf = async (id: string) => {
    const rect = (await stage.getByTestId(`stage-path-vertex-hit-${id}`).boundingBox())!
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  }
  const v0 = await cornerOf('v0')
  const v1 = await cornerOf('v1')
  const quarter = { x: v0.x + (v1.x - v0.x) * 0.25, y: v0.y + (v1.y - v0.y) * 0.25 }
  await page.mouse.dblclick(quarter.x, quarter.y)

  /*
   * 五个顶点，新的那一个**排在被双击的那条边上**、在两个角之间。
   *
   * 断的是「落在这条边上」而不是「逐像素等于光标」：落点走与拖夹点同一条解算，因此它会被
   * 网格吸走最多半格——那正是这条要求的内容，不是误差。
   */
  await expect(vertices).toHaveCount(5)
  const inserted = await cornerOf('v1')
  expect(inserted.y).toBeCloseTo(v0.y, 0)
  expect(inserted.x).toBeGreaterThan(v0.x)
  expect(inserted.x).toBeLessThan(v1.x)
  expect(Math.abs(inserted.x - quarter.x)).toBeLessThan(8)

  // 它是真的顶点：拖走之后形状跟着变。
  await page.mouse.move(inserted.x, inserted.y)
  await page.mouse.down()
  await page.mouse.move(inserted.x, inserted.y - 70, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await cornerOf('v1')).y).toBeLessThan(inserted.y - 40)

  // 一步撤销回到四顶点：插入与拖动各是一条 `entity.curve.set`。
  await stage.press('Control+Z')
  await expect.poll(async () => (await cornerOf('v1')).y).toBeCloseTo(inserted.y, 0)

  /*
   * 点亮那个顶点再按 `Delete`：一步没动的按下把会话留着、夹点点亮，这一档 `Delete` 删的是
   * 顶点而不是整个 Entity。
   */
  /*
   * 等过一次连击间隔再点亮：上一次按下就落在几乎同一个位置上，浏览器会把这一下算进那条
   * 连击里，而**连击中的那一下刻意不点亮**（第三下常常落在刚显形、正压在光标底下的夹点上）。
   * 这里要的是一次独立的按下，因此必须真的把两次手势分开。
   */
  await page.waitForTimeout(700)
  const armed = await cornerOf('v1')
  await page.mouse.move(armed.x, armed.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(stage.getByTestId('stage-path-vertex-v1')).toHaveAttribute('data-vertex-hot')
  await page.keyboard.press('Delete')
  await expect(vertices).toHaveCount(4)
  // 删的是顶点不是对象：曲线还在。
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)
})

/**
 * 没有夹点被作用着时 `Delete` 仍然删掉整个 Entity。
 *
 * @remarks
 * 这是分级的另一半，两条缺一不可：只断前一半的用例，在一个把 `Delete` 无条件改写成删顶点的
 * 实现上同样会绿——而那样的话，几何编辑会话里就再也删不掉整条曲线，屏幕上还没有任何东西说明
 * 为什么。
 */
test('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 没点亮夹点时 Delete 删整个对象', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('R')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(440, 320).x, at(440, 320).y)
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')

  await page.mouse.dblclick(at(340, 260).x, at(340, 260).y)
  await expect(stage.locator('[data-testid^="stage-path-vertex-hit-v"]')).toHaveCount(4)

  await page.keyboard.press('Delete')
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(0)
})

/**
 * 弧不受理，并且**说出来**。
 *
 * @remarks
 * 判别点是命令行那一行：静默不动与敲错在屏幕上无法区分，而弧根本没有顶点可插。
 */
test('OpenSpec: stage-engine / 几何编辑会话内插入与删除顶点 / 弧上双击说明它没有顶点', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('ARC')
  await commandInput.press('Enter')
  await page.mouse.click(at(240, 300).x, at(240, 300).y)
  await page.mouse.click(at(340, 220).x, at(340, 220).y)
  await page.mouse.click(at(440, 300).x, at(440, 300).y)
  await expect(prompt).toContainText('命令：')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)

  /*
   * 取弧上四分之一处的一点。按包围盒估算是够不着的——弧上哪个 y 对应哪个 x 要解方程；
   * 而 `getPointAtLength` 加 `getScreenCTM` 直接给出这条描边自己的客户端坐标。
   *
   * 取 25% 而不是弧顶：弧顶正是 `mid` 夹点所在，那一下会被它接管、开成一次改半径的会话。
   */
  const onArc = await stroke.evaluate((element) => {
    const path = element as SVGPathElement
    const point = path.getPointAtLength(path.getTotalLength() * 0.25)
    const screen = point.matrixTransform(path.getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.click(onArc.x, onArc.y)
  await page.mouse.dblclick(onArc.x, onArc.y)
  await expect(stage.getByTestId('stage-editable-path')).toHaveCount(1)

  await page.mouse.dblclick(onArc.x, onArc.y)
  await expect(prompt).toContainText('圆弧没有顶点')
})
