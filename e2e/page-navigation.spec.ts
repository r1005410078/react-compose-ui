import { expect, test } from '@playwright/test'

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
