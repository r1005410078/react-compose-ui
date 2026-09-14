import { expect, test } from '@playwright/test'

/**
 * 细节裁剪在一份真实现场图纸上的验收。
 *
 * @remarks
 * 断的是**文字节点数**：这张图的文字高度只有 2.5–5 个图纸单位，适配之后字号不到两个像素，
 * 物料声明的可读下限（盒高 5 像素）之下一个都不该建节点；放大到能读之后要回来。判别性的那
 * 一半是**选中**：被裁掉的文字被框选进选择集之后必须当场有节点——裁剪只影响渲染，而选区盒与
 * 属性面板都要它在。帧时间不进断言，数字记在
 * `openspec/changes/add-stage-detail-culling/tasks.md`。
 */
test('OpenSpec: stage / 场景只渲染与裁剪窗口相交的子树 / 读不出来的文字不建节点', async ({ page }) => {
  test.setTimeout(180_000)
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(String(error)))

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
  // 只数实体自己的文字物料：组件实例内部的文字属于实例，而实例作为整体不声明可读下限。
  const texts = stage.locator('[data-entity-id] > .compose-material--text')
  await stage.click({ position: { x: 5, y: 5 } })

  // 大图上节点数是最终一致的（分批），读它之前先等稳定。
  const settled = async (locator: typeof nodes) => {
    let previous = -1
    await expect.poll(async () => {
      const current = await locator.count()
      const stable = current === previous
      previous = current
      return stable
    }, { timeout: 30_000, intervals: [250] }).toBe(true)
    return previous
  }

  // 1) 适配档：图在（曲线都在），字一个都不建
  expect(await settled(nodes)).toBeGreaterThan(1000)
  expect(await settled(texts)).toBe(0)

  // 2) 框选进选择集的字当场有节点：从右上往左下拖（窗交判定），起止点都落在场景带外的空白处
  //    ——图面底部坐着命令行，因此按场景的包围盒定位而不是按图面中心。
  const scene = (await stage.locator('[data-testid^="stage-frame-"]').first().boundingBox())!
  const cx = scene.x + scene.width / 2
  await page.mouse.move(cx + 60, scene.y - 30)
  await page.mouse.down()
  await page.mouse.move(cx - 60, scene.y + scene.height + 20, { steps: 5 })
  await page.mouse.up()
  expect(await settled(texts)).toBeGreaterThan(0)
  // 记下其中一个文字的屏幕位置：下面以它为锚点放大，锚点下的那个字放大之后必然回到 DOM。
  const anchor = (await texts.first().boundingBox())!
  // 点空白清空选区（`Escape` 的含义是退回上一层分组，不是清空）；豁免随之消失，字又没了。
  await page.mouse.click(cx + 60, scene.y - 30)
  expect(await settled(texts)).toBe(0)

  // 3) 以那个字为锚点放大到能读之后它回来
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2)
  await page.keyboard.down('Control')
  for (let i = 0; i < 15; i += 1) await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  expect(await settled(texts)).toBeGreaterThan(0)

  // 4) 缩回去又没了
  await page.keyboard.down('Control')
  for (let i = 0; i < 15; i += 1) await page.mouse.wheel(0, 100)
  await page.keyboard.up('Control')
  expect(await settled(texts)).toBe(0)

  expect(failures).toEqual([])
})
