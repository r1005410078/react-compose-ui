import { describe, expect, it } from 'vitest'
import {
  addComponentShelfSection,
  keepOnlyComponentShelfSection,
  insertComponentShelfSectionAt,
  moveComponentShelfSection,
  reorderComponentShelfSection,
  removeComponentShelfSection,
  resolveComponentShelf,
  setComponentShelfPresetVisible,
  updateComponentShelfSection,
} from './component-shelf'
import type { ComposeComponentShelf, ComposeComponentShelfFolderSection } from './component-shelf'
import type { ComposeComponentCatalog, ComposeComponentDescriptor } from '../component-store'

const labels = { basics: '基础组件', components: '项目组件' }

function descriptor(displayName: string, folderPath: readonly string[]): ComposeComponentDescriptor {
  return {
    entryId: displayName,
    assetKey: displayName,
    displayName,
    componentId: displayName,
    kind: 'base',
    revision: '1',
    reference: { kind: 'component', providerId: 'project', assetKey: displayName, scope: 'persistent' },
    folderPath,
  }
}

const catalog: ComposeComponentCatalog = {
  components: [
    descriptor('断路器', ['Symbols', 'Switchgear']),
    descriptor('刀闸', ['Symbols', 'Switchgear']),
    descriptor('电缆终端头', ['Symbols', 'Conductors']),
    descriptor('说明', ['Symbols']),
    descriptor('页头', []),
  ],
  issues: [],
  // 「Signs」是空文件夹：它没有组件，但仍要占一组。
  folders: [['Symbols'], ['Symbols', 'Switchgear'], ['Symbols', 'Conductors'], ['Symbols', 'Signs']],
}

const presets = [
  { id: 'container', label: '容器' },
  { id: 'text', label: '文字' },
  { id: 'rect', label: '矩形', paletteHidden: true },
]

const symbols: ComposeComponentShelf = {
  title: '符号库',
  sections: [
    { kind: 'folder', id: 'symbols', folderPath: ['Symbols'], groupBy: 'subfolder' },
    { kind: 'folder', id: 'components', folderPath: [] },
    { kind: 'presets', id: 'basics', collapsed: true },
  ],
}

function resolve(shelf: ComposeComponentShelf, query = '', current: ComposeComponentCatalog | null = catalog) {
  return resolveComponentShelf({ shelf, presets, catalog: current, query, labels })
}

describe('resolveComponentShelf', () => {
  it('OpenSpec: component-library / 混合组件目录 / 按子文件夹分组', () => {
    const [section] = resolve(symbols)
    // 组的清单来自文件夹：空的 Signs 同样占一组，直接躺在 Symbols 下的排在最前面且没有小标题。
    expect(section?.groups.map((group) => [group.title, group.tiles.length])).toEqual([
      [null, 1],
      ['Conductors', 1],
      ['Signs', 0],
      ['Switchgear', 2],
    ])
    expect(section?.count).toBe(4)
  })

  it('OpenSpec: component-library / 混合组件目录 / 段标题缺省按来源取', () => {
    const sections = resolve(symbols)
    expect(sections.map((section) => section.title)).toEqual(['Symbols', '项目组件', '基础组件'])
    expect(sections[2]?.collapsed).toBe(true)
  })

  it('OpenSpec: component-library / 混合组件目录 / 搜索跨段', () => {
    const sections = resolve(symbols, '终端')
    expect(sections.map((section) => section.count)).toEqual([1, 1, 0])
    // 段标题保留，命中项所在的组也保留；一个都没命中的子文件夹在搜索期间收起来。
    expect(sections[0]?.groups.map((group) => group.title)).toEqual(['Conductors'])
    expect(sections.map((section) => section.title)).toHaveLength(3)
  })

  it('OpenSpec: component-library / 混合组件目录 / 文件夹不存在', () => {
    const shelf: ComposeComponentShelf = {
      sections: [
        { kind: 'folder', id: 'gone', folderPath: ['Symbols', 'Substation'] },
        { kind: 'presets', id: 'basics' },
      ],
    }
    const sections = resolve(shelf)
    expect(sections[0]?.missing).toBe(true)
    expect(sections[0]?.groups).toEqual([])
    // 其余段照常。
    expect(sections[1]?.count).toBe(2)
  })

  it('OpenSpec: component-library / 混合组件目录 / 目录还没读回来时不说找不到', () => {
    const shelf: ComposeComponentShelf = {
      sections: [{ kind: 'folder', id: 'symbols', folderPath: ['Symbols'], groupBy: 'subfolder' }],
    }
    expect(resolve(shelf, '', null)[0]?.missing).toBe(false)
  })

  it('OpenSpec: component-library / 混合组件目录 / paletteHidden 的 Preset 勾不出来', () => {
    const shelf: ComposeComponentShelf = {
      sections: [{ kind: 'presets', id: 'basics', include: ['container', 'rect'] }],
    }
    const [section] = resolve(shelf)
    expect(section?.groups[0]?.tiles.map((tile) => (tile.kind === 'preset' ? tile.presetId : null)))
      .toEqual(['container'])
  })
})

describe('OpenSpec: component-library / 自定义物料面板 / 货架编辑', () => {
  const ids = (shelf: ComposeComponentShelf) => shelf.sections.map((section) => section.id)
  const available = ['container', 'text']

  it('挪段：按 id 寻址，越界原样返回', () => {
    expect(ids(moveComponentShelfSection(symbols, 'components', -1)))
      .toEqual(['components', 'symbols', 'basics'])
    // 连按到头之后静默不动——编辑面上那颗按钮此时已经禁用，这里是键盘用户的第二道。
    expect(moveComponentShelfSection(symbols, 'symbols', -1)).toBe(symbols)
    expect(moveComponentShelfSection(symbols, 'basics', 1)).toBe(symbols)
    expect(moveComponentShelfSection(symbols, '不存在', 1)).toBe(symbols)
  })

  it('去掉一段；整份货架可以空', () => {
    expect(ids(removeComponentShelfSection(symbols, 'components'))).toEqual(['symbols', 'basics'])
    const emptied = symbols.sections.reduce(
      (shelf, section) => removeComponentShelfSection(shelf, section.id),
      symbols,
    )
    expect(emptied.sections).toEqual([])
    expect(removeComponentShelfSection(symbols, '不存在')).toBe(symbols)
  })

  it('只看这一组：收成只剩那一段，标题照旧', () => {
    const only = keepOnlyComponentShelfSection(symbols, 'components')
    expect(ids(only)).toEqual(['components'])
    expect(only.title).toBe('符号库')
  })

  it('加一段：重复 id 原样返回', () => {
    const added = addComponentShelfSection(symbols, {
      kind: 'folder',
      id: 'signs',
      folderPath: ['Symbols', 'Signs'],
    })
    expect(ids(added)).toEqual(['symbols', 'components', 'basics', 'signs'])
    expect(addComponentShelfSection(symbols, { kind: 'presets', id: 'basics' })).toBe(symbols)
  })

  it('改段选项：文件夹的分组方式与折叠', () => {
    const flat = updateComponentShelfSection<ComposeComponentShelfFolderSection>(
      symbols,
      'symbols',
      { groupBy: 'flat', collapsed: true },
    )
    expect(flat.sections[0]).toMatchObject({ groupBy: 'flat', collapsed: true, id: 'symbols' })
    // 改完仍然解析得动，而且真的按平铺出一组。
    expect(resolve(flat)[0]!.groups).toHaveLength(1)
  })

  it('藏一个基础 Preset：include 缺省时先把其余的写出来', () => {
    const hidden = setComponentShelfPresetVisible({
      shelf: symbols,
      sectionId: 'basics',
      presetId: 'container',
      visible: false,
      available,
    })
    expect(hidden.sections[2]).toMatchObject({ include: ['text'] })
    const tiles = resolve(hidden)[2]!.groups.flatMap((group) => group.tiles)
    expect(tiles.map((tile) => (tile.kind === 'preset' ? tile.presetId : ''))).toEqual(['text'])
  })

  it('显回来时回到 available 里的位置，不是末尾', () => {
    const hidden = setComponentShelfPresetVisible({
      shelf: symbols, sectionId: 'basics', presetId: 'container', visible: false, available,
    })
    const shown = setComponentShelfPresetVisible({
      shelf: hidden, sectionId: 'basics', presetId: 'container', visible: true, available,
    })
    // 藏了再显不该把它挪到最后——那个位移用户没有要求过，撤销也回不来。
    expect(shown.sections[2]).toMatchObject({ include: ['container', 'text'] })
  })

  it('paletteHidden 的 Preset 勾不动：那不是货架的决定', () => {
    // 「矩形」不在 available 里（判据把它挡下了），因此写货架是 no-op 而不是写出一条假清单。
    expect(setComponentShelfPresetVisible({
      shelf: symbols, sectionId: 'basics', presetId: 'rect', visible: true, available,
    })).toBe(symbols)
  })

  it('文件夹段上勾 Preset 是 no-op：文件夹来源不能按单项挑', () => {
    expect(setComponentShelfPresetVisible({
      shelf: symbols, sectionId: 'symbols', presetId: 'container', visible: false, available,
    })).toBe(symbols)
  })
})

describe('OpenSpec: editor-workspace-layout / 货架编排的拖拽与键盘 / 按下标重排段', () => {
  const ids = (shelf: ComposeComponentShelf) => shelf.sections.map((section) => section.id)

  it('按最终下标挪，前后两个方向都对', () => {
    expect(ids(reorderComponentShelfSection(symbols, 'basics', 0)))
      .toEqual(['basics', 'symbols', 'components'])
    expect(ids(reorderComponentShelfSection(symbols, 'symbols', 2)))
      .toEqual(['components', 'basics', 'symbols'])
  })

  it('落回原位、越界与找不到都原样返回', () => {
    expect(reorderComponentShelfSection(symbols, 'symbols', 0)).toBe(symbols)
    expect(reorderComponentShelfSection(symbols, '不存在', 1)).toBe(symbols)
    // 钳到末尾而不是拒绝：拖到最下面是一次正当手势。
    expect(ids(reorderComponentShelfSection(symbols, 'symbols', 9)))
      .toEqual(['components', 'basics', 'symbols'])
  })

  it('按下标插入；同 id 的段已经在货架上时原样返回', () => {
    const next = insertComponentShelfSectionAt(
      symbols,
      { kind: 'folder', id: 'relays', folderPath: ['Symbols', '继电器'] },
      1,
    )
    expect(ids(next)).toEqual(['symbols', 'relays', 'components', 'basics'])
    expect(insertComponentShelfSectionAt(symbols, { kind: 'presets', id: 'basics' }, 0))
      .toBe(symbols)
  })
})
