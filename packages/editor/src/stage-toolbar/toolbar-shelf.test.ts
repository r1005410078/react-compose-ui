import { describe, expect, it } from 'vitest'
import {
  COMPOSE_TOOLBAR_SEPARATOR,
  addToolbarShelfItem,
  insertToolbarSeparator,
  moveToolbarShelfItem,
  removeToolbarShelfItem,
  DRAWING_TOOLBAR_SHELF,
  PAGE_TOOLBAR_SHELF,
  normalizeToolbarShelf,
  splitToolbarShelf,
} from './toolbar-shelf'
import { COMPOSE_EDITOR_SHORTCUT_ACTIONS } from '../editor-preferences'

const known = (ids: readonly string[]) => (id: string) => ids.includes(id)

describe('OpenSpec: editor-workspace-layout / 工具栏货架', () => {
  it('不在目录里的 id 跳过而不报错', () => {
    const sections = splitToolbarShelf(['select', 'MIRROR', 'grid'], known(['select', 'grid']))
    expect(sections).toEqual([['select', 'grid']])
  })

  it('分隔线切段，空段不留下一条没有内容的竖线', () => {
    // 首尾各一条、中间连着两条，以及一整段的 id 全都不在目录里：四种空段都不该产出。
    const shelf = [
      COMPOSE_TOOLBAR_SEPARATOR,
      'select',
      COMPOSE_TOOLBAR_SEPARATOR,
      COMPOSE_TOOLBAR_SEPARATOR,
      'MIRROR',
      COMPOSE_TOOLBAR_SEPARATOR,
      'grid',
      COMPOSE_TOOLBAR_SEPARATOR,
    ]
    expect(splitToolbarShelf(shelf, known(['select', 'grid']))).toEqual([['select'], ['grid']])
  })

  it('「选择」在读取时被钉回第一位', () => {
    // 归一化放在读取侧：写入侧漏一处的症状是「工具栏上没有选择工具了」，用户在画布上会卡住。
    expect(normalizeToolbarShelf(['grid', 'select', 'LINE'])).toEqual(['select', 'grid', 'LINE'])
    expect(normalizeToolbarShelf(['grid', 'LINE'])).toEqual(['select', 'grid', 'LINE'])
  })
})

describe('OpenSpec: editor-workspace-layout / 平铺式默认画布工具栏', () => {
  it('两个内建的默认货架不同，且各自装得下自己的活儿', () => {
    for (const id of ['LINE', 'PLINE', 'POLYGON', 'CIRCLE', 'ARC', 'WIRE', 'ortho', 'polar']) {
      expect(PAGE_TOOLBAR_SHELF).not.toContain(id)
      expect(DRAWING_TOOLBAR_SHELF).toContain(id)
    }
    // 页面画的是分区框与指示。
    expect(PAGE_TOOLBAR_SHELF).toContain('RECTANGLE')
    expect(PAGE_TOOLBAR_SHELF).toContain('ARROW')
    // 接线图里的盒是矩形曲线，容器不在栏上；文字要标端子号，留着。
    expect(PAGE_TOOLBAR_SHELF).toContain('draw-container')
    expect(DRAWING_TOOLBAR_SHELF).not.toContain('draw-container')
    expect(DRAWING_TOOLBAR_SHELF).toContain('draw-text')
  })

  it('绘图命令排在容器 / 文字之前', () => {
    /*
     * 溢出是从**尾部**收进「更多」的，而绘图命令是绘图工作区存在的全部理由。这条顺序是那条
     * 机制的直接后果，不是审美——两边共用一条顺序时它们排在最后，窗口稍窄就被收走。
     */
    const commands = DRAWING_TOOLBAR_SHELF.indexOf('LINE')
    const text = DRAWING_TOOLBAR_SHELF.indexOf('draw-text')
    expect(commands).toBeGreaterThan(-1)
    expect(commands).toBeLessThan(text)
  })

  it('「选择」在两条内建货架上都固定在第一位', () => {
    expect(PAGE_TOOLBAR_SHELF[0]).toBe('select')
    expect(DRAWING_TOOLBAR_SHELF[0]).toBe('select')
  })
})

describe('OpenSpec: editor-workspace-layout / 工具栏货架 / 目录准入', () => {
  /**
   * 每一格的第二条入口，逐项**声明**。
   *
   * @remarks
   * 刻意不写成一张「这些都算通过」的白名单——那种写法在加进新一格时永远绿，而这条规则要防的
   * 正是「有人加了一格只有按钮的功能」。逐项声明会让加格的人被迫回答「它还能从哪儿到达」，
   * 而下面的断言把这个回答真的验一遍。
   *
   * 三种入口对应三处事实来源：
   * - `command`——绘图命令，能在命令行敲、能按单键。它们**不在动作目录里**（那会为已经能敲
   *   `CIRCLE` 的东西造第二个词）。
   * - `action`——编辑器动作，命令面板搜得到，也可以绑键。
   * - `stageKey`——Stage 自己硬接的功能键，不经编辑器的键位表。
   */
  const SECOND_ENTRANCE: Readonly<Record<string, { readonly kind: 'command' } | { readonly kind: 'action'; readonly id: string } | { readonly kind: 'stageKey'; readonly key: string }>> = {
    select: { kind: 'action', id: 'stage.selectTool' },
    'transform-gizmo': { kind: 'action', id: 'stage.toggleTransformGizmo' },
    snap: { kind: 'action', id: 'stage.toggleGridSnap' },
    // 画布设置是网格 ▾ 菜单里唯一的入口，因此这一条是为本规则补的动作。
    grid: { kind: 'action', id: 'stage.canvasSettings' },
    ortho: { kind: 'stageKey', key: 'F8' },
    polar: { kind: 'stageKey', key: 'F10' },
    'draw-container': { kind: 'action', id: 'stage.drawContainerTool' },
    'draw-text': { kind: 'action', id: 'stage.drawTextTool' },
    LINE: { kind: 'command' },
    PLINE: { kind: 'command' },
    RECTANGLE: { kind: 'command' },
    POLYGON: { kind: 'command' },
    CIRCLE: { kind: 'command' },
    ARC: { kind: 'command' },
    ARROW: { kind: 'command' },
    WIRE: { kind: 'command' },
  }

  it('两条内建货架上的每一格都声明了第二条入口，且那条入口真的在', () => {
    const actionIds = new Set<string>(COMPOSE_EDITOR_SHORTCUT_ACTIONS)
    const ids = [...PAGE_TOOLBAR_SHELF, ...DRAWING_TOOLBAR_SHELF]
      .filter((id) => id !== COMPOSE_TOOLBAR_SEPARATOR)
    for (const id of ids) {
      const entrance = SECOND_ENTRANCE[id]
      expect(entrance, `${id} 没有声明第二条入口`).toBeDefined()
      if (entrance?.kind === 'action') {
        // 声明了就得真的在动作目录里：写错 id 的症状是这条规则形同虚设。
        expect(actionIds.has(entrance.id), `${entrance.id} 不在动作目录里`).toBe(true)
      }
    }
  })
})

describe('OpenSpec: editor-workspace-layout / 自定义工具栏 / 货架编辑', () => {
  const shelf = ['select', 'grid', 'LINE']

  it('上移下移，且谁都不能挪到「选择」之前', () => {
    expect(moveToolbarShelfItem(shelf, 2, -1)).toEqual(['select', 'LINE', 'grid'])
    expect(moveToolbarShelfItem(shelf, 1, 1)).toEqual(['select', 'LINE', 'grid'])
    // 挪到头之后静默不动：键盘用户会连按，而连按到头抛错比不动差。
    expect(moveToolbarShelfItem(shelf, 1, -1)).toBe(shelf)
    expect(moveToolbarShelfItem(shelf, 2, 1)).toBe(shelf)
  })

  it('「选择」拿不掉', () => {
    expect(removeToolbarShelfItem(shelf, 0)).toBe(shelf)
    expect(removeToolbarShelfItem(shelf, 1)).toEqual(['select', 'LINE'])
  })

  it('分隔线可以插多条，且插不到「选择」之前', () => {
    expect(insertToolbarSeparator(shelf, 1)).toEqual(['select', COMPOSE_TOOLBAR_SEPARATOR, 'grid', 'LINE'])
    expect(insertToolbarSeparator(shelf, 0)).toEqual(['select', COMPOSE_TOOLBAR_SEPARATOR, 'grid', 'LINE'])
    // 想留一段空隙是正当用法；空段在渲染时本来就会被丢掉，因此这里不去重。
    const twice = insertToolbarSeparator(insertToolbarSeparator(shelf, 1), 1)
    expect(twice.filter((id) => id === COMPOSE_TOOLBAR_SEPARATOR)).toHaveLength(2)
  })

  it('加格去重，分隔线除外', () => {
    expect(addToolbarShelfItem(shelf, 'grid')).toBe(shelf)
    expect(addToolbarShelfItem(shelf, 'ARC')).toEqual(['select', 'grid', 'LINE', 'ARC'])
    expect(addToolbarShelfItem(shelf, COMPOSE_TOOLBAR_SEPARATOR)).toHaveLength(4)
  })
})
