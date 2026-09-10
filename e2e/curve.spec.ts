import { expect, test } from '@playwright/test'
import { enterAnimationEditing } from './support/test-helpers'

test('OpenSpec: compose-document / 曲线 Entity 纵向流程 / 添加、按距离命中、编辑端点、移动与撤销', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()

  // 点击添加：曲线的创建路径是 Palette，绘制手势属于后续的绘图模式。
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 曲线' }).click()

  // 场景树零改动即可见——曲线是普通页面 Entity，这正是本刀要证明的。
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const curveRow = sceneTree.getByRole('row').filter({ hasText: 'Curve' })
  await expect(curveRow).toHaveCount(1)

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  await expect(stroke).toHaveCount(1)

  // 断言此刻不是 100%：`world = (屏幕 − 视口) / zoom`，zoom 恒为 1 时漏乘 zoom 也看不出来，
  // 因此命中相关的断言必须在非 100% 缩放下做。首次进入的自动取景已经把缩放压到 100% 以下。
  const zoomValue = editor.locator('.compose-editor__canvas-zoom-value')
  await expect(zoomValue).not.toHaveText('100%')

  const box = await stroke.boundingBox()
  expect(box).not.toBeNull()
  // 默认几何是左上→右下的斜线，因此右上角是包围盒里离线身最远的空角。
  const emptyCorner = { x: box!.x + box!.width - 6, y: box!.y + 6 }
  const onLine = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }

  // 先清掉添加时的选中，才能观察点击空角的效果。
  await page.keyboard.press('Escape')
  await page.mouse.click(emptyCorner.x, emptyCorner.y)
  await expect(editor.getByRole('region', { name: 'Curve 属性', exact: true })).toHaveCount(0)

  await page.mouse.click(onLine.x, onLine.y)
  const inspector = editor.getByRole('region', { name: 'Curve 属性', exact: true })
  await expect(inspector).toBeVisible()

  // 端点显示的是 parent 局部坐标：与「位置」读到同一个值说明换算做对了。
  await expect(inspector.getByRole('spinbutton', { name: '起点 X' }))
    .toHaveValue(await inspector.getByRole('spinbutton', { name: '位置 X' }).inputValue())

  // Inspector 改端点：几何与盒在同一事务里更新，画布立即跟随。
  const beforeEdit = await stroke.boundingBox()
  const endX = inspector.getByRole('spinbutton', { name: '终点 X' })
  await endX.fill('900')
  await endX.blur()
  await expect.poll(async () => (await stroke.boundingBox())!.width)
    .toBeGreaterThan(beforeEdit!.width)

  // 拖动整体移动：位置写 LayoutItem.offset，几何随盒平移。
  const beforeDrag = await stroke.boundingBox()
  const grip = { x: beforeDrag!.x + beforeDrag!.width / 2, y: beforeDrag!.y + beforeDrag!.height / 2 }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 60, grip.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Math.round((await stroke.boundingBox())!.x))
    .toBeGreaterThan(Math.round(beforeDrag!.x))

  // 撤销一步回到拖动前。
  await page.keyboard.press('Control+z')
  await expect.poll(async () => Math.round((await stroke.boundingBox())!.x))
    .toBe(Math.round(beforeDrag!.x))

  // 预览零改动即可渲染——曲线走的是普通 Entity 的渲染管线。
  await editor.getByRole('button', { name: '打开预览' }).click()
  const dialog = page.getByRole('dialog', { name: '文档预览对话框' })
  await expect(dialog.getByTestId('compose-material-curve-stroke')).toBeVisible()
})

test('OpenSpec: compose-document / 曲线 Entity / 位置关键帧零改动可用', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 曲线' }).click()

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const box = await stroke.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  // 曲线是普通页面 Entity，因此既有动画能力不需要任何曲线专用代码。
  await enterAnimationEditing(editor)
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '为 位置 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：位置' })).toBeVisible()

  // 动画面板从底部展开会压缩 Stage，图面因此重新取景——必须在这之后重新量，
  // 沿用设计模式下量到的盒会让抓取点落在线外。
  const animBox = await stroke.boundingBox()
  expect(animBox).not.toBeNull()

  // 播放头移到 200 ms 后拖动曲线：自动记录写入第二个关键帧。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  // 抓取点取对角线 1/4 处而不是中心：运动路径顶点位于物体中心，中心按下会抓到顶点。
  const grip = { x: animBox!.x + animBox!.width / 4, y: animBox!.y + animBox!.height / 4 }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 96, grip.y, { steps: 5 })
  await page.mouse.up()
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：位置' })).toBeVisible()

  // 播放头回 0：曲线按采样文档回到起点，说明轨道走的是既有 LayoutItem.offset 路径。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  await expect
    .poll(async () => Math.abs((await stroke.boundingBox())!.x - animBox!.x))
    .toBeLessThan(2)
})

test('OpenSpec: basic-materials / 曲线的虚线偏移 / 打两个关键帧让虚线沿线流动', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await editor.getByRole('button', { name: '添加 曲线' }).click()

  const stroke = stage.getByTestId('compose-material-curve-stroke')
  const box = await stroke.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  // 实线上的偏移在屏幕上没有任何变化——先有图案，偏移才谈得上「流动」。
  await inspector.getByRole('combobox', { name: '线条样式' }).selectOption('8 4')
  await expect(stroke).toHaveAttribute('stroke-dasharray', '4 2')
  // 没设过偏移的曲线不写这个属性，与引入本能力之前逐字一致。
  await expect(stroke).not.toHaveAttribute('stroke-dashoffset', /.*/u)

  await enterAnimationEditing(editor)
  const animationPanel = editor.locator('[data-workspace-panel="animation"]')
  await animationPanel.getByRole('button', { name: '创建动画' }).click()

  // 0 ms 打点：偏移从 0 起步。
  await inspector.getByRole('button', { name: '为 虚线偏移 添加关键帧' }).click()
  await expect(animationPanel.getByRole('button', { name: '关键帧 0 ms：虚线偏移' })).toBeVisible()

  // 200 ms 改值：自动记录把 Renderer props 的编辑改写成播放头处的关键帧，而不是静态值。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  await inspector.getByRole('spinbutton', { name: '虚线偏移' }).fill('-12')
  await inspector.getByRole('spinbutton', { name: '虚线偏移' }).press('Enter')
  await expect(animationPanel.getByRole('button', { name: '关键帧 200 ms：虚线偏移' })).toBeVisible()

  // 图案真的在动：中间时刻是插值出来的第三个值，而不是两端之一。
  const offsetAt = async (timeMs: string) => {
    await animationPanel.getByRole('slider', { name: '当前时间' }).fill(timeMs)
    // 缺席即 0：渲染不写这个属性与写 0 是同一件事，读数因此对两者都成立。
    return expect.poll(async () => Number(await stroke.getAttribute('stroke-dashoffset') ?? 0))
  }
  await (await offsetAt('200')).toBeCloseTo(-12, 1)
  await (await offsetAt('100')).toBeCloseTo(-6, 0)
  await (await offsetAt('0')).toBe(0)

  // 采样只作用于渲染：偏移走满两个关键帧，几何一动不动。基准必须在动画模式下重量——
  // 面板从底部展开会压缩 Stage 并让图面重新取景，沿用设计模式量到的盒会误报成位移。
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('0')
  const animBox = await stroke.boundingBox()
  expect(animBox).not.toBeNull()
  await animationPanel.getByRole('slider', { name: '当前时间' }).fill('200')
  await expect.poll(async () => Math.round((await stroke.boundingBox())!.x))
    .toBe(Math.round(animBox!.x))
})
