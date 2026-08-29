import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { drawContainer, selectContainer } from './support/test-helpers'

/**
 * 缩放手柄的尺寸读数。
 *
 * 容器的边长与本次位移都取网格步长 8 的整数倍，落点因此正好落在格点上——吸附不会把读数挪走，
 * 用例于是不必关掉它。`?no-auto-fit` 把缩放钉在 1，屏幕位移与世界位移因此相等：
 * `world = (屏幕 − 视口) / zoom`，自动适配一开这些绝对值全部失效。
 */
async function readout(stage: Locator, index: 0 | 1) {
  return (await stage.getByTestId(`stage-dynamic-input-field-${index}`).locator('text').last()
    .textContent())?.trim()
}

/** 抓住一个手柄拖到相对位移处，停在按下状态。 */
async function grabHandle(
  page: Page,
  handle: Locator,
  delta: { readonly x: number; readonly y: number },
) {
  await expect.poll(() => handle.boundingBox()).not.toBeNull()
  const box = await handle.boundingBox()
  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 })
}

async function release(page: Page) {
  await page.mouse.up()
}

test('OpenSpec: stage / 缩放手柄的尺寸读数 / 拖角手柄时宽高都在屏幕上', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  await selectContainer(editor)

  // 容器画成 648 × 360（见 `drawContainer`），往右下各拖 40 / 32。
  await grabHandle(page, editor.getByTestId('stage-resize-se'), { x: 40, y: 32 })

  await expect(stage.getByTestId('stage-dynamic-input')).toHaveCount(1)
  expect(await readout(stage, 0)).toBe('688')
  expect(await readout(stage, 1)).toBe('392')

  // 读数不可键入：两个框都不挂光标条、不挂锁。
  await expect(stage.locator('.compose-stage__dynamic-input-caret')).toHaveCount(0)
  await expect(stage.locator('.compose-stage__dynamic-input-lock-glyph')).toHaveCount(0)

  await release(page)
  await expect(stage.getByTestId('stage-dynamic-input')).toHaveCount(0)
})

test('OpenSpec: stage / 缩放手柄的尺寸读数 / 拖边手柄时两个数都画', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  await selectContainer(editor)

  // 右边手柄只改宽；高那个数照画——用户在改的是盒，盒的量纲是宽和高。
  await grabHandle(page, editor.getByTestId('stage-resize-edge-e'), { x: 40, y: 32 })

  expect(await readout(stage, 0)).toBe('688')
  expect(await readout(stage, 1)).toBe('360')

  await release(page)
})

test('OpenSpec: stage / 缩放手柄的尺寸读数 / 值取吸附之后的包围盒', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  await selectContainer(editor)

  /*
   * 43 不是网格步长 8 的整数倍：读数必须是吸附之后的 688，不是裸指针的 691。读裸指针的
   * 症状是框里的数与选区框差几个像素——而那正是用户要对齐的地方。
   */
  await grabHandle(page, editor.getByTestId('stage-resize-se'), { x: 43, y: 32 })

  expect(await readout(stage, 0)).toBe('688')

  await release(page)
})
