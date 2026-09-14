import { expect, test } from '@playwright/test'

/**
 * 一份真实现场图纸的导入。
 *
 * @remarks
 * `EMS.dxf` 是 AC1024 导出的监控柜图纸：五千多个实体、四个块（其中一个是 `A$` 开头的匿名
 * 块）、以及 `TRACE` / `HATCH` / `MTEXT` / `ELLIPSE` 这些我们表达不了的实体。手写的小夹具
 * 覆盖不到这些——量级与脏数据只在真实文件上才出现。
 *
 * 断言刻意不锁实体数量：图纸会被替换，而这条用例要钉的是**导入不失败、内容看得见、
 * 导不了的被报告**这三件事。
 */
test('OpenSpec: dxf-import / 资源浏览器上的导入为页面 / 真实图纸', async ({ page }) => {
  // 一遍完整导入；并发跑整套用例时要抢 CPU。
  test.setTimeout(180_000)
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(String(error)))

  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()

  const assets = editor.locator('[data-workspace-panel="asset-browser"]')
  const rootGrid = assets.getByRole('grid', { name: 'Demo Assets' })
  await rootGrid.getByRole('gridcell', { name: /^EMS\.dxf/ }).dblclick()

  // 1) 导入产出一份新页面并打开它
  const pageTab = editor.locator('[data-workspace-tab^="compose-page-document:"]').filter({ hasText: 'EMS' })
  await expect(pageTab).toHaveCount(1, { timeout: 90_000 })

  // 2) 提示是「部分内容未能完整导入」，不是失败
  const notice = editor.locator('.compose-editor__page-notice')
  await expect(notice).toContainText('部分内容未能完整导入')
  await expect(notice).not.toContainText('导入失败')
  await expect(notice).not.toContainText('非法')

  // 3) 块变成组件文件，含那个 `A$` 开头的匿名块——它是文件名里带 `$` 的唯一来源
  await expect(rootGrid.getByRole('gridcell', { name: /^A\$/ })).toHaveCount(1)

  /*
   * 4) 内容真的画出来了。场景树是虚拟化的，DOM 里只有可见的那些行，因此这里断的是「有行」
   *    而不是行数——按实体总数断会得到一条永远红的用例。
   */
  const rows = editor.getByRole('treegrid', { name: '场景树' }).locator('[data-scene-node-id]')
  expect(await rows.count()).toBeGreaterThan(0)
  /*
   * 轴对齐的线包围盒有一个轴是零，而 Playwright 把零面积当作不可见——因此这里数个数而不是
   * 断可见。图纸上大量是水平/竖直线，用 `toBeVisible` 会得到一条随机红的用例。
   */
  const stage = editor.getByRole('application', { name: 'Stage' })
  expect(await stage.getByTestId('compose-material-curve-stroke').count()).toBeGreaterThan(0)

  expect(failures).toEqual([])
})

/**
 * 同一份图纸导入两次不该报错。
 *
 * @remarks
 * 块名天生会撞：`CCSYM00200102` 这类名字来自标准符号库，同一家设计院出的两张图会带着同名的
 * 块，再导一次同一张图更是必撞。此前第二次导入抛的是 `Asset "A3.component.json" already
 * exists`——一句用户看不懂、也没做错任何事的错。
 *
 * 判别性的一半是**第二次也要出诊断提示**：只断「没有 already exists」的话，一个默默什么都
 * 不做的实现照样绿。
 */
test('OpenSpec: dxf-import / 资源浏览器上的导入为页面 / 同一份图纸导入两次', async ({ page }) => {
  // 这条要跑两遍完整导入（每遍十几秒），并发跑整套用例时还要抢 CPU。
  test.setTimeout(240_000)
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  await editor.locator('[data-workspace-tab="compose-assets"]').click()
  const rootGrid = editor.locator('[data-workspace-panel="asset-browser"]')
    .getByRole('grid', { name: 'Demo Assets' })

  const openTabs = () => editor.locator('[data-workspace-tab^="compose-page-document:"]')
    .filter({ hasText: 'EMS' })
  await rootGrid.getByRole('gridcell', { name: /^EMS\.dxf/ }).dblclick()
  await expect(openTabs()).toHaveCount(1, { timeout: 90_000 })

  await rootGrid.getByRole('gridcell', { name: /^EMS\.dxf/ }).first().dblclick()
  await expect(openTabs()).toHaveCount(2, { timeout: 90_000 })

  /*
   * 提示位只有一个，成功与失败共用：真撞名时它写的是 `Asset "…" already exists`，而导入在
   * 那一步就中断了、根本走不到诊断。因此断「它写着诊断」已经足够判别，不需要再断一次
   * 「它没写 already exists」——而后者还易碎：第二个文档打开会带走提示条。
   */
  await expect(editor.locator('.compose-editor__page-notice'))
    .toContainText('部分内容未能完整导入', { timeout: 30_000 })
  /*
   * 后缀本身由 `asset-naming.test.ts` 断言（`A3-2.component.json`，且仍是合法组件文件名）。
   * 这里**不重复断资源列表**：那条断言在并发跑整套用例时不稳定，而它证明的事已经被那个
   * 纯函数用例决定性地覆盖了。本用例独有的是上面那句——两次导入都走完、都出诊断而不是
   * 抛 `already exists`。
   */
})
