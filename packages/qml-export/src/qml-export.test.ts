import {
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeResolvedLayoutBox,
  type JsonObject,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { ComposeQmlExportError, exportComposeSceneToQml } from './qml-export'
import type { ComposeQmlInstanceContent } from './qml-export-types'

const FRAME_ID = 'scene'

function entity(
  id: string,
  components: Readonly<Record<string, JsonObject>>,
  presetId = 'container',
): ComposeEntity {
  const base: Record<string, JsonObject> = {
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 10, min: 1, max: null },
      height: { mode: 'fixed', value: 10, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Appearance: { backgroundPaint: { kind: 'solid', color: 'transparent' } },
    ...components,
  }
  return {
    id,
    name: id,
    components: {
      Composition: { presetId, baseComponentKeys: Object.keys(base), capabilityIds: [] },
      ...base,
    },
  }
}

function box(x: number, y: number, width: number, height: number): ComposeResolvedLayoutBox {
  return { x, y, width, height, positioning: 'absolute' }
}

/**
 * 一份只有一个场景的文档与成对的快照。
 *
 * @remarks
 * 导出器只读快照里的盒，不求解布局，因此单元测试直接写盒；盒与 `LayoutItem` 故意不一致的
 * 用例正是在断言「读的是快照」。
 */
function scene(
  children: readonly ComposeEntity[],
  boxes: Readonly<Record<string, ComposeResolvedLayoutBox>>,
  topLevel: readonly string[] = children.map((child) => child.id),
  frameBox: ComposeResolvedLayoutBox = box(500, 300, 320, 200),
): { readonly document: ComposeDocument; readonly snapshot: ComposeLayoutSnapshot } {
  const frame = createComposeFrameEntity({ id: FRAME_ID, childIds: topLevel, size: { width: 320, height: 200 } })
  return {
    document: {
      schemaVersion: 7,
      canvas: createDefaultCanvasSettings(),
      rootIds: [FRAME_ID],
      entities: Object.fromEntries([frame, ...children].map((item) => [item.id, item])),
    },
    snapshot: { revision: 1, diagnostics: [], boxes: { [FRAME_ID]: frameBox, ...boxes } },
  }
}

function exportScene(input: ReturnType<typeof scene>) {
  return exportComposeSceneToQml({ ...input, frameId: FRAME_ID })
}

/** 取出某个对象声明块（从类型行到与它同缩进的闭合括号）。 */
function block(qml: string, marker: string): string {
  const lines = qml.split('\n')
  const index = lines.findIndex((line) => line.includes(marker))
  expect(index, `找不到 ${marker}`).toBeGreaterThanOrEqual(0)
  let start = index
  while (start > 0 && !lines[start]!.trimEnd().endsWith('{')) start -= 1
  const indent = lines[start]!.length - lines[start]!.trimStart().length
  let end = start + 1
  while (end < lines.length && !(lines[end]!.trim() === '}' && lines[end]!.length - lines[end]!.trimStart().length === indent)) end += 1
  return lines.slice(start, end + 1).join('\n')
}

const curveProps = (props: JsonObject = {}): JsonObject => ({
  stroke: '#f97316',
  strokeWidth: 2,
  strokeLinecap: 'butt',
  strokeDasharray: 'none',
  markerStart: 'none',
  markerEnd: 'none',
  ...props,
})

describe('OpenSpec: qml-export / 以求解结果为输入的绝对定位导出', () => {
  it('Auto Layout 容器：子项按快照坐标绝对定位，不出现 Qt 布局类型', () => {
    const row = entity('row', {
      Hierarchy: { childIds: ['a', 'b', 'c'] },
      Layout: {
        type: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignContent: 'flex-start',
        justifyContent: 'flex-start', alignItems: 'stretch',
        padding: { top: 8, right: 8, bottom: 8, left: 8 }, rowGap: 0, columnGap: 12,
      },
    })
    const children = ['a', 'b', 'c'].map((id) => entity(id, {
      Appearance: { backgroundPaint: { kind: 'solid', color: '#ef4444' } },
    }))
    const { qml } = exportScene(scene([row, ...children], {
      row: box(16, 16, 288, 80),
      a: box(8, 8, 60, 64),
      b: box(80, 8, 80, 64),
      c: box(172, 8, 100, 64),
    }, ['row']))
    expect(block(qml, 'objectName: "b"')).toContain('x: 80')
    expect(block(qml, 'objectName: "c"')).toContain('x: 172')
    expect(qml).not.toMatch(/RowLayout|ColumnLayout|GridLayout/)
  })

  it('导线端点：读的是已解算文档里的几何，而不是 LayoutItem', () => {
    const wire = entity('wire', {
      Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 40 } },
      Renderer: { type: 'curve', props: curveProps() },
    }, 'wire')
    const { qml } = exportScene(scene([wire], { wire: box(10, 20, 100, 40) }))
    const path = block(qml, 'PathLine')
    expect(path).toContain('x: 100')
    expect(path).toContain('y: 40')
    expect(block(qml, 'objectName: "wire"')).toContain('x: 10')
  })

  it('根场景不写它在工作区上的位置', () => {
    const { qml } = exportScene(scene([], {}, [], box(500, 300, 320, 200)))
    const root = block(qml, 'objectName: "scene"')
    expect(root).not.toMatch(/^\s{4}x: /m)
    expect(root).toContain('width: 320')
  })
})

describe('OpenSpec: qml-export / 场景、容器与 Group 映射', () => {
  it('带圆角描边的容器：底色与圆角在本体上，边框是压在子级之上的覆盖层', () => {
    const panel = entity('panel', {
      Hierarchy: { childIds: ['inner'] },
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#1e293b' },
        borderColor: '#334155',
        borderWidth: 1,
        borderRadius: 8,
      },
    })
    const inner = entity('inner', { Appearance: { backgroundPaint: { kind: 'solid', color: '#ef4444' } } })
    const { qml } = exportScene(scene([panel, inner], {
      panel: box(10, 10, 200, 100),
      inner: box(0, 0, 50, 50),
    }, ['panel']))
    const body = block(qml, 'objectName: "panel"')
    expect(body).toMatch(/^\s+color: "#1e293b"$/m)
    expect(body).toMatch(/^\s+radius: 8$/m)
    // 覆盖层排在子级之后：Qt 里后声明的在上。
    expect(body.indexOf('objectName: "inner"')).toBeLessThan(body.indexOf('border.color: "#334155"'))
    expect(body).toContain('border.width: 1')
  })

  it('未声明 Clip 的场景不裁剪', () => {
    const { qml } = exportScene(scene([], {}, []))
    expect(block(qml, 'objectName: "scene"')).not.toContain('clip: true')
  })

  it('带 Clip 的容器裁剪；滚动降级为裁剪并给出诊断', () => {
    const scroller = entity('scroller', {
      Hierarchy: { childIds: [] },
      Clip: { enabled: true, horizontal: 'scroll', vertical: 'scroll' },
    })
    const { qml, diagnostics } = exportScene(scene([scroller], { scroller: box(0, 0, 100, 100) }))
    expect(block(qml, 'objectName: "scroller"')).toContain('clip: true')
    expect(diagnostics.map((item) => item.code)).toContain('overflow.scroll-unsupported')
  })

  it('#rrggbbaa 换算成 QML 的 #aarrggbb', () => {
    const tinted = entity('tinted', { Appearance: { backgroundPaint: { kind: 'solid', color: '#11223380' } } })
    const { qml } = exportScene(scene([tinted], { tinted: box(0, 0, 10, 10) }))
    expect(block(qml, 'objectName: "tinted"')).toContain('color: "#80112233"')
  })

  it('隐藏的对象不导出', () => {
    const hidden = entity('hidden', { Visibility: { visible: false } })
    const { qml } = exportScene(scene([hidden], { hidden: box(0, 0, 10, 10) }))
    expect(qml).not.toContain('"hidden"')
  })
})

describe('OpenSpec: qml-export / 曲线映射', () => {
  function curveScene(curve: JsonObject, size: { width: number; height: number }, props: JsonObject = {}, fill?: string) {
    const shape = entity('shape', {
      Curve: curve,
      Renderer: { type: 'curve', props: curveProps(props) },
      ...(fill ? { Appearance: { backgroundPaint: { kind: 'solid', color: fill } } } : {}),
    }, 'curve')
    return exportScene(scene([shape], { shape: box(0, 0, size.width, size.height) }))
  }

  it('非等比盒中的弧：两个半径各自缩放，与预览的 viewBox 拉伸一致', () => {
    // 几何 100×50（半圆），盒 160×50：横向 1.6 倍，纵向不变。
    const { qml } = curveScene({ kind: 'arc', center: { x: 50, y: 50 }, radius: 50, startAngle: 180, sweep: 180 }, { width: 160, height: 50 })
    const arc = block(qml, 'PathArc')
    expect(arc).toContain('radiusX: 80')
    expect(arc).toContain('radiusY: 50')
    expect(arc).toContain('x: 160')
  })

  it('虚线换算成以线宽为单位的 dashPattern', () => {
    const { qml } = curveScene({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 30 } }, { width: 100, height: 30 }, { strokeDasharray: '8 4' })
    expect(qml).toContain('strokeStyle: ShapePath.DashLine')
    expect(qml).toContain('dashPattern: [4, 2]')
  })

  it('点线配圆头，dashPattern 为零长度 dash', () => {
    const { qml } = curveScene({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 30 } }, { width: 100, height: 30 }, { strokeDasharray: '1 4', strokeLinecap: 'butt' })
    expect(qml).toContain('dashPattern: [0, 2]')
    expect(qml).toContain('capStyle: ShapePath.RoundCap')
  })

  it('带洞路径：两条子路径在同一个 ShapePath 里，使用奇偶填充', () => {
    const square = (x: number, y: number, s: number) => ({
      start: { x, y },
      closed: true,
      segments: [[x + s, y], [x + s, y + s], [x, y + s], [x, y]].map(([tx, ty]) => ({
        c1: { x: tx!, y: ty! }, c2: { x: tx!, y: ty! }, to: { x: tx!, y: ty! },
      })),
    })
    const { qml } = curveScene({ kind: 'path', fillRule: 'evenodd', subpaths: [square(0, 0, 100), square(30, 30, 40)] }, { width: 100, height: 100 }, {}, '#f43f5e')
    expect(qml.match(/ShapePath \{/g)).toHaveLength(1)
    expect(qml).toContain('PathMove')
    expect(qml).toContain('fillRule: ShapePath.OddEvenFill')
    expect(qml).toContain('fillColor: "#f43f5e"')
  })

  it('缺省填充规则写成非零：Qt 的缺省是奇偶，SVG 的是非零', () => {
    const { qml } = curveScene({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }, { width: 10, height: 10 })
    expect(qml).toContain('fillRule: ShapePath.WindingFill')
  })

  it('整圆由两段半圆组成', () => {
    const { qml } = curveScene({ kind: 'arc', center: { x: 30, y: 30 }, radius: 30, startAngle: 0, sweep: 360 }, { width: 60, height: 60 })
    expect(qml.match(/PathArc \{/g)).toHaveLength(2)
  })

  it('圆角多段线展开成直段与角弧', () => {
    const { qml } = curveScene({
      kind: 'polyline', closed: true, cornerRadius: 10,
      vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }],
    }, { width: 100, height: 60 })
    expect(qml.match(/PathArc \{/g)).toHaveLength(4)
  })

  it('端点箭头是额外的一条填充路径，颜色取描边色', () => {
    const { qml } = curveScene({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 120, y: 30 } }, { width: 120, height: 30 }, { markerEnd: 'arrow' })
    expect(qml.match(/ShapePath \{/g)).toHaveLength(2)
    expect(qml).toContain('fillColor: "#f97316"')
  })

  it('线宽 0 不画描边（Qt 的线宽 0 是一像素 cosmetic 线）', () => {
    const { qml } = curveScene({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }, { width: 10, height: 10 }, { strokeWidth: 0 })
    expect(qml).toContain('strokeColor: "transparent"')
    expect(qml).not.toContain('strokeWidth: 0')
  })
})

describe('OpenSpec: qml-export / 文字映射', () => {
  function textScene(props: JsonObject, size = { width: 200, height: 40 }) {
    const label = entity('label', {
      Renderer: {
        type: 'text',
        props: {
          text: '你好 Qt', color: '#f8fafc', fontFamily: 'Inter, sans-serif', fontSize: 16,
          fontWeight: 400, letterSpacing: 0, textAlign: 'left', verticalAlign: 'top',
          textCase: 'original', textDecoration: 'none', ...props,
        },
      },
    }, 'text')
    return exportScene(scene([label], { label: box(0, 0, size.width, size.height) }))
  }

  it('像素字号、盒写死为快照尺寸、按词边界或任意字符换行', () => {
    const { qml } = textScene({})
    const text = block(qml, 'Text {')
    expect(text).toContain('font.pixelSize: 16')
    expect(text).not.toContain('pointSize')
    expect(text).toContain('width: 200')
    expect(text).toContain('wrapMode: Text.WrapAtWordBoundaryOrAnywhere')
    expect(text).toContain('textFormat: Text.PlainText')
  })

  it('固定行高：顶对齐补上半份半行距，底对齐补下半份，居中不补', () => {
    expect(block(textScene({ lineHeight: 24, verticalAlign: 'top' }).qml, 'Text {'))
      .toContain('y: Math.floor((24 - Math.round(e_label_metrics.ascent) - Math.round(e_label_metrics.descent)) / 2)')
    expect(block(textScene({ lineHeight: 24, verticalAlign: 'bottom' }).qml, 'Text {'))
      .toContain('y: -Math.ceil(')
    const middle = textScene({ lineHeight: 24, verticalAlign: 'middle' }).qml
    expect(block(middle, 'Text {')).toMatch(/^\s+y: 0$/m)
    expect(middle).not.toContain('FontMetrics')
    expect(block(middle, 'Text {')).toContain('lineHeightMode: Text.FixedHeight')
  })

  it('字体栈只写第一个字族并给出诊断，字族进入清单', () => {
    const { qml, diagnostics, fontFamilies } = textScene({})
    expect(qml).toContain('font.family: "Inter"')
    expect(diagnostics.map((item) => item.code)).toContain('text.font-stack')
    expect(fontFamilies).toEqual(['Inter'])
  })

  it('字重、下划线、大小写与字距', () => {
    const text = block(textScene({ fontWeight: 'bold', textDecoration: 'underline', textCase: 'uppercase', letterSpacing: 2 }).qml, 'Text {')
    expect(text).toContain('font.weight: 700')
    expect(text).toContain('font.underline: true')
    expect(text).toContain('font.capitalization: Font.AllUppercase')
    expect(text).toContain('font.letterSpacing: 2')
  })
})

describe('OpenSpec: qml-export / 旋转与基点', () => {
  it('左边中点为基点：Rotation 原点为 (0, 20)，不钳制到盒内', () => {
    const tilted = entity('tilted', { Transform: { rotation: 30, pivot: { x: 0, y: 0.5 } } })
    const outside = entity('outside', { Transform: { rotation: 10, pivot: { x: 1.5, y: -0.5 } } })
    const { qml } = exportScene(scene([tilted, outside], {
      tilted: box(0, 0, 100, 40),
      outside: box(0, 0, 100, 40),
    }))
    const rotation = block(block(qml, 'objectName: "tilted"'), 'Rotation')
    expect(rotation).toContain('origin.x: 0')
    expect(rotation).toContain('origin.y: 20')
    expect(rotation).toContain('angle: 30')
    const far = block(block(qml, 'objectName: "outside"'), 'Rotation')
    expect(far).toContain('origin.x: 150')
    expect(far).toContain('origin.y: -20')
  })
})

describe('OpenSpec: qml-export / 不支持内容的降级', () => {
  it('渐变背景降级为最靠近中点的色标', () => {
    const gradient = entity('gradient', {
      Appearance: {
        backgroundPaint: {
          kind: 'linear-gradient', start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
          stops: [
            { id: 'a', position: 0, color: '#000000' },
            { id: 'b', position: 0.45, color: '#336699' },
            { id: 'c', position: 1, color: '#ffffff' },
          ],
        },
      },
    })
    const { qml, diagnostics } = exportScene(scene([gradient], { gradient: box(0, 0, 10, 10) }))
    expect(block(qml, 'objectName: "gradient"')).toContain('color: "#336699"')
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'paint.gradient-degraded', entityId: 'gradient' }))
  })

  it('图表与组件实例导出为同尺寸占位，其余对象照常导出', () => {
    const chart = entity('chart', { Renderer: { type: 'chart', props: {} } }, 'chart-bar')
    const instance = entity('instance', { Renderer: { type: 'component-instance', props: {} } }, 'component-instance')
    const plain = entity('plain', { Appearance: { backgroundPaint: { kind: 'solid', color: '#ef4444' } } })
    const { qml, diagnostics } = exportScene(scene([chart, instance, plain], {
      chart: box(0, 0, 120, 80),
      instance: box(0, 0, 60, 30),
      plain: box(0, 0, 10, 10),
    }))
    expect(block(block(qml, 'objectName: "chart"'), 'border.width: 1')).toContain('width: 120')
    expect(diagnostics.filter((item) => item.code === 'renderer.placeholder').map((item) => item.entityId))
      .toEqual(['chart'])
    expect(diagnostics.filter((item) => item.code === 'instance.unresolved').map((item) => item.entityId))
      .toEqual(['instance'])
    expect(qml).toContain('objectName: "plain"')
  })

  it('被绑定的属性与动画按静态值导出并给出诊断', () => {
    const bound = entity('bound', {
      Renderer: { type: 'rectangle', props: {} },
      Bindings: { version: 1, rendererProps: { fields: { text: { scope: 'page', exportName: 'temperature' } } } },
      Animation: { tracks: [] },
    }, 'rectangle')
    const { diagnostics } = exportScene(scene([bound], { bound: box(0, 0, 10, 10) }))
    expect(diagnostics.map((item) => item.code)).toEqual(['binding.static-value', 'animation.static-pose'])
  })
})

describe('OpenSpec: qml-export / 确定性输出', () => {
  it('同一输入两次导出逐字节相同', () => {
    const input = scene([entity('a', { Appearance: { backgroundPaint: { kind: 'solid', color: '#ef4444' } } })], { a: box(1.005, 2, 3, 4) })
    expect(exportScene(input).qml).toBe(exportScene(input).qml)
  })

  it('规范化后相撞的 id 按遍历顺序区分，objectName 保留原始 id', () => {
    const first = entity('node-1', {})
    const second = entity('node_1', {})
    const { qml } = exportScene(scene([first, second], { 'node-1': box(0, 0, 1, 1), node_1: box(0, 0, 1, 1) }))
    expect(block(qml, 'objectName: "node-1"')).toContain('id: e_node_1\n')
    expect(block(qml, 'objectName: "node_1"')).toContain('id: e_node_1_2')
  })

  it('数值最多两位小数、整数不补零', () => {
    const { qml } = exportScene(scene([entity('a', {})], { a: box(82.96874999999991, 4, 10, 10) }))
    expect(block(qml, 'objectName: "a"')).toContain('x: 82.97')
  })
})

describe('OpenSpec: qml-export / 导出入口拒绝非法输入', () => {
  it('场景不是根 Frame 时抛出', () => {
    const input = scene([entity('a', {})], { a: box(0, 0, 1, 1) })
    expect(() => exportComposeSceneToQml({ ...input, frameId: 'a' })).toThrow(ComposeQmlExportError)
  })

  it('快照里没有场景的盒子时抛出', () => {
    const input = scene([], {})
    expect(() => exportComposeSceneToQml({
      ...input,
      snapshot: { ...input.snapshot, boxes: {} },
      frameId: FRAME_ID,
    })).toThrow(/布局快照/)
  })
})

/** 一份单根组件文档的求解结果：根 80×40，里面一块红色的 `rect`，可选再嵌一个实例 `inner`。 */
function instanceContent(
  overrides: Partial<ComposeQmlInstanceContent> = {},
  withInner = false,
): ComposeQmlInstanceContent {
  const rect = entity('rect', { Appearance: { backgroundPaint: { kind: 'solid', color: '#ef4444' } } })
  const inner = entity('inner', { Renderer: { type: 'component-instance', props: {} } }, 'component-instance')
  const childIds = withInner ? ['rect', 'inner'] : ['rect']
  const root = createComposeFrameEntity({ id: 'root', childIds, size: { width: 80, height: 40 } })
  return {
    document: {
      schemaVersion: 7,
      canvas: createDefaultCanvasSettings(),
      rootIds: ['root'],
      entities: Object.fromEntries([root, rect, inner].map((item) => [item.id, item])),
    },
    snapshot: {
      revision: 1,
      diagnostics: [],
      boxes: { root: box(0, 0, 80, 40), rect: box(10, 5, 20, 10), inner: box(40, 0, 40, 40) },
    },
    contentFit: 'layout',
    rootSize: { width: 80, height: 40 },
    contentScale: { x: 1, y: 1 },
    flipScale: { x: 1, y: 1 },
    ...overrides,
  }
}

function instanceEntity(id: string) {
  return entity(id, { Renderer: { type: 'component-instance', props: {} } }, 'component-instance')
}

describe('OpenSpec: qml-export / 组件实例按嵌套求解结果内联展开', () => {
  it('同一组件的两个实例：内部对象 id 互不相同，objectName 是复合地址', () => {
    const input = scene([instanceEntity('a'), instanceEntity('b')], {
      a: box(0, 0, 80, 40),
      b: box(100, 0, 80, 40),
    })
    const { qml, diagnostics } = exportComposeSceneToQml({
      ...input,
      frameId: FRAME_ID,
      instances: new Map([['a', instanceContent()], ['b', instanceContent()]]),
    })
    expect(qml).toContain('id: e_a__rect')
    expect(qml).toContain('id: e_b__rect')
    expect(block(qml, 'objectName: "a/rect"')).toContain('x: 10')
    expect(qml).toContain('objectName: "b/rect"')
    expect(diagnostics.filter((item) => item.code === 'instance.unresolved')).toEqual([])
  })

  it('翻转绕盒中心镜像，scale 按根自然尺寸摆放并以原点缩放', () => {
    const input = scene([instanceEntity('a')], { a: box(0, 0, 160, 20) })
    const { qml } = exportComposeSceneToQml({
      ...input,
      frameId: FRAME_ID,
      instances: new Map([['a', instanceContent({
        contentFit: 'scale',
        contentScale: { x: 2, y: 0.5 },
        flipScale: { x: -1, y: 1 },
      })]]),
    })
    const flip = block(qml, 'origin.x: 80')
    expect(flip).toContain('origin.y: 10')
    expect(flip).toContain('xScale: -1')
    expect(flip).toContain('yScale: 1')
    const scale = block(qml, 'xScale: 2')
    expect(scale).toContain('yScale: 0.5')
    expect(scale).not.toContain('origin.')
    expect(qml.indexOf('xScale: -1')).toBeLessThan(qml.indexOf('xScale: 2'))
  })

  it('嵌套实例按「外层/内层」取得求解结果并同样展开', () => {
    const input = scene([instanceEntity('outer')], { outer: box(0, 0, 80, 40) })
    const { qml, diagnostics } = exportComposeSceneToQml({
      ...input,
      frameId: FRAME_ID,
      instances: new Map([
        ['outer', instanceContent({}, true)],
        ['outer/inner', instanceContent()],
      ]),
    })
    expect(qml).toContain('objectName: "outer/inner/rect"')
    expect(qml).toContain('id: e_outer__inner__rect')
    expect(diagnostics.filter((item) => item.code === 'instance.unresolved')).toEqual([])
  })

  it('缺少求解结果的实例导出为同尺寸占位并给出带地址的诊断，其余照常展开', () => {
    const input = scene([instanceEntity('a'), instanceEntity('b')], {
      a: box(0, 0, 80, 40),
      b: box(100, 0, 60, 30),
    })
    const { qml, diagnostics } = exportComposeSceneToQml({
      ...input,
      frameId: FRAME_ID,
      instances: new Map([['a', instanceContent()]]),
    })
    expect(qml).toContain('objectName: "a/rect"')
    expect(qml).not.toContain('objectName: "b/rect"')
    expect(block(block(qml, 'objectName: "b"'), 'border.width: 1')).toContain('width: 60')
    const unresolved = diagnostics.filter((item) => item.code === 'instance.unresolved')
    expect(unresolved).toEqual([expect.objectContaining({ entityId: 'b', message: expect.stringContaining('b') })])
  })
})

const PAGE_SCRIPT = { setupModule: 'export function setup() { return {} }\n', runtimeModule: '// runtime\n' }

function bindings(fields: Record<string, string>): JsonObject {
  return {
    version: 1,
    rendererProps: {
      fields: Object.fromEntries(Object.entries(fields).map(([prop, exportName]) => [prop, { scope: 'page', exportName }])),
    },
  }
}

describe('OpenSpec: qml-page-script / 导出值桥接为 QML 属性', () => {
  const label = entity('label', {
    Renderer: { type: 'text', props: { text: '23.5', color: '#22c55e', fontSize: 16 } },
    Bindings: bindings({ text: 'temperature', color: 'alarmColor', fontSize: 'size' }),
  }, 'text')
  const wire = entity('wire', {
    Renderer: { type: 'curve', props: { stroke: '#ff3b30cc', strokeWidth: 2, markerEnd: 'arrow' } },
    Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
    Bindings: bindings({ stroke: 'alarmColor' }),
  }, 'curve')
  const input = scene([label, wire], { label: box(0, 0, 100, 20), wire: box(0, 40, 40, 1) })

  it('被绑定的导出名生成 page 属性，对象以带静态回退的表达式绑定', () => {
    const { qml, files } = exportComposeSceneToQml({ ...input, frameId: FRAME_ID, pageScript: PAGE_SCRIPT })
    expect(qml).toMatch(/^import "ComposeRuntime"$/m)
    expect(qml).toMatch(/^import "page.setup.mjs" as PageSetup$/m)
    const page = block(qml, 'id: page')
    expect(page).toContain('setup: PageSetup.setup')
    expect(page).toContain('property var x_temperature: undefined')
    expect(page).toContain('property var x_alarmColor: undefined')
    expect(page).toContain('"alarmColor":{"property":"x_alarmColor","kinds":["color"]}')
    expect(qml).toContain('text: page.x_temperature === undefined ? "23.5" : page.text(page.x_temperature)')
    expect(qml).toContain('color: page.x_alarmColor === undefined ? "#22c55e" : page.color(page.x_alarmColor)')
    // 描边与箭头填充跟同一个绑定；静态回退写的是 Qt 的 #aarrggbb。
    expect(qml.match(/page\.x_alarmColor === undefined \? "#ccff3b30" : page\.color\(page\.x_alarmColor\)/g)).toHaveLength(2)
    expect(files.map((file) => file.path)).toEqual([
      'Scene.qml',
      'page.setup.mjs',
      'ComposeRuntime/qmldir',
      'ComposeRuntime/ComposePage.qml',
      'ComposeRuntime/globals.mjs',
      'ComposeRuntime/script-runtime.mjs',
    ])
    expect(files[1]!.content).toBe(PAGE_SCRIPT.setupModule)
    expect(files[5]!.content).toBe(PAGE_SCRIPT.runtimeModule)
  })

  it('不能动态化的绑定（字号）按静态值导出并给出诊断', () => {
    const { qml, diagnostics } = exportComposeSceneToQml({ ...input, frameId: FRAME_ID, pageScript: PAGE_SCRIPT })
    expect(qml).not.toContain('x_size')
    expect(diagnostics.filter((item) => item.code === 'binding.static-value')).toEqual([
      expect.objectContaining({ entityId: 'label', message: expect.stringContaining('fontSize') }),
    ])
  })

  it('页面没有 setup：没有 page 对象与运行时，产物只有场景文件', () => {
    const { qml, files, diagnostics } = exportComposeSceneToQml({ ...input, frameId: FRAME_ID })
    expect(qml).not.toContain('ComposePage')
    expect(qml).not.toContain('page.')
    expect(files).toEqual([{ path: 'Scene.qml', content: qml }])
    expect(diagnostics.filter((item) => item.code === 'binding.static-value').map((item) => item.entityId))
      .toEqual(['label', 'wire'])
  })

  it('组件实例内部的绑定不动态化：嵌套文档没有脚本作用域', () => {
    const content = instanceContent()
    const rect = content.document.entities.rect!
    const boundRect = { ...rect, components: { ...rect.components, Bindings: bindings({ text: 'temperature' }) } }
    const { qml } = exportComposeSceneToQml({
      ...scene([instanceEntity('a')], { a: box(0, 0, 80, 40) }),
      frameId: FRAME_ID,
      pageScript: PAGE_SCRIPT,
      instances: new Map([['a', { ...content, document: { ...content.document, entities: { ...content.document.entities, rect: boundRect } } }]]),
    })
    expect(qml).not.toContain('x_temperature')
  })
})
