import { expect, test } from '@playwright/test'
import { expandInspectorSection, pointerDrop } from './support/test-helpers'

/**
 * 页面预览渲染 Provider 里已保存的页面，因此示例用 `?page-preview` 显式开启；
 * 默认的文档预览仍然渲染当前编辑中的文档。
 */
test('OpenSpec: 页面宿主与跳转执行 / 页面预览内跳转与返回', async ({ page }) => {
  await page.goto('/?no-auto-fit&page-preview')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })

  // 首页是清单里的 demo-home-page，它只有一个跳转入口。
  const goToCounter = preview.getByRole('button', { name: '去计数器' })
  await expect(goToCounter).toBeVisible()

  await goToCounter.click()
  // 计数器页面到达：它的绑定文本与返回入口同时出现。
  await expect(preview.getByRole('button', { name: '返回' })).toBeVisible()
  await expect(preview.getByTestId('compose-material-text').first()).toHaveText('0')
  await expect(goToCounter).toBeHidden()

  await preview.getByRole('button', { name: '返回' }).click()
  await expect(preview.getByRole('button', { name: '去计数器' })).toBeVisible()

  await preview.getByRole('button', { name: '关闭预览' }).click()
})

test('OpenSpec: 页面宿主与跳转执行 / 键盘触发跳转', async ({ page }) => {
  await page.goto('/?no-auto-fit&page-preview')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })

  const goToCounter = preview.getByRole('button', { name: '去计数器' })
  await goToCounter.focus()
  await page.keyboard.press('Enter')
  await expect(preview.getByRole('button', { name: '返回' })).toBeVisible()
})

test('OpenSpec: 编辑期 Interaction 不改变命中与行为 / 画布点击只选中', async ({ page }) => {
  // 跳转入口只在导航演示下出现；默认首页保持空白，供其余用例作为确定起点。
  await page.goto('/?no-auto-fit&page-preview')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const target = stage.getByTestId('stage-entity-demo-home-goto-counter')
  await expect(target).toBeVisible()

  await target.click()
  // 画布是布局态：点击带跳转的 Entity 只选中它，不加载任何页面、不换内容。
  await expect(editor.getByRole('region', { name: '去计数器 属性', exact: true })).toBeVisible()
  await expect(target).toBeVisible()
  // 编辑期不应出现 button 语义——那是预览宿主才建立的。
  await expect(stage.getByRole('button', { name: '去计数器' })).toHaveCount(0)
})

/**
 * 回归：配好跳转但**尚未保存**时，预览必须包含这条交互。
 *
 * 页面预览渲染的是 Provider 里的页面，而刚画出来的东西只存在于编辑中的文档；宿主不把
 * live 文档交给页面宿主的话，用户会看到上次保存的内容，以为「交互没生效」。
 */
test('OpenSpec: 页面宿主与跳转执行 / 未保存的跳转在预览中生效', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  // 1) 在首页上画一个矩形——只存在于编辑中的文档，标签页处于未保存状态。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(frame).toBeVisible()
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox!.x + 200,
    y: frameBox!.y + 160,
  })
  const rectangle = stage.getByTestId('stage-entity-stage-demo-0')
    .or(stage.locator('[data-testid^="stage-entity-"]').filter({ hasText: '' }).last())
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .getByRole('img', { name: '有未保存改动' })).toBeVisible()

  // 2) 通过 Inspector 给它配一条点击跳转。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加交互' }).click()
  await expandInspectorSection(inspector, '交互')
  const nodeField = inspector.getByTestId('semantic-editor-node')
  await expect(nodeField).toBeVisible()
  await nodeField.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Counter' }).click()

  // 3) 不保存直接预览：矩形与它的跳转都必须在。
  await editor.getByRole('button', { name: '打开预览' }).click()
  const preview = page.getByRole('dialog', { name: '文档预览对话框' })
  const target = preview.getByRole('button', { name: 'Rectangle' })
  await expect(target).toBeVisible()

  await target.click()
  // 落到 Counter 页面：它的计数文本来自页面 setup 绑定。
  await expect(preview.getByTestId('compose-material-text').first()).toHaveText('0')
  void rectangle
})
