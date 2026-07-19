import { expect, test } from '@playwright/test'

test('mounts ComposeEditor as the full-screen demo', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  await expect(editor).toHaveAttribute(
    'data-compose-core',
    '@compose-ui/core',
  )
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)

  const editorBox = await editor.boundingBox()
  const viewport = page.viewportSize()
  expect(editorBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(editorBox!.x).toBe(0)
  expect(editorBox!.y).toBe(0)
  expect(editorBox!.width).toBe(viewport!.width)
  expect(editorBox!.height).toBe(viewport!.height)

  await expect(
    editor.locator('[data-workspace-tab="compose-scene-graph"]'),
  ).toHaveAttribute('title', 'Scene Graph')
  await expect(editor.getByText('Canvas', { exact: true })).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-inspector"]'),
  ).toHaveAttribute('title', 'Component')
  await expect(editor.getByLabel('设置')).toBeVisible()
  await expect(editor.getByText('日志', { exact: true })).toBeVisible()
  await expect(editor.getByText('命令', { exact: true })).toBeVisible()
})

test('uses fixed edge groups around the central canvas', async ({ page }) => {
  await page.goto('/')

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const right = page.getByTestId('dv-edge-group-compose-inspector-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const canvas = page.locator('[data-workspace-panel="canvas"]')
  const scenePanel = page.locator('[data-workspace-panel="scene-graph"]')

  await expect(left).toHaveClass(/dv-edge-group/)
  await expect(right).toHaveClass(/dv-edge-group/)
  await expect(bottom).toHaveClass(/dv-edge-group/)
  expect(
    await scenePanel.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    })),
  ).toEqual(
    expect.objectContaining({
      overflowY: 'hidden',
    }),
  )
  expect(
    await scenePanel.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true)

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

  const sceneTabBox = await left
    .locator('[data-workspace-tab="compose-scene-graph"]')
    .boundingBox()
  const settingsBox = await left.getByLabel('设置').boundingBox()
  expect(sceneTabBox).not.toBeNull()
  expect(settingsBox).not.toBeNull()
  expect(settingsBox!.y).toBeGreaterThan(sceneTabBox!.y)
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

  const sceneTab = left.locator('[data-workspace-tab="compose-scene-graph"]')
  await sceneTab.click()
  await expect.poll(async () => (await left.boundingBox())?.width).toBeLessThan(60)

  await sceneTab.click()
  await expect.poll(async () => (await left.boundingBox())?.width).toBeGreaterThan(
    initialLeftBox!.width + 40,
  )

  await bottom.getByText('日志', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeLessThan(60)

  await bottom.getByText('日志', { exact: true }).click()
  await expect.poll(async () => (await bottom.boundingBox())?.height).toBeGreaterThan(
    initialBottomBox!.height - 10,
  )
  await expect(bottom.getByText('workspace.ready', { exact: true })).toBeVisible()
})

test('adds and edits a text component inside the editor', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })

  await editor.getByRole('button', { name: '添加文本组件' }).click()

  const textNode = editor
    .getByRole('region', { name: '编辑画布' })
    .getByRole('button', { name: '默认文本' })
  await expect(textNode).toBeVisible()

  await textNode.click()
  await editor.getByLabel('文本内容').fill('客户现场大屏')

  await expect(
    editor
      .getByRole('region', { name: '编辑画布' })
      .getByRole('button', { name: '客户现场大屏' }),
  ).toBeVisible()
  await expect(editor.getByText('component.text.update', { exact: true })).toBeVisible()
})
