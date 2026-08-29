import { expect, test } from '@playwright/test'

/**
 * 角度约束：关 / 正交 / 极轴，三者互斥，默认极轴。
 *
 * 落点都收在 500×450 以内，且取网格步长的整数倍：网格排在角度约束**之前**，不落在格点上的
 * 坐标会先被取整。
 */
test('OpenSpec: editor-workspace-layout / 工具栏上的角度约束 / 两个按钮是同一个单选组', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const ortho = editor.getByRole('button', { name: '正交' })
  const polar = editor.getByRole('button', { name: '极轴追踪' })

  // 默认极轴：它只在光标靠近某条射线时才吸，不挡任何画法，因此可以默认开着。
  await expect(polar).toHaveAttribute('aria-pressed', 'true')
  await expect(ortho).toHaveAttribute('aria-pressed', 'false')

  await ortho.click()
  await expect(ortho).toHaveAttribute('aria-pressed', 'true')
  await expect(polar).toHaveAttribute('aria-pressed', 'false')

  // 按下已经按下的那一个即关闭——三态互斥。
  await ortho.click()
  await expect(ortho).toHaveAttribute('aria-pressed', 'false')
  await expect(polar).toHaveAttribute('aria-pressed', 'false')

  await editor.getByRole('button', { name: '增量角' }).click()
  await expect(editor.getByRole('menuitemradio')).toHaveCount(8)
  await expect(editor.getByRole('menuitemradio', { name: '45°' }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('OpenSpec: stage / 角度约束的持有、切换与呈现 / 靠近射线时吸住并画出追踪射线', async ({ page }) => {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const ray = stage.getByTestId('stage-drafting-tracking-ray')

  const commandInput = stage.getByRole('textbox', { name: '命令行' })
  await commandInput.fill('L')
  await commandInput.press('Enter')
  await page.mouse.click(box.x + 120, box.y + 200)

  // 离 0° 射线 8px：在容差内，吸住并画出射线。
  await page.mouse.move(box.x + 400, box.y + 192)
  await expect(ray).toHaveCount(1)

  // 20° 方向，离 0° 与 45° 都够不着——这正是极轴敢默认开着的那一处。
  await page.mouse.move(box.x + 400, box.y + 128)
  await expect(ray).toHaveCount(0)

  await commandInput.press('Escape')
})
