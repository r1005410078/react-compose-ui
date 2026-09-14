import { expect, test } from '@playwright/test'

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
