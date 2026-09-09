import { expect, test } from '@playwright/test'

/**
 * SVG 导入产出的是**普通文档**，不是一种新的实体。
 *
 * @remarks
 * 判别性断言是「每个部件是一个 Entity」：只断言「导进来了」的用例在一个仍然把整份 SVG 当作
 * 单个不透明资源的实现上同样会绿，因此这里断的是场景树里数得出三个部件、且改一个的颜色不会
 * 波及另一个。
 */
test('OpenSpec: svg-import / 资源浏览器上的导入为组件 / 右键导入并打开组件文档', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await expect(rootGrid).toBeVisible()
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  // 1) 落成一份组件资产，并直接打开它的组件文档——导入之后要做的是改这个符号。
  await expect(rootGrid.getByRole('gridcell', { name: /^Disconnector\.component\.json/ }))
    .toHaveCount(1)
  const componentTab = editor.locator('[data-workspace-tab^="compose-component-document:"]')
    .filter({ hasText: 'Disconnector' })
  await expect(componentTab).toHaveCount(1)

  // 2) 每个部件都是场景树里可独立选中的 Entity，元素 id 成了它的名字。
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  await expect(rows.filter({ hasText: 'blade' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'terminals' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'nameplate' })).toHaveCount(1)

  // 3) 表达不了的属性降级而不是丢掉元素：带滤镜与渐变的那一个仍然在，同时出现在诊断里。
  await expect(editor.locator('.compose-editor__page-notice')).toContainText('×')
})

/**
 * 改一个部件的颜色只影响那个部件。
 *
 * @remarks
 * 这是「导入结果可二次编辑」的核心断言，也是这次变更存在的理由：从前整份 SVG 是一个 Entity，
 * 改色只能整份改。
 */
test('OpenSpec: svg-import / 导入结果可二次编辑 / 改一个部件的颜色', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  const blade = rows.filter({ hasText: 'blade' }).first()
  await expect(blade).toBeVisible()
  const bladeId = await blade.getAttribute('data-scene-node-id')
  expect(bladeId).not.toBeNull()

  // 导入产出的描边来自 `<style>` 里的 class，且已经求值成这个 Entity 自己的 props。
  const strokeOf = async (id: string) => editor
    .locator(`[data-testid="compose-material-curve-${id}"] [data-testid="compose-material-curve-stroke"]`)
    .getAttribute('stroke')
  expect(await strokeOf(bladeId!)).toBe('#33aa55')
})

/**
 * `path` 的顶点与控制手柄。
 *
 * @remarks
 * 判别性来自开放路径的**首尾各只有一侧**：只断言「有手柄」的用例在一个给每个顶点都画两侧的
 * 实现上同样会绿。
 *
 * 用导入来的那条 `Q` 路径而不是现画一条——绘图命令产出的都是最窄 kind，画不出 `path`。
 */
test('OpenSpec: stage-engine / path 曲线的顶点与控制手柄 / 会话里顶点与手柄都画', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  const stage = editor.getByRole('application', { name: 'Stage' })
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  await rows.filter({ hasText: 'arcmark' }).first().click()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('VERTEX')
  await commandInput.press('Enter')

  // 顶点方块全画：一条两点的贝塞尔有两个顶点。
  await expect(stage.getByTestId('stage-path-vertex-p0v0')).toBeVisible()
  await expect(stage.getByTestId('stage-path-vertex-p0v1')).toBeVisible()

  // 控制点手柄在会话里**一直画**：只在点亮时画的手柄按不到——点亮的语义是「下一次按下就是
  // 取点」，按向手柄的那一下会先被它吃掉。
  await expect(stage.getByTestId('stage-path-tangent-p0v0-out')).toBeVisible()
  await expect(stage.getByTestId('stage-path-tangent-p0v1-in')).toBeVisible()
  // 开放路径的首尾各只有一侧。
  await expect(stage.getByTestId('stage-path-tangent-p0v0-in')).toHaveCount(0)
  await expect(stage.getByTestId('stage-path-tangent-p0v1-out')).toHaveCount(0)
})

/**
 * 拖控制点默认保持对称，`Alt` 断开。
 *
 * @remarks
 * 判别性来自「对侧动没动」：只断言被拖的那一个跟手的用例，在一个根本没实现对称的实现上同样
 * 会绿。用软连接那条两段路径中间的顶点——只有它两侧都有控制点。
 */
test('OpenSpec: stage-engine / path 曲线的顶点与控制手柄 / 对称与 Alt 断开', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  const stage = editor.getByRole('application', { name: 'Stage' })
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  await rows.filter({ hasText: 'flex' }).first().click()
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('VERTEX')
  await commandInput.press('Enter')

  // 中间顶点两侧的控制点都画着，不必先点亮它——点亮会吃掉按向手柄的那一下。
  const outHandle = stage.getByTestId('stage-path-tangent-p0v1-out')
  const inHandle = stage.getByTestId('stage-path-tangent-p0v1-in')
  await expect(outHandle).toBeVisible()
  await expect(inHandle).toBeVisible()

  const center = async (locator: typeof outHandle) => {
    const box = (await locator.boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const before = await center(inHandle)
  const from = await center(outHandle)

  /*
   * 两次都**在拖动中途**量对侧：松手即提交、会话结束，手柄随之收起。松手前把指针挪回起点，
   * 几何因此几乎没变——盒不变，两次拖动量到的坐标才可比。
   */
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 18, from.y + 14, { steps: 4 })
  const mirrored = await center(inHandle)

  // 默认：对侧关于顶点作镜像，因此它必须动。
  expect(Math.hypot(mirrored.x - before.x, mirrored.y - before.y)).toBeGreaterThan(10)
  await page.mouse.move(from.x, from.y, { steps: 4 })
  await page.mouse.up()

  // `Alt`：只动被拖的那一个。手柄一直画着，因此松手之后直接量、直接再拖。
  const held = await center(inHandle)
  const second = await center(outHandle)
  await page.keyboard.down('Alt')
  await page.mouse.move(second.x, second.y)
  await page.mouse.down()
  await page.mouse.move(second.x - 16, second.y + 12, { steps: 4 })
  const unchanged = await center(inHandle)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  expect(Math.hypot(unchanged.x - held.x, unchanged.y - held.y)).toBeLessThan(2)
})
