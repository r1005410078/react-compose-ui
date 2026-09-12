import { expect, test } from '@playwright/test'
import { enterAnimationEditing } from './support/test-helpers'

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

/**
 * 导入来的部件走既有的关键帧轨道与 `Transform.pivot`。
 *
 * @remarks
 * 这条与 `rotation-pivot.spec.ts` 是同一句断言的两个起点——那一条画一条线，这一条从 SVG 导进
 * 一个刀闸，「导入产物与手画的走完全相同的编辑路径」正是这次变更的主张。
 *
 * 判别性全在**转 180°** 上：绕盒中心转 180° 会把盒映射回它自己（一条线在屏幕上逐像素不变，
 * 位置也不变），绕铰点转则把盒整个搬到铰点的另一侧。因此一条等式同时挡掉两种坏实现——根本
 * 没转的，和绕盒中心转的。
 *
 * 刀身是 (80,180) → (124,76) 的一条线，铰点 (80,180) 落在它紧包围盒的**左下角**，因此基点
 * 取 `bottom-left`；量的是 Entity 自己的盒而不是描边，圆头端点的外扩不进来。
 */
test('OpenSpec: svg-import / 导入结果可二次编辑 / 给刀身刻角度帧绕铰点摆动', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  const stage = editor.getByRole('application', { name: 'Stage' })
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  const blade = rows.filter({ hasText: 'blade' }).first()
  await expect(blade).toBeVisible()
  await blade.click()
  const bladeId = (await blade.getAttribute('data-scene-node-id'))!
  const node = stage.locator(`[data-entity-id="${bladeId}"]`)
  await expect(node).toHaveCount(1)

  // 1) 基点设到铰点。默认基点是盒中心，用默认值写的用例两种实现都能通过。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('combobox', { name: '旋转基点' }).selectOption('bottom-left')

  // 2) 0 ms 刻 0°、200 ms 刻 180°，走的是既有的自动记录。
  await enterAnimationEditing(editor)
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：旋转' })).toBeVisible()

  const timeline = animationPanel.getByRole('slider', { name: '当前时间' })
  await timeline.fill('200')
  const rotation = inspector.getByRole('spinbutton', { name: '旋转' })
  await rotation.fill('180')
  await rotation.press('Enter')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()

  // 3) 铰点不动：转 180° 之后，盒的右边沿落在原来的左边沿上、上边沿落在原来的下边沿上。
  await timeline.fill('0')
  await expect.poll(async () => (await node.boundingBox())!.y).not.toBeNaN()
  const flat = (await node.boundingBox())!

  await timeline.fill('200')
  await expect.poll(async () => Math.round((await node.boundingBox())!.x))
    .toBeLessThan(Math.round(flat.x) - 8)
  const swung = (await node.boundingBox())!

  expect(swung.x + swung.width).toBeCloseTo(flat.x, 0)
  expect(swung.y).toBeCloseTo(flat.y + flat.height, 0)
})

/**
 * 导入来的符号走既有的 `Ports` 与导线绑定。
 *
 * @remarks
 * 与 `symbol-wires.spec.ts` 是同一句断言的两个起点：那一条给手画的矩形挂端口，这一条给导入
 * 来的**组件根**挂端口，再放一个实例。实例的端口是从离线快照读出来的而不是复制的，因此这条
 * 同时钉住「组件根上声明一次，全部实例都有」。
 *
 * 判别性是**两端各断一次**：只断「绑定端跟着走」的用例，在一个把整条线一起平移的实现上同样
 * 会绿；自由端必须一动不动。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */
test('OpenSpec: svg-import / 导入结果可二次编辑 / 组件根挂端口后实例接线并跟随', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^Disconnector\.svg/ }).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: '导入为组件', exact: true }).click()

  // 1) 组件文档里给**根**挂一个端口。默认端口落在 Entity 局部原点，也就是符号的左上角。
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  await expect(rows.filter({ hasText: 'blade' })).toHaveCount(1)
  await rows.first().click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()
  await stage.press('Control+S')

  // 2) 回页面放一个实例：端口从离线快照读出来，实例这一侧什么都不用配。
  await editor.locator('[data-workspace-tab]').filter({ hasText: 'Home' }).first().click()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加主组件 Disconnector' }).click()
  const instance = stage.locator('[data-testid^="stage-entity-"]').last()
  const instanceId = (await instance.getAttribute('data-testid'))!
  const symbol = stage.getByTestId(instanceId)
  await expect(symbol.getByTestId('compose-component-instance-content')).toBeVisible()
  const beforeSymbol = (await symbol.boundingBox())!

  /*
   * 导线要按**新出现的那个 Entity** 认，不能拿描边总数或 `.last()`：符号自己就含四条
   * `<line>`（两根引线、静触头、刀身），它们同样是曲线描边，拿总数会把它们算进来。
   */
  const entityIds = () => stage.locator('[data-testid^="stage-entity-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')!))
  const beforeIds = await entityIds()

  // 3) `LINE` 起点捕捉到端口，终点落在右下方的空白处。
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await page.mouse.click(beforeSymbol.x, beforeSymbol.y)
  await page.mouse.click(beforeSymbol.x + 200, beforeSymbol.y + 150)
  await commandInput.press('Enter')
  // `LINE` 连续取点：不退出的话，下一步按在符号上的指针会被取点插件吃掉。
  await stage.press('Escape')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')

  const wireId = (await entityIds()).find((id) => !beforeIds.includes(id))!
  expect(wireId).toBeTruthy()
  const stroke = stage.getByTestId(wireId).locator('line[data-testid="compose-material-curve-stroke"]')
  await expect(stroke).toHaveCount(1)
  const beforeWire = (await stroke.boundingBox())!

  // 4) 把符号拖走。实例不是空心曲线，盒内部本来就可点可拖。
  const dragFrom = {
    x: beforeSymbol.x + beforeSymbol.width * 0.5,
    y: beforeSymbol.y + beforeSymbol.height * 0.7,
  }
  await page.mouse.move(dragFrom.x, dragFrom.y)
  await page.mouse.down()
  await page.mouse.move(dragFrom.x - 90, dragFrom.y + 70, { steps: 8 })
  await page.mouse.up()

  const afterSymbol = (await symbol.boundingBox())!
  const moved = { x: afterSymbol.x - beforeSymbol.x, y: afterSymbol.y - beforeSymbol.y }
  expect(moved.x).toBeLessThan(-20)

  // 绑定端跟着走——求解不存储，作者文档里那份几何一个字没改。
  await expect.poll(async () => (await stroke.boundingBox())!.x)
    .toBeCloseTo(beforeWire.x + moved.x, 0)
  const afterWire = (await stroke.boundingBox())!
  // 自由端一动不动：右下角还在原处。
  expect(afterWire.x + afterWire.width).toBeCloseTo(beforeWire.x + beforeWire.width, 0)
})
