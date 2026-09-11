import { expect, test } from '@playwright/test'
import { pointerDrop } from './support/test-helpers'

/**
 * 从页面场景树的实例行进入组件、返回并还原选区。
 *
 * @remarks
 * 先用既有的「拖到资源目录创建组件」流程造出一个实例——这条路径已经由 component-library
 * 的用例覆盖，这里只借它准备夹具。
 */
test('OpenSpec: editor-workspace-layout / 场景树进入组件与返回 / 从实例行进入并返回', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const assetRootRow = editor.getByRole('treegrid', { name: '资源目录' })
    .getByRole('row', { name: /Demo Assets/ })
  const assetRootBox = await assetRootRow.boundingBox()
  expect(assetRootBox).not.toBeNull()
  await pointerDrop(page, sceneTree.getByRole('row', { name: /Rectangle/ }), {
    x: assetRootBox!.x + assetRootBox!.width / 2,
    y: assetRootBox!.y + assetRootBox!.height / 2,
  })

  const createComponent = page.getByRole('dialog', { name: '创建组件' })
  await createComponent.getByLabel('名称').fill('Breaker')
  await createComponent.getByRole('button', { name: '创建' }).click()
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toBeVisible()

  // 进入之前：页面文档的根行没有返回控件可按。
  await expect(sceneTree.locator('[data-scene-exit="true"]')).toHaveCount(0)
  const tabs = editor.getByRole('tablist', { name: '文档' }).getByRole('tab')
  const tabsBefore = await tabs.count()
  const canvasPanel = editor.locator('[data-workspace-panel="canvas"]')
  await expect(canvasPanel).not.toHaveAttribute('data-entry-layer', 'true')

  const instanceRow = sceneTree.getByRole('row', { name: /Breaker/ })
  await instanceRow.click()
  await expect(instanceRow).toHaveAttribute('aria-selected', 'true')
  await instanceRow.getByRole('button', { name: /^进入 / }).click()

  // 树整棵换成组件文档：页面上那个实例不在这份文档里，根行成为来路出口。
  const exitRow = sceneTree.locator('[data-scene-exit="true"]')
  await expect(exitRow).toHaveCount(1)
  await expect(exitRow).toContainText('Breaker')
  await expect(sceneTree.getByRole('img', { name: '组件实例' })).toHaveCount(0)

  /*
   * 进入是当前文档上的一次导航，不是打开了另一份文件：标签条一格不多，高亮仍停在来路那条，
   * 而画布给出一处不依赖文字的模式提示——层没有关闭控件，唯一的出口是返回。
   */
  await expect(tabs).toHaveCount(tabsBefore)
  await expect(canvasPanel).toHaveAttribute('data-entry-layer', 'true')
  await expect(editor.locator('[data-component-asset-key]')).toHaveCount(1)

  // 返回：来路那个实例重新被选中，而不是落在空选区。
  await exitRow.getByRole('button', { name: '返回上一层' }).click()
  await expect(sceneTree.locator('[data-scene-exit="true"]')).toHaveCount(0)
  await expect(sceneTree.getByRole('row', { name: /Breaker/ }))
    .toHaveAttribute('aria-selected', 'true')

  // 干净地返回即丢弃：那份组件会话被关掉，标签条上没有因为这次进入留下任何东西。
  await expect(tabs).toHaveCount(tabsBefore)
  await expect(canvasPanel).not.toHaveAttribute('data-entry-layer', 'true')
  await expect(editor.locator('[data-component-asset-key]')).toHaveCount(0)

  // 再次进入仍然只有一份组件会话。
  await sceneTree.getByRole('row', { name: /Breaker/ })
    .getByRole('button', { name: /^进入 / })
    .click()
  await expect(sceneTree.locator('[data-scene-exit="true"]')).toHaveCount(1)
  await expect(editor.locator('[data-component-asset-key]')).toHaveCount(1)
  await expect(tabs).toHaveCount(tabsBefore)
})
