import { expect, test } from '@playwright/test'
import { stableBox } from './support/test-helpers'

/**
 * 曲线的命中一律按几何，不按包围盒。
 *
 * @remarks
 * 四条各钉一个原因。容差那条**必须**落在离线身 5px 处——包围盒空角在新旧容差下都点不中，
 * 拿它当判别会得到一条永远绿的假用例。
 *
 * 用 `?no-auto-fit` 把缩放钉在 1，屏幕像素因此就是世界像素，容差的量级才断得准。
 */
async function drawLine(
  page: import('@playwright/test').Page,
  from: { x: number, y: number },
  to: { x: number, y: number },
) {
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.click()
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('指定第一点')
  await page.mouse.click(from.x, from.y)
  await page.mouse.click(to.x, to.y)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

test('OpenSpec: stage / 线状节点不以包围盒拦截指针 / 容差之外与端点之外都点不中', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = await stableBox(stage.getByTestId('stage-surface'))
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(120, 200), at(320, 200))
  await page.keyboard.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  const bb = (await stroke.boundingBox())!
  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })

  // 线身上必须点得中，否则下面两条「点不中」说明不了任何事。
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await expect(inspector).toBeVisible()
  await page.keyboard.press('Escape')

  // 离线身 5px：夹在旧容差（±6）与新容差（±3）之间，这一条钉住的正是量级。
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2 - 5)
  await expect(inspector).toHaveCount(0)

  // 沿线身越过端点 4px：与容差量级无关，钉住的是命中层的 linecap。
  await page.mouse.click(bb.x + bb.width + 4, bb.y + bb.height / 2)
  await expect(inspector).toHaveCount(0)
})

test('OpenSpec: stage-engine / 框选判定按几何 / 空角里的窗交框不选中斜线', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()
  const surface = await stableBox(stage.getByTestId('stage-surface'))
  const at = (dx: number, dy: number) => ({ x: surface.x + dx, y: surface.y + dy })

  await drawLine(page, at(120, 120), at(320, 320))
  await page.keyboard.press('Escape')

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)
  const bb = (await stroke.boundingBox())!
  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })

  const drag = async (from: { x: number, y: number }, to: { x: number, y: number }) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
  }

  // 右上空角：从右往左拖是窗交，但这个框一次都没碰到线身。
  await drag(
    { x: bb.x + bb.width - 6, y: bb.y + 6 },
    { x: bb.x + bb.width - 56, y: bb.y + 46 },
  )
  await expect(inspector).toHaveCount(0)

  // 同样从右往左，但框穿过线身——这一条防止上一条矫枉过正。
  await drag(
    { x: bb.x + bb.width / 2 + 30, y: bb.y + bb.height / 2 - 30 },
    { x: bb.x + bb.width / 2 - 30, y: bb.y + bb.height / 2 + 30 },
  )
  await expect(inspector).toBeVisible()
})
