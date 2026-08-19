import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { emptyWorkspaceRect, openPageInspector } from './support/test-helpers'

/** 在所有场景之外画一个容器，得到第二块场景并返回它的 Entity id。 */
async function createSecondScene(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const region = await emptyWorkspaceRect(page, editor)
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
  // 绑定动画写的是页面文件，而页面文件里的文档是**上次保存**的那份：新场景必须先保存，
  // 否则 Store 会以「不是 Frame」拒绝这次绑定。
  await stage.focus()
  await page.keyboard.press('Control+s')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)
  const ids = await stage.locator('[data-testid^="stage-frame-boundary-"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-frame-id')!))
  return ids.find((id) => id !== 'frame-root')!
}

/** 在当前作用域场景创建一条动画并打一个关键帧。 */
async function createAnimationWithKeyframe(editor: Locator) {
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await editor.getByRole('radio', { name: '动画' }).click()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await expect(animationPanel.getByRole('slider', { name: '当前时间' })).toBeVisible()
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
  await editor.getByRole('radio', { name: '设计' }).click()
}

test('OpenSpec: editor-workspace-layout / 动画模式 / 选中另一块场景内的对象切换作用域', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  // 场景 1 里放一个矩形并给激活场景建动画。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const sceneOneRect = stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer')
  await sceneOneRect.click()
  await createAnimationWithKeyframe(editor)

  // 第二块场景还没有动画：选中它就应当看到空态，而不是场景 1 的时间线。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()

  // 选回场景 1 的对象，时间线切回场景 1 的动画。
  await editor.getByRole('radio', { name: '设计' }).click()
  await sceneOneRect.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
})

test('OpenSpec: editor-workspace-layout / 多场景动画会话 / 两块场景各自建动画并保存', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const sceneOneRect = stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer')
  await sceneOneRect.click()
  await createAnimationWithKeyframe(editor)

  // 第二块场景里也放一个矩形并建自己的动画。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const sceneTwoRect = stage.locator(`[data-entity-id="${sceneTwoId}"] .compose-stage__node.is-renderer`)
  await expect(sceneTwoRect).toHaveCount(1)
  await sceneTwoRect.click()
  await createAnimationWithKeyframe(editor)

  // 两块场景各有一条动画，互不覆盖：来回切换都看得到自己的关键帧。
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(1)
  await editor.getByRole('radio', { name: '设计' }).click()
  await sceneOneRect.click()
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toHaveCount(1)

  // 保存把两块场景的清单合并回同一份文件，保存后不再有未保存标记。
  await editor.getByRole('radio', { name: '设计' }).click()
  await stage.focus()
  await page.keyboard.press('Control+s')
  await expect(editor.getByRole('img', { name: '有未保存改动' })).toHaveCount(0)

  // 一页只有一份动画文件：两块场景是同一份文件里的两个分区，不该增生出第二个文件。
  // 文件选择器列出页面同目录下的全部动画文件，因此选项数 = 占位项 + 文件数。
  await openPageInspector(page, editor)
  const fileSelect = editor.getByRole('region', { name: '页面属性' })
    .getByRole('combobox', { name: '动画文件' })
  await expect(fileSelect.locator('option')).toHaveCount(2)
})

test('OpenSpec: editor-workspace-layout / 动画模式 / 清空选择回退到激活场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await stage.locator('[data-entity-id="frame-root"] .compose-stage__node.is-renderer').click()
  await createAnimationWithKeyframe(editor)

  // 建第二块场景并选中它——作用域跟着走，看到空态。
  const sceneTwoId = await createSecondScene(page, editor)
  await editor.getByTestId(`stage-container-label-${sceneTwoId}`).click()
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByText('当前页面还没有动画')).toBeVisible()

  // 清空选择：回退到激活场景（仍是第一块），时间线回到它的动画。
  await editor.getByRole('radio', { name: '设计' }).click()
  await openPageInspector(page, editor)
  await editor.getByRole('radio', { name: '动画' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()
})
