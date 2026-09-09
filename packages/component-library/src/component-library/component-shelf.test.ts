import { describe, expect, it } from 'vitest'
import { resolveComponentShelf } from './component-shelf'
import type { ComposeComponentShelf } from './component-shelf'
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
  search: true,
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
