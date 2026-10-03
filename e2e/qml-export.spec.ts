import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 「导出为 QML」从应用菜单触发，导出的是画布正在画的那一份——含尚未保存的改动。
 *
 * 判别点是**同一个会话里导出两次**：画矩形之前导出一次、之后不保存再导出一次。只断言第二次
 * 含有形状的话，一份「导出上次保存的文档」的实现在这个夹具上同样可能通过（如果首页本来就有
 * 形状），而第一次导出没有形状把这条路堵死了。
 */
async function exportFromAppMenu(page: Page) {
  await page.getByRole('button', { name: '应用菜单' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: '导出为 QML' }).click()
  const download = await downloadPromise
  return { name: download.suggestedFilename(), qml: readFileSync(await download.path(), 'utf8') }
}

test('OpenSpec: qml-export / 编辑器导出入口 / 导出含未保存改动的场景', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()

  const before = await exportFromAppMenu(page)
  expect(before.name).toMatch(/\.qml$/)
  expect(before.qml).toMatch(/^import QtQuick$/m)
  expect(before.qml).not.toContain('Shape {')
  await expect(editor.getByRole('status').filter({ hasText: '已导出 QML' })).toBeVisible()

  // 用 RECTANGLE 命令画一个矩形（闭合多段线），不保存。
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('RECTANGLE')
  await commandInput.press('Enter')
  const box = await stableBox(surface)
  await page.mouse.click(box.x + 120, box.y + 120)
  await page.mouse.click(box.x + 260, box.y + 220)
  await expect(stage.getByTestId('compose-material-curve-stroke')).toHaveCount(1)

  const after = await exportFromAppMenu(page)
  expect(after.qml.match(/Shape \{/g)).toHaveLength(1)
  // 矩形是四顶点闭合多段线：起点加四段（含回到起点的那一段）。
  expect(after.qml.match(/PathLine \{/g)).toHaveLength(4)
})

test('OpenSpec: qml-export / 编辑器导出时逐实例准备与求解 / 导出含实例的场景', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 容器' }).click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = editor.getByRole('treegrid', { name: '场景树' }).getByRole('row', { name: /Container/ })
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('符号')
  await dialog.getByRole('button', { name: '创建' }).click()
  await expect(editor.getByTestId('compose-component-instance-content')).toBeVisible()

  const { qml } = await exportFromAppMenu(page)
  // 实例内部的对象按复合地址写 objectName，矩形在实例里展开成形状而不是占位。
  expect(qml).toMatch(/objectName: "[^"/]+\/[^"]+"/)
  expect(qml).toContain('Shape {')
  const notice = editor.getByRole('status').filter({ hasText: '已导出 QML' })
  await expect(notice).toBeVisible()
  await expect(notice).not.toContainText('没有可用的嵌套求解结果')
})
