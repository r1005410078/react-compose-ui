import { expect, test } from '@playwright/test'

test('mounts the editor and preview workspace packages', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'React Compose UI' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Compose editor' })).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )
  await expect(page.getByRole('region', { name: 'Compose preview' })).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor.getByText('Scene Graph', { exact: true })).toBeVisible()
  await expect(editor.getByText('Canvas', { exact: true })).toBeVisible()
  await expect(editor.getByText('Component', { exact: true })).toBeVisible()
  await expect(editor.getByText('Transaction Log', { exact: true })).toBeVisible()
  await expect(editor.getByText('Command', { exact: true })).toBeVisible()
})

test('uses fixed edge groups around the central canvas', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const right = page.getByTestId('dv-edge-group-compose-inspector-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const canvas = page.locator('[data-workspace-panel="canvas"]')

  await expect(left).toHaveClass(/dv-edge-group/)
  await expect(right).toHaveClass(/dv-edge-group/)
  await expect(bottom).toHaveClass(/dv-edge-group/)

  const leftBox = await left.boundingBox()
  const rightBox = await right.boundingBox()
  const bottomBox = await bottom.boundingBox()
  const canvasBox = await canvas.boundingBox()

  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  expect(bottomBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  expect(leftBox!.x).toBeLessThan(canvasBox!.x)
  expect(rightBox!.x).toBeGreaterThanOrEqual(canvasBox!.x + canvasBox!.width)
  expect(bottomBox!.y).toBeGreaterThan(canvasBox!.y)
})

test('resizes and collapses edge groups without losing content', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const initialLeftBox = await left.boundingBox()
  const initialBottomBox = await bottom.boundingBox()

  expect(initialLeftBox).not.toBeNull()
  expect(initialBottomBox).not.toBeNull()

  await page.mouse.move(
    initialLeftBox!.x + initialLeftBox!.width,
    initialLeftBox!.y + initialLeftBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    initialLeftBox!.x + initialLeftBox!.width + 60,
    initialLeftBox!.y + initialLeftBox!.height / 2,
  )
  await page.mouse.up()

  await expect.poll(async () => (await left.boundingBox())?.width).toBeGreaterThan(
    initialLeftBox!.width + 40,
  )
  await expect(left.getByText('Page 1', { exact: true })).toBeVisible()

  await bottom.getByText('Transaction Log', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeLessThan(60)

  await bottom.getByText('Transaction Log', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeGreaterThan(
    initialBottomBox!.height - 10,
  )
  await expect(bottom.getByText('workspace.ready', { exact: true })).toBeVisible()
})

test('adds a text component and updates the preview', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const preview = page.getByRole('region', { name: 'Compose preview' })

  await editor.getByRole('button', { name: '添加文本组件' }).click()

  const textNode = editor
    .getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
  await expect(textNode).toBeVisible()

  await textNode.click()
  await editor.getByLabel('文本内容').fill('客户现场大屏')

  await expect(preview.getByText('客户现场大屏')).toBeVisible()
})
