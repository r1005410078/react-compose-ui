import { expect, test, type Page } from '@playwright/test'

/**
 * `FLATTEN` 把选中的形状换成一条可编辑的 `path`。
 *
 * 判据是**用户按下这个按钮想做什么**：把一个圆角矩形变成能拖控制手柄的路径。因此它是
 * 「写入方 MUST 取最窄 kind」那条规则的唯一例外——那条规则防的是「拖不动顶点」，而这里
 * 要的正是把顶点换成控制手柄。
 *
 * 单个操作数走**原地改几何**：它还是那个对象，名字、颜色、位置与层序一个字节不动。
 */
test('OpenSpec: stage / 布尔运算的落地规划 / 拍平一个矩形之后它仍是同一个对象，几何变成 path', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })

  // 先画一个矩形：拍平要有东西可拍。
  await commandInput.fill('RECTANGLE')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('指定第一个角点')
  await page.mouse.click(at(240, 200).x, at(240, 200).y)
  await page.mouse.click(at(420, 320).x, at(420, 320).y)
  await expect(prompt).toContainText('命令：')

  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)

  /*
   * 此刻它是一个闭合多段线，渲染成 `<polygon>`；不先断这一条，下面那句「没有 polygon 了」
   * 在任何情况下都成立，会得到一条永远绿的假用例。
   *
   * 两个而不是一个：描边层之下还压着一层透明加宽的命中层，命中靠它而不是靠包围盒。
   */
  const scene = stage.getByTestId('stage-scene-layer')
  await expect(scene.locator('polygon')).toHaveCount(2)

  // 选中它，然后从命令行拍平——货架不得成为唯一入口，这条路必须自己走得通。
  await page.mouse.click(at(330, 200).x, at(330, 200).y)
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  await commandInput.fill('FLAT')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')

  /*
   * 场景树上还是原来那一行：单操作数走原地改几何，Entity 没有被换掉。少了这一条，
   * 「拍平」与「删掉再建一个」在屏幕上无法区分，而后者会丢掉动画轨道与导线绑定。
   */
  await expect(sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })).toHaveCount(1)

  /*
   * 几何换成了 `path`，而这件事在 Scene 的 DOM 上直接读得出来：闭合多段线渲染成一个
   * `<polygon>`，`path` 渲染成一个 `<path>`。断这一条比断属性面板里的文案硬——它量的是
   * 用户真正看见的那个元素。
   */
  await expect(scene.locator('polygon')).toHaveCount(0)
  await expect(scene.locator('path[d]').first()).toBeVisible()
})

/**
 * 并集把两个形状合成一个：产物是一个新对象，两个操作数在**同一个事务**里消失。
 *
 * 与拍平那一支的差别是**操作数有几个**——多于一个就合并，因为这时它确实不再是原来任何一个。
 */
test('OpenSpec: stage / 布尔运算的落地规划 / 并集把两个矩形合成一个，撤销一步全回去', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })

  // 两个重叠的矩形。
  for (const [from, to] of [[[220, 180], [360, 300]], [[300, 240], [440, 360]]] as const) {
    await commandInput.fill('RECTANGLE')
    await commandInput.press('Enter')
    await expect(prompt).toContainText('指定第一个角点')
    await page.mouse.click(at(from[0], from[1]).x, at(from[0], from[1]).y)
    await page.mouse.click(at(to[0], to[1]).x, at(to[0], to[1]).y)
    await expect(prompt).toContainText('命令：')
  }
  await expect(rows).toHaveCount(2)

  /*
   * 两个都选上：`Shift` 累加是这个产品唯一的一套选择语义。**点在描边上**——矩形默认空心，
   * 而空心曲线不以包围盒拦截指针，内部点下去什么都选不中。
   */
  const scene = stage.getByTestId('stage-scene-layer')
  await expect(scene.locator('polygon')).toHaveCount(4)
  await page.mouse.click(at(290, 180).x, at(290, 180).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(370, 360).x, at(370, 360).y)
  await page.keyboard.up('Shift')
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)

  await commandInput.fill('UNI')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')

  /*
   * 两个操作数合成了一个：场景树上只剩一行，而它叫的是**层序最靠后**那个操作数的名字——
   * 外观、名称、父级与插入位置取同一个来源，这一条在这里是看得见的。
   */
  await expect(rows).toHaveCount(1)
  // 图上也只剩一个闭合多段线（描边层 + 命中层两个 `<polygon>`）。
  await expect(scene.locator('polygon')).toHaveCount(2)

  // 一个事务：撤销一步 MUST 回到运算之前，而不是回到「删了一半」。
  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(2)
  await expect(scene.locator('polygon')).toHaveCount(4)
})

/**
 * 差集挖出一个洞：产物是**一条**带两条子路径的 `path`，靠 `fill-rule="evenodd"` 表达那个洞。
 *
 * 这是整条链上唯一能被证伪的地方——`islandCount → evenodd → DOM` 三段在单测里各断过一次，
 * 而「看得见的洞与点不中的洞是同一个洞」这句话只在浏览器里成立或不成立。拆成两个 Entity 会
 * 把洞画成一块实心的覆盖物，那在 DOM 上读作两个元素而不是一个。
 */
test('OpenSpec: compose-document / 曲线布尔运算按面分类求解 / 差集挖出的洞落成 evenodd', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const scene = stage.getByTestId('stage-scene-layer')

  // 大矩形，再在它**内部**画一个小矩形——两者没有任何交点，正是「枚举面」做不对的那一档。
  for (const [from, to] of [[[200, 160], [460, 380]], [[280, 220], [360, 300]]] as const) {
    await commandInput.fill('RECTANGLE')
    await commandInput.press('Enter')
    await expect(prompt).toContainText('指定第一个角点')
    await page.mouse.click(at(from[0], from[1]).x, at(from[0], from[1]).y)
    await page.mouse.click(at(to[0], to[1]).x, at(to[0], to[1]).y)
    await expect(prompt).toContainText('命令：')
  }
  await expect(scene.locator('polygon')).toHaveCount(4)

  // 都点在描边上：矩形默认空心，内部点下去什么都选不中。
  await page.mouse.click(at(330, 160).x, at(330, 160).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(320, 220).x, at(320, 220).y)
  await page.keyboard.up('Shift')

  await commandInput.fill('SU')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')

  /*
   * 闭合多段线渲染成 `<polygon>`，带洞的产物只能落成 `path`——先断 polygon 归零，否则下面
   * 那句在「运算根本没发生」时照样成立。
   */
  await expect(scene.locator('polygon')).toHaveCount(0)
  const hole = scene.locator('path[fill-rule="evenodd"]')
  await expect(hole).toHaveCount(2)
  // 一条 `path` 两条子路径：`d` 里恰好两个 `M`。拆成两个 Entity 会读成两个元素。
  const data = (await hole.first().getAttribute('d')) ?? ''
  expect(data.match(/M/g)).toHaveLength(2)
})

/**
 * `⌥⇧U`：照抄 Figma 的键位，是这一格在目录里声明的**第三条入口**。
 *
 * 目录那条「每一格都声明了第二条入口」的用例读的是 `entrance` 字段（写着命令行），快捷键
 * 只写在注释里——没有这一条，把五个键位整个删掉不会让任何用例变红。
 */
test('OpenSpec: stage / 布尔运算的键盘入口 / 图面上按 ⌥⇧U 即求并集，撤销一步全回去', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })

  for (const [from, to] of [[[220, 180], [360, 300]], [[300, 240], [440, 360]]] as const) {
    await commandInput.fill('RECTANGLE')
    await commandInput.press('Enter')
    await expect(prompt).toContainText('指定第一个角点')
    await page.mouse.click(at(from[0], from[1]).x, at(from[0], from[1]).y)
    await page.mouse.click(at(to[0], to[1]).x, at(to[0], to[1]).y)
    await expect(prompt).toContainText('命令：')
  }
  await expect(rows).toHaveCount(2)

  await page.mouse.click(at(290, 180).x, at(290, 180).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(370, 360).x, at(370, 360).y)
  await page.keyboard.up('Shift')

  // 焦点此刻在图面上——键位必须在这里生效，那正是用户刚点完选择的地方。
  await page.keyboard.press('Alt+Shift+KeyU')
  await expect(rows).toHaveCount(1)

  /*
   * 选区挪到了**产物**上。布尔运算消费用户自己建立的那份选区，不挪的话操作数被删掉、选区跟着
   * 被静默清空，用户读到的是「我按了一下，东西没了」——与编组把选区挪到新建的那个 Group 上
   * 是同一条。
   */
  await expect(stage.getByTestId('stage-selection-bounds')).toHaveCount(1)
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('Control+z')
  await expect(rows).toHaveCount(2)
})

/**
 * 锁定一个操作数即拒绝**并说明**，MUST NOT 退回去把它一起合并掉。
 *
 * 「你锁了它」和「我把它删了」是两件事，后者会让锁形同虚设；而「敲了没反应」与敲错字在屏幕上
 * 无法区分，因此那句话必须指名道姓。
 */
test('OpenSpec: stage / 布尔运算的八种拒绝各有一句话 / 锁着的操作数挡住运算并指名道姓', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })

  for (const [from, to] of [[[220, 180], [360, 300]], [[300, 240], [440, 360]]] as const) {
    await commandInput.fill('RECTANGLE')
    await commandInput.press('Enter')
    await expect(prompt).toContainText('指定第一个角点')
    await page.mouse.click(at(from[0], from[1]).x, at(from[0], from[1]).y)
    await page.mouse.click(at(to[0], to[1]).x, at(to[0], to[1]).y)
    await expect(prompt).toContainText('命令：')
  }
  await expect(rows).toHaveCount(2)

  // 锁住其中一个；场景树那颗锁按钮是这条能力在界面上的入口。
  const target = rows.first()
  const name = (await target.getByRole('gridcell').first().textContent())?.trim() ?? ''
  await target.hover()
  await target.getByRole('button', { name: `锁定 ${name}` }).click()

  await page.mouse.click(at(290, 180).x, at(290, 180).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(370, 360).x, at(370, 360).y)
  await page.keyboard.up('Shift')

  await commandInput.fill('UNI')
  await commandInput.press('Enter')

  // 说明里带着那个对象的名字，而两个矩形一个都没少。
  await expect(prompt).toContainText(`「${name}」锁着`)
  await expect(rows).toHaveCount(2)
})

/**
 * 结果没有面积时说明一句，而文档**一个字节不动**。
 *
 * 「这两个形状没有重叠」与「这几个形状算不出来」是两句不同的话：前者按一下别的运算就好，
 * 后者要把形状错开一点再试。
 */
test('OpenSpec: stage / 布尔运算的八种拒绝各有一句话 / 交集为空时出说明而文档不变', async ({ page }) => {
  await page.goto('/?no-auto-fit')

  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const prompt = stage.getByTestId('stage-drafting-command-prompt')
  const surface = stage.getByTestId('stage-surface')
  await expect.poll(() => surface.boundingBox()).not.toBeNull()
  const box = (await surface.boundingBox())!
  const at = (dx: number, dy: number) => ({ x: box.x + dx, y: box.y + dy })

  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  const sceneTree = editor.getByRole('treegrid', { name: '场景树' })
  const rows = sceneTree.getByRole('row').filter({ hasText: 'Rectangle' })

  // 两个离得很远的矩形——它们没有任何重叠。
  for (const [from, to] of [[[180, 160], [260, 240]], [[400, 320], [480, 400]]] as const) {
    await commandInput.fill('RECTANGLE')
    await commandInput.press('Enter')
    await expect(prompt).toContainText('指定第一个角点')
    await page.mouse.click(at(from[0], from[1]).x, at(from[0], from[1]).y)
    await page.mouse.click(at(to[0], to[1]).x, at(to[0], to[1]).y)
    await expect(prompt).toContainText('命令：')
  }
  await expect(rows).toHaveCount(2)

  await page.mouse.click(at(220, 160).x, at(220, 160).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(440, 320).x, at(440, 320).y)
  await page.keyboard.up('Shift')

  await page.keyboard.press('Alt+Shift+KeyI')

  await expect(prompt).toContainText('留不下任何面积')
  await expect(rows).toHaveCount(2)
})

/**
 * 打开画布并备好键入坐标的工具。
 *
 * @remarks
 * 圆与矩形一律**键入坐标**而不是点击：几何因此精确已知，尺寸断言才有意义。只有油漆桶的落点
 * 与选择集必须用指针——前者是 `pick`（不过点输入管线），后者本来就是点选。
 */
async function openBooleanStage(page: Page) {
  await page.goto('/?no-auto-fit')
  const editor = page.getByRole('region', { name: 'Compose editor' })
  const stage = editor.getByRole('application', { name: 'Stage' })
  const surface = stage.getByTestId('stage-surface')
  await expect(surface).toBeVisible()
  const view = await page.evaluate(() => {
    const scene = document.querySelector('.compose-stage__scene') as HTMLElement
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform)
    const rect = (document.querySelector('[data-testid="stage-surface"]') as HTMLElement)
      .getBoundingClientRect()
    return { zoom: matrix.a, x: matrix.e, y: matrix.f, left: rect.left, top: rect.top }
  })
  const commandInput = stage.getByRole('combobox', { name: '命令行' })
  return {
    at: (x: number, y: number) => ({
      x: view.left + view.x + x * view.zoom,
      y: view.top + view.y + y * view.zoom,
    }),
    commandInput,
    curves: stage.locator('[data-testid="compose-material-curve-stroke"]'),
    key: async (command: string, points: readonly string[]) => {
      await commandInput.fill(command)
      await commandInput.press('Enter')
      for (const point of points) {
        await commandInput.fill(point)
        await commandInput.press('Enter')
      }
      await commandInput.press('Escape')
    },
    prompt: stage.getByTestId('stage-drafting-command-prompt'),
    stage,
    zoom: view.zoom,
  }
}

/**
 * 在页面内量每条曲线渲染出来的尺寸。
 *
 * @remarks
 * **不用 Playwright 的 `boundingBox()`**：它量的是绘制边界，尖角上的斜接（miter）会把描边
 * 甩出形状之外——这个并集的产物因此读成 335 × 269 而不是 320 × 240，而那 15 与 29 个像素
 * 与几何无关。页面内的 `getBoundingClientRect` 给的是几何边界。
 */
async function measureCurves(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-entity-id]')]
    .filter((node) => !node.getAttribute('data-entity-id')!.startsWith('frame'))
    .flatMap((node) => {
      const element = node.querySelector('[data-testid="compose-material-curve-stroke"]')
      if (!element) return []
      const rect = element.getBoundingClientRect()
      return [{
        fill: element.getAttribute('fill') ?? '',
        height: rect.height,
        tag: element.tagName,
        width: rect.width,
      }]
    }))
}

/**
 * 由圆弧围成的填充块参与区域运算。
 *
 * 这是用户报上来的那一档：求面产出的面边上有弧就只能落成 `path`（多段线顶点没有 bulge），
 * 而区域运算此前把 `path` 整个拒掉，命令行写着「这一版还不支持带曲线段的路径」。产品自己
 * 产出的东西产品自己不认。
 *
 * 断的是**几何尺寸**而不只是「算出来了」：把弧拍成折线同样算得出来，而尺寸对不上正是棱的
 * 直接后果；只数个数的话，一个几像素大的退化产物也能让用例变绿。
 */
test('OpenSpec: stage-engine / 操作数合不合格在解算层判定，命令会话只管数量 / 由弧围成的填充块参与区域运算', async ({ page }) => {
  const { at, commandInput, curves, key, prompt, stage } = await openBooleanStage(page)

  // 两个相交的圆：圆心 (100,100) 与 (260,100)，半径各 120。
  await key('CIRCLE', ['100,100', '220,100'])
  await key('CIRCLE', ['260,100', '380,100'])

  // 油漆桶填左边那块月牙：它的两条边都是圆弧，因此只能落成 `path`。
  await commandInput.fill('HATCH')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('点一下要填充的区域内部')
  await page.mouse.click(at(20, 100).x, at(20, 100).y)
  await commandInput.press('Escape')
  await commandInput.press('Escape')
  const fills = stage.locator('[data-testid="compose-material-curve-stroke"][fill^="#"]')
  await expect(fills).toHaveCount(1)
  await expect(fills.first()).toHaveJSProperty('tagName', 'path')

  // 一个压在月牙右半边上的矩形；两者没有共用的边界。
  await key('RECTANGLE', ['150,60', '300,140'])
  await page.keyboard.press('Escape')
  await expect(curves).toHaveCount(4)

  /*
   * 选月牙的内部，再 Shift 点矩形的右边线。**不点 (180, 100)**——那正好压在月牙选区盒的右
   * 边缘，Shift 点击会被缩放命中带吃掉，选区不增加。
   */
  await page.mouse.click(at(20, 100).x, at(20, 100).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(300, 100).x, at(300, 100).y)
  await page.keyboard.up('Shift')

  await commandInput.fill('UNION')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')

  // 两个操作数合成一个，两个圆原样留着。
  await expect(curves).toHaveCount(3)
  await expect(fills).toHaveCount(1)
  /*
   * 月牙 x ∈ [−20, 180]、矩形 x ∈ [150, 300]，并集因此是 320 × 240 世界单位。拿**圆自己**当
   * 尺子（它恒是 240 × 240）而不是换算屏幕缩放：两者在同一次测量里，比例因此与缩放无关。
   * 弧被拍成折线时这个比例会小掉——多边形的顶点落在弧的内侧。
   */
  const measured = await measureCurves(page)
  expect(measured).toHaveLength(3)
  // 圆自己是尺子（恒 240 × 240），比例因此与画布缩放无关。
  const ruler = measured.find((item) => item.tag === 'circle')!
  const merged = measured.find((item) => item.fill.startsWith('#'))!
  expect(merged.width / ruler.width).toBeCloseTo(320 / 240, 2)
  expect(merged.height / ruler.height).toBeCloseTo(1, 2)
})

/**
 * 两块共用一段弧形边界的填充求并集。
 *
 * 这一条是用户报的那张图：两个相交的圆，油漆桶填出的几块面，全选求运算。共用的那段弧在两个
 * 对象里各存了一份、各自量化，两份的圆心因此差到三个量化步长——归一之前平面图把它们当成两条
 * 几乎共圆的边，每一个射线方向都退化。
 *
 * 断的是**几何尺寸**而不是「算出来了」：左月牙 ∪ 透镜恰好是整个左边那个圆，与右边那个圆一样
 * 大。只数个数的话，一个几像素大的退化产物同样能让用例变绿——上一个变更就栽在这里。
 */
test('OpenSpec: compose-document / 重合的边界在建图之前归一到同一条支撑 / 两块共用弧边界的填充求得出并集', async ({ page }) => {
  const { at, commandInput, curves, key, prompt } = await openBooleanStage(page)
  await key('CIRCLE', ['100,100', '220,100'])
  await key('CIRCLE', ['260,100', '380,100'])
  // 左月牙与透镜：两者共用圆 b 左边那段弧。
  for (const seed of [[20, 100], [200, 100]] as const) {
    await commandInput.fill('HATCH')
    await commandInput.press('Enter')
    await page.mouse.click(at(seed[0], seed[1]).x, at(seed[0], seed[1]).y)
    await commandInput.press('Escape')
    await commandInput.press('Escape')
  }
  await page.keyboard.press('Escape')
  await expect(curves).toHaveCount(4)

  await page.mouse.click(at(20, 100).x, at(20, 100).y)
  await page.keyboard.down('Shift')
  await page.mouse.click(at(200, 100).x, at(200, 100).y)
  await page.keyboard.up('Shift')

  await commandInput.fill('UNION')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')

  // 两块填充合成一块，两个圆原样留着。
  await expect(curves).toHaveCount(3)
  const measured = await measureCurves(page)
  expect(measured).toHaveLength(3)
  /*
   * 拿**圆自己**当尺子（它恒是 240 × 240）而不是换算屏幕缩放：两者在同一次测量里，比例因此
   * 与缩放无关。左月牙 ∪ 透镜 = 整个圆 a，两轴都是 1:1。
   */
  const ruler = measured.find((item) => item.tag === 'circle')!
  const merged = measured.find((item) => item.fill.startsWith('#'))!
  expect(merged.width / ruler.width).toBeCloseTo(1, 2)
  expect(merged.height / ruler.height).toBeCloseTo(1, 2)
})

/**
 * 用户报上来的那一下：两个相交的圆、三块填出来的面，框选全部再求并集。
 *
 * 三块面两两都贴着同一条弧，而每一条共用的弧在图里各存了一份——这是「共用曲线边界」这一档
 * 最密的形式：五个对象一次进同一张平面图。
 *
 * 断的是**尺寸差**而不是绝对尺寸：量到的是渲染出来的墨，含描边宽度；拿并集与单个圆的宽度
 * **相减**，那个常数就抵掉了，剩下的正好是 (200 − 120) 个世界单位。
 */
test('OpenSpec: compose-document / 重合的边界在建图之前归一到同一条支撑 / 框选全部五个对象求并集', async ({ page }) => {
  const { at, commandInput, curves, key, prompt, zoom } = await openBooleanStage(page)
  // 半径 60、圆心相距 80 的两个圆：整份图连同框选的余量都落在图面可视区里。
  await key('CIRCLE', ['100,100', '160,100'])
  await key('CIRCLE', ['180,100', '240,100'])
  for (const seed of [[50, 100], [140, 100], [230, 100]] as const) {
    await commandInput.fill('HATCH')
    await commandInput.press('Enter')
    await page.mouse.click(at(seed[0], seed[1]).x, at(seed[0], seed[1]).y)
    await commandInput.press('Escape')
    await commandInput.press('Escape')
  }
  await page.keyboard.press('Escape')
  await expect(curves).toHaveCount(5)

  // 先量一个圆当尺子：它恒是 120 个世界单位宽。
  const ruler = (await measureCurves(page)).find((item) => item.tag === 'circle')!

  // 从空白处拖一个从左往右的框：窗口判定，五个对象全部被完全框住。
  await page.mouse.move(at(20, 20).x, at(20, 20).y)
  await page.mouse.down()
  await page.mouse.move(at(270, 185).x, at(270, 185).y, { steps: 8 })
  await page.mouse.up()

  await commandInput.fill('UNION')
  await commandInput.press('Enter')
  await expect(prompt).toContainText('命令：')
  await expect(curves).toHaveCount(1)

  const merged = (await measureCurves(page))[0]!
  // 两个圆的并集：宽 200、高 120 个世界单位。描边那个常数在相减里抵掉。
  expect((merged.width - ruler.width) / zoom).toBeCloseTo(200 - 120, 0)
  expect((merged.height - ruler.height) / zoom).toBeCloseTo(0, 0)
})
