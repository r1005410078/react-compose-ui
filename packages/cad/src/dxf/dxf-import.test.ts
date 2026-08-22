import { describe, expect, it } from 'vitest'
import {
  getCadArc,
  getCadInsert,
  getCadLine,
  getCadPolyline,
  getCadText,
  validateCadDocument,
} from '../document'
import { arcPointAt } from '../geometry'
import { groupDxfRecords, tokenizeDxf } from './dxf-parser'
import { importDxfDocument } from './dxf-import'

/** 把 `[code, value]` 列表写成 DXF 文本；用例只关心内容，不关心排版。 */
function dxf(...pairs: readonly (readonly [number, string | number])[]) {
  return pairs.map(([code, value]) => `${code}\n${value}`).join('\n') + '\n'
}

function entitiesSection(...body: readonly (readonly [number, string | number])[]) {
  return dxf(
    [0, 'SECTION'], [2, 'ENTITIES'],
    ...body,
    [0, 'ENDSEC'], [0, 'EOF'],
  )
}

describe('OpenSpec: cad-document / DXF 导入器 / 分词与分组', () => {
  it('容忍 CRLF 与组码两侧空白', () => {
    const pairs = tokenizeDxf('  0  \r\nLINE\r\n 10 \r\n1.5\r\n')
    expect(pairs).toEqual([{ code: 0, value: 'LINE' }, { code: 10, value: '1.5' }])
  })

  it('组码不是整数的行被丢弃，不让后续错位', () => {
    // 丢一对好过把后面所有对错位一格。
    expect(tokenizeDxf('abc\nLINE\n10\n1\n')).toEqual([{ code: 10, value: '1' }])
  })

  it('记录保留重复出现的组码', () => {
    const [record] = groupDxfRecords(tokenizeDxf(dxf(
      [0, 'LWPOLYLINE'], [10, 1], [20, 2], [10, 3], [20, 4],
    )))
    // 收成「组码 → 单值」会只剩最后一个顶点，而这个错误在三角形上看不出来。
    expect(record!.pairs.filter(({ code }) => code === 10)).toHaveLength(2)
  })
})

describe('OpenSpec: cad-document / DXF 导入的坐标翻转', () => {
  it('位置翻转', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'LINE'], [8, '0'], [10, 10], [20, 20], [11, 30], [21, 40],
    ))
    expect(getCadLine(document.entities['dxf-1']!)).toEqual({
      start: { x: 10, y: -20 },
      end: { x: 30, y: -40 },
    })
  })

  it('不对称圆弧的角度取反，且与「先按 DXF 求点再翻 Y」一致', () => {
    // 起角与终角都不是 90 的倍数：对称几何在翻转错误下看起来仍然正确。
    const { document } = importDxfDocument(entitiesSection(
      [0, 'ARC'], [8, '0'], [10, 100], [20, 50], [40, 20], [50, 30], [51, 100],
    ))
    const arc = getCadArc(document.entities['dxf-1']!)!
    expect(arc.startAngle).toBe(-30)
    expect(arc.sweep).toBe(-70)

    // 独立复算：DXF 里 60° 处的点，翻转 Y 之后应当落在我们这段弧的同一参数位置上。
    const dxfAngle = 60
    const expected = {
      x: 100 + 20 * Math.cos((dxfAngle * Math.PI) / 180),
      y: -(50 + 20 * Math.sin((dxfAngle * Math.PI) / 180)),
    }
    const actual = arcPointAt(
      { center: arc.center, radius: arc.radius, startAngle: arc.startAngle, sweep: arc.sweep },
      arc.startAngle + arc.sweep * ((dxfAngle - 30) / 70),
    )
    expect(actual.x).toBeCloseTo(expected.x)
    expect(actual.y).toBeCloseTo(expected.y)
  })

  it('整圆是扫掠 −360 的弧', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'CIRCLE'], [8, '0'], [10, 0], [20, 0], [40, 5],
    ))
    expect(getCadArc(document.entities['dxf-1']!)).toMatchObject({ sweep: 360, radius: 5 })
  })

  it('起终角相同的 ARC 是整圆而不是零长弧', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'ARC'], [8, '0'], [10, 0], [20, 0], [40, 5], [50, 45], [51, 45],
    ))
    expect(getCadArc(document.entities['dxf-1']!)?.sweep).toBe(-360)
  })

  it('文字旋转取反', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'TEXT'], [8, '0'], [10, 5], [20, 6], [40, 2.5], [1, 'QF01'], [50, 30], [72, 2],
    ))
    expect(getCadText(document.entities['dxf-1']!)).toEqual({
      position: { x: 5, y: -6 },
      content: 'QF01',
      height: 2.5,
      rotation: -30,
      align: 'right',
    })
  })

  it('块实例的旋转取反而比例不变', () => {
    const { document } = importDxfDocument(dxf(
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'SYM'], [10, 0], [20, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 10], [21, 0],
      [0, 'ENDBLK'],
      [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [8, '0'], [2, 'SYM'], [10, 100], [20, 200], [50, 30], [41, 2], [42, 3],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    const insert = getCadInsert(document.entities[document.rootIds[0]!]!)!
    expect(insert.position).toEqual({ x: 100, y: -200 })
    // 翻转把旋转共轭成逆旋转，而对角比例矩阵与翻转可交换。
    expect(insert.rotation).toBe(-30)
    expect(insert.scale).toEqual({ x: 2, y: 3 })
  })
})

describe('OpenSpec: cad-document / DXF 导入器 / 实体映射', () => {
  it('五类实体各自映射并通过校验', () => {
    const { document, diagnostics } = importDxfDocument(entitiesSection(
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 10], [21, 0],
      [0, 'CIRCLE'], [8, '0'], [10, 20], [20, 0], [40, 5],
      [0, 'ARC'], [8, '0'], [10, 40], [20, 0], [40, 5], [50, 0], [51, 90],
      [0, 'LWPOLYLINE'], [8, '0'], [70, 1], [10, 0], [20, 10], [10, 10], [20, 10], [10, 10], [20, 20],
      [0, 'TEXT'], [8, '0'], [10, 0], [20, 30], [40, 2], [1, 'A'],
    ))
    expect(document.rootIds).toHaveLength(5)
    expect(diagnostics).toEqual([])
    expect(validateCadDocument(document).valid).toBe(true)
  })

  it('长折线的顶点不被折叠，闭合标志被读出', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'LWPOLYLINE'], [8, '0'], [70, 1],
      [10, 0], [20, 0], [10, 10], [20, 0], [10, 20], [20, 10], [10, 30], [20, 10], [10, 40], [20, 0],
    ))
    const polyline = getCadPolyline(document.entities['dxf-1']!)!
    expect(polyline.vertices).toHaveLength(5)
    expect(polyline.closed).toBe(true)
    expect(polyline.vertices[2]).toEqual({ x: 20, y: -10 })
  })

  it('开放的多段线', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'LWPOLYLINE'], [8, '0'], [10, 0], [20, 0], [10, 10], [20, 0],
    ))
    expect(getCadPolyline(document.entities['dxf-1']!)?.closed).toBe(false)
  })
})

describe('OpenSpec: cad-document / DXF 导入诊断', () => {
  it('不支持的实体被跳过并按类型聚合', () => {
    const { document, diagnostics } = importDxfDocument(entitiesSection(
      [0, 'SPLINE'], [8, '0'],
      [0, 'SPLINE'], [8, '0'],
      [0, 'SPLINE'], [8, '0'],
      [0, 'HATCH'], [8, '0'],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 1], [21, 1],
    ))
    // 导入能导的，报告导不了的——一个 HATCH 不该让整张图导不进来。
    expect(document.rootIds).toHaveLength(1)
    expect(diagnostics).toEqual([
      { code: 'dxf.unsupported-entity', subject: 'SPLINE', count: 3 },
      { code: 'dxf.unsupported-entity', subject: 'HATCH', count: 1 },
    ])
  })

  it('bulge 按弦导入并报告', () => {
    const { document, diagnostics } = importDxfDocument(entitiesSection(
      [0, 'LWPOLYLINE'], [8, '0'], [10, 0], [20, 0], [42, 0.5], [10, 10], [20, 0],
    ))
    expect(getCadPolyline(document.entities['dxf-1']!)?.vertices).toHaveLength(2)
    expect(diagnostics).toContainEqual({
      code: 'dxf.polyline-bulge', subject: 'LWPOLYLINE', count: 1,
    })
  })

  it('bulge 全为零时不报告', () => {
    const { diagnostics } = importDxfDocument(entitiesSection(
      [0, 'LWPOLYLINE'], [8, '0'], [10, 0], [20, 0], [42, 0], [10, 10], [20, 0],
    ))
    expect(diagnostics).toEqual([])
  })

  it('字段不完整的实体被跳过并报告', () => {
    const { document, diagnostics } = importDxfDocument(entitiesSection(
      [0, 'CIRCLE'], [8, '0'], [10, 0], [20, 0], [40, 0],
      [0, 'TEXT'], [8, '0'], [10, 0], [20, 0], [40, 2], [1, ''],
    ))
    expect(document.rootIds).toEqual([])
    expect(diagnostics).toHaveLength(2)
  })
})

describe('OpenSpec: cad-document / DXF 图层与块的映射', () => {
  const withLayers = (...body: readonly (readonly [number, string | number])[]) => dxf(
    [0, 'SECTION'], [2, 'TABLES'],
    [0, 'TABLE'], [2, 'LAYER'],
    [0, 'LAYER'], [2, 'WIRE'], [62, 1], [70, 0],
    [0, 'LAYER'], [2, 'HIDDEN'], [62, -3], [70, 0],
    [0, 'LAYER'], [2, 'FROZEN'], [62, 3], [70, 1],
    [0, 'LAYER'], [2, 'LOCKED'], [62, 3], [70, 4],
    [0, 'ENDTAB'], [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    ...body,
    [0, 'ENDSEC'], [0, 'EOF'],
  )

  it('图层名即 id，颜色、可见与锁定被读出', () => {
    const { document } = importDxfDocument(withLayers())
    expect(document.layers.map(({ id }) => id))
      .toEqual(['0', 'WIRE', 'HIDDEN', 'FROZEN', 'LOCKED'])
    expect(document.layers[1]).toMatchObject({ color: '#ff0000', visible: true, locked: false })
    // 负的颜色号表示图层关闭。
    expect(document.layers[2]!.visible).toBe(false)
    expect(document.layers[3]!.visible).toBe(false)
    expect(document.layers[4]!.locked).toBe(true)
  })

  it('文件没给图层 0 也补一个', () => {
    const { document } = importDxfDocument(entitiesSection(
      [0, 'LINE'], [8, 'NOPE'], [10, 0], [20, 0], [11, 1], [21, 1],
    ))
    expect(document.layers.map(({ id }) => id)).toEqual(['0'])
  })

  it('未知图层落回 0 并报告', () => {
    const { document, diagnostics } = importDxfDocument(withLayers(
      [0, 'LINE'], [8, 'GHOST'], [10, 0], [20, 0], [11, 1], [21, 1],
    ))
    expect(document.entities['dxf-1']!.components.CadPlacement).toEqual({ layerId: '0' })
    expect(diagnostics).toContainEqual({ code: 'dxf.unknown-layer', subject: 'GHOST', count: 1 })
    expect(validateCadDocument(document).valid).toBe(true)
  })

  it('块内几何按基点换算为块局部坐标', () => {
    const { document } = importDxfDocument(dxf(
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'SYM'], [10, 100], [20, 100],
      [0, 'LINE'], [8, '0'], [10, 100], [20, 100], [11, 110], [21, 100],
      [0, 'ENDBLK'],
      [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [8, '0'], [2, 'SYM'], [10, 0], [20, 0],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    const block = document.blocks.SYM!
    // 基点对准插入点，因此块坐标 (100,100) 就是局部原点。
    expect(getCadLine(block.entities[block.rootIds[0]!]!)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    })
    expect(validateCadDocument(document).valid).toBe(true)
  })

  it('布局块被跳过', () => {
    const { document } = importDxfDocument(dxf(
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, '*Model_Space'], [10, 0], [20, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 1], [21, 1],
      [0, 'ENDBLK'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(document.blocks).toEqual({})
    // 布局块的内容也不进顶层——它属于那个块。
    expect(document.rootIds).toEqual([])
  })

  it('块内的 INSERT 被跳过并报告', () => {
    const { document, diagnostics } = importDxfDocument(dxf(
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'INNER'], [10, 0], [20, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 1], [21, 1],
      [0, 'ENDBLK'],
      [0, 'BLOCK'], [2, 'OUTER'], [10, 0], [20, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 2], [21, 0],
      [0, 'INSERT'], [8, '0'], [2, 'INNER'], [10, 0], [20, 0],
      [0, 'ENDBLK'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(document.blocks.OUTER!.rootIds).toHaveLength(1)
    expect(diagnostics).toContainEqual({ code: 'dxf.nested-block', subject: 'INNER', count: 1 })
    // 硬导进去会让整份文档不合法——一个符号毁掉一张图。
    expect(validateCadDocument(document).valid).toBe(true)
  })

  it('引用不存在的块被跳过并报告', () => {
    const { document, diagnostics } = importDxfDocument(entitiesSection(
      [0, 'INSERT'], [8, '0'], [2, 'MISSING'], [10, 0], [20, 0],
    ))
    expect(document.rootIds).toEqual([])
    expect(diagnostics).toContainEqual({ code: 'dxf.unknown-block', subject: 'MISSING', count: 1 })
  })

  it('INSERT 出现在块定义之前也能解析', () => {
    // 两趟：先扫块名，再映射实体——比要求文件有序可靠。
    const { document, diagnostics } = importDxfDocument(dxf(
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'INSERT'], [8, '0'], [2, 'SYM'], [10, 0], [20, 0],
      [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'BLOCKS'],
      [0, 'BLOCK'], [2, 'SYM'], [10, 0], [20, 0],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 1], [21, 1],
      [0, 'ENDBLK'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ))
    expect(diagnostics).toEqual([])
    expect(validateCadDocument(document).valid).toBe(true)
  })
})
