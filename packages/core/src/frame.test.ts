import { describe, expect, it } from 'vitest'
import {
  COMPOSE_DEFAULT_SCENE_APPEARANCE,
  COMPOSE_SCENE_SIZE_PRESETS,
  createComposeFrame,
  findComposeSceneSizePreset,
  formatComposeSceneSize,
  formatComposeSceneSizePresetLabel,
  createComposeFrameEntity,
  getComposeFrame,
  getComposeFrameGuides,
  isComposeFrameEntity,
  isWithinFrame,
  listComposeFrameIds,
  promoteComposeEntityToFrame,
  resolveOwningFrameId,
} from './frame'
import { validateComposeDocument } from './document'
import type { ComposeEntity } from './document-types'
import { ROOT_FRAME_ID, containerEntity, documentFixture, frameEntity, rendererEntity } from './test-fixtures'

/** 根 Frame → Container → 嵌套 Frame → 叶子的四层文档。 */
function nestedDocument() {
  const document = documentFixture(
    {
      outer: containerEntity('outer', ['inner-frame']),
      'inner-frame': frameEntity('inner-frame', ['leaf'], { width: 200, height: 120 }),
      leaf: rendererEntity('leaf'),
    },
    ['outer'],
  )
  expect(validateComposeDocument(document).valid).toBe(true)
  return document
}

describe('Frame Component 与隔离边界', () => {
  it('createComposeFrame 每次返回可独立修改的新对象', () => {
    const first = createComposeFrame()
    const second = createComposeFrame()
    expect(first).toEqual(second)
    expect(first.size).not.toBe(second.size)
    expect(first.guides).toEqual([])
  })

  it('isComposeFrameEntity 只认 Frame Component', () => {
    const document = nestedDocument()
    expect(isComposeFrameEntity(document.entities[ROOT_FRAME_ID])).toBe(true)
    expect(isComposeFrameEntity(document.entities.outer)).toBe(false)
    expect(isComposeFrameEntity(undefined)).toBe(false)
  })

  it('resolveOwningFrameId 返回最近祖先 Frame 而不是文档根', () => {
    const document = nestedDocument()
    expect(resolveOwningFrameId(document, 'leaf')).toBe('inner-frame')
    expect(resolveOwningFrameId(document, 'outer')).toBe(ROOT_FRAME_ID)
    // Frame 自身的动画清单挂在它自己身上，因此它属于自己。
    expect(resolveOwningFrameId(document, 'inner-frame')).toBe('inner-frame')
    expect(resolveOwningFrameId(document, 'missing')).toBeNull()
  })

  it('isWithinFrame 以最近 Frame 判定跨边界', () => {
    const document = nestedDocument()
    expect(isWithinFrame(document, 'leaf', 'inner-frame')).toBe(true)
    // leaf 在嵌套 Frame 内，因此不属于外层 Frame 的动画时间轴。
    expect(isWithinFrame(document, 'leaf', ROOT_FRAME_ID)).toBe(false)
  })

  it('listComposeFrameIds 列出全部 Frame', () => {
    expect([...listComposeFrameIds(nestedDocument())].sort()).toEqual(['frame-root', 'inner-frame'])
  })

  it('getComposeFrameGuides 归一化缺省 guides', () => {
    const document = nestedDocument()
    expect(getComposeFrameGuides(document.entities[ROOT_FRAME_ID])).toEqual([])
    expect(getComposeFrameGuides(document.entities.leaf)).toEqual([])
  })
})

describe('OpenSpec: compose-document / Frame 升格纯函数入口', () => {
  /** 一个改过底色、关掉裁剪、带自定义 Composition 的普通容器。 */
  function customContainer(): ComposeEntity {
    const entity = containerEntity('custom', ['leaf'])
    return {
      ...entity,
      name: '侧边栏',
      components: {
        ...entity.components,
        Appearance: { backgroundPaint: { kind: 'solid', color: '#204020' }, borderRadius: 12 },
        Clip: { enabled: false, horizontal: 'visible', vertical: 'visible' },
      },
    }
  }

  it('升格保留 id、名称、子级与既有外观', () => {
    const source = customContainer()
    const promoted = promoteComposeEntityToFrame(source, { width: 400, height: 300 })
    expect(promoted.id).toBe('custom')
    expect(promoted.name).toBe('侧边栏')
    expect(promoted.components.Hierarchy).toEqual(source.components.Hierarchy)
    expect(promoted.components.Appearance).toEqual(source.components.Appearance)
    expect(promoted.components.Clip).toEqual(source.components.Clip)
    expect(getComposeFrame(promoted)?.size).toEqual({ width: 400, height: 300 })
    // 入参不被修改。
    expect(isComposeFrameEntity(source)).toBe(false)
  })

  it('升格把 Frame 写进 baseComponentKeys，使它此后不可被移除', () => {
    const promoted = promoteComposeEntityToFrame(customContainer(), { width: 400, height: 300 })
    const composition = promoted.components.Composition as { baseComponentKeys: readonly string[] }
    expect(composition.baseComponentKeys).toContain('Frame')
  })

  it('对叶 Entity 升格补齐 Hierarchy 并一并保护', () => {
    const leaf = rendererEntity('leaf-root')
    const promoted = promoteComposeEntityToFrame(leaf, { width: 100, height: 100 })
    expect(promoted.components.Hierarchy).toEqual({ childIds: [] })
    const composition = promoted.components.Composition as { baseComponentKeys: readonly string[] }
    expect(composition.baseComponentKeys).toContain('Hierarchy')
    expect(composition.baseComponentKeys).toContain('Frame')
  })

  it('对已是 Frame 的 Entity 升格只改尺寸且保留辅助线', () => {
    const frame = createComposeFrameEntity({ id: 'scene', size: { width: 800, height: 600 } })
    const withGuide = {
      ...frame,
      components: {
        ...frame.components,
        Frame: { size: { width: 800, height: 600 }, guides: [{ id: 'g1', axis: 'x', position: 40 }] },
      },
    }
    const promoted = promoteComposeEntityToFrame(withGuide, { width: 900, height: 600 })
    expect(getComposeFrame(promoted)?.size).toEqual({ width: 900, height: 600 })
    expect(getComposeFrameGuides(promoted)).toEqual([{ id: 'g1', axis: 'x', position: 40 }])
    const composition = promoted.components.Composition as { baseComponentKeys: readonly string[] }
    // 幂等：不重复追加。
    expect(composition.baseComponentKeys.filter((key) => key === 'Frame')).toHaveLength(1)
  })

  it('升格后的文档通过校验', () => {
    const promoted = promoteComposeEntityToFrame(customContainer(), { width: 400, height: 300 })
    const document = documentFixture({ custom: promoted, leaf: rendererEntity('leaf') }, ['custom'])
    expect(validateComposeDocument(document).valid).toBe(true)
  })
})

describe('OpenSpec: compose-document / 场景默认外观', () => {
  it('默认构造的 Frame Entity 采用场景默认外观', () => {
    const entity = createComposeFrameEntity({ id: 'scene' })
    expect(entity.components.Appearance).toEqual(COMPOSE_DEFAULT_SCENE_APPEARANCE)
  })

  it('场景默认不带边框', () => {
    // 布局求解把边框计入内容盒，而场景是绝对坐标的原点：1px 边框会让按网格吸附的子级
    // 在属性面板里读成 7、15、23。默认值不该埋进这个偏差。
    expect(COMPOSE_DEFAULT_SCENE_APPEARANCE).toMatchObject({
      borderWidth: 0,
      borderColor: 'transparent',
    })
  })

  it('appearance 选项覆盖整份外观', () => {
    const entity = createComposeFrameEntity({
      id: 'probe',
      appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
    })
    expect(entity.components.Appearance).toEqual({
      backgroundPaint: { kind: 'solid', color: 'transparent' },
    })
  })

  it('backgroundPaint 只覆盖背景，其余场景默认值保留', () => {
    const entity = createComposeFrameEntity({
      id: 'scene',
      backgroundPaint: { kind: 'solid', color: '#101010' },
    })
    expect(entity.components.Appearance).toEqual({
      ...COMPOSE_DEFAULT_SCENE_APPEARANCE,
      backgroundPaint: { kind: 'solid', color: '#101010' },
    })
  })
})

describe('场景常见尺寸预设', () => {
  it('列出六个桌面分辨率且 id 唯一', () => {
    expect(COMPOSE_SCENE_SIZE_PRESETS.map((preset) => preset.size)).toEqual([
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
      { width: 3840, height: 2160 },
    ])
    expect(new Set(COMPOSE_SCENE_SIZE_PRESETS.map((preset) => preset.id)).size)
      .toBe(COMPOSE_SCENE_SIZE_PRESETS.length)
  })

  it('按尺寸反查命中预设', () => {
    expect(findComposeSceneSizePreset({ width: 1920, height: 1080 })?.name).toBe('Full HD')
  })

  it('自定义尺寸没有匹配预设', () => {
    expect(findComposeSceneSizePreset({ width: 1000, height: 800 })).toBeNull()
    // 宽命中而高不命中不算匹配：预设是一整个分辨率，不是两个独立轴。
    expect(findComposeSceneSizePreset({ width: 1920, height: 1000 })).toBeNull()
  })

  it('格式化尺寸与预设文案', () => {
    expect(formatComposeSceneSize({ width: 1920, height: 1080 })).toBe('1920 × 1080')
    expect(formatComposeSceneSizePresetLabel(COMPOSE_SCENE_SIZE_PRESETS[3]!))
      .toBe('1920 × 1080 (Full HD)')
    // 没有通名的分辨率不留下空括号。
    expect(formatComposeSceneSizePresetLabel(COMPOSE_SCENE_SIZE_PRESETS[1]!))
      .toBe('1366 × 768')
  })

  it('尺寸不匹配预设不影响文档校验', () => {
    const document = documentFixture({
      scene: frameEntity('scene', [], { width: 1000, height: 800 }),
    })
    expect(findComposeSceneSizePreset({ width: 1000, height: 800 })).toBeNull()
    expect(validateComposeDocument(document).valid).toBe(true)
  })
})
