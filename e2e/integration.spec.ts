import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function pointerDrop(page: Page, source: Locator, target: { x: number; y: number }) {
  const sourceBox = await source.boundingBox()
  expect(sourceBox).not.toBeNull()
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 5 })
  await page.mouse.up()
}

test('OpenSpec: editor-workspace-layout / 完整示例入口 / 根路径直接展示 Stage 编排工作区', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(page.locator('#root > .compose-editor')).toHaveCount(1)
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', 'Component Library')
  await expect(editor.getByRole('button', { name: 'Add Text component' })).toHaveCount(0)

  const editorBox = await editor.boundingBox()
  const viewport = page.viewportSize()
  expect(editorBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(editorBox).toEqual({
    x: 0,
    y: 0,
    width: viewport!.width,
    height: viewport!.height,
  })

  const left = page.getByTestId('dv-edge-group-compose-scene-edge')
  const right = page.getByTestId('dv-edge-group-compose-inspector-edge')
  const bottom = page.getByTestId('dv-edge-group-compose-bottom-edge')
  const canvas = page.locator('[data-workspace-panel="canvas"]')
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

test('OpenSpec: editor-workspace-layout / Controller 驱动的默认组合 / 使用完整示例完成 Stage 纵向流程', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  await expect(
    editor.locator('[data-workspace-tab="compose-component-library"]'),
  ).toHaveAttribute('title', 'Component Library')

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: 'Add Rectangle' }).click()

  await editor.getByRole('button', { name: '创建 Frame' }).click()
  const frame = stage.getByTestId('stage-frame')
  await expect(frame).toHaveCount(1)
  const frameBox = await frame.boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: 'Add Rectangle' }), {
    x: frameBox!.x + 160,
    y: frameBox!.y + 180,
  })
  await pointerDrop(page, editor.getByRole('button', { name: 'Add Text' }), {
    x: frameBox!.x + 480,
    y: frameBox!.y + 180,
  })
  await expect(stage.locator('.compose-stage__node.is-component')).toHaveCount(2)

  const components = stage.locator('.compose-stage__node.is-component')
  const textComponent = components.filter({ hasText: '大屏标题' })
  await textComponent.click()
  await stage.press('Shift+ArrowRight')
  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  await expect(
    editor.locator('[data-compose-ui="history"]')
      .getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }),
  ).toBeVisible()

  await components.nth(0).click()
  await components.nth(1).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  await expect(stage.locator('.compose-stage__node.is-group')).toHaveCount(1)

  await stage.locator('.compose-stage__node.is-component').filter({
    hasText: '大屏标题',
  }).click()
  const property = editor.getByRole('textbox', { name: '文本内容', exact: true })
  await property.fill('统一事务舞台')
  await expect(stage.getByText('统一事务舞台')).toBeVisible()
  await property.press('Control+z')
  await expect(property).toHaveValue('大屏标题')
  await property.press('Control+Shift+z')
  await expect(property).toHaveValue('统一事务舞台')

  await editor.getByText('命令', { exact: true }).click()
  const commandPanel = editor.getByRole('region', { name: '命令调试台' })
  await expect(commandPanel.getByText('已拒绝')).toBeVisible()
  await expect(commandPanel.getByText('成功').first()).toBeVisible()

  await editor.getByText('日志', { exact: true }).click()
  const log = editor.getByRole('region', { name: 'Operation log' })
  await expect(log.getByRole('button', { name: /Create Frame/ })).toBeVisible()
  await expect(
    log.getByRole('button', { name: /^Property Update Text ·/ }),
  ).toBeVisible()
  await expect(log.getByRole('button', { name: /Undo · Update Text/ })).toBeVisible()
  await expect(log.getByText(/Reject .* outside a Frame/)).toHaveCount(0)
  await log.getByRole('button', { name: /Move Text · x .* → .*, y .* → .*/ }).click()
  const operationDetail = log.getByRole('region', { name: 'Operation details' })
  await expect(operationDetail).toContainText('Before')
  await expect(operationDetail).toContainText('After')
  await expect(operationDetail).toContainText('forwardPatches')

  await editor.getByRole('button', { name: '预览 Frame' }).click()
  const preview = page.getByRole('dialog', { name: 'Frame 预览对话框' })
  await expect(preview.getByRole('region', { name: 'Compose preview' })).toBeVisible()
  await expect(preview.getByText('统一事务舞台')).toBeVisible()
})

test('OpenSpec: component-registry / 完整示例 renderer / 在 Stage 中渲染 ECharts Canvas', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  const frameBox = await stage.getByTestId('stage-frame').boundingBox()
  expect(frameBox).not.toBeNull()

  await pointerDrop(page, editor.getByRole('button', { name: 'Add ECharts Chart' }), {
    x: frameBox!.x + 320,
    y: frameBox!.y + 240,
  })

  const chart = stage.getByRole('img', { name: '季度数据' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('canvas')).toBeVisible()
})

test('OpenSpec: stage / 八向缩放 / resize 手柄在预览阶段跟随鼠标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()
  const movements = {
    n: { x: 0, y: 60 },
    ne: { x: -100, y: 60 },
    e: { x: -100, y: 0 },
    se: { x: -100, y: -60 },
    s: { x: 0, y: -60 },
    sw: { x: 100, y: -60 },
    w: { x: 100, y: 0 },
    nw: { x: 100, y: 60 },
  } as const

  for (const [direction, movement] of Object.entries(movements)) {
    const handle = stage.getByTestId(`stage-resize-${direction}`)
    const startBox = await handle.boundingBox()
    expect(startBox).not.toBeNull()
    const start = {
      x: startBox!.x + startBox!.width / 2,
      y: startBox!.y + startBox!.height / 2,
    }
    const target = {
      x: start.x + movement.x,
      y: start.y + movement.y,
    }
    expect(await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
      start,
    )).toBe(`stage-resize-${direction}`)

    for (const [from, to] of [[start, target], [target, start]] as const) {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(to.x, to.y, { steps: 5 })
      await expect.poll(async () => {
        const box = await handle.boundingBox()
        return box && {
          x: Math.round(box.x + box.width / 2),
          y: Math.round(box.y + box.height / 2),
        }
      }).toEqual({
        x: Math.round(to.x),
        y: Math.round(to.y),
      })
      await page.mouse.up()
    }
  }
})

test('OpenSpec: stage / Group 直接操纵 / 舞台可拖动 Group 且子节点保持可命中', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: '创建 Frame' }).click()
  await editor.getByRole('button', { name: '适配 Frame' }).click()
  const frameBox = await stage.getByTestId('stage-frame').boundingBox()
  expect(frameBox).not.toBeNull()
  const rectangleButton = editor.getByRole('button', { name: 'Add Rectangle' })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 220,
    y: frameBox!.y + 220,
  })
  await pointerDrop(page, rectangleButton, {
    x: frameBox!.x + 580,
    y: frameBox!.y + 220,
  })

  const components = stage.locator('.compose-stage__node.is-component')
  await components.nth(0).click()
  await components.nth(1).click({ modifiers: ['Shift'] })
  await stage.press('Control+g')
  const group = stage.locator('.compose-stage__node.is-group')
  await expect(group).toHaveCount(1)
  const groupId = await group.getAttribute('data-node-id')
  const componentBoxes = await Promise.all([
    components.nth(0).boundingBox(),
    components.nth(1).boundingBox(),
  ])
  expect(componentBoxes.every(Boolean)).toBe(true)
  const [left, right] = [...componentBoxes]
    .map((box) => box!)
    .sort((first, second) => first.x - second.x)
  const gapPoint = {
    x: (left.x + left.width + right.x) / 2,
    y: (Math.max(left.y, right.y) + Math.min(
      left.y + left.height,
      right.y + right.height,
    )) / 2,
  }
  const nodeAt = (point: { x: number; y: number }) => page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)
      ?.closest('[data-node-id]')
      ?.getAttribute('data-node-id'),
    point,
  )
  expect(await nodeAt(gapPoint)).toBe(groupId)

  const groupBefore = await group.boundingBox()
  expect(groupBefore).not.toBeNull()
  await page.keyboard.down('Control')
  await page.mouse.move(gapPoint.x, gapPoint.y)
  await page.mouse.down()
  await page.mouse.move(gapPoint.x + 80, gapPoint.y + 40, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect.poll(async () => {
    const box = await group.boundingBox()
    return box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
    }
  }).toEqual({
    x: Math.round(groupBefore!.x + 80),
    y: Math.round(groupBefore!.y + 40),
  })

  const child = components.nth(0)
  const childBefore = await child.boundingBox()
  expect(childBefore).not.toBeNull()
  const childPoint = {
    x: childBefore!.x + childBefore!.width / 2,
    y: childBefore!.y + childBefore!.height / 2,
  }
  expect(await nodeAt(childPoint)).toBe(await child.getAttribute('data-node-id'))
  await page.keyboard.down('Control')
  await page.mouse.move(childPoint.x, childPoint.y)
  await page.mouse.down()
  await page.mouse.move(childPoint.x + 40, childPoint.y + 20, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect.poll(async () => {
    const box = await child.boundingBox()
    return box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
    }
  }).toEqual({
    x: Math.round(childBefore!.x + 40),
    y: Math.round(childBefore!.y + 20),
  })
})

test('OpenSpec: stage / DOM Scene 与 SVG Overlay 分层 / 完整示例视觉黄金文件', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })

  await expect(editor).toHaveScreenshot('stage-workspace-default.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.locator('[data-workspace-tab="compose-component-library"]').click()
  await editor.getByRole('button', { name: 'Add Rectangle' }).click()
  await editor.getByText('命令', { exact: true }).click()
  await expect(editor.getByRole('region', { name: '命令调试台' })
    .getByText('已拒绝').first()).toBeVisible()
  await expect(editor).toHaveScreenshot('stage-workspace-command-rejected.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await editor.getByText('命令', { exact: true }).click()

  await editor.getByRole('button', { name: '创建 Frame' }).click()
  const stage = editor.getByRole('application', { name: 'Stage' })
  const frameBox = await stage.getByTestId('stage-frame').boundingBox()
  expect(frameBox).not.toBeNull()
  await pointerDrop(page, editor.getByRole('button', { name: 'Add Rectangle' }), {
    x: frameBox!.x + 160,
    y: frameBox!.y + 180,
  })
  await pointerDrop(page, editor.getByRole('button', { name: 'Add Text' }), {
    x: frameBox!.x + 480,
    y: frameBox!.y + 180,
  })
  await stage.locator('.compose-stage__node.is-component').nth(0).click()
  await stage.locator('.compose-stage__node.is-component').nth(1).click({
    modifiers: ['Shift'],
  })

  await expect(editor).toHaveScreenshot('stage-workspace-selected.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })

  await editor.locator('[data-workspace-tab="compose-scene-graph"]').click()
  await editor.getByRole('row', { name: /Frame/ })
    .getByRole('button', { name: '展开节点' })
    .click()
  await editor.getByRole('row', { name: /Rectangle/ }).click()
  const rectangle = stage.locator('.compose-stage__node.is-component').filter({
    hasText: 'Rectangle',
  })
  const rectangleBox = await rectangle.boundingBox()
  expect(rectangleBox).not.toBeNull()
  await expect(editor.getByRole('region', { name: 'Rectangle 属性' })).toBeVisible()
  const pointerStart = {
    clientX: rectangleBox!.x + rectangleBox!.width / 2,
    clientY: rectangleBox!.y + rectangleBox!.height / 2,
  }
  const pointerEnd = {
    clientX: pointerStart.clientX + frameBox!.x - rectangleBox!.x + 2,
    clientY: pointerStart.clientY,
  }
  await rectangle.dispatchEvent('pointerdown', {
    ...pointerStart,
    bubbles: true,
    button: 0,
    pointerId: 41,
  })
  await stage.dispatchEvent('pointermove', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    pointerId: 41,
  })
  await expect(stage.locator('.compose-stage__guide')).not.toHaveCount(0)
  await expect(editor).toHaveScreenshot('stage-workspace-snapping.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  })
  await stage.dispatchEvent('pointerup', {
    ...pointerEnd,
    bubbles: true,
    button: 0,
    pointerId: 41,
  })
})
