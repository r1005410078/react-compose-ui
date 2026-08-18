import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function pointerDrop(page: Page, source: Locator, target: { x: number; y: number }) {
  const sourceBox = await source.boundingBox()
  expect(sourceBox).not.toBeNull()
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.mouse.up()
}

/** 通过新的画布工具流创建一个可供后续断言操作的 Container。 */
export async function drawContainer(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '创建容器' }).click()
  await page.mouse.move(outputBox!.x + 48, outputBox!.y + 64)
  await page.mouse.down()
  await page.mouse.move(outputBox!.x + 696, outputBox!.y + 424, { steps: 4 })
  await page.mouse.up()
  await expect(stage.getByTestId('stage-container')).toBeVisible()
  await editor.getByRole('button', { name: '选择', exact: true }).click()
}

/**
 * 用工具栏文本工具在指定位置创建一个内容为 `Text` 的实体。
 *
 * Text Preset 默认不在组件库 Palette 中（工具栏已提供入口），因此需要文本实体的用例
 * 走工具栏创建，而不是从 Palette 拖入。
 */
export async function drawText(page: Page, editor: Locator, at: { x: number; y: number }) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const before = await stage.getByTestId('compose-material-text').count()
  await editor.getByRole('button', { name: '文字' }).click()
  await page.mouse.click(at.x, at.y)
  // 文字只按点创建，且以空内容进入编辑；空内容退出会被删除，所以这些用例先键入内容再提交。
  // 聚焦推迟一帧以避开 pointerdown 默认动作，打字前先等焦点落定。
  await expect(stage.getByTestId('compose-material-text-editable')).toBeFocused()
  await page.keyboard.type('Text')
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '选择', exact: true }).click()
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(before + 1)
}

/**
 * 选中一个顶层容器。
 *
 * 非空容器的选中入口已经收敛到画布标题标签，点容器体只会起框选。
 */
export async function selectContainer(editor: Locator, index = 0) {
  // 根 Frame 同样带标题标签（画板也是容器）；这里只在被测的普通容器里数序号。
  await editor
    .locator('[data-testid^="stage-container-label-"]:not([data-testid$="frame-root"])')
    .nth(index)
    .click()
}

export async function enableAutoLayout(inspector: Locator) {
  await inspector.getByRole('button', { name: '添加布局' }).click()
  await inspector.getByRole('menuitem', { name: 'Auto Layout display: flex' }).click()
}

export async function selectAxisSizing(inspector: Locator, axis: '宽度' | '高度', mode: 'Fill' | 'Hug') {
  const input = inspector.getByRole('combobox', { name: `尺寸${axis}` })
  await input.fill(mode)
  await input.press('Enter')
}

export async function expandInspectorSection(inspector: Locator, name: string) {
  const trigger = inspector.getByRole('button', { name, exact: true })
  if (await trigger.getAttribute('aria-expanded') === 'false') {
    await trigger.click()
  }
}
