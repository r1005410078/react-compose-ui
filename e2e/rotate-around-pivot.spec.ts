import { expect, test } from '@playwright/test'

/**
 * 画布旋转手势绕 Entity 自己的旋转基点。
 *
 * @remarks
 * 判别性全在**非中心基点**上：默认基点就是盒中心，绕包围盒中心与绕基点转是同一件事，用默认
 * 基点写的用例两种实现都能通过。因此这里必须先把基点设到左边中点——刀闸的铰点就在刀身一端。
 *
 * 症状有两个面，都要断：拖动中与松手后的盒不一致（提交时跳一下），以及动画模式下「只想刻
 * 角度」却连带写出一条位置轨道。
 */
test('OpenSpec: stage-engine / 旋转工具插件 / 非中心基点下只刻角度不写位置', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  const first = stage.locator('.compose-stage__node.is-renderer').first()
  await first.click()
  const entityId = await first.getAttribute('data-entity-id')
  expect(entityId).not.toBeNull()
  const node = stage.locator(`[data-entity-id="${entityId}"]`)

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('combobox', { name: '旋转基点' }).selectOption('middle-left')
  const position = () => inspector.getByRole('spinbutton').evaluateAll((nodes) =>
    nodes
      .map((element) => `${element.getAttribute('aria-label')}=${(element as HTMLInputElement).value}`)
      .filter((text) => text.startsWith('位置')))
  const before = await position()

  // 动画模式下拖着转：自动记录会把这次编辑改写成播放头处的关键帧。
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await editor.getByRole('radio', { name: '动画' }).click()
  await animationPanel.getByRole('button', { name: '创建动画' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')

  await expect.poll(() => node.boundingBox()).not.toBeNull()
  const box = (await node.boundingBox())!
  const hinge = { x: box.x, y: box.y + box.height / 2 }
  await editor.getByRole('button', { name: '旋转', exact: true }).click()
  const from = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(hinge.x, hinge.y + (from.x - hinge.x), { steps: 10 })
  const during = (await node.boundingBox())!
  await page.mouse.up()
  const after = (await node.boundingBox())!

  // 松手不跳：世界矩阵与分解拿的是同一个基点，提交因此不需要靠位移去补差额。
  expect(after.x).toBeCloseTo(during.x, 0)
  expect(after.y).toBeCloseTo(during.y, 0)

  // 只写角度轨道。位置一并被写出来时，用户会发现自己「刻了个角度，位置也被刻了一帧」。
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: /关键帧 \d+ ms：位置/ })).toHaveCount(0)

  // 位置字段一个字没动。
  await editor.getByRole('radio', { name: '设计' }).click()
  expect(await position()).toEqual(before)
})
