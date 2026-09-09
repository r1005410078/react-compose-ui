import { expect, test } from '@playwright/test'
import { expandInspectorSection, pointerDrop } from './support/test-helpers'

/**
 * 导线的纵向流程。
 *
 * @remarks
 * 判别点是**求解不存储**：把符号拖走，导线的绑定端必须跟着走，而作者文档里那份几何并没有被
 * 逐条路径回写。删掉符号之后导线仍在——悬空引用是解算失败，不是文档非法。
 *
 * 命中相关断言必须在非 100% 缩放下做：`world = (屏幕 − 视口) / zoom`。
 */
test('OpenSpec: compose-document / 符号导线 / 绑定端跟着符号走，符号删掉后导线仍在', async ({ page }) => {
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  await expect(editor.locator('.compose-editor__canvas-zoom-value')).not.toHaveText('100%')

  // 1) 放一个矩形并给它一个端口（默认落在 Entity 局部原点，即矩形左上角）。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: frameBox.x + 240,
    y: frameBox.y + 180,
  })
  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()

  // 用固定 testid 锁住矩形：导线落地之后 `.last()` 会变成导线自己。
  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rectangle = stage.getByTestId(rectangleId)
  const beforeRect = (await rectangle.boundingBox())!

  // 2) LINE：起点捕捉到端口，终点落在右下方的空白处。
  //
  // 这里用 `LINE` 而不是 `WIRE` 正是这一刀的验收点——绑定跟着**取点的来源**走，与命令是哪
  // 一条无关。`LINE` 连续画线，因此取完两点还要回车结束，否则下一步拖符号的按下会被取点
  // 插件吃掉。
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await page.mouse.click(beforeRect.x, beforeRect.y)
  await page.mouse.click(beforeRect.x + 220, beforeRect.y + 160)
  await commandInput.press('Enter')

  // 只认**两点直线**那一个描边：矩形现在也是曲线（画成 `<polygon>`），拿总数会把它算进来。
  const stroke = stage.locator('line[data-testid="compose-material-curve-stroke"]')
  await expect(stroke).toHaveCount(1)
  // `LINE` 连续取点，回车之后会话还在等下一条的第一个点；不退出的话，下面那一下按在符号上
  // 的指针会被取点插件吃掉（它此刻要的是一个**点**，不是一次选择）。
  await stage.press('Escape')
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('命令：')
  const beforeWire = (await stroke.boundingBox())!

  /*
   * 3) 把符号拖走：绑定端跟着走，自由端不动。抓的是**下边线的左段**——矩形默认空心，盒
   * 内部不命中，可点可拖的只有那一圈描边；而导线从左上角斜向右下，在这条边约 80% 宽处
   * 才穿过它，左段不会误抓到它。落点按**量到的盒**取比例：这条用例跑在非 100% 缩放下，
   * 写死像素会跑到盒外面去。
   */
  const grip = {
    x: beforeRect.x + beforeRect.width * 0.2,
    y: beforeRect.y + beforeRect.height - 1,
  }
  await page.mouse.click(grip.x, grip.y)
  // 按下点**避开刚才那一下点击**：同一个位置的第二次按下会被浏览器判成双击，而双击一个
  // 矩形进的是几何编辑（它是曲线），这一次拖拽就不再是移动。
  const dragFrom = { x: beforeRect.x + beforeRect.width * 0.5, y: grip.y }
  await page.mouse.move(dragFrom.x, dragFrom.y)
  await page.mouse.down()
  await page.mouse.move(dragFrom.x - 80, dragFrom.y - 60, { steps: 8 })
  await page.mouse.up()

  const afterRect = (await rectangle.boundingBox())!
  const moved = { x: afterRect.x - beforeRect.x, y: afterRect.y - beforeRect.y }
  expect(moved.x).toBeLessThan(-20)

  await expect.poll(async () => (await stroke.boundingBox())!.x).toBeCloseTo(beforeWire.x + moved.x, 0)
  // 自由端一动不动：右下角还在原处。
  const afterWire = (await stroke.boundingBox())!
  expect(afterWire.x + afterWire.width).toBeCloseTo(beforeWire.x + beforeWire.width, 0)

  // 4) 删掉符号：导线仍在，绑定标为失效。
  await page.mouse.click(afterRect.x + 8, afterRect.y + afterRect.height - 8)
  await page.keyboard.press('Delete')
  await expect(rectangle).toHaveCount(0)
  // 悬空引用是解算失败而不是文档非法，因此导线还在。
  await expect(stroke).toHaveCount(1)

  await stroke.click({ force: true })
  await expandInspectorSection(inspector, '接线')
  await expect(inspector.getByTestId('compose-material-wire-start'))
    .toHaveAttribute('data-wire-end', 'dangling')
  // 自由端与失效必须可区分：两者的几何都来自作者文档，屏幕上看不出差别。
  await expect(inspector.getByTestId('compose-material-wire-end'))
    .toHaveAttribute('data-wire-end', 'free')
})

/**
 * 跨父级的那一端不绑，并且**说出来**。
 *
 * @remarks
 * `wire.parent-mismatch` 是文档非法而不是警告，而落地父级按线段紧包围盒中心判定——把符号放进
 * 一个容器、再把线画到容器外面，是一次很平常的手势。静默丢弃与「绑上了」在屏幕上无法区分，
 * 因此判别点是**命令行必须说出原因**。
 */
test('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 跨父级不绑并在命令行说明', async ({ page }) => {
  // 与上一条一样走默认路由：关掉自动适配时场景不在视野里，落点会掉到画面之外。
  await page.goto('/')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage.getByTestId('stage-surface')).toBeVisible()

  // 容器落在场景里，矩形落进容器——端口的父级因此是容器而不是场景。
  const frame = stage.getByTestId('stage-frame-boundary-frame-root')
  const frameBox = (await frame.boundingBox())!
  await editor.locator('[data-workspace-tab="compose-component-library-panel"]').click()
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Container' }), {
    x: frameBox.x + 160,
    y: frameBox.y + 150,
  })
  // 容器的 testid 不带 id 后缀，与矩形那套 `stage-entity-<id>` 不是一个命名。
  const containerBox = (await stage.getByTestId('stage-container').last().boundingBox())!
  await pointerDrop(page, editor.getByRole('button', { name: '添加 Rectangle' }), {
    x: containerBox.x + containerBox.width / 2,
    y: containerBox.y + containerBox.height / 2,
  })

  const inspector = editor.locator('[data-workspace-panel="inspector"]')
  await inspector.getByRole('button', { name: '添加端口' }).click()
  const rectangleId = (await stage.locator('[data-testid^="stage-entity-"]').last()
    .getAttribute('data-testid'))!
  const rect = (await stage.getByTestId(rectangleId).boundingBox())!

  // LINE：起点捕捉到端口（容器内），终点远在容器之外，因此线段落地在场景上。
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  await commandInput.fill('LINE')
  await commandInput.press('Enter')
  await page.mouse.click(rect.x, rect.y)
  await page.mouse.click(containerBox.x + containerBox.width + 220, containerBox.y + 200)

  // 判别点：说明必须出现。不绑是可见的降级，静默丢弃不是。
  //
  // 断在结束会话**之前**：`LINE` 逐段落地，这一段在第二次点击时就已经提交，而随后的回车
  // 会把命令行换成结束文案，说明就看不见了。
  await expect(stage.getByTestId('stage-drafting-command-prompt')).toContainText('不在同一层级')
  await commandInput.press('Enter')
})
