import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { expandInspectorSection, stableBox } from './support/test-helpers'

/** 按内容在画布上点中一条文字：场景树里它们都叫 Text，按名字选不出来。 */
async function selectText(editor: Locator, content: string) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  await stage.getByTestId('compose-material-text').filter({ hasText: content }).first()
    .click({ force: true })
  await expandInspectorSection(
    editor.getByRole('region', { name: 'Text 属性', exact: true }),
    '文字样式',
  )
}

async function fontSizes(editor: Locator) {
  return editor.getByRole('application', { name: 'Stage' }).evaluate((stage) =>
    Object.fromEntries([...stage.querySelectorAll('[data-testid="compose-material-text"]')]
      .map((node) => [node.textContent ?? '', getComputedStyle(node).fontSize])))
}

async function writeText(page: Page, editor: Locator, content: string, at: { x: number; y: number }) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('button', { name: '文字', exact: true }).click()
  await page.mouse.click(at.x, at.y)
  await expect(stage.getByTestId('compose-material-text-editable')).toBeFocused()
  await page.keyboard.insertText(content)
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '选择', exact: true }).click()
}

test('OpenSpec: compose-document / 共享文字样式 / 提取、应用、改一次全改、脱离不改变呈现', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  await expect.poll(() => output.boundingBox()).not.toBeNull()
  const box = await stableBox(output)

  await writeText(page, editor, '电站总数', { x: box.x + 120, y: box.y + 120 })
  await writeText(page, editor, '今日充放电', { x: box.x + 120, y: box.y + 200 })

  const inspector = editor.getByRole('region', { name: 'Text 属性', exact: true })
  await expandInspectorSection(inspector, '文字样式')

  // 提取：从当前这一条取排版值建一条样式，并把它应用上去。
  await inspector.getByRole('textbox', { name: '新样式名称' }).fill('指标数值')
  await inspector.getByRole('button', { name: '提取为样式' }).click()
  await expect(inspector.getByRole('button', { name: '脱离样式' })).toBeVisible()

  // 应用到另一条。
  await selectText(editor, '电站总数')
  await inspector.getByRole('combobox', { name: '文字样式' }).selectOption({ label: '指标数值' })
  await expect(inspector.getByRole('button', { name: '脱离样式' })).toBeVisible()

  /*
   * 改跟随者的字号是**局部覆盖**，只作用于这一条——样式压过本地值的话就没有「这一条标题要
   * 大一号」这档能力了。
   */
  await inspector.getByRole('spinbutton', { name: '字号' }).fill('26')
  await inspector.getByRole('spinbutton', { name: '字号' }).press('Enter')
  await expect.poll(() => fontSizes(editor))
    .toEqual({ 电站总数: '26px', 今日充放电: '12px' })

  // 「把这一条写回样式」是另一个意图：改一次，所有跟随者一起变。
  await expandInspectorSection(inspector, '文字样式')
  await inspector.getByRole('button', { name: '把这一条写回样式' }).click()
  await expect.poll(() => fontSizes(editor))
    .toEqual({ 电站总数: '26px', 今日充放电: '26px' })

  // 脱离是「把跟随换成自己写下」，不是一次外观改动——呈现逐像素不变。
  await inspector.getByRole('button', { name: '脱离样式' }).click()
  await expect(inspector.getByRole('button', { name: '提取为样式' })).toBeVisible()
  await expect.poll(() => fontSizes(editor))
    .toEqual({ 电站总数: '26px', 今日充放电: '26px' })
})

test('OpenSpec: compose-document / 共享文字样式 / 重命名、多选批量应用与删除', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  await expect(output).toBeVisible()
  await expect.poll(() => output.boundingBox()).not.toBeNull()
  const box = await stableBox(output)

  await writeText(page, editor, '电站总数', { x: box.x + 120, y: box.y + 120 })
  await writeText(page, editor, '今日充放电', { x: box.x + 120, y: box.y + 200 })

  const inspector = editor.getByRole('region', { name: 'Text 属性', exact: true })
  await expandInspectorSection(inspector, '文字样式')

  // 先把这一条调大，样式才有一个能在屏幕上读出来的值。
  await inspector.getByRole('spinbutton', { name: '字号' }).fill('26')
  await inspector.getByRole('spinbutton', { name: '字号' }).press('Enter')
  await expandInspectorSection(inspector, '文字样式')
  await inspector.getByRole('textbox', { name: '新样式名称' }).fill('指标数值')
  await inspector.getByRole('button', { name: '提取为样式' }).click()

  // 重命名走的是同一条 upsert：id 不变，因此这一条照旧跟着它。
  await inspector.getByRole('textbox', { name: '样式名称' }).fill('数值')
  await inspector.getByRole('textbox', { name: '样式名称' }).press('Enter')
  await expect(inspector.getByRole('combobox', { name: '文字样式' }))
    .toHaveValue(/^style-/)
  await expect(inspector.getByRole('option', { name: '数值' })).toHaveCount(1)

  // 多选：两条一起选中，面板只多出样式一段。
  await stage.getByTestId('compose-material-text').filter({ hasText: '电站总数' }).first()
    .click({ force: true })
  await stage.getByTestId('compose-material-text').filter({ hasText: '今日充放电' }).first()
    .click({ force: true, modifiers: ['Shift'] })
  const batchSelect = editor.getByRole('combobox', { name: '文字样式' })
  await expect(batchSelect).toBeVisible()
  await batchSelect.selectOption({ label: '数值' })
  await expect.poll(() => fontSizes(editor))
    .toEqual({ 电站总数: '26px', 今日充放电: '26px' })

  /*
   * 删除不追着解除引用：跟随者的引用变成悬空，而被管辖的字段在「应用」那一步就已经从它们
   * 身上删掉了，因此两条都回到默认排版——这是一次看得见的改动，数量写在确认框里。
   */
  await editor.getByRole('button', { name: '删除样式' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('正被 2 处跟随')
  await dialog.getByRole('button', { name: '删除' }).click()
  /*
   * 两条一起回到 24px——那是 props 缺席时样式表给的值，而不是新建文字写下的 12：新建会把
   * `DEFAULT_TEXT_PROPS` 显式写进 props，而「应用样式」把被管辖的键删掉了，样式没了就谁也
   * 不再给这个字段。断言写死这个数是有意的：它正是「跟随者不追着解除引用」这条的可见后果。
   */
  await expect.poll(() => fontSizes(editor))
    .toEqual({ 电站总数: '24px', 今日充放电: '24px' })
})
