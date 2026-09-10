import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { clickCurveStroke, emptyWorkspaceRect, openPageInspector, enterAnimationEditing, exitAnimationEditing } from './support/test-helpers'

/** 在所有场景之外画一个容器，得到第二块场景并返回它的 Entity id。 */
async function createSecondScene(page: Page, editor: Locator, minBlank?: number) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const region = await emptyWorkspaceRect(page, editor, minBlank)
  const width = Math.min(240, region.width - 16)
  const height = Math.min(180, region.height - 16)
  const start = {
    x: region.x + (region.width - width) / 2,
    y: region.y + (region.height - height) / 2,
  }
  await editor.getByRole('button', { name: '创建容器', exact: true }).first().click()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + width, start.y + height, { steps: 4 })
  await page.mouse.up()
  await editor.getByRole('button', { name: '选择', exact: true }).click()
  await expect(stage.locator('[data-testid^="stage-frame-boundary-"]')).toHaveCount(2)
  // 刻意不保存：绑定是文档命令，尚未保存的场景同样能创建动画。
  const ids = await stage.locator('[data-testid^="stage-frame-boundary-"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-frame-id')!))
  return ids.find((id) => id !== 'frame-root')!
}

/** 在当前作用域场景创建一条动画并打一个关键帧。 */
async function createAnimationWithKeyframe(editor: Locator) {
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await enterAnimationEditing(editor)
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  await exitAnimationEditing(editor)
}

test('OpenSpec: editor-workspace-layout / 动画模式 / 选中另一块场景内的对象切换作用域', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  // 场景 1 里放一个矩形并给激活场景建动画。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const sceneOneRect = stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer')
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(sceneOneRect)
  await createAnimationWithKeyframe(editor)

  // 第二块场景还没有动画：选中它就应当看到空态，而不是场景 1 的时间线。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()

  // 选回场景 1 的对象，时间线切回场景 1 的动画。
  await exitAnimationEditing(editor)
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(sceneOneRect)
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 多场景动画会话 / 两块场景各自建动画并保存', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const sceneOneRect = stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer')
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(sceneOneRect)
  await createAnimationWithKeyframe(editor)
  /*
   * 进入动画编辑时变换指示器自动打开，退出不自动关（它是视图状态，关掉是正当选择）。动画工作区
   * 的时间线常驻展开，图面比页面工作区矮，选中对象的旋转环因此正好压在小场景那个矩形的下边线
   * 上——点描边之前先把指示器关掉。
   */
  const gizmoToggle = editor.getByRole('button', { name: '变换指示器' })
  await gizmoToggle.click()
  await expect(gizmoToggle).toHaveAttribute('aria-pressed', 'false')

  // 第二块场景里也放一个矩形并建自己的动画。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const sceneTwoRect = stage.locator(`[data-entity-id="${sceneTwoId}"] .compose-stage__node.is-renderer`)
  await expect(sceneTwoRect).toHaveCount(1)
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。取**下边线**——第二块场景很小，
  // 它的标题标签正压在矩形上边线那一带。
  await clickCurveStroke(sceneTwoRect, { edge: 'bottom' })
  await createAnimationWithKeyframe(editor)
  // 第二次进入又把指示器打开了：与上面同一条理由。
  await gizmoToggle.click()
  await expect(gizmoToggle).toHaveAttribute('aria-pressed', 'false')

  // 两块场景各有一条动画，互不覆盖：来回切换都看得到自己的关键帧。
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(1)
  await exitAnimationEditing(editor)
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(sceneOneRect)
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(1)

  // 保存把两块场景的清单各自回写进自己绑定的文件，保存后不再有未保存标记。
  await exitAnimationEditing(editor)
  await stage.focus()
  await page.keyboard.press('Control+s')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // 一场景一份文件：页面配置面板的动画分组逐场景列出绑定行，两行各自绑定不同的文件。
  await openPageInspector(page, editor)
  const pageInspector = editor.getByRole('region', { name: '页面属性' })
  await expect
    .poll(async () => pageInspector.locator('select option:checked').evaluateAll((options) =>
      options
        .map((option) => option.textContent ?? '')
        .filter((text) => text.endsWith('.animation.json'))))
    .toHaveLength(2)
  const boundFiles = await pageInspector.locator('select option:checked').evaluateAll((options) =>
    options
      .map((option) => option.textContent ?? '')
      .filter((text) => text.endsWith('.animation.json')))
  expect(new Set(boundFiles).size).toBe(2)
})

test('OpenSpec: editor-workspace-layout / 动画模式 / 清空选择回退到激活场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer'))
  await createAnimationWithKeyframe(editor)

  // 建第二块场景并选中它——作用域跟着走，看到空态。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()

  // 清空选择：回退到激活场景（仍是第一块），时间线回到它的动画。
  await exitAnimationEditing(editor)
  await openPageInspector(page, editor)
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 动画模式 / 动画模式拖拽不跨场景挂载', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  const inspector = editor.locator('[data-workspace-panel="inspector"]')

  // 场景 2（画完处于选中态）里直接添加 矩形，再复制一份拖回场景 1——
  // 复刻缺陷报告的操作序列：动画模式下拖动场景 2 的原件曾被判成跨场景挂载。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const inScene1 = stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer')
  const inScene2 = stage.locator(`[data-entity-id="${sceneTwoId}"] .compose-stage__node.is-renderer`)
  await expect(inScene2).toHaveCount(1)
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。取**下边线**——第二块场景很小，
  // 它的标题标签正压在矩形上边线那一带。
  await clickCurveStroke(inScene2, { edge: 'bottom' })
  await stage.press('Control+d')
  await expect(inScene2).toHaveCount(2)
  const sceneOneBox = (await stage.getByTestId('stage-frame-boundary-frame-root').boundingBox())!
  const copyBox = (await inScene2.last().boundingBox())!
  // 抓**上边线**：矩形默认空心，盒内部不命中；副本被复制偏移推离了场景标题标签那一带。
  // 终点按同一个偏移落——挂载按对象落在哪里判定。
  await page.mouse.move(copyBox.x + copyBox.width / 2, copyBox.y + 1)
  await page.mouse.down()
  await page.mouse.move(
    sceneOneBox.x + 300,
    sceneOneBox.y + 300 - copyBox.height / 2 + 1,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect(inScene1).toHaveCount(1)
  await expect(inScene2).toHaveCount(1)

  // 场景 1 的副本刻一条动画。矩形默认空心，选中它要点那一圈描边。
  await clickCurveStroke(inScene1)
  await enterAnimationEditing(editor)
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()

  // 保持动画模式直接选中场景 2 的原件并创建它自己的动画。
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。取**下边线**——第二块场景很小，
  // 它的标题标签正压在矩形上边线那一带。
  await clickCurveStroke(inScene2, { edge: 'bottom' })
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()

  // 把播放头拖到 200 ms 后在画布上拖动对象：拖拽是姿态编辑，不得跨场景挂载。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const dragBox = (await inScene2.first().boundingBox())!
  /*
   * 抓**下边线**的 1/4 处：矩形默认空心，盒内部不命中，而上边线那一带压着场景标题标签；
   * 取 1/4 而不是正中，是为了同时避开物体中心的运动路径顶点与变换指示器的旋转环。
   */
  const dragFrom = { x: dragBox.x + dragBox.width / 4, y: dragBox.y + dragBox.height - 1 }
  await page.mouse.move(dragFrom.x, dragFrom.y)
  await page.mouse.down()
  await page.mouse.move(dragFrom.x + 80, dragFrom.y, { steps: 4 })
  await page.mouse.up()

  // 对象仍属场景 2，且这次拖动在播放头处写入了场景 2 动画的关键帧。
  await expect(inScene2).toHaveCount(1)
  await expect(inScene1).toHaveCount(1)
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 场景 1 的动画不受影响：仍只有副本自己的一条对象轨道与 0 ms 关键帧。
  await exitAnimationEditing(editor)
  await clickCurveStroke(inScene1)
  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: /^选择对象轨道/ })).toHaveCount(1)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(0)
})

test('OpenSpec: editor-workspace-layout / 运动路径以物体中心为锚 / 第二块场景的路径画在自己场景内', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  /*
   * 第二块场景（不在世界原点）里放一个矩形并打两个位置关键帧。这里要一块**装得开**的空白：
   * 场景太矮时里面的矩形会顶到场景的标题标签上，而标签在场景顶边之外、压着矩形的上描边——
   * 症状是「点不中那条描边」，看起来像命中坏了。
   */
  const sceneTwoId = await createSecondScene(page, editor, 200)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const rect = stage.locator(`[data-entity-id="${sceneTwoId}"] .compose-stage__node.is-renderer`)
  await expect(rect).toHaveCount(1)
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(rect)
  await enterAnimationEditing(editor)
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  // 键盘微移打点而不是画布拖拽：场景 2 位置靠下，动画模式展开时间线后可能遮住它，
  // 微移同样派发 transform 命令并被自动记录改写为关键帧，且不依赖屏幕几何。
  await stage.focus()
  for (let i = 0; i < 3; i += 1) await stage.press('ArrowRight')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 路径必须画在矩形所在的场景里：每个顶点都落在场景 2 的边界盒内，
  // 而不是整体平移一个场景原点、画进场景 1。
  const sceneTwoBox = (await stage.getByTestId(`stage-frame-boundary-${sceneTwoId}`).boundingBox())!
  const vertices = stage.locator('circle[data-testid^="stage-path-vertex-hit-"]')
  await expect(vertices).toHaveCount(2)
  for (let i = 0; i < 2; i += 1) {
    const vertexBox = (await vertices.nth(i).boundingBox())!
    const center = {
      x: vertexBox.x + vertexBox.width / 2,
      y: vertexBox.y + vertexBox.height / 2,
    }
    expect(center.x).toBeGreaterThanOrEqual(sceneTwoBox.x - 1)
    expect(center.x).toBeLessThanOrEqual(sceneTwoBox.x + sceneTwoBox.width + 1)
    expect(center.y).toBeGreaterThanOrEqual(sceneTwoBox.y - 1)
    expect(center.y).toBeLessThanOrEqual(sceneTwoBox.y + sceneTwoBox.height + 1)
  }
})

test('OpenSpec: editor-workspace-layout / 未保存场景的动画创建 / 刚画出来的场景就能建动画', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  /*
   * 画出第二块场景后**不保存**，直接在它里面放对象、建动画。要一块装得开的空白：场景太矮时
   * 里面的矩形会顶到场景的标题标签上，而标签压着矩形的上描边，下面那一下就点不中了。
   */
  const sceneTwoId = await createSecondScene(page, editor, 200)
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(1)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(
    stage.locator(`[data-entity-id="${sceneTwoId}"] .compose-stage__node.is-renderer`).first(),
  )
  await createAnimationWithKeyframe(editor)

  await enterAnimationEditing(editor)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  // 激活场景不因为建动画而改变。
  await expect(editor.getByTestId('stage-scene-tag-frame-root')).toHaveClass(/is-active/)
})

test('OpenSpec: editor-workspace-layout / 未保存场景的动画创建 / 创建失败不留孤儿文件', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 正常建一次动画，确认只落一份文件；绑定行候选 = 解除项 + 同目录文件 + 新建项。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  // 矩形默认空心，盒内部不命中：选中它要点那一圈描边。
  await clickCurveStroke(stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer'))
  await createAnimationWithKeyframe(editor)

  await openPageInspector(page, editor)
  const fileSelect = editor.getByRole('region', { name: '页面属性' })
    .getByRole('combobox', { name: '场景（激活）' })
  await expect(fileSelect.locator('option:checked')).toHaveText('Home-场景.animation.json')
  await expect(fileSelect.locator('option')).toHaveCount(3)
})
