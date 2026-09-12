import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * 导线每点一下就落地。
 *
 * @remarks
 * 判别点是**回车之前**：攒到结束才提交时，点了两下、三下画布上只有一条预览，场景树里什么
 * 都没有。因此每一条用例都在会话还开着的时候断言文档，而不是等它结束。
 *
 * 「仍然是**一个** Entity」同样要断：照抄 `LINE` 的逐段落地会让中间的拐点退化成两个自由端
 * 刚好重合，符号一挪接头就裂开——那正是导线不走那条路的全部理由。
 */

async function openStage(page: Page, query = '?no-auto-fit') {
  await page.goto(`/${query}`)
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  return {
    stage,
    surface,
    strokes: stage.getByTestId('compose-material-curve-stroke'),
    commandInput: stage.getByRole('combobox', { name: '命令行' }),
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    // 走 `page.mouse`：`locator.click` 的可操作性检查会认为浮在图面上的面板拦住了落点。
    click: async (x: number, y: number) => {
      const box = (await surface.boundingBox())!
      await page.mouse.click(box.x + x, box.y + y)
    },
  }
}

/**
 * 图上那条曲线的顶点数。
 *
 * @remarks
 * 两个顶点渲染成 `<line>`、三个及以上渲染成 `<polyline>`，因此顶点数要按标签分派着读——
 * 只读 `points` 会在两顶点那一档拿到空列表。
 */
async function vertexCount(strokes: Locator) {
  return strokes.first().evaluate((node) => (
    node.tagName.toLowerCase() === 'line'
      ? 2
      : (node as unknown as SVGPolylineElement).points.numberOfItems
  ))
}

test('OpenSpec: stage / 会话把已落地的几何扩到同一个 Entity 上 / 第二个点落下时它就在图上', async ({ page }) => {
  const { strokes, commandInput, click } = await openStage(page)

  await commandInput.fill('W')
  await commandInput.press('Enter')

  await click(100, 120)
  // 一个点的导线画不出来，也没有第二端可言。
  await expect(strokes).toHaveCount(0)

  await click(300, 120)
  // 判别点：**回车之前**它就在文档里。攒到结束才提交时这里是 0。
  await expect(strokes).toHaveCount(1)
  expect(await vertexCount(strokes)).toBe(2)

  await click(300, 280)
  // 仍然是**一个** Entity，只是多了一个顶点——逐段落地会在这里得到两条。
  await expect(strokes).toHaveCount(1)
  expect(await vertexCount(strokes)).toBe(3)

  await page.keyboard.press('Enter')
  await expect(strokes).toHaveCount(1)
  await commandInput.press('Escape')
})

test('OpenSpec: stage / 命令会话的参考点跟着文档走 / 撤销之后导线的顶点数与会话一致', async ({ page }) => {
  const { strokes, commandInput, click } = await openStage(page)

  await commandInput.fill('W')
  await commandInput.press('Enter')
  await click(100, 120)
  await click(300, 120)
  await click(300, 280)
  expect(await vertexCount(strokes)).toBe(3)

  // 撤销撤掉的是最后那一次几何写入，Entity 并没有消失——只判存在的实现在这里读不出变化。
  await page.keyboard.press('Control+z')
  await expect.poll(() => vertexCount(strokes)).toBe(2)

  await click(460, 140)
  // 会话跟着回退了一个点，因此这一下是第三个顶点；没回退的话它是第四个。
  await expect.poll(() => vertexCount(strokes)).toBe(3)
  await commandInput.press('Escape')
  await commandInput.press('Escape')
})

test('OpenSpec: stage / 会重开的命令与两级 Escape / 放弃这一条时线也消失', async ({ page }) => {
  const { strokes, commandInput, prompt, click } = await openStage(page)

  await commandInput.fill('W')
  await commandInput.press('Enter')
  await click(100, 120)
  await click(300, 120)
  await expect(strokes).toHaveCount(1)

  await commandInput.press('Escape')
  // 「放弃这一条」在屏幕上必须是这条线消失，而不是留下半条。
  await expect(strokes).toHaveCount(0)
  // 第一级只放弃这一条：命令留着，提示回到第一步。
  await expect(prompt).toContainText('指定第一点')

  await commandInput.press('Escape')
  // 第二级退出整条命令：这一下之后提示不再问下一个点。
  await expect(prompt).toContainText('已取消')
  await expect(prompt).not.toContainText('指定第一点')
})

test('OpenSpec: stage / 会话把已落地的几何扩到同一个 Entity 上 / 中途路过另一条导线不建节点', async ({ page }) => {
  // 接入要真的走一遍捕捉，因此用默认路由（自动适配把场景缩进图面，缩放不是 100%）。
  const { stage, commandInput } = await openStage(page, '')
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect.poll(() => frame.boundingBox()).not.toBeNull()
  const box = (await frame.boundingBox())!
  const at = (x: number, y: number) => ({
    x: Math.round(box.x + x),
    y: Math.round(box.y + y),
  })

  const lines = stage.locator('line[data-testid="compose-material-curve-stroke"]')
  const polylines = stage.locator('polyline[data-testid="compose-material-curve-stroke"]')
  const junctions = stage.locator('polygon[data-testid="compose-material-curve-stroke"]')

  // 1) 一条水平导线。
  const left = at(80, 200)
  const right = at(320, 200)
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(left.x, left.y)
  await page.mouse.click(right.x, right.y)
  await stage.press('Enter')
  await stage.press('Escape')
  await expect(lines).toHaveCount(1)

  // 2) 第二条**穿过**它：中间那一下落在线身上，但随后继续走。
  const cross = at(200, 200)
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(cross.x, cross.y - 100)
  await page.mouse.move(cross.x, cross.y)
  await expect(stage.getByTestId('stage-drafting-tap-target')).toHaveCount(1)
  await page.mouse.click(cross.x, cross.y)
  await page.mouse.click(cross.x, cross.y + 100)
  await stage.press('Enter')
  await stage.press('Escape')

  // 路过不是接线意图：先接上再走开会留下一个谁也没接的孤儿节点，而它已经把对方切成了两段。
  await expect(junctions).toHaveCount(0)
  await expect(lines).toHaveCount(1)
  await expect(polylines).toHaveCount(1)

  // 3) 最后一个点落在它上面：这一下才是接线。
  const tap = at(140, 200)
  await commandInput.fill('WIRE')
  await commandInput.press('Enter')
  await page.mouse.click(tap.x, tap.y + 120)
  await page.mouse.move(tap.x, tap.y)
  await expect(stage.getByTestId('stage-drafting-tap-target')).toHaveCount(1)
  await page.mouse.click(tap.x, tap.y)
  await stage.press('Enter')
  await stage.press('Escape')

  await expect(junctions).toHaveCount(1)
  // 被接入的那条断成两段，加上新画的这一条。
  await expect(lines).toHaveCount(3)
})
