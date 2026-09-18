import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { pointerDrop, enterAnimationEditing, exitAnimationEditing, stableBox } from './support/test-helpers'

/**
 * 从基础图形到嵌套组件动画的完整纵向流程。
 *
 * @remarks
 * 这条用例把「画元件 → 编组 → 提取组件 → 嵌套第二层 → 打关键帧」串成一条。每一步单独都有
 * 用例，接缝没有——而接缝正是最容易坏的地方：曲线是 `stage-engine` 的产物、编组是编辑器动作、
 * 提取走资源 Store、实例渲染在 `materials`、动画轨道住 `animation`，五个包各自全绿而串起来
 * 断掉，是这里已经发生过的事。
 *
 * `?no-auto-fit` 把缩放钉在 1：屏幕位移与世界位移因此相等（`world = (屏幕 − 视口) / zoom`），
 * 自动适配一开，下面每一个落点都会落到别处。
 */

/** 启动一条绘图命令并逐点落笔，最后用 `Escape` 收束连续取点的那几条。 */
async function draw(
  page: Page,
  stage: Locator,
  command: string,
  points: readonly { x: number; y: number }[],
) {
  const input = stage.getByRole('combobox', { name: '命令行' })
  await input.fill(command)
  await input.press('Enter')
  for (const point of points) {
    await page.mouse.click(point.x, point.y)
  }
  await page.keyboard.press('Escape')
}

/** 框选一块矩形区域里的全部对象。 */
async function marquee(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

/**
 * 打开一个工作区面板。
 *
 * 工作区标签是**开关**：面板已经开着时再点一下会把它收起来。无条件点的症状是第二次调用把
 * 面板关掉，而拖拽目标行仍在 DOM 里、只是量不到盒——报出来的是一句与本用例无关的超时。
 */
async function openPanel(editor: Locator, tab: string, target: Locator) {
  if (!await target.isVisible()) {
    await editor.locator(`[data-workspace-tab="${tab}"]`).click()
  }
  await expect(target).toBeVisible()
}

/** 把场景树里的一行拖进资源目录，在弹出的对话框里建一个项目组件。 */
async function extractComponent(page: Page, editor: Locator, row: Locator, name: string) {
  const assets = editor.getByRole('treegrid', { name: '资源目录' })
  await openPanel(editor, 'compose-scene-content-panel', editor.getByRole('treegrid', { name: '场景树' }))
  await openPanel(editor, 'compose-assets', assets)
  const assetRoot = assets.getByRole('row', { name: /Demo Assets/ })
  await expect.poll(() => assetRoot.boundingBox()).not.toBeNull()
  const target = (await assetRoot.boundingBox())!
  await pointerDrop(page, row, {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  })

  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('名称').fill(name)
  await dialog.getByRole('button', { name: '创建' }).click()
}

test('OpenSpec: editor-workspace-layout / 项目组件与 Variant 纵向流程 / 基础图形画元件、两层组件嵌套并加动画', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：编辑器布局在首帧之后还会动一下，
   * 中间那一刻量到的可能是 `null`，报出来是一句与本用例无关的 `Cannot read properties of
   * null`。轮询到量得着为止。
   */
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = await stableBox(surface)
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const instances = stage.getByTestId('compose-component-instance-content')

  // ── 1. 用基础图形画一个刀闸符号：上引线、斜的闸刀、下引线、触点圆。
  await draw(page, stage, 'L', [at(240, 140), at(240, 200)])
  await draw(page, stage, 'L', [at(240, 200), at(296, 264)])
  await draw(page, stage, 'L', [at(240, 300), at(240, 360)])
  /*
   * 触点圆的半径必须明显大于特征点靶区：圆心落在下引线的端点上（那正是触点该在的地方），
   * 半径点若离得太近会被同一个端点吸回圆心，圆退化成一个点、当场提交不出来。开着网格吸附时
   * 靶区还要加上半条对角步长，因此 8 不够、24 才稳。
   */
  await draw(page, stage, 'C', [at(240, 300), at(264, 300)])
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(4)

  // ── 2. 框选四个图形编成一个 Group，它就是这个元件的单根。
  await marquee(page, at(180, 100), at(360, 400))
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('GROUP')
  await commandInput.press('Enter')
  await openPanel(editor, 'compose-scene-content-panel', sceneTree)
  await expect(sceneTree.getByRole('img', { name: 'Group' })).toBeVisible()

  // ── 3. 把 Group 拖进资源目录，提取成项目组件。
  await extractComponent(page, editor, sceneTree.getByRole('row', { name: /Group/ }), '刀闸')
  await expect(instances).toHaveCount(1)
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toHaveCount(1)

  // ── 4. 第二层嵌套：画一个标签框，与刀闸实例一起编组后再提取成组件。
  //     组件 B 的文档里因此含着组件 A 的一个实例——这正是「组件嵌套」。
  await draw(page, stage, 'R', [at(200, 420), at(340, 470)])
  await marquee(page, at(150, 90), at(400, 500))
  await commandInput.fill('GROUP')
  await commandInput.press('Enter')
  await openPanel(editor, 'compose-scene-content-panel', sceneTree)
  await extractComponent(page, editor, sceneTree.getByRole('row', { name: /Group/ }), '间隔单元')

  /*
   * 嵌套的判别点在这里：页面上只有**一个**实例节点（间隔单元），而画布上渲染出**两个**实例
   * 内容——多出来的那个是间隔单元文档里嵌着的刀闸。两个数相等就说明第二层没有嵌进去。
   */
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toHaveCount(1)
  await expect(instances).toHaveCount(2)
  const componentLibrary = editor.locator('[data-workspace-panel="component-library"]')
  await openPanel(editor, 'compose-component-library-panel', componentLibrary)
  await expect(componentLibrary.getByRole('button', { name: '添加主组件 刀闸' })).toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加主组件 间隔单元' })).toBeVisible()

  // ── 5. 再放一个间隔单元实例：同一份组件文档喂出两个实例。
  await componentLibrary.getByRole('button', { name: '添加主组件 间隔单元' }).click()
  // 两个顶层实例各自带一个嵌套的刀闸，因此渲染出四份实例内容。
  await expect(instances).toHaveCount(4)

  // ── 6. 给其中一个实例打一个位置关键帧：动画模式下在画布上拖它，自动记录写轨道。
  /*
   * 这里刻意不走 Inspector 的菱形。选中实例时属性面板渲染的是**组件根**的属性分组
   * （`instanceRootSelection`），而菱形装饰是为页面上那个 Entity 建的，两者不是同一份文档，
   * 因此实例的位置字段旁边没有菱形——这是既有设计的后果，不是本用例的问题。自动记录走的是
   * 另一条路：拖动直接写页面 Entity 的 `LayoutItem.offset` 轨道。
   */
  await openPanel(editor, 'compose-scene-content-panel', sceneTree)
  await sceneTree.getByRole('row', { name: /间隔单元/ }).first().click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await enterAnimationEditing(editor)
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')

  const dragged = instances.first()
  await expect.poll(() => dragged.boundingBox()).not.toBeNull()
  const before = (await dragged.boundingBox())!
  /*
   * 从中心偏一点抓，但偏得有限：中心有运动路径顶点，而**离中心 80px 那一圈是变换指示器的
   * 旋转环**——动画模式下指示器默认打开，落在那条命中带上的拖动是旋转而不是移动。这是环
   * 屏幕恒定的既定代价。偏移上限 40/24（距离 47）稳稳落在带的内沿（70）以内，同时不超过
   * 1/4 处，小对象上也仍在盒内。
   */
  const grip = {
    x: before.x + before.width / 2 - Math.min(before.width / 4, 40),
    y: before.y + before.height / 2 - Math.min(before.height / 4, 24),
  }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 96, grip.y + 48, { steps: 5 })
  await page.mouse.up()

  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  await exitAnimationEditing(editor)

  // 结构一动没动：打关键帧写的是轨道，两个实例连同各自嵌套的刀闸都还在。
  await expect(instances).toHaveCount(4)
})
