import { expect, test } from '@playwright/test'
import { pointerDrop } from './support/test-helpers'

/** 属性面板的 Dockview 标签：对象名住在这里（`属性 · Rectangle`）。 */
function inspectorTabTitle(editor: Locator) {
  return editor.locator('[data-workspace-tab="compose-inspector"]')
}


test('OpenSpec: editor-workspace-layout / 项目组件与 Variant 纵向流程 / 场景树导出、Revert、Apply 与统一图标', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
    .toHaveCount(1)

  // 普通 Scene Tree 行既保留树内移动，也能跨面板落到可写资源目录。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const rectangleRow = sceneTree.getByRole('row', { name: /Rectangle/ })
  const assetRootRow = editor.getByRole('treegrid', { name: '资源目录' })
    .getByRole('row', { name: /Demo Assets/ })
  const assetRootBox = await assetRootRow.boundingBox()
  expect(assetRootBox).not.toBeNull()
  await pointerDrop(page, rectangleRow, {
    x: assetRootBox!.x + assetRootBox!.width / 2,
    y: assetRootBox!.y + assetRootBox!.height / 2,
  })

  const createComponent = page.getByRole('dialog', { name: '创建组件' })
  await expect(createComponent).toBeVisible()
  await createComponent.getByLabel('名称').fill('Dragged Card')
  await createComponent.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toBeVisible()
  await expect(editor.getByRole('img', { name: '项目组件' }).first()).toBeVisible()

  // Undo 只恢复页面源节点，Redo 复用同一个已保存资源实例。
  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(0)
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
  await stage.press('Control+Shift+z')
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const componentLibrary = editor.locator('[data-workspace-panel="component-library"]')
  await expect(componentLibrary.getByRole('button', { name: '添加主组件 Dragged Card' }))
    .toBeVisible()
  await componentLibrary.getByRole('button', { name: '创建变体 Dragged Card' }).click()
  const createVariant = page.getByRole('dialog', { name: '创建变体' })
  await createVariant.getByLabel('变体名称').fill('Dragged Card Focused')
  await createVariant.getByRole('button', { name: '创建变体' }).click()
  await expect(editor.locator('[data-workspace-panel="component-document"][data-component-kind="variant"]'))
    .toBeVisible()
  await expect(componentLibrary.getByRole('button', { name: '添加变体 Dragged Card Focused' }))
    .toBeVisible()
  // Dock 高度装不下基础组件与项目组件两个区块，可见性断言触发的自动滚动落点不稳定：
  // 项目组件是最后一个区块，把滚动容器钉到底（scrollTop 会被钳制到最大值，落点唯一），
  // 保证黄金图取景一致。
  await componentLibrary.getByRole('heading', { name: '项目组件 (2)' })
    .evaluate((heading) => {
      let scroller = heading.parentElement
      while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
        scroller = scroller.parentElement
      }
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' })
    })
  await expect(componentLibrary).toHaveScreenshot('component-library-components-variants.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.02,
  })

  // Variant 使用自己的 Runtime。保存生成稳定 ID 操作；Revert 与 Apply 都显式消费当前层覆盖。
  // 单选叶子提取时叶子本身就是组件根，因此这里只有一个节点，而组件根是 Frame——它的体不再
  // 是选中入口（裸点是框选）。走 command 点体这个入口；用 Meta 而不是 Control，macOS 上
  // Ctrl+左键会被 Chromium 翻译成右键。
  const variantChild = stage.locator('.compose-stage__scene .compose-stage__node').first()
  await expect(variantChild).toBeVisible()
  await variantChild.click({ modifiers: ['Meta'] })
  await stage.press('ArrowRight')
  /*
   * 保存按钮已从标签条删掉；`document.save` 的默认键位仍是 Cmd/Ctrl+S。键位由编辑器根节点
   * 捕获，因此要先把焦点放回编辑器里——刚点过编辑器外面那些开关时，焦点还留在那儿。
   */
  const saveDocument = () => stage.press('Control+S')
  await saveDocument()
  await expect(editor.getByText('1 项本层覆盖', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Revert 全部变体覆盖' }).click()
  await expect(editor.getByText('与父源同步 · 无本地覆盖', { exact: true })).toBeVisible()
  await expect(editor.getByText('当前层覆盖已 Revert', { exact: true })).toBeVisible()

  await variantChild.click({ modifiers: ['Meta'] })
  await stage.press('Shift+ArrowRight')
  await saveDocument()
  await expect(editor.getByText('1 项本层覆盖', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Apply 全部变体覆盖' }).click()
  await expect(editor.getByText('与父源同步 · 无本地覆盖', { exact: true })).toBeVisible()
  await expect(editor.getByText('覆盖已 Apply 到直接父源', { exact: true })).toBeVisible()

  // 回到页面同时放入 Variant、Container 与 first-class Group，校验四种语义图标一致可访问。
  await editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: 'Home' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(1)
  await editor.getByRole('button', { name: '关闭 Dragged Card Focused' }).click()
  const assetBrowserPanel = editor.locator('[data-workspace-panel="asset-browser"]')
  if (!await assetBrowserPanel.isVisible()) {
    await editor.locator('[data-workspace-tab="compose-assets"]').click()
  }
  await expect(assetBrowserPanel).toBeVisible()
  await expect(editor.getByRole('img', { name: '组件变体' }).first()).toBeVisible()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await componentLibrary.getByRole('button', { name: '添加变体 Dragged Card Focused' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(2)
  await componentLibrary.getByRole('button', { name: '添加 矩形' }).click()
  await componentLibrary.getByRole('button', { name: '添加 矩形' }).click()
  await componentLibrary.getByRole('button', { name: '添加 容器' }).click()
  const rootRenderers = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  await expect(rootRenderers).toHaveCount(4)
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const rectangleRows = sceneTree.getByRole('row', { name: /Rectangle/ })
  await expect(rectangleRows).toHaveCount(2)
  await rectangleRows.nth(0).click()
  await rectangleRows.nth(1).click({ modifiers: ['Shift'] })
  await stage.focus()
  await stage.press('Control+g')

  // 页面上引用主组件或变体都是实例（空心图标），不再用「变体实例」区分。
  await expect(sceneTree.getByRole('img', { name: '组件实例' }).first()).toBeVisible()
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toHaveCount(2)
  await expect(sceneTree.getByRole('img', { name: 'Container' })).toBeVisible()
  await expect(sceneTree.getByRole('img', { name: 'Group' })).toBeVisible()
  await expect(sceneTree).toHaveScreenshot('scene-tree-group-component-variant-icons.png', {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.02,
    })
})


test('OpenSpec: component-library / 离线快照与 revision 冲突 / 保留旧版本、覆盖确认并继续渲染', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?component-failure-demo')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const failureControls = page.getByRole('region', { name: '组件容错演示' })
  await expect(failureControls.getByRole('status')).toHaveText('Provider 在线')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rectangleRow = editor.getByRole('treegrid', { name: '场景树' })
    .getByRole('row', { name: /Rectangle/ })
  const assetRootRow = editor.getByRole('treegrid', { name: '资源目录' })
    .getByRole('row', { name: /Demo Assets/ })
  const assetRootBox = await assetRootRow.boundingBox()
  expect(assetRootBox).not.toBeNull()
  await pointerDrop(page, rectangleRow, {
    x: assetRootBox!.x + assetRootBox!.width / 2,
    y: assetRootBox!.y + assetRootBox!.height / 2,
  })
  const createComponent = page.getByRole('dialog', { name: '创建组件' })
  await createComponent.getByLabel('名称').fill('Resilient Card')
  await createComponent.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const projectComponent = editor.getByRole('button', { name: '添加主组件 Resilient Card' })
  await projectComponent.dblclick()
  const componentPanel = editor.locator(
    '[data-workspace-panel="component-document"][data-component-kind="base"]',
  )
  await expect(componentPanel).toBeVisible()
  // 组件根是 Frame，也就是一块场景：它的体不再是选中入口，走 command 点体。
  const componentChild = stage.locator('.compose-stage__scene .compose-stage__node').first()
  await componentChild.click({ modifiers: ['Meta'] })
  await stage.press('ArrowRight')
  // 焦点此刻可能在编辑器外的模拟开关上，因此按在 Stage 上：键位由编辑器根节点捕获。
  const saveComponent = () => stage.press('Control+S')

  // 先模拟另一个客户端推进 revision。取消冲突对话框即保留旧会话，显式覆盖才提交。
  await failureControls.getByRole('button', { name: '模拟组件源 revision 更新' }).click()
  await saveComponent()
  const conflictDialog = page.getByRole('dialog', { name: '组件源已在外部更新' })
  await expect(conflictDialog).toBeVisible()
  await conflictDialog.getByRole('button', { name: '取消' }).click()
  await saveComponent()
  await conflictDialog.getByRole('button', { name: '覆盖保存' }).click()

  await editor.getByRole('button', { name: '关闭 Resilient Card' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()
  await failureControls.getByRole('button', { name: '模拟 Provider 离线' }).click()
  await expect(failureControls.getByRole('status')).toHaveText('Provider 离线')
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // Preview 与 Stage 都只依赖实例保存的 resolvedSnapshot，源 Provider 离线不影响输出。
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })
  await expect(preview.getByTestId('compose-component-instance-content')).toBeVisible()
})


test('创建组件重名时在对话框内提示并允许改名重试', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor.getByRole('application', { name: 'Stage' })).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  async function openCreateDialog() {
    await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
    await editor.getByRole('button', { name: '添加 容器' }).click()
    await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
    const row = sceneTree.getByRole('row').last()
    await row.click()
    await row.click({ button: 'right' })
    await page.getByRole('menuitem', { name: '创建组件…' }).click()
    return page.getByRole('dialog', { name: '创建组件' })
  }

  const first = await openCreateDialog()
  await first.getByLabel('组件名称').fill('Duplicate Card')
  await first.getByRole('button', { name: '创建' }).click()
  await expect(page.getByRole('dialog', { name: '创建组件' })).toHaveCount(0)

  // 重名写入失败必须在对话框内可见，而不是只出现在被遮罩压暗的角落通知里。
  const second = await openCreateDialog()
  await second.getByLabel('组件名称').fill('Duplicate Card')
  await second.getByRole('button', { name: '创建' }).click()
  await expect(second.getByRole('alert')).toContainText('已存在')
  await expect(second).toBeVisible()

  // 改名后可直接重试成功。
  await second.getByLabel('组件名称').fill('Renamed Card')
  await second.getByRole('button', { name: '创建' }).click()
  await expect(page.getByRole('dialog', { name: '创建组件' })).toHaveCount(0)
})


test('OpenSpec: component-library / 实例层结构覆盖 / 内部删除写入覆盖且越界拖拽被拒绝', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Struct Card')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // 第 0 行是默认展开的根画板，实例从第 1 行开始。
  await sceneTree.getByRole('row').nth(1).getByRole('button', { name: /展开/ }).click()
  await sceneTree.getByRole('row').nth(2).getByRole('button', { name: /展开/ }).click()
  await expect(sceneTree.getByRole('row')).toHaveCount(4)
  await expect(stage.locator('[data-component-instance-entity-id]')).toHaveCount(3)

  // 内部子树是封闭编辑域：拖到宿主根等于移出实例，必须整体拒绝且结构不变。
  const rectangleRow = sceneTree.getByRole('row', { name: /Rectangle/ })
  const treeBox = await sceneTree.boundingBox()
  const rowBox = await rectangleRow.boundingBox()
  await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + rowBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    treeBox!.x + treeBox!.width / 2,
    treeBox!.y + treeBox!.height - 30,
    { steps: 6 },
  )
  await page.mouse.up()
  await expect(sceneTree.getByRole('row')).toHaveCount(4)

  // 删除内部实体只写实例覆盖，渲染同步减少一个内部实体。
  await rectangleRow.click()
  await rectangleRow.press('Delete')
  await expect(sceneTree.getByRole('row')).toHaveCount(3)
  await expect(stage.locator('[data-component-instance-entity-id]')).toHaveCount(2)
})


test('OpenSpec: component-library / Apply、Revert 与显式更新 / 组件源保存后实例自动同步', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Sync Card')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  const instanceContent = stage.locator('[data-component-instance-entity-id]').last()
  const before = await instanceContent.boundingBox()
  expect(before?.width).toBe(240)

  // 在组件文档里改内部宽度
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.locator('[data-workspace-panel="component-library"] button')
    .filter({ hasText: 'Sync Card' }).first().dblclick()
  // 场景树切换到组件 Runtime 需要一帧；面板可见早于树内容替换。
  await page.waitForTimeout(800)
  // 必须等组件文档成为活动面板：实例在页面场景树里同名，只等行会命中页面树而不是组件树。
  await expect(editor.locator('[data-workspace-panel="component-document"]')).toBeVisible()
  const componentTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = componentTree.getByRole('row')
  for (let index = 0; index < await rows.count(); index += 1) {
    const toggle = rows.nth(index).getByRole('button', { name: /展开/ })
    if (await toggle.count()) await toggle.click()
  }
  await componentTree.getByRole('row', { name: /Rectangle/ }).click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  // 对象名住在属性面板的**标签**上（`属性 · Rectangle`），面板里不再写第二遍。
  await expect(inspectorTabTitle(editor)).toContainText('Rectangle')
  const width = inspector.getByLabel('尺寸宽度')
  await width.fill('400')
  await width.press('Enter')

  // 保存后无需任何确认，页面里的实例直接跟随
  await stage.press('Control+S')
  await editor.locator('[data-workspace-tab]').filter({ hasText: 'Home' }).click()
  await expect.poll(async () => (await instanceContent.boundingBox())?.width).toBe(400)
})


test('OpenSpec: align-component-variant-with-unity / 实例 Apply 写回主组件', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Apply Card')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  // 再放一个同主组件实例，用于验证写回后自动同步。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加主组件 Apply Card' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(2)
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()

  // 选中实例：改组件根外观（圆角）写入本层覆盖；单选提取后根即内容，无内部再下钻。
  const firstRow = sceneTree.getByRole('row', { name: /Apply Card/ }).first()
  await firstRow.click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expect(inspector.getByRole('toolbar', { name: '实例操作' })).toBeVisible()
  const radius = inspector.getByRole('spinbutton', { name: '边框圆角' })
  await radius.fill('24')
  await radius.press('Enter')
  await expect(radius).toHaveValue('24')
  await expect(inspector.getByText(/项本层覆盖/)).toBeVisible()
  await expect(inspector.getByRole('button', { name: 'Apply 全部实例覆盖' })).toBeEnabled()
  await inspector.getByRole('button', { name: 'Apply 全部实例覆盖' }).click()
  await expect(editor.locator('.compose-editor__page-notice')).toContainText('已写回主组件')

  // 打开主组件文档，根圆角应为 24。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.locator('[data-workspace-panel="component-library"] button')
    .filter({ hasText: 'Apply Card' }).first().dblclick()
  await page.waitForTimeout(800)
  await expect(editor.locator('[data-workspace-panel="component-document"]')).toBeVisible()
  // 组件根现在是 Frame，选中它打开的是 Frame Inspector（不含圆角），因此直接断言渲染结果。
  await expect(
    editor.locator('[data-workspace-panel="component-document"] .compose-stage__scene > .compose-stage__node'),
  ).toHaveCSS('border-radius', '24px')

  // 第二实例应已同步（无冲突覆盖）。
  await editor.locator('[data-workspace-tab]').filter({ hasText: 'Home' }).click()
  await sceneTree.getByRole('row', { name: /Apply Card/ }).nth(1).click()
  await expect(inspector.getByRole('spinbutton', { name: '边框圆角' })).toHaveValue('24')
})


test('OpenSpec: align-component-variant-with-unity / 从实例创建变体并改绑', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const createComponent = page.getByRole('dialog', { name: '创建组件' })
  await createComponent.getByLabel('组件名称').fill('Rebind Card')
  await createComponent.getByRole('button', { name: '创建' }).click()
  await expect(stage.getByTestId('compose-component-instance-content')).toBeVisible()

  const hostRow = sceneTree.getByRole('row', { name: /Rebind Card/ })
  await hostRow.click()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  const radius = inspector.getByRole('spinbutton', { name: '边框圆角' })
  await radius.fill('16')
  await radius.press('Enter')
  await expect(inspector.getByText(/项本层覆盖/)).toBeVisible()
  await inspector.getByRole('button', { name: '创建变体' }).click()
  const variantDialog = page.getByRole('dialog', { name: '创建变体' })
  await expect(variantDialog).toContainText('改绑')
  await variantDialog.getByLabel('变体名称').fill('Rebind Card V2')
  await variantDialog.getByRole('button', { name: '创建变体' }).click()
  await expect(editor.locator('.compose-editor__page-notice')).toContainText(/已创建变体并改绑/)

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const library = editor.locator('[data-workspace-panel="component-library"]')
  await expect(library.getByRole('button', { name: '添加变体 Rebind Card V2' })).toBeVisible()
  // 创建后会打开变体文档；回到页面再断言改绑后的实例已无本层覆盖。
  await editor.locator('[data-workspace-tab]').filter({ hasText: 'Home' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await hostRow.click()
  // 切回页面标签后场景树要重新挂载，直接点旧 locator 会落空导致没有选中项。
  await expect(hostRow).toBeVisible()
  await hostRow.click()
  await expect(inspector.getByRole('button', { name: 'Apply 全部实例覆盖' })).toBeDisabled()

})


