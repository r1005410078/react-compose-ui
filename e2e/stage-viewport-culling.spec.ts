import { expect, test } from '@playwright/test'

/**
 * 视口裁剪在一份真实现场图纸上的验收。
 *
 * @remarks
 * 断的是**节点数**而不是帧时间：帧时间与机器、构建模式和后台负载都相关，写进 CI 就是一条会
 * 随机红的用例。实测数字记在 `openspec/changes/add-stage-viewport-culling/tasks.md`。
 *
 * 判别性的那一半是**最后一步**：缩回整张图都在可视区的那一档时，节点数必须一个不差地回到
 * 适配时的那个数。只断「放大之后节点变少了」的话，一个把什么都裁掉的实现照样绿。
 */
test('OpenSpec: stage / 场景只渲染与裁剪窗口相交的子树 / 真实图纸', async ({ page }) => {
  // 一遍完整导入（十几秒），并发跑整套用例时还要抢 CPU。
  test.setTimeout(180_000)
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(String(error)))

  // 这条用例要的正是自动适配：适配之后整张图都落在可视区里，那一档的可见集必须是全集。
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  await editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })
    .getByRole('gridcell', { name: /^EMS\.dxf/ })
    .dblclick()
  await expect(editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'EMS' })).toHaveCount(1, { timeout: 90_000 })

  const stage = editor.getByRole('application', { name: 'Stage' })
  const nodes = stage.locator('[data-entity-id]')
  // 图面拿到焦点，缩放快捷键才到得了 Stage。点左上角是空白处，不会选中任何东西。
  await stage.click({ position: { x: 5, y: 5 } })

  /*
   * 大图上换窗之后的挂与卸是**分批**的（见 `stage-scene-layer.tsx`：补进来的节点按构造落在
   * 可视区之外，晚几帧到达用户看不见）。因此节点数是最终一致的，读它必须先等稳定——直接
   * 读一次会读到还在路上的那个中间值。
   */
  const settledCount = async () => {
    let previous = -1
    await expect.poll(async () => {
      const current = await nodes.count()
      const stable = current === previous && current > 0
      previous = current
      return stable
    }, { timeout: 30_000, intervals: [250] }).toBe(true)
    return previous
  }

  // 1) 整张图都在可视区时，每一个实体都必须在 DOM 里
  const fitted = await settledCount()
  expect(fitted).toBeGreaterThan(1000)

  // 2) 放大之后，屏外的子树不建节点
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Control+Equal')
  expect(await settledCount()).toBeLessThan(Math.floor(fitted / 4))

  // 3) 缩回去，一个不少地回来
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Control+Minus')
  expect(await settledCount()).toBe(fitted)

  expect(failures).toEqual([])
})
