import { expect, test } from '@playwright/test'
import {
  pointerDrop,
  drawContainer,
  drawText,
  enableAutoLayout,
  expandInspectorSection,
} from './support/test-helpers'

test('OpenSpec: stage / 画布内原地文字编辑 / 点击创建后直接输入并提交为一条事务', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  // 点击（而不是拖拽）创建 Auto width 文字，光标应当直接落进去。
  await editor.getByRole('button', { name: '文字' }).click()
  await page.mouse.click(outputBox!.x + 200, outputBox!.y + 160)

  const editable = stage.getByTestId('compose-material-text-editable')
  await expect(editable).toBeFocused()
  await expect(stage.getByTestId('stage-text-editing-bounds')).toBeVisible()
  // 编辑态不显示八向与旋转手柄。
  await expect(stage.getByTestId('stage-resize-se')).toHaveCount(0)
  await expect(stage.getByTestId('stage-rotation-handle')).toHaveCount(0)

  // 点击创建的文字是空的，直接打字即可，无需先清掉占位文案。
  await expect(editable).toHaveText('')
  await page.keyboard.type('H')
  // 空内容量不出有意义的宽度，从第一个字符开始比。
  const seededWidth = (await editable.boundingBox())!.width
  await page.keyboard.type('ello canvas')
  // Auto width 必须在输入过程中经既有 measurement 链路实时改宽。
  await expect
    .poll(async () => (await editable.boundingBox())!.width)
    .toBeGreaterThan(seededWidth)

  // output 是 1280×720 的世界尺寸，远大于 Stage 视口；点击必须落在两者的交集内，
  // 否则事件根本不会送到 Stage。
  await page.mouse.click(outputBox!.x + 420, outputBox!.y + 320)
  await expect(stage.getByTestId('compose-material-text-editable')).toHaveCount(0)
  await expect(stage.getByTestId('compose-material-text')).toContainText('Hello canvas')

  // 创建是一条事务，文本提交是第二条；撤销一次只回退文本。
  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(1)
  await expect(stage.getByTestId('compose-material-text')).not.toContainText('Hello canvas')
})


test('OpenSpec: stage / 画布内原地文字编辑 / 缩窄文字框时高度跟随内容而不裁剪', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '文字' }).click()
  await page.mouse.click(outputBox!.x + 200, outputBox!.y + 160)
  await expect(stage.getByTestId('compose-material-text-editable')).toBeFocused()
  await page.keyboard.type('Hello canvas world')
  await page.keyboard.press('Escape')

  const node = stage.locator('.compose-stage__node.is-renderer').last()
  const before = (await node.boundingBox())!

  // 八向手柄照常保留；文字的特殊之处只在于高度不会被钉死。
  for (const handle of ['ne', 'se', 'sw', 'nw']) {
    await expect(stage.getByTestId(`stage-resize-${handle}`)).toBeVisible()
  }
  const handle = stage.getByTestId('stage-resize-se')
  const handleBox = (await handle.boundingBox())!
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  // 角手柄同时往左上拖：宽度收窄，高度本会被一起钉小。
  await page.mouse.move(handleBox.x - 70, handleBox.y - 6, { steps: 6 })
  await page.mouse.up()

  const after = (await node.boundingBox())!
  expect(after.width).toBeLessThan(before.width)
  // 宽度定死后文字重新换行，框跟着长高，内容始终完整可见。
  expect(after.height).toBeGreaterThan(before.height)
  const overflow = await node.evaluate((el) => {
    const span = el.querySelector('.compose-material--text-content')!
    return span.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom
  })
  expect(overflow).toBeLessThanOrEqual(1)
})


test('OpenSpec: stage / 画布内原地文字编辑 / 点击创建后未输入即退出不留残余', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await editor.getByRole('button', { name: '文字' }).click()
  await page.mouse.click(outputBox!.x + 200, outputBox!.y + 160)
  await expect(stage.getByTestId('compose-material-text-editable')).toHaveText('')

  await page.keyboard.press('Escape')

  // 空文字既不可见也很难再选中，留着只会污染场景树；创建那条事务仍可被撤销回退。
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(0)
  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(1)
})


test('OpenSpec: stage / 画布内原地文字编辑 / 双击改写后 Esc 提交并可撤销', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await drawText(page, editor, { x: outputBox!.x + 200, y: outputBox!.y + 160 })
  const text = stage.getByTestId('compose-material-text')
  const original = (await text.textContent())!

  await text.dblclick()
  const editable = stage.getByTestId('compose-material-text-editable')
  await expect(editable).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('改写后的文案')
  await page.keyboard.press('Escape')

  await expect(stage.getByTestId('compose-material-text-editable')).toHaveCount(0)
  await expect(text).toContainText('改写后的文案')

  await stage.focus()
  await stage.press('Control+z')
  await expect(text).toContainText(original)
})


test('OpenSpec: stage / 画布内原地文字编辑 / 空内容退出删除实体且可撤销', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-output-boundary')
  await expect(output).toBeVisible()
  const outputBox = await output.boundingBox()
  expect(outputBox).not.toBeNull()

  await drawText(page, editor, { x: outputBox!.x + 200, y: outputBox!.y + 160 })
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(1)

  await stage.getByTestId('compose-material-text').dblclick()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.press('Escape')

  // 空 Hug 文字既不可见也很难再选中，退出时删除；删除是普通可撤销事务。
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(0)
  await stage.focus()
  await stage.press('Control+z')
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(1)
})


test('OpenSpec: stage / 画布拖拽跨容器移动 / 拖进容器成为其子级', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  // 1) 先画一个容器，再在容器外放一个矩形。
  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  expect(frameBox).not.toBeNull()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const output = stage.getByTestId('stage-output-boundary')
  const outputBox = await output.boundingBox()
  // Stage 可视区约 600x600，而 output 是 1280x720：落点必须留在可视区内，
  // 否则 pointer 事件打不到画布上。容器占 output 的 48..696 x 64..424，这里放它上方。
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox!.x + 200,
    y: outputBox!.y + 20,
  })
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  await expect(rectangle).toHaveCount(1)
  await expect(sceneTree.getByRole('row', { name: /Rectangle/ })).toBeVisible()

  // 2) 拖到容器中心：拖动过程中出现容器高亮。
  const rectBox = await rectangle.boundingBox()
  await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height / 2)
  await page.mouse.down()
  // 容器右半部分在可视区之外，取一个既深入容器又仍可见的点。
  await page.mouse.move(outputBox!.x + 300, outputBox!.y + 250, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toBeVisible()
  await page.mouse.up()

  // 3) 松手后矩形成为容器子级，不再是根层节点。
  await expect(stage.getByTestId('stage-drop-container')).toHaveCount(0)
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(0)
  await expect(
    stage.getByTestId('stage-container').locator(':scope > .compose-stage__node.is-renderer'),
  ).toHaveCount(1)

  // 4) 一次拖拽只产生一条可撤销事务。
  await page.keyboard.press('Control+z')
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
})


test('OpenSpec: stage / 画布拖拽跨容器移动 / 贴边掠过不吸入', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox!.x + 200,
    y: outputBox!.y + 20,
  })
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  const rectBox = await rectangle.boundingBox()

  // 只贴到容器左边缘内 4px，未达到判定留白。
  await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(frameBox!.x + 4, frameBox!.y + frameBox!.height / 2, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toHaveCount(0)
  await page.mouse.up()

  // 仍是根层节点，只是坐标变了。
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
})


test('OpenSpec: stage / Auto Layout 容器内原地重排 / 拖动只改顺序不脱离布局', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-output-boundary')).toBeVisible()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()

  // 1) 容器内放两个矩形，再启用 Auto Layout 把它们转成 Flow。
  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })

  const frame = stage.getByTestId('stage-container')
  const children = frame.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)

  await frame.click({ position: { x: 8, y: 8 } })
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(containerInspector)

  // Flow 排队后按 childIds 顺序左右相邻，记下第一个的宽度用于识别顺序。
  const firstBox = await children.nth(0).boundingBox()
  const secondBox = await children.nth(1).boundingBox()
  expect(firstBox!.x).toBeLessThan(secondBox!.x)

  // 2) 把第一个拖到第二个右侧：过程中出现落点线。
  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    secondBox!.x + secondBox!.width - 4,
    secondBox!.y + secondBox!.height / 2,
    { steps: 8 },
  )
  // 垂直线的包围盒宽度为 0，Playwright 会判定为 hidden，因此断言存在而不是可见。
  await expect(stage.getByTestId('stage-drop-line')).toHaveCount(1)
  await page.mouse.up()
  await expect(stage.getByTestId('stage-drop-line')).toHaveCount(0)

  // 3) 仍是容器的两个 Flow 子级，只是顺序交换——没有脱离布局散落。
  await expect(children).toHaveCount(2)
  const afterFirst = await children.nth(0).boundingBox()
  const afterSecond = await children.nth(1).boundingBox()
  expect(afterFirst!.x).toBeLessThan(afterSecond!.x)
  expect(Math.round(afterFirst!.y)).toBe(Math.round(firstBox!.y))

  // 4) 一次撤销回到原顺序。
  await page.keyboard.press('Control+z')
  await expect(children).toHaveCount(2)
})


test('OpenSpec: stage-engine / Auto Layout 容器内原地重排 / 拖出容器无落点回弹不脱流', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-output-boundary')).toBeVisible()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()

  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })

  const frame = stage.getByTestId('stage-container')
  const children = frame.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)
  await frame.click({ position: { x: 8, y: 8 } })
  await enableAutoLayout(editor.getByRole('region', { name: 'Container 属性', exact: true }))

  const firstBox = await children.nth(0).boundingBox()
  // 把第一个 Flow 子级拖到容器上方的空白画布并松手：无任何合法落点。
  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(outputBox!.x + 200, outputBox!.y + 20, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toHaveCount(0)
  await expect(stage.getByTestId('stage-drop-line')).toHaveCount(0)
  await page.mouse.up()

  // 回弹：仍是容器的 Flow 子级，位置与拖动前一致；根层没有多出脱流节点。
  await expect(children).toHaveCount(2)
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(0)
  const afterBox = await children.nth(0).boundingBox()
  expect(Math.round(afterBox!.x)).toBe(Math.round(firstBox!.x))
  expect(Math.round(afterBox!.y)).toBe(Math.round(firstBox!.y))
})

test('OpenSpec: stage-engine / 拖拽修饰键结构意图 / Alt 强制吸入贴边容器', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  const frameBox = await stage.getByTestId('stage-container').boundingBox()
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox!.x + 200,
    y: outputBox!.y + 20,
  })
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  const rectBox = await rectangle.boundingBox()

  // 贴到容器左边缘内 4px：默认不吸入，按下 Alt 后强制成为落点。
  await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(frameBox!.x + 4, frameBox!.y + frameBox!.height / 2, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toHaveCount(0)
  await page.keyboard.down('Alt')
  await page.mouse.move(frameBox!.x + 5, frameBox!.y + frameBox!.height / 2)
  await expect(stage.getByTestId('stage-drop-container')).toBeVisible()
  await page.mouse.up()
  await page.keyboard.up('Alt')

  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(0)
  await expect(
    stage.getByTestId('stage-container').locator(':scope > .compose-stage__node.is-renderer'),
  ).toHaveCount(1)
})

test('OpenSpec: stage-engine / 拖拽修饰键结构意图 / Space 锁定原父级不吸入', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })

  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: outputBox!.x + 200,
    y: outputBox!.y + 20,
  })
  const rectangle = stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer')
  const rectBox = await rectangle.boundingBox()

  // 深入容器内部本会吸入；手势中按住 Space 锁定原父级，高亮原地消失。
  await page.mouse.move(rectBox!.x + rectBox!.width / 2, rectBox!.y + rectBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(outputBox!.x + 300, outputBox!.y + 250, { steps: 8 })
  await expect(stage.getByTestId('stage-drop-container')).toBeVisible()
  await page.keyboard.down('Space')
  await expect(stage.getByTestId('stage-drop-container')).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Space')

  // 仍是根层节点，坐标已更新到松手位置附近。
  await expect(stage.locator('.compose-stage__scene > .compose-stage__node.is-renderer'))
    .toHaveCount(1)
  const droppedBox = await rectangle.boundingBox()
  expect(droppedBox!.y).toBeGreaterThan(rectBox!.y + 100)
})

test('OpenSpec: stage / resize 手势实时布局反馈 / 兄弟随拖动实时让位', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-output-boundary')).toBeVisible()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()

  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })

  const frame = stage.getByTestId('stage-container')
  const children = frame.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(2)
  await frame.click({ position: { x: 8, y: 8 } })
  await enableAutoLayout(editor.getByRole('region', { name: 'Container 属性', exact: true }))

  const secondBefore = await children.nth(1).boundingBox()
  await children.nth(0).click()
  // 边中点没有可见角柄，用 E 边的加宽命中区拖拽。
  const handle = stage.getByTestId('stage-resize-edge-e')
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()

  // 向右拖 E 手柄 80px：松手前第二个子级就应实时右移让位。
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2 + 80,
    handleBox!.y + handleBox!.height / 2,
    { steps: 8 },
  )
  await expect.poll(async () => {
    const box = await children.nth(1).boundingBox()
    return box!.x - secondBefore!.x
  }).toBeGreaterThan(70)
  await page.mouse.up()

  // 提交后的最终布局与松手前所见一致。
  const secondAfter = await children.nth(1).boundingBox()
  expect(secondAfter!.x - secondBefore!.x).toBeGreaterThan(70)

  // Escape 取消的手势立即恢复提交态：再次拖动并取消，兄弟回到提交位置。
  const handleBox2 = await stage.getByTestId('stage-resize-edge-e').boundingBox()
  await page.mouse.move(
    handleBox2!.x + handleBox2!.width / 2,
    handleBox2!.y + handleBox2!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    handleBox2!.x + handleBox2!.width / 2 + 80,
    handleBox2!.y + handleBox2!.height / 2,
    { steps: 8 },
  )
  await expect.poll(async () => {
    const box = await children.nth(1).boundingBox()
    return box!.x - secondAfter!.x
  }).toBeGreaterThan(70)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(async () => {
    const box = await children.nth(1).boundingBox()
    return Math.round(box!.x - secondAfter!.x)
  }).toBe(0)
})

test('OpenSpec: stage-engine / Auto Layout 容器内原地重排 / wrap 容器跨行重排', async ({ page }) => {
  await page.goto('/')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-output-boundary')).toBeVisible()
  const outputBox = await stage.getByTestId('stage-output-boundary').boundingBox()

  await drawContainer(page, editor)
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  const rectangleButton = editor.getByRole('button', { name: '添加 Rectangle' })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 120, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 320, y: outputBox!.y + 160 })
  await pointerDrop(page, rectangleButton, { x: outputBox!.x + 500, y: outputBox!.y + 160 })

  const frame = stage.getByTestId('stage-container')
  const children = frame.locator(':scope > .compose-stage__node.is-renderer')
  await expect(children).toHaveCount(3)
  await frame.click({ position: { x: 8, y: 8 } })
  const containerInspector = editor.getByRole('region', { name: 'Container 属性', exact: true })
  await enableAutoLayout(containerInspector)
  await expandInspectorSection(containerInspector, '布局')
  // Rectangle 默认 240 宽：648 宽的容器放不下三个，开启换行后自然形成 2+1 两行。
  await containerInspector.getByRole('radiogroup', { name: '换行' })
    .getByRole('radio', { name: '换行', exact: true }).click()

  const firstRowFirst = await children.nth(0).boundingBox()
  const secondRowBox = await children.nth(2).boundingBox()
  expect(secondRowBox!.y).toBeGreaterThan(firstRowFirst!.y + 50)

  // 把第二行的子级拖到第一行两个兄弟之间：出现行内插入线，松手后进入第一行。
  await page.mouse.move(
    secondRowBox!.x + secondRowBox!.width / 2,
    secondRowBox!.y + secondRowBox!.height / 2,
  )
  await page.mouse.down()
  const firstRowSecond = await children.nth(1).boundingBox()
  await page.mouse.move(
    firstRowSecond!.x + 2,
    firstRowSecond!.y + firstRowSecond!.height / 2,
    { steps: 8 },
  )
  await expect(stage.getByTestId('stage-drop-line')).toHaveCount(1)
  await page.mouse.up()
  await expect(stage.getByTestId('stage-drop-line')).toHaveCount(0)

  // 拖动的子级现在位于第一行（y 与第一行首个子级一致）。
  await expect(children).toHaveCount(3)
  await expect.poll(async () => {
    const moved = await children.nth(1).boundingBox()
    return Math.round(moved!.y) === Math.round(firstRowFirst!.y)
  }).toBe(true)
})

test('OpenSpec: stage / 组件实例内部下钻与命中 / 双击逐层下钻并与场景树同步', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })

  // 单选提取会复用被选中的容器作为组件根，因此内部再嵌一层容器才能验证逐层下钻。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.getByRole('button', { name: '添加 Container' }).click()
  await editor.getByRole('button', { name: '添加 Rectangle' }).click()
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  const source = sceneTree.getByRole('row').last()
  await source.click()
  await source.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '创建组件…' }).click()
  const dialog = page.getByRole('dialog', { name: '创建组件' })
  await dialog.getByLabel('组件名称').fill('Drill Card')
  await dialog.getByRole('button', { name: '创建' }).click()

  const content = stage.getByTestId('compose-component-instance-content')
  await expect(content).toBeVisible()
  const inner = content.locator('[data-component-instance-entity-id]').last()
  const box = await inner.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2

  // 单击只选中实例整体，内部实体不被单独选中。
  await page.mouse.click(x, y)
  await expect(sceneTree.getByRole('row', { name: /Drill Card/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // 一次双击恰好前进一层，并自动展开宿主实例使选中行可见。
  await page.waitForTimeout(600)
  await page.mouse.dblclick(x, y)
  await expect(sceneTree.getByRole('row', { name: /Container/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(sceneTree.getByRole('row', { name: /Drill Card/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  // 再次双击继续深入一层，祖先链保持展开。
  await page.waitForTimeout(600)
  await page.mouse.dblclick(x, y)
  await expect(sceneTree.getByRole('row', { name: /Rectangle/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // 内部实体几何来自 DOM 测量，选中框必须贴合该实体且不带手柄。
  const outline = stage.getByTestId('stage-instance-selection-bounds')
  await expect(outline).toBeVisible()
  await expect(outline).toHaveAttribute('width', String(box!.width))
  await expect(outline).toHaveAttribute('height', String(box!.height))
  await expect(stage.getByTestId('stage-resize-edge-nw')).toHaveCount(0)

  // Inspector 路由到内部实体：编辑写入实例覆盖，宿主文档不新增实体。
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await expect(inspector).toContainText('Rectangle')
  const positionX = inspector.getByLabel('位置 X')
  await expect(positionX).toHaveValue('520')
  await positionX.fill('40')
  await positionX.press('Enter')
  await expect(inspector.getByLabel('位置 X')).toHaveValue('40')

  // name 不是 Component 字段，稳定操作代数无法表达重命名，因此该字段只读而不是静默失效。
  await expect(inspector.getByLabel('名称')).toHaveAttribute('readonly', '')
})


