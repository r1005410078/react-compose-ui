import { expect, test } from '@playwright/test'
import { openPageInspector } from './support/test-helpers'

/** 从命令面板执行「新建场景」。 */
async function createScene(page: import('@playwright/test').Page, editor: import('@playwright/test').Locator) {
  await editor.locator('[data-workspace-tab="compose-command"]').click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  const search = commandPanel.getByRole('combobox', { name: '检索命令' })
  await search.fill('新建场景')
  await commandPanel.getByRole('option', { name: /新建场景/ }).click()
  await search.fill('')
}

test('OpenSpec: editor-workspace-layout / 新建场景与激活场景 / 新建第二个场景不改变激活', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  const labels = editor.locator('[data-testid^="stage-container-label-"]')
  await expect(labels).toHaveCount(1)

  await createScene(page, editor)

  // 两块场景各有标题标签，且只有一个带激活标记。
  await expect(editor.locator('[data-testid^="stage-scene-tag-"]')).toHaveCount(2)
  await expect(editor.locator('[data-testid^="stage-scene-tag-"].is-active')).toHaveCount(1)
  // 新场景不自动激活：激活写在页面文件里、不进撤销历史，自动激活会造出
  // 「撤销后场景已删除但激活仍指向它」的悬空状态。
  await expect(editor.getByTestId('stage-scene-tag-frame-root')).toHaveClass(/is-active/)

  // 新建场景改的是文档，可撤销。
  await stage.focus()
  await stage.press('Control+z')
  await expect(editor.locator('[data-testid^="stage-scene-tag-"]')).toHaveCount(1)
})

test('OpenSpec: editor-workspace-layout / 新建场景与激活场景 / 切换激活且撤销不回滚', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await createScene(page, editor)
  const tags = editor.locator('[data-testid^="stage-scene-tag-"]')
  await expect(tags).toHaveCount(2)

  // 激活写的是页面文件，而页面文件里的文档是上次保存的那份：新场景必须先保存才能被激活。
  await stage.focus()
  await page.keyboard.press('Control+s')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // 点非激活场景的标记切换激活。
  const inactive = editor.locator('[data-testid^="stage-scene-tag-"]:not(.is-active)')
  const activatedId = await inactive.evaluate((element) =>
    element.getAttribute('data-testid')!.replace('stage-scene-tag-', ''))
  await inactive.click()
  await expect(editor.getByTestId(`stage-scene-tag-${activatedId}`)).toHaveClass(/is-active/)

  // 页面配置面板的下拉同步。
  await openPageInspector(page, editor)
  await expect(editor.getByRole('combobox', { name: '激活场景' })).toHaveValue(activatedId)

  // 激活写在页面文件里，不进撤销历史：撤销回滚的是文档事务，激活场景保持不变。
  // 刻意撤销一次与场景创建无关的事务——直接撤销掉刚激活的那块场景会混淆两件事。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await stage.focus()
  await stage.press('Control+z')
  await expect(editor.getByTestId(`stage-scene-tag-${activatedId}`)).toHaveClass(/is-active/)
})

test('OpenSpec: editor-workspace-layout / 页面配置面板 / 点空白工作区打开且无尺寸字段', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })

  await openPageInspector(page, editor)
  const inspector = editor.getByRole('region', { name: '页面属性' })
  await expect(inspector.getByRole('combobox', { name: '激活场景' })).toBeVisible()
  await expect(inspector.getByText('页面脚本', { exact: true })).toBeVisible()
  await expect(inspector.getByText('动画', { exact: true })).toBeVisible()
  // 尺寸属于场景，不属于页面。
  await expect(inspector.getByRole('combobox', { name: '尺寸宽度' })).toHaveCount(0)
  await expect(inspector.getByRole('combobox', { name: '常见尺寸' })).toHaveCount(0)
})

test('OpenSpec: stage / 场景标签的激活与预览入口 / 播放按钮以该场景为目标打开预览', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })

  await editor.getByTestId('stage-scene-play-frame-root').click()
  const dialog = page.getByRole('dialog', { name: '文档预览对话框' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: '预览场景' })).toHaveValue('frame-root')
  await expect(dialog.getByTestId('compose-preview-frame')).toBeVisible()
})
