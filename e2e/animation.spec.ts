import { expect, test } from '@playwright/test'
import { pointerDrop, drawContainer } from './support/test-helpers'

test('OpenSpec: editor-workspace-layout / 动画模式 / 打点、拖播放头、画布采样与撤销', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 放一个 Rectangle 并选中它。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await expect(node).toHaveCount(1)
  await node.click()

  // 工具栏模式切换器切到「动画」= 进入动画模式；空态引导创建第一条动画（生成文件资产并绑定页面）。
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()

  // 属性面板位置字段出现菱形；点击在播放头 0 ms 打第一个关键帧。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const keyButton = inspector.getByRole('button', { name: '为 位置 添加关键帧' })
  await expect(keyButton).toBeVisible()
  await keyButton.click()
  await expect(
    inspector.getByRole('button', { name: '删除 位置 在当前播放头的关键帧' }),
  ).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()

  // 播放头拖到 200 ms 后在画布上拖动对象：自动记录写入第二个关键帧（绝对位置）。
  const originalBox = await node.boundingBox()
  expect(originalBox).not.toBeNull()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  // 抓取点取 1/4 处而不是中心：运动路径顶点位于物体中心，中心按下会抓到顶点。
  await page.mouse.move(
    originalBox!.x + originalBox!.width / 4,
    originalBox!.y + originalBox!.height / 4,
  )
  await page.mouse.down()
  await page.mouse.move(
    originalBox!.x + originalBox!.width / 4 + 96,
    originalBox!.y + originalBox!.height / 4,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  const draggedBox = await node.boundingBox()
  expect(draggedBox).not.toBeNull()
  expect(draggedBox!.x - originalBox!.x).toBeGreaterThan(48)

  // 播放头回 0：画布按采样文档回到起始位置——拖动没有污染基础静态值。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  await expect
    .poll(async () => Math.abs((await node.boundingBox())!.x - originalBox!.x))
    .toBeLessThan(2)

  // 撤销撤掉的是 200 ms 关键帧事务，而不是画布位置。
  await stage.press('Control+z')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(0)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
})


test('OpenSpec: editor-workspace-layout / 设计与动画模式切换器 / 创建动画生成文件资产并绑定页面', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 进入动画模式：底部动态出现时间线标签并展开，空态提供创建入口。
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()

  // 绑定后即显示正常时间线（零轨道 + 提示行），不再是创建引导。
  await expect(animationPanel.getByText('还没有轨道，选中组件打下第一个关键帧')).toBeVisible()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '创建动画' })).toHaveCount(0)

  // 点击输出区域激活画布 Inspector：动画区块（页面脚本上方）显示绑定的动画文件。
  const outputBox = (await stage.getByTestId('stage-output-boundary').boundingBox())!
  await page.mouse.click(outputBox.x + 40, outputBox.y + 40)
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expect(editor.getByRole('region', { name: '画布属性' })).toBeVisible()
  const animationSelect = inspector.getByRole('combobox', { name: '动画文件' })
  await expect(animationSelect.locator('option:checked')).toHaveText('Home.animation.json')
  const animationSection = inspector.locator('.property-panel__group').filter({ hasText: '动画文件' })
  const scriptSection = inspector.locator('.property-panel__group').filter({ hasText: '页面脚本' })
  const animationBox = (await animationSection.boundingBox())!
  const scriptBox = (await scriptSection.boundingBox())!
  expect(animationBox.y).toBeGreaterThan(scriptBox.y)

  // 保存页面：绑定引用与清单写盘。
  await editor.getByRole('button', { name: '保存页面' }).click()
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // 切回设计模式：时间线标签移除，底部恢复 资源/命令/日志。
  await editor.getByRole('radio', { name: '设计' }).click()
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  await expect
    .poll(async () => bottom.locator('[data-workspace-tab]').evaluateAll(
      (tabs) => tabs.map((tab) => tab.getAttribute('data-workspace-tab')),
    ))
    .toEqual(['compose-assets', 'compose-command', 'compose-transaction-log'])

  // 资源浏览器的 Pages 目录出现动画文件资产。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  await assets.getByRole('grid').first().getByRole('gridcell', { name: /^Pages/ }).click()
  await expect(assets.getByRole('gridcell', { name: /^Home\.animation\.json/ })).toBeVisible()

  // 重新进入动画模式：绑定持久，时间线直接显示而不是创建引导。
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  await expect(animationPanel.getByText('当前页面还没有动画')).toHaveCount(0)
})

test('OpenSpec: stage / 画布可编辑运动路径 / 拖顶点、拖切线、双击切换与撤销粒度', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 准备：放 Rectangle → 创建动画 → 0 ms 打点 → 播放头 200 ms 拖出第二个关键帧。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await node.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const startBox = (await node.boundingBox())!
  // 1/4 处抓取：避开物体中心的运动路径顶点。
  await page.mouse.move(startBox.x + startBox.width / 4, startBox.y + startBox.height / 4)
  await page.mouse.down()
  await page.mouse.move(startBox.x + startBox.width / 4 + 120, startBox.y + startBox.height / 4, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 位置轨道存在即显示可编辑路径：两个顶点。
  const path = stage.locator('[data-testid="stage-editable-path"]')
  await expect(path).toBeVisible()
  const vertexHits = stage.locator('[data-testid^="stage-path-vertex-hit-"]')
  await expect(vertexHits).toHaveCount(2)

  // 拖第二个顶点：松手后关键帧值变化，对象在播放头 200 ms 跟到新位置。
  const draggedBox = (await node.boundingBox())!
  const secondVertex = (await vertexHits.nth(1).boundingBox())!
  await page.mouse.move(secondVertex.x + secondVertex.width / 2, secondVertex.y + secondVertex.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    secondVertex.x + secondVertex.width / 2,
    secondVertex.y + secondVertex.height / 2 + 80,
    { steps: 4 },
  )
  await page.mouse.up()
  await expect.poll(async () => (await node.boundingBox())!.y - draggedBox.y).toBeGreaterThan(60)

  // 一次拖拽在撤销栈里只有一条记录：撤销一次即回到拖拽前位置。
  await stage.press('Control+z')
  await expect.poll(async () => Math.abs((await node.boundingBox())!.y - draggedBox.y)).toBeLessThan(2)

  // 双击第二个顶点切换 smooth：出现切线手柄；拖切线让轨迹弯曲（折线点集变化）。
  await vertexHits.nth(1).dblclick()
  const tangentHits = stage.locator('[data-testid^="stage-path-tangent-"]')
  await expect(tangentHits.first()).toBeVisible()
  const straightPoints = await stage
    .locator('[data-testid="stage-editable-path-line"]')
    .getAttribute('points')
  const tangent = (await tangentHits.first().boundingBox())!
  await page.mouse.move(tangent.x + tangent.width / 2, tangent.y + tangent.height / 2)
  await page.mouse.down()
  await page.mouse.move(tangent.x + tangent.width / 2, tangent.y + tangent.height / 2 - 60, { steps: 4 })
  await page.mouse.up()
  await expect
    .poll(async () => stage.locator('[data-testid="stage-editable-path-line"]').getAttribute('points'))
    .not.toBe(straightPoints)

  // 再次双击回 corner：切线清零、手柄消失。
  await vertexHits.nth(1).dblclick()
  await expect(tangentHits).toHaveCount(0)

  // 退出动画模式（切到底部组其他标签）：路径覆盖层立即消失。
  await editor.locator('[data-workspace-tab="compose-transaction-log"]').click()
  await expect(stage.locator('[data-testid="stage-editable-path"]')).toHaveCount(0)
})


test('OpenSpec: compose-preview / 预览按脚本绑定驱动动画 / 创建-打点-绑定-预览自动播放', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 创建动画并打出两个位置关键帧（0 ms 菱形打点 + 200 ms 画布拖动自动记录）。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await node.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const box = (await node.boundingBox())!
  // 1/4 处抓取：避开物体中心的运动路径顶点。
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 4 + 120, box.y + box.height / 4, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 选中动画片段：属性区切换为动画检查器。
  await animationPanel.getByRole('button', { name: /^动画片段 Rectangle：/u }).click()
  await expect(inspector.getByRole('textbox', { name: '名称' })).toHaveValue('动画 1')

  // 选回对象轨道：恢复 Entity Inspector；再点片段回到动画检查器。
  await animationPanel.getByRole('button', { name: '选择对象轨道 Rectangle' }).click()
  await expect(inspector.getByRole('spinbutton', { name: '位置 X' })).toBeVisible()
  await animationPanel.getByRole('button', { name: /^动画片段 Rectangle：/u }).click()
  await expect(inspector.getByRole('textbox', { name: '名称' })).toHaveValue('动画 1')

  // 循环播放让预览断言稳定；修改经 animation.configure 写入文档。
  await inspector.getByRole('combobox', { name: '播放模式' }).selectOption('loop')

  // 绑定播放到页面 setup 导出的布尔 animate（候选按语义过滤，字符串/数值成员不出现）。
  // 绑定入口悬停显隐：先悬停"播放"行让入口可见。
  await inspector.locator('[data-property-path="playing"]').hover()
  await inspector.getByRole('button', { name: /绑定\s*播放/u }).click()
  const picker = page.getByRole('dialog')
  await expect(picker.getByText('animate')).toBeVisible()
  await expect(picker.getByText('buttonLabel')).toHaveCount(0)
  await picker.getByText('animate').click()

  // 打开预览：animate 初始为 true，动画自动播放——实体位置随时间变化。
  await editor.getByRole('button', { name: '打开预览' }).click()
  const previewEntity = page
    .getByTestId('compose-preview-dialog-artboard')
    .locator('[data-testid^="compose-preview-entity-"]')
    .first()
  await expect(previewEntity).toBeVisible()
  // 位置必须用 getBoundingClientRect 读：boundingBox() 会等元素连续两帧几何稳定，
  // 而这里的元素正在被动画持续驱动，它多数时候直接返回 null。
  const measureX = async () => previewEntity.evaluate(
    (element) => element.getBoundingClientRect().x,
  )
  const initial = await measureX()
  await expect
    .poll(async () => Math.abs(await measureX() - initial), { timeout: 4000 })
    .toBeGreaterThan(10)
})


test('OpenSpec: editor-workspace-layout / 动画模式 / 动画进行中新增节点不打断画布与多节点轨道', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 节点 A：打 0 ms 关键帧，播放头 200 ms 拖出第二帧。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const nodes = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await expect(nodes).toHaveCount(1)
  await nodes.first().click()
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  const originalBox = (await nodes.first().boundingBox())!
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  // 1/4 处抓取：避开物体中心的运动路径顶点。
  await page.mouse.move(originalBox.x + originalBox.width / 4, originalBox.y + originalBox.height / 4)
  await page.mouse.down()
  await page.mouse.move(originalBox.x + originalBox.width / 4 + 96, originalBox.y + originalBox.height / 4, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(1)

  // 回归：动画模式下点击添加节点 B。采样文档先于布局快照拿到新实体时，
  // 画布曾因几何索引缺 box 抛错并整体卸载。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(nodes).toHaveCount(2)
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(1)

  // 节点 B：直接在画布拖动，自动记录为它新建位置轨道（200 ms 一帧）。
  const bBox = (await nodes.nth(1).boundingBox())!
  await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2 + 120, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(2)

  // 回归：真实指针拖入节点 C 也不崩，且已有轨道不受影响。
  const outputBox = (await stage.getByTestId('stage-output-boundary').boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox.x + 450,
    y: outputBox.y + 40,
  })
  await expect(nodes).toHaveCount(3)
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(2)

  // 采样独立：播放头回 0，A 回到起点；B 只有 200 ms 一帧，端点钳制保持拖后位置。
  const draggedB = (await nodes.nth(1).boundingBox())!
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  await expect
    .poll(async () => Math.abs((await nodes.first().boundingBox())!.x - originalBox.x))
    .toBeLessThan(2)
  expect(Math.abs((await nodes.nth(1).boundingBox())!.y - draggedB.y)).toBeLessThan(2)
})


test('OpenSpec: editor-workspace-layout / 动画模式 / 嵌套容器子级可打点采样且拖入嵌套不打断', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 准备嵌套：容器 + 一个拖进容器的矩形子级。
  await drawContainer(page, editor)
  const outputBox = (await stage.getByTestId('stage-output-boundary').boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox.x + 200,
    y: outputBox.y + 20,
  })
  const topLevel = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  const rectBox = (await topLevel.first().boundingBox())!
  await page.mouse.move(rectBox.x + rectBox.width / 2, rectBox.y + rectBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(outputBox.x + 300, outputBox.y + 250, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toBeVisible()
  await page.mouse.up()
  const nested = stage.getByTestId('stage-container').locator(':scope > .compose-stage__node.is-renderer')
  await expect(nested).toHaveCount(1)

  // 嵌套子级打点：0 ms 菱形 + 200 ms 画布拖动自动记录。
  await nested.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  const startBox = (await nested.boundingBox())!
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  // 1/4 处抓取：避开物体中心的运动路径顶点。
  await page.mouse.move(startBox.x + startBox.width / 4, startBox.y + startBox.height / 4)
  await page.mouse.down()
  await page.mouse.move(startBox.x + startBox.width / 4 + 80, startBox.y + startBox.height / 4 + 40, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  // 动画拖动只写关键帧，不把子级拖出容器。
  await expect(nested).toHaveCount(1)

  // 播放头回 0：嵌套子级按采样回到容器内起点。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  await expect
    .poll(async () => Math.abs((await nested.boundingBox())!.x - startBox.x))
    .toBeLessThan(2)

  // 回归：动画进行中往已含动画子级的容器里再添加节点（点击添加以当前选中实体为
  // 兄弟插入，正好落进容器）。结构变化曾让采样文档先于布局快照拿到新实体而崩溃。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await expect(nested).toHaveCount(2)
  await expect(stage.getByTestId('stage-container')).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
})


test('OpenSpec: editor-workspace-layout / 动画模式 / 组件实例参与动画', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  // 从容器创建组件实例。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Anim Card')
  await dialog.getByRole('button', { name: '创建' }).click()
  const instanceContent = stage.getByTestId('compose-component-instance-content')
  await expect(instanceContent).toBeVisible()

  // 选中实例并进入动画模式：实例是页面文档中的普通 Entity，位置轨道照常可用。
  const instanceBox = (await instanceContent.boundingBox())!
  await page.mouse.click(instanceBox.x + instanceBox.width / 2, instanceBox.y + instanceBox.height / 2)
  await expect(sceneTree.getByRole('row', { name: /Anim Card/ }))
    .toHaveAttribute('aria-selected', 'true')
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  // 创建是异步的 建文件→绑定→水合 流程：等时间线退出空态再取几何，避免拖拽落在重绑定窗口。
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  await expect(instanceContent).toBeVisible()

  // 播放头 0 拖动实例：自动记录建轨并打 0 ms 帧；播放头 200 再拖出第二帧。
  const startBox = (await instanceContent.boundingBox())!
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(startBox.x + startBox.width / 2 - 60, startBox.y + startBox.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  const zeroBox = (await instanceContent.boundingBox())!
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const midBox = (await instanceContent.boundingBox())!
  // 实例大于画布视口（1280×720，左缘在画布外）：1/4 点会落到画布外的面板上。
  // 用中心加小偏移抓取——既落在画布内，又避开物体中心的运动路径顶点。
  await page.mouse.move(midBox.x + midBox.width / 2 + 60, midBox.y + midBox.height / 2 + 40)
  await page.mouse.down()
  await page.mouse.move(midBox.x + midBox.width / 2 + 200, midBox.y + midBox.height / 2 + 40, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: /^动画片段 Anim Card：/u })).toBeVisible()

  // 采样：播放头回 0，实例回到 0 ms 关键帧位置。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  await expect
    .poll(async () => Math.abs((await instanceContent.boundingBox())!.x - zeroBox.x))
    .toBeLessThan(2)
})


test('OpenSpec: editor-workspace-layout / 时间线更多操作菜单 / 右键删除轨道并撤销恢复', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 准备一条位置轨道：打点 + 播放头 200 ms 拖出第二帧。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await node.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const box = (await node.boundingBox())!
  // 1/4 处抓取：避开物体中心的运动路径顶点。
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 4 + 96, box.y + box.height / 4, { steps: 4 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 属性行右键 → 删除轨道：轨道连同两个关键帧一起消失。
  await animationPanel.getByRole('button', { name: '选择属性轨道 位置' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: '删除轨道' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(0)
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(0)

  // 撤销一步整体恢复。
  await stage.press('Control+z')
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 行上没有"更多操作"按钮：右键是唯一入口，行尾不为它留位。
  const propertyRow = animationPanel.getByRole('button', { name: '选择属性轨道 位置' })
  await propertyRow.hover()
  await expect(animationPanel.getByRole('button', { name: '位置 的更多操作' })).toHaveCount(0)

  // 键盘走同一条路径：Shift+F10 由浏览器翻译成 contextmenu 派发到焦点元素上。
  await propertyRow.focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menuitem', { name: '删除轨道' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '在播放头处打点' })).toBeVisible()
  // 依赖光标时间的条目只属于车道右键，行不表达时间位置。
  await expect(page.getByRole('menuitem', { name: '在光标所在时间打点' })).toHaveCount(0)

  // 关闭后焦点回到该行的命中按钮，而不是丢给 body。
  await page.keyboard.press('Escape')
  await expect(propertyRow).toBeFocused()
})



test('OpenSpec: editor-workspace-layout / 画布 Inspector 关键帧缓动编辑 / 选中关键帧调曲线、撤销与采样', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await expect(node).toHaveCount(1)
  await node.click()

  await editor.getByRole('radio', { name: '动画' }).click()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()

  // 0 ms 与 300 ms 各打一帧：后者由自动记录在拖动时写入。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  const originalBox = (await node.boundingBox())!
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('300')
  // 抓取点取 1/4 处：物体中心是运动路径顶点。
  await page.mouse.move(
    originalBox.x + originalBox.width / 4,
    originalBox.y + originalBox.height / 4,
  )
  await page.mouse.down()
  await page.mouse.move(
    originalBox.x + originalBox.width / 4 + 120,
    originalBox.y + originalBox.height / 4,
    { steps: 5 },
  )
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 300 ms：位置' })).toBeVisible()

  // 点画布空白处回到画布 Inspector；此时时间线选中首帧，缓动区出现在「当前时间」下方。
  const outputBox = (await stage.getByTestId('stage-output-boundary').boundingBox())!
  await page.mouse.click(outputBox.x + 40, outputBox.y + 40)
  await expect(editor.getByRole('region', { name: '画布属性' })).toBeVisible()
  await animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' }).click()
  await expect(inspector.getByRole('textbox', { name: '关键帧' }))
    .toHaveValue(/位置 · 0 ms → 300 ms$/u)

  const easing = inspector.getByRole('combobox', { name: '缓动' })
  await expect(easing).toHaveValue('linear')
  // 缓动区必须落在「当前时间」行下方，且贴边占满整行宽度。
  const currentTimeRow = (await inspector.getByText('当前时间').boundingBox())!
  const easingBox = (await inspector.locator('.compose-easing-editor').boundingBox())!
  expect(easingBox.y).toBeGreaterThan(currentTimeRow.y)
  const easingRow = (await inspector.locator('[data-property-path="easing"]').boundingBox())!
  const curveBox = (await inspector.locator('.compose-easing-editor__canvas').boundingBox())!
  expect(Math.abs(curveBox.x - easingRow.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((curveBox.x + curveBox.width) - (easingRow.x + easingRow.width)))
    .toBeLessThanOrEqual(1)

  // 选预设：曲线与控制点数值同步，改动写入文档。
  await easing.selectOption('ease-in-out')
  await expect(inspector.getByRole('textbox', { name: '控制点' })).toHaveValue('0.42, 0, 0.58, 1')

  // 一次预设选择就是一条事务：撤销回到 linear。
  await stage.press('Control+z')
  await expect(easing).toHaveValue('linear')

  // 改成 hold 后播放头停在段中：采样保持前值，画布不做插值。
  await easing.selectOption('hold')
  // 播放头滑杆 step 是 4 ms：取 152 而不是 150，否则 fill 会被判为非法值。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('152')
  await expect
    .poll(async () => Math.abs((await node.boundingBox())!.x - originalBox.x))
    .toBeLessThan(2)
})
