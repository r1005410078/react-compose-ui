import { expect, test } from '@playwright/test'

/**
 * 刀闸故事的整条纵向流程：画 → 打点 → 存成组件 → 放两个实例 → 脚本驱动各自的姿态。
 *
 * @remarks
 * 判别点是**两个**实例：只放一个的话，把播放头做成全局单值的实现同样能全绿。「粒度」这个
 * 问题在屏幕上的样子，就是同一帧里同一个组件的两个实例姿态不同。
 *
 * 断言读的是嵌套实体真实拿到的 transform：实例内部的姿态经过一次独立的 Yoga 求解，
 * 属性上读到的仍是作者值，jsdom 里也量不出来。
 */
test('OpenSpec: scene-animation / 组件文档的动画 / 打点存成组件后两个实例各走各的姿态', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  // `switch-demo` 只多两个可绑定的数值导出（openMs / closedMs），不改页面内容。
  await page.goto('/?no-auto-fit&switch-demo')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  // 1. 画一个装着矩形的容器，把**容器**存成组件。
  // 源必须是容器：单个矩形存成组件时它自己就是组件根 Frame，组件内部没有可动的子级。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row', { name: /Container/ })
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const createDialog = page.getByRole('dialog', { name: '创建组件' })
  // 名字避开「Widget Switcher」：组件库按文本筛选时 Switch 是它的子串。
  await createDialog.getByLabel('组件名称').fill('刀闸')
  await createDialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // 2. 进组件文档，在**组件自己的**时间线上打两个旋转关键帧。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加主组件 刀闸' }).dblclick()
  // 场景树切换到组件 Runtime 需要一帧；面板可见早于树内容替换。
  await page.waitForTimeout(800)
  await expect(editor.locator('[data-workspace-panel="component-document"]')).toBeVisible()

  const componentTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = componentTree.getByRole('row')
  for (let index = 0; index < await rows.count(); index += 1) {
    const toggle = rows.nth(index).getByRole('button', { name: /展开/ })
    if (await toggle.count()) await toggle.click()
  }
  await componentTree.getByRole('row', { name: /Rectangle/ }).click()
  await expect(inspector).toContainText('Rectangle')

  // 基线必须在资源面板**打开着**的时候量：面板没渲染时行数是 0，之后那条断言就成了
  // 「现在有 8 行，期望 0 行」——看起来像功能坏了，其实是量具没接上。
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const assetRows = editor.getByRole('treegrid', { name: '资源目录' }).getByRole('row')
  await expect(assetRows.first()).toBeVisible()
  const assetsBefore = await assetRows.count()

  await editor.getByRole('radio', { name: '动画' }).click()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：旋转' })).toBeVisible()

  // 播放头挪到 200 ms 再改旋转：自动记录把这次属性编辑改写成该时刻的关键帧。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const rotation = inspector.getByRole('spinbutton', { name: '旋转' })
  await rotation.fill('60')
  await rotation.press('Enter')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()

  // 组件的动画内嵌在资产里：不得在用户的资源目录里落一个动画文件。
  await editor.getByRole('radio', { name: '设计' }).click()
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await expect(assetRows).toHaveCount(assetsBefore)

  await editor.getByRole('button', { name: /^保存(主组件|变体)/ }).click()

  // 3. 回到页面，再放一个同组件的实例。
  await editor.locator('[data-workspace-tab]').filter({ hasText: 'Home' }).click()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加主组件 刀闸' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(2)

  // 4. 两个实例各绑一个页面导出：openMs 是 0，closedMs 是 200（动画时长也是 200）。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const instanceRows = sceneTree.getByRole('row', { name: /刀闸/ })
  await expect(instanceRows).toHaveCount(2)

  const bindPlayhead = async (rowIndex: number, exportName: string) => {
    await instanceRows.nth(rowIndex).click()
    await inspector.getByRole('combobox', { name: '动画' }).selectOption({ index: 1 })
    // 绑定入口悬停显隐：先悬停「播放头」行让入口可见。
    await inspector.locator('[data-property-path="animationTime"]').hover()
    await inspector.getByRole('button', { name: /绑定\s*播放头/u }).click()
    await page.getByRole('dialog').getByText(exportName, { exact: true }).click()
  }
  await bindPlayhead(0, 'openMs')
  await bindPlayhead(1, 'closedMs')

  /*
   * 读每个实例内部所有嵌套实体的 transform。
   *
   * 不去猜那个矩形的 Entity id——它是创建组件时生成的。两个实例渲染的是同一份文档，
   * 因此姿态列表相同就说明播放头没起作用，不同就说明各走各的。
   */
  const poses = () => stage.evaluate(() => Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="compose-component-instance-content"]'),
  ).map((host) => Array.from(
    host.querySelectorAll<HTMLElement>('[data-component-instance-entity-id]'),
  ).map((node) => node.style.transform).join('|')))

  await expect.poll(async () => {
    const [open, closed] = await poses()
    return open !== undefined && closed !== undefined && open !== closed
  }).toBe(true)

  const [open, closed] = await poses()
  // 0 ms 那一端停在作者姿态，200 ms 那一端转到 60 度。
  expect(open).toContain('rotate(0deg)')
  expect(closed).toContain('rotate(60deg)')
})

/**
 * 另一半：动画先打在页面上，再把对象存成组件。
 *
 * @remarks
 * 上一条从空的组件文档开始建动画，走的是「组件文档进得了动画模式」这条路；这一条走的是
 * 「创建组件搬运动画清单」那条。两条缺口各自独立，一条用例覆盖不了另一条。
 *
 * 判别信号是**实例 Inspector 的动画下拉里有那条动画**：清单没被搬过去的话组件文档里只有
 * 一堆悬空轨道，下拉是空的——而这在屏幕上看起来只是「动画没生效」，很容易被当成播放坏了。
 */
test('OpenSpec: stage-engine / 组件提取搬运动画清单 / 页面上打的点跟着组件走', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit&switch-demo')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()

  // 在**页面**的时间线上给矩形打两个旋转关键帧。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  // 矩形是容器的子级，行默认折叠着。
  const pageRows = sceneTree.getByRole('row')
  for (let index = 0; index < await pageRows.count(); index += 1) {
    const toggle = pageRows.nth(index).getByRole('button', { name: /展开/ })
    if (await toggle.count()) await toggle.click()
  }
  await sceneTree.getByRole('row', { name: /Rectangle/ }).click()
  await editor.getByRole('radio', { name: '动画' }).click()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  const rotation = inspector.getByRole('spinbutton', { name: '旋转' })
  await rotation.fill('60')
  await rotation.press('Enter')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()
  await editor.getByRole('radio', { name: '设计' }).click()

  // 把装着它的容器存成组件。
  const source = sceneTree.getByRole('row', { name: /Container/ })
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const createDialog = page.getByRole('dialog', { name: '创建组件' })
  await createDialog.getByLabel('组件名称').fill('刀闸')
  await createDialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // 判别点：清单跟着走了，实例的动画下拉里才有得选。
  await sceneTree.getByRole('row', { name: /刀闸/ }).click()
  const picker = inspector.getByRole('combobox', { name: '动画' })
  await expect(picker.getByRole('option')).toHaveCount(2)

  await picker.selectOption({ index: 1 })
  await inspector.locator('[data-property-path="animationTime"]').hover()
  await inspector.getByRole('button', { name: /绑定\s*播放头/u }).click()
  await page.getByRole('dialog').getByText('closedMs', { exact: true }).click()

  // 轨道与清单对上了，实例才动得起来：id 换掉的实现在这里停在 0 度。
  await expect
    .poll(async () => stage.evaluate(() => Array.from(
      document.querySelectorAll<HTMLElement>('[data-component-instance-entity-id]'),
    ).map((node) => node.style.transform).join('|')))
    .toContain('rotate(60deg)')
})
