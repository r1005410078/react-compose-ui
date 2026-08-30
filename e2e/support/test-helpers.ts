import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export async function pointerDrop(page: Page, source: Locator, target: { x: number; y: number }) {
  // 拖起点必须在可视区域内：Palette 是可滚动的，新增一个 Preset 就会把靠后的物料挤出视口，
  // 此时 boundingBox 仍然返回坐标（CSS 上可见），而按下的位置已经落在面板之外。
  await source.scrollIntoViewIfNeeded()
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

/**
 * 点一个空心曲线的描边把它选中。
 *
 * @remarks
 * 矩形默认空心，盒内部不命中——它在画布上可点、可拖的只有那一圈描边。默认点**上边线**：
 * 选中之后边缘的缩放命中带整条让到盒外，因此同一条边线在选中前后都归「选中/移动」，用例
 * 不必因为对象已经被选中而换一个位置。
 */
export async function clickCurveStroke(
  node: Locator,
  options: {
    /** 落点距盒左上角的横向偏移；默认取上边线上一个远离角手柄的位置。 */
    readonly offsetX?: number
    /** 改点下边线；上边线落在场景之外、或被场景标题标签压住时用它。 */
    readonly edge?: 'top' | 'bottom'
    readonly modifiers?: readonly ('Alt' | 'Control' | 'Meta' | 'Shift')[]
  } = {},
) {
  const { offsetX = 40, edge = 'top', modifiers } = options
  const height = edge === 'bottom'
    ? (await node.boundingBox())!.height
    : 0
  await node.click({
    position: { x: offsetX, y: edge === 'bottom' ? height - 1 : 1 },
    ...(modifiers ? { modifiers: [...modifiers] } : {}),
  })
}

/**
 * 空心曲线的可抓点：盒上边线上的一个页面坐标。
 *
 * @remarks
 * 与 {@link clickCurveStroke} 同一条理由，给需要 `page.mouse` 逐步拖动的用例用。
 */
export async function curveStrokeGrip(node: Locator, offsetX = 40) {
  await expect.poll(() => node.boundingBox()).not.toBeNull()
  const box = (await node.boundingBox())!
  return { x: box.x + offsetX, y: box.y + 1 }
}

/**
 * 从场景树里选中一个容器的子项。
 *
 * @remarks
 * 画布上选不中它时用这条路：空心矩形只有描边可点，而填满容器交叉轴的子项，四条边里三条压在
 * 容器自己的缩放命中带下面。选择集是编辑器级的，因此树里选中与画布上点中是同一件事。
 */
export async function selectChildInSceneTree(editor: Locator, parent: Locator, child: Locator) {
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const parentId = await parent.getAttribute('data-entity-id')
  const childId = await child.getAttribute('data-entity-id')
  const parentRow = sceneTree.locator(`[data-tree-item-id="${parentId}"]`)
  const expand = parentRow.getByRole('button', { name: '展开节点' })
  if (await expand.count() > 0) await expand.click()
  await sceneTree.locator(`[data-tree-item-id="${childId}"]`).click()
}

/** 通过新的画布工具流创建一个可供后续断言操作的 Container。 */
export async function drawContainer(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const output = stage.getByTestId('stage-frame-boundary-frame-root')
  /*
   * `toBeVisible()` 之后再 `boundingBox()` 是两趟往返：布局在首帧之后还会动一下，中间那一刻
   * 量到的可能是 `null`。轮询到量得出来为止，否则症状是这条断言在满载时偶发地红，而看起来
   * 像画布坏了。
   */
  await expect.poll(() => output.boundingBox()).not.toBeNull()
  const outputBox = await output.boundingBox()

  await editor.getByRole('button', { name: '创建容器' }).click()
  await page.mouse.move(outputBox!.x + 48, outputBox!.y + 64)
  await page.mouse.down()
  await page.mouse.move(outputBox!.x + 696, outputBox!.y + 424, { steps: 4 })
  await page.mouse.up()
  await expect(stage.getByTestId('stage-container')).toBeVisible()
  await editor.getByRole('button', { name: '选择', exact: true }).click()
}

/**
 * 用工具栏文本工具在指定位置创建一个内容为 `Text` 的实体。
 *
 * Text Preset 默认不在组件库 Palette 中（工具栏已提供入口），因此需要文本实体的用例
 * 走工具栏创建，而不是从 Palette 拖入。
 */
export async function drawText(page: Page, editor: Locator, at: { x: number; y: number }) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  const before = await stage.getByTestId('compose-material-text').count()
  await editor.getByRole('button', { name: '文字' }).click()
  await page.mouse.click(at.x, at.y)
  // 文字只按点创建，且以空内容进入编辑；空内容退出会被删除，所以这些用例先键入内容再提交。
  // 聚焦推迟一帧以避开 pointerdown 默认动作，打字前先等焦点落定。
  await expect(stage.getByTestId('compose-material-text-editable')).toBeFocused()
  await page.keyboard.type('Text')
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: '选择', exact: true }).click()
  await expect(stage.getByTestId('compose-material-text')).toHaveCount(before + 1)
}

/**
 * 选中一个场景内的普通容器。
 *
 * 标题标签只属于场景（rootIds 直接成员）：场景子级容器没有标签。画布点体虽然可选中，
 * 但容器可能被子项铺满或伸出可视区（右侧被 Inspector 面板遮挡），因此走场景树——
 * 它是任何布局与视口下都稳定的选中入口。会切换底部标签到场景树。
 */
export async function selectContainer(editor: Locator, index = 0) {
  // 先关掉可能残留的浮层（如 Ctrl+点击在 macOS 上弹出的上下文菜单）：base-ui portal
  // 会把背景设为 inert，拦截一切点击。
  await editor.page().keyboard.press('Escape')
  await editor.locator('[data-workspace-tab="compose-scene-content-panel"]').click()
  await editor.getByRole('treegrid', { name: '场景树' })
    .getByRole('row', { name: /Container/ })
    .nth(index)
    .click()
}

export async function enableAutoLayout(inspector: Locator) {
  await inspector.getByRole('button', { name: '添加布局' }).click()
  await inspector.getByRole('menuitem', { name: 'Auto Layout display: flex' }).click()
}

export async function selectAxisSizing(inspector: Locator, axis: '宽度' | '高度', mode: 'Fill' | 'Hug') {
  const input = inspector.getByRole('combobox', { name: `尺寸${axis}` })
  await input.fill(mode)
  await input.press('Enter')
}

export async function expandInspectorSection(inspector: Locator, name: string) {
  const trigger = inspector.getByRole('button', { name, exact: true })
  if (await trigger.getAttribute('aria-expanded') === 'false') {
    await trigger.click()
  }
}

/**
 * 可以在里面绘制的空白区最小尺寸。
 *
 * 点一下只要有一个像素就够，绘制不行：stage 顶部还浮着缩放控件条，窄条区域会把 pointerdown
 * 喂给它而不是画布，于是"画了但什么都没创建"，而选中态没变会让后续断言无条件通过。
 */
const MIN_DRAWABLE_BLANK = 80

/** 只需要落一次点击时的最小尺寸。 */
const MIN_CLICKABLE_BLANK = 24

/** 场景填满视口时最多缩小几次腾出空白区。 */
const MAX_ZOOM_OUT = 6

/** 标尺占据上/左边缘，四个方向各留安全距后取面积最大的一块空白。 */
function largestBlankRegion(
  stageBox: { x: number; y: number; width: number; height: number },
  occupied: readonly { x: number; y: number; width: number; height: number }[],
  minSize: number,
) {
  const RULER = 28
  const viewport = {
    left: stageBox.x + RULER,
    top: stageBox.y + RULER,
    right: stageBox.x + stageBox.width - RULER,
    bottom: stageBox.y + stageBox.height - RULER,
  }
  const left = Math.min(...occupied.map((box) => box.x))
  const top = Math.min(...occupied.map((box) => box.y))
  const right = Math.max(...occupied.map((box) => box.x + box.width))
  const bottom = Math.max(...occupied.map((box) => box.y + box.height))
  return [
    { x: viewport.left, y: viewport.top, width: left - viewport.left, height: viewport.bottom - viewport.top },
    { x: viewport.left, y: viewport.top, width: viewport.right - viewport.left, height: top - viewport.top },
    { x: right, y: viewport.top, width: viewport.right - right, height: viewport.bottom - viewport.top },
    { x: viewport.left, y: bottom, width: viewport.right - viewport.left, height: viewport.bottom - bottom },
  ]
    .filter((region) => region.width >= minSize && region.height >= minSize)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

/** 读取当前所有场景在屏幕上的矩形。 */
async function frameScreenBoxes(stage: Locator) {
  const frames = await stage.locator('[data-testid^="stage-frame-boundary-"]').all()
  const boxes = await Promise.all(frames.map((frame) => frame.boundingBox()))
  return boxes.filter((box): box is NonNullable<typeof box> => box !== null)
}

/**
 * 求一块既在 stage 视口内、又落在所有场景之外的空白矩形。
 *
 * 场景边界盒是未裁剪的世界矩形，可能远大于 stage 视口，因此不能直接拿它的外侧算落点。
 * 场景多了以后可能把视口填满，此时先缩小视图再找——多场景用例不该因为"看不见空地"而失败。
 */
export async function emptyWorkspaceRect(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  for (let attempt = 0; attempt <= MAX_ZOOM_OUT; attempt += 1) {
    const stageBox = (await stage.boundingBox())!
    const region = largestBlankRegion(stageBox, await frameScreenBoxes(stage), MIN_DRAWABLE_BLANK)
    if (region) return region
    await stage.focus()
    await stage.press('Control+-')
  }
  throw new Error('stage 视口里找不到场景之外的空白处')
}

/**
 * 点空白工作区打开页面属性面板。
 *
 * 这里刻意不缩放视图：调用方常常在前后测量画布几何，任何视口变化都会让那些断言凭空偏移。
 * 只落一次点击，因此对空白区的尺寸要求也比绘制宽松得多。
 */
export async function openPageInspector(page: Page, editor: Locator) {
  const stage = editor.getByRole('application', { name: 'Stage' })
  await expect(stage).toBeVisible()
  /*
   * `toBeVisible()` 与 `boundingBox()` 是两趟往返，中间布局可以再动一次——切工作区标签之后
   * 尤其如此。断言可见的那一刻它有盒，量的时候可能已经没有了，`boundingBox()` 于是回 `null`，
   * 症状是一句与本用例毫无关系的 `Cannot read properties of null`。轮询到量得着为止。
   */
  await expect.poll(() => stage.boundingBox()).not.toBeNull()
  const stageBox = (await stage.boundingBox())!
  const region = largestBlankRegion(stageBox, await frameScreenBoxes(stage), MIN_CLICKABLE_BLANK)
  expect(region, 'stage 视口里找不到场景之外的空白处').toBeTruthy()
  await page.mouse.click(region!.x + region!.width / 2, region!.y + region!.height / 2)
  await expect(editor.getByRole('region', { name: '页面属性' })).toBeVisible()
}
