import { expect, test } from '@playwright/test'

/**
 * 组件内动画在实例里播放的纵向流程。
 *
 * @remarks
 * 判别点是**两个**实例：只放一个的话，把播放头做成全局单值的实现同样能全绿。「粒度」这个
 * 问题在屏幕上的样子，就是同一帧里同一个组件的两个实例姿态不同。
 *
 * 用示例应用预置的「刀闸」组件而不是当场做一个：目前没有任何 UI 路径能把动画做进组件文档
 * （设计/动画模式切换器只挂在页面文档，创建组件也不搬运动画清单），那是下一刀的事，
 * 本刀交付的是**播放**。
 */
test('OpenSpec: basic-materials / 组件实例的动画播放头 / 两个实例各绑一个导出各走各的姿态', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit&switch-demo')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')

  // 放两个同一组件的实例。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const addSwitch = editor.getByRole('button', { name: '添加主组件 刀闸' })
  await addSwitch.click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(1)
  await addSwitch.click()
  await expect(stage.getByTestId('compose-component-instance-content')).toHaveCount(2)

  const blades = stage.locator('[data-component-instance-entity-id="demo-switch-blade"]')
  await expect(blades).toHaveCount(2)
  // 起点：两个实例都没配动画，因此都停在作者姿态。这一步同时证明「还没配」是合法状态。
  expect(await blades.nth(0).evaluate((el) => (el as HTMLElement).style.transform))
    .toBe('rotate(0deg)')

  // 两个实例各绑一个页面导出：openMs 是 0，closedMs 是 200（动画时长也是 200）。
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const instanceRows = sceneTree.getByRole('row', { name: /刀闸/ })
  await expect(instanceRows).toHaveCount(2)

  const bindPlayhead = async (rowIndex: number, exportName: string) => {
    await instanceRows.nth(rowIndex).click()
    await inspector.getByRole('combobox', { name: '动画' }).selectOption('demo-switch-clip')
    // 绑定入口悬停显隐：先悬停「播放头」行让入口可见。
    await inspector.locator('[data-property-path="animationTime"]').hover()
    await inspector.getByRole('button', { name: /绑定\s*播放头/u }).click()
    const picker = page.getByRole('dialog')
    await picker.getByText(exportName, { exact: true }).click()
  }
  await bindPlayhead(0, 'openMs')
  await bindPlayhead(1, 'closedMs')

  /*
   * 断言读的是嵌套闸刀真实拿到的 transform。
   *
   * 两个实例在页面上本来就摆在不同位置，读屏幕绝对坐标只能证明「它们不在一处」，
   * 那与播放头毫无关系；旋转角是实例内部的姿态，只可能来自采样。
   */
  await expect
    .poll(async () => blades.nth(0).evaluate((el) => (el as HTMLElement).style.transform))
    .toBe('rotate(0deg)')
  await expect
    .poll(async () => blades.nth(1).evaluate((el) => (el as HTMLElement).style.transform))
    .toBe('rotate(-60deg)')
})
