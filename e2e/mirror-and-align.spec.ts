import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** 用键入坐标画一条线，几何因此精确已知、不受吸附与角度约束影响。 */
async function drawLine(
  commandInput: Locator,
  from: { x: number, y: number },
  to: { x: number, y: number },
) {
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await commandInput.fill(`${from.x},${from.y}`)
  await commandInput.press('Enter')
  await commandInput.fill(`${to.x},${to.y}`)
  await commandInput.press('Enter')
  await commandInput.press('Escape')
}

function setup(page: Page) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  return {
    editor,
    stage,
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    inspector: editor.locator('[data-workspace-panel="inspector"]'),
  }
}

/** 属性面板里的位置读数；几何断言读文档值而不是屏幕像素。 */
async function geometry(inspector: Locator) {
  return inspector.getByRole('spinbutton').evaluateAll((nodes) => Object.fromEntries(
    nodes
      .map((element) => [
        element.getAttribute('aria-label') ?? '',
        Number((element as HTMLInputElement).value),
      ])
      .filter(([label]) => typeof label === 'string' && /^(位置|尺寸)/.test(label as string)),
  ))
}

/**
 * `MIRROR` 把一条斜线翻到轴的另一侧。
 *
 * @remarks
 * 判别性来自**斜线**与**两端各自落点**：轴对齐的线镜像之后包围盒不变，一个只改位置不改几何
 * 的实现同样会绿；而一条斜线镜像之后两端要各自换边。
 *
 * 轴取一条**竖直**线：这正是接线图上最常见的那一次镜像（把刀闸翻到母线另一侧）。
 */
test('OpenSpec: stage-engine / MIRROR 命令 / 斜线按竖直轴翻到另一侧', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const { stage, commandInput, inspector } = setup(page)
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  // 一条从左上到右下的斜线：盒 [200,300]×[100,160]。
  await drawLine(commandInput, { x: 200, y: 100 }, { x: 300, y: 160 })
  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  await stroke.click({ force: true })
  const before = await geometry(inspector)
  expect(before['位置 X']).toBe(200)

  // 轴过 x = 400 的竖直线：盒 [200,300] 镜像之后落在 [500,600]。
  await commandInput.fill('MIRROR')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('镜像轴')
  await commandInput.fill('400,0')
  await commandInput.press('Enter')
  await commandInput.fill('400,200')
  await commandInput.press('Enter')

  await expect.poll(async () => (await geometry(inspector))['位置 X']).toBe(500)
  const after = await geometry(inspector)
  // 尺寸是等距变换的不变量。
  expect(after['尺寸 宽']).toBe(before['尺寸 宽'])
  expect(after['尺寸 高']).toBe(before['尺寸 高'])
  expect(after['位置 Y']).toBe(before['位置 Y'])

  /*
   * 两端各自换边：镜像之后左端在**下**。只断盒的话，一个原样平移过去的实现同样会绿——
   * 因此读实际画出来的那条线的两个端点。
   */
  const endpoints = await stroke.evaluate((element) => {
    const line = element as SVGLineElement
    const matrix = line.getScreenCTM()!
    const map = (x: number, y: number) => {
      const point = new DOMPoint(x, y).matrixTransform(matrix)
      return { x: point.x, y: point.y }
    }
    return [
      map(line.x1.baseVal.value, line.y1.baseVal.value),
      map(line.x2.baseVal.value, line.y2.baseVal.value),
    ]
  })
  const [left, right] = endpoints[0]!.x < endpoints[1]!.x
    ? [endpoints[0]!, endpoints[1]!]
    : [endpoints[1]!, endpoints[0]!]
  expect(left.y).toBeGreaterThan(right.y)

  // 撤销一步整条回来：几何、位置与角度共享一个 mergeKey。
  await stage.press('Control+Z')
  await expect.poll(async () => (await geometry(inspector))['位置 X']).toBe(200)
})

/**
 * 对齐取选区整体包围盒，分布保持两端。
 *
 * @remarks
 * 判别性有两处：**换个顺序选中结果相同**（取「最先选中那一个」为基准的实现在这里失败），
 * 以及**两端不动**（把整排重新铺开的实现在这里失败）。
 *
 * 三条线的宽度刻意不等——等宽时「按中心等距」与「按间隙等距」给出同一个答案。
 */
test('OpenSpec: stage-engine / 对齐与分布 / 左对齐与水平等距', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const { stage, commandInput } = setup(page)
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  // 宽度 40 / 100 / 20，三条各在一行上。
  await drawLine(commandInput, { x: 100, y: 100 }, { x: 140, y: 100 })
  await drawLine(commandInput, { x: 220, y: 200 }, { x: 320, y: 200 })
  await drawLine(commandInput, { x: 500, y: 300 }, { x: 520, y: 300 })
  const strokes = stage.getByTestId('compose-material-curve-stroke')
  await expect(strokes).toHaveCount(3)

  const leftOf = async (index: number) => Math.round((await strokes.nth(index).boundingBox())!.x)
  const origin = await Promise.all([leftOf(0), leftOf(1), leftOf(2)])

  /*
   * 逐条点选而不是 `Control+A`：画完之后焦点在命令行里，那一下会被输入框解释成「全选文本」。
   * 线是细的，因此 `force`——命中容差只有几个像素，Playwright 的可操作性检查在这里过不去。
   */
  const selectInOrder = async (order: readonly number[]) => {
    await strokes.nth(order[0]!).click({ force: true })
    for (const index of order.slice(1)) {
      await strokes.nth(index).click({ force: true, modifiers: ['Shift'] })
    }
  }

  await selectInOrder([0, 1, 2])
  await commandInput.fill('ALIGNLEFT')
  await commandInput.press('Enter')
  // 包围盒左边是第一条的 100，三条全部贴到那里。
  await expect.poll(() => leftOf(2)).toBe(origin[0])
  expect(await Promise.all([leftOf(0), leftOf(1), leftOf(2)]))
    .toEqual([origin[0], origin[0], origin[0]])

  // 一步撤销全部回来：三条的位移写在同一条变换命令里。
  await stage.press('Control+Z')
  await expect.poll(() => leftOf(2)).toBe(origin[2])
  expect(await Promise.all([leftOf(0), leftOf(1)])).toEqual([origin[0], origin[1]])

  /*
   * 水平等距：两端不动，中间按**边到边的间隙**摊开。
   * 跨度 420，三条宽度共 160，两条间隙各 130，因此中间那条落在 100 + 40 + 130 = 270。
   *
   * 选区沿用上一步的：撤销不清选区，而重新逐条点选会踩上「点一个已经在选区里的成员不收敛
   * 选区」那条既有规则——这里要验的不是选择语义。基准与选择顺序无关由单测钉住
   * （`planStageAlignment` 正序与倒序逐字相等），它在那里断得更干净。
   */
  await commandInput.fill('DISTRIBUTEX')
  await commandInput.press('Enter')
  await expect.poll(() => leftOf(1)).toBe(origin[0] + 40 + 130)
  expect(await leftOf(0)).toBe(origin[0])
  expect(await leftOf(2)).toBe(origin[2])
})

/**
 * 选区不足时**说出来**。
 *
 * @remarks
 * 「敲了没反应」与敲错字在屏幕上无法区分——这与 `VERTEX` 的「候选不是恰好一个」是同一条。
 */
test('OpenSpec: stage-engine / 对齐与分布 / 选区不足时说明', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const { stage, commandInput } = setup(page)
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  await drawLine(commandInput, { x: 100, y: 100 }, { x: 140, y: 100 })
  await stage.getByTestId('compose-material-curve-stroke').click({ force: true })

  await commandInput.fill('ALIGNLEFT')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('至少需要选中 2')

  await commandInput.fill('DISTRIBUTEX')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('至少需要选中 3')
})
