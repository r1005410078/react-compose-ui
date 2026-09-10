import { expect, test } from '@playwright/test'
import { clickCurveStroke, enterAnimationEditing } from './support/test-helpers'

/**
 * 在两条轨道上各打两帧（0 ms 与 200 ms），框选两个 200 ms 关键帧后整体拖动、再框选后删除，
 * 每一步都只撤销一次。
 */
test('OpenSpec: animation-panel / 关键帧车道框选 / 框选后整体拖动与删除各撤销一步', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 矩形' }).click()
  const node = stage.locator('.compose-stage__scene > .compose-stage__node > .compose-stage__node.is-renderer')
  await expect(node).toHaveCount(1)
  await clickCurveStroke(node)

  await enterAnimationEditing(editor)
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()

  // 位置与旋转各在 0 ms 与 200 ms 打一帧：打点用当前值，两帧同值也合法。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await inspector.getByRole('button', { name: '为 旋转 添加关键帧' }).click()
  const position200 = animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })
  const rotation200 = animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })
  await expect(position200).toBeVisible()
  await expect(rotation200).toBeVisible()

  /** 从第一个 200 ms 关键帧右侧的空白起手，拖到第二个的左侧：碰到两个 200 ms，避开两个 0 ms。 */
  const marqueeAround200 = async () => {
    const first = (await position200.boundingBox())!
    const second = (await rotation200.boundingBox())!
    await page.mouse.move(first.x + first.width + 24, first.y + first.height / 2)
    await page.mouse.down()
    await page.mouse.move(second.x - 24, second.y + second.height / 2, { steps: 4 })
    await page.mouse.up()
  }

  await marqueeAround200()
  await expect(position200).toHaveAttribute('aria-current', 'true')
  await expect(rotation200).toHaveAttribute('aria-current', 'true')
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).not.toHaveAttribute('aria-current')
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：旋转' })).not.toHaveAttribute('aria-current')

  // 拖其中一个 40 ms：像素 / 毫秒比例从 0 ms 与 200 ms 两个菱形的间距量出来。取 40 而不是 50，
  // 是因为拖动吸附到标尺次刻度（主刻度的 1/5），步长随窗口宽度在 2 / 4 / 10 / 20 ms 之间变，
  // 40 对每一档都整除。
  const zero = (await animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' }).boundingBox())!
  const anchor = (await position200.boundingBox())!
  const pxPerMs = (anchor.x - zero.x) / 200
  const anchorCenter = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }
  await page.mouse.move(anchorCenter.x, anchorCenter.y)
  await page.mouse.down()
  await page.mouse.move(anchorCenter.x + 40 * pxPerMs, anchorCenter.y, { steps: 5 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 240 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 240 ms：旋转' })).toBeVisible()

  // 整组一次事务：撤销一步两者一起回到 200 ms。
  await stage.press('Control+z')
  await expect(position200).toBeVisible()
  await expect(rotation200).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 240 ms：位置' })).toHaveCount(0)
  await expect(animationPanel.getByRole('button', { name: '关键帧 240 ms：旋转' })).toHaveCount(0)

  // 再框选后按 Delete：焦点已落在选中的菱形上，两帧一起消失；撤销一步一起回来。
  await marqueeAround200()
  await expect(position200).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('Delete')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toHaveCount(0)
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toHaveCount(0)
  await stage.press('Control+z')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：旋转' })).toBeVisible()
})
