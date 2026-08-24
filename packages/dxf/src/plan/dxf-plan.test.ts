import { describe, expect, it } from 'vitest'
import {
  getComposeCurve,
  getComposeLayoutItem,
  getComposeLock,
  getComposeVisibility,
} from '@compose-ui/core'
import type { ComposeEntity, JsonObject } from '@compose-ui/core'
import { assembleDxfDocument, planDxfImport } from './dxf-plan'
import type { DxfCreateSeed, DxfImportPlan } from './dxf-types'

const axis = { mode: 'fixed', value: 1, min: 1, max: null }

/**
 * 一份最小 seed 工厂。
 *
 * @remarks
 * 结构与 Registry 的 Preset seed 一致但不引用它——本包不依赖 `component-registry`，这份夹具
 * 同时是那条边界的证据。
 */
const createSeed: DxfCreateSeed = (presetId) => {
  const components: Record<string, JsonObject> = {
    Composition: { presetId, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: { positioning: 'absolute', offset: { x: 0, y: 0 }, width: axis, height: axis },
    Visibility: { visible: true },
    Lock: { locked: false },
  }
  if (presetId === 'frame') {
    components.Hierarchy = { childIds: [] }
    components.Frame = { size: { width: 1, height: 1 }, guides: [] }
  }
  if (presetId === 'curve') {
    components.Curve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
    components.Renderer = { type: 'curve', props: { stroke: '#000', strokeWidth: 1 } }
  }
  if (presetId === 'text') {
    components.Renderer = { type: 'text', props: { text: 'Text', fontSize: 12 } }
  }
  return { name: presetId, components }
}

function dxf(...lines: string[]) {
  return `${lines.join('\n')}\n`
}

function entities(plan: DxfImportPlan): readonly ComposeEntity[] {
  return plan.scene.childIds
    .map((id) => plan.scene.entities[id])
    .filter((entity): entity is ComposeEntity => entity !== undefined)
}

function section(name: string, ...body: string[]) {
  return ['0', 'SECTION', '2', name, ...body, '0', 'ENDSEC']
}

function rendererProps(entity: ComposeEntity) {
  return (entity.components.Renderer as { props: Record<string, unknown> }).props
}

describe('顶层图元', () => {
  it('OpenSpec: dxf-import / DXF 导入产出页面导入计划 / 顶层图元落进场景', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'LINE', '10', '0', '20', '0', '11', '100', '21', '0',
      '0', 'CIRCLE', '10', '50', '20', '50', '40', '10',
      '0', 'ARC', '10', '0', '20', '0', '40', '20', '50', '0', '51', '90',
      '0', 'LWPOLYLINE', '70', '1', '10', '0', '20', '0', '10', '10', '20', '0',
      '10', '10', '20', '10',
    ), '0', 'EOF'), { createSeed })

    const kinds = entities(plan).map((entity) => getComposeCurve(entity)?.kind)
    expect(kinds).toEqual(['line', 'arc', 'arc', 'polyline'])

    // 整圆是扫掠 360 的弧，不另立类型。
    expect(getComposeCurve(entities(plan)[1]!)).toMatchObject({
      kind: 'arc',
      sweep: 360,
      radius: 10,
    })
    expect(getComposeCurve(entities(plan)[3]!)).toMatchObject({
      kind: 'polyline',
      closed: true,
    })
  })

  it('OpenSpec: dxf-import / 导入的几何归一化到场景 / Y 轴翻转', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'LINE', '10', '10', '20', '20', '11', '30', '21', '40',
    ), '0', 'EOF'), { createSeed })

    // 翻转之后 `(10,20)` 在下、`(30,40)` 在上；不翻转的话两端会同向排列。
    expect(getComposeCurve(entities(plan)[0]!)).toMatchObject({
      kind: 'line',
      start: { x: 0, y: 20 },
      end: { x: 20, y: 0 },
    })
  })

  it('原点处不产出 -0', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'LINE', '10', '0', '20', '0', '11', '100', '21', '0',
    ), '0', 'EOF'), { createSeed })

    const curve = getComposeCurve(entities(plan)[0]!)
    if (curve?.kind !== 'line') throw new Error('应当是直线')
    // `-0` 在 JSON 里写成 `0`，只在 `Object.is` 与断言里现形。
    expect(Object.is(curve.start.y, 0)).toBe(true)
  })
})

const TERMINAL = [
  '0', 'BLOCK', '2', 'TERMINAL', '10', '-30', '20', '0',
  '0', 'LWPOLYLINE', '70', '1',
  '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '10', '10', '0', '20', '10',
  '0', 'ENDBLK',
]

describe('块与实例', () => {
  it('OpenSpec: dxf-import / 块基点映射为实例的旋转基点 / 基点在盒外的块被旋转插入', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS', ...TERMINAL),
      ...section('ENTITIES', '0', 'INSERT', '2', 'TERMINAL', '10', '150', '20', '320', '50', '180'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.instances).toHaveLength(1)
    // 基点 `(-30, 0)` 落在块几何包围盒 `x[0,10] y[-10,0]` 之外，归一化后是 `(-3, 1)`。
    // 写成盒中心（也就是缺席）时对称图形转出来逐像素相同，因此这条必须断基点本身。
    expect(plan.instances[0]).toMatchObject({
      blockName: 'TERMINAL',
      offset: { x: 70, y: -10 },
      rotation: -180,
      pivot: { x: -3, y: 1 },
    })
    // 转轴落回插入点：盒左上角加基点偏移，等于插入点减去场景归一化的平移量。
    const instance = plan.instances[0]!
    expect({
      x: instance.offset.x + instance.pivot.x * plan.scene.size.width,
      y: instance.offset.y + instance.pivot.y * plan.scene.size.height,
    }).toEqual({ x: 40, y: 0 })
  })

  it('OpenSpec: dxf-import / 块基点映射为实例的旋转基点 / 基点即盒中心', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS',
        '0', 'BLOCK', '2', 'BOX', '10', '5', '20', '5',
        '0', 'LWPOLYLINE', '70', '1',
        '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '10', '10', '0', '20', '10',
        '0', 'ENDBLK'),
      ...section('ENTITIES', '0', 'INSERT', '2', 'BOX', '10', '100', '20', '100'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.instances[0]?.pivot).toEqual({ x: 0.5, y: 0.5 })
  })

  it('OpenSpec: dxf-import / DXF 的块映射为组件资产 / 一个块两次插入', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS', ...TERMINAL),
      ...section('ENTITIES',
        '0', 'INSERT', '2', 'TERMINAL', '10', '0', '20', '0',
        '0', 'INSERT', '2', 'TERMINAL', '10', '100', '20', '0'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.components).toHaveLength(1)
    expect(plan.instances.map((instance) => instance.blockName)).toEqual(['TERMINAL', 'TERMINAL'])

    const component = plan.components[0]!
    const rootId = component.document.rootIds[0]!
    // 组件根必须是 Frame，尺寸取块内几何的紧包围盒。
    expect(component.document.entities[rootId]?.components.Frame).toMatchObject({
      size: { width: 10, height: 10 },
    })
  })

  it('OpenSpec: dxf-import / DXF 的块映射为组件资产 / 块内的 INSERT 被拒绝并报告', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS',
        '0', 'BLOCK', '2', 'INNER', '10', '0', '20', '0',
        '0', 'LINE', '10', '0', '20', '0', '11', '10', '21', '0',
        '0', 'ENDBLK',
        '0', 'BLOCK', '2', 'OUTER', '10', '0', '20', '0',
        '0', 'INSERT', '2', 'INNER', '10', '0', '20', '0',
        '0', 'ENDBLK'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.diagnostics).toContainEqual({
      code: 'dxf.nested-block',
      subject: 'INNER',
      count: 1,
    })
    expect(plan.components.map((component) => component.blockName)).toEqual(['INNER'])
  })

  it('布局块的内容既不进块表也不掉到顶层', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS',
        '0', 'BLOCK', '2', '*Model_Space', '10', '0', '20', '0',
        '0', 'LINE', '10', '0', '20', '0', '11', '10', '21', '0',
        '0', 'ENDBLK'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.components).toHaveLength(0)
    expect(plan.scene.childIds).toHaveLength(0)
  })
})

describe('图层', () => {
  const layers = section('TABLES',
    '0', 'TABLE', '2', 'LAYER',
    '0', 'LAYER', '2', '0', '62', '7', '70', '0',
    '0', 'LAYER', '2', 'HIDDEN', '62', '-1', '70', '0',
    '0', 'LAYER', '2', 'LOCKED', '62', '1', '70', '4',
    '0', 'ENDTAB')

  it('OpenSpec: dxf-import / DXF 图层在导入期被求值 / 关闭的图层', () => {
    const plan = planDxfImport(dxf(
      ...layers,
      ...section('ENTITIES',
        '0', 'LINE', '8', 'HIDDEN', '10', '0', '20', '0', '11', '10', '21', '0'),
      '0', 'EOF',
    ), { createSeed })

    const [entity] = entities(plan)
    expect(getComposeVisibility(entity!).visible).toBe(false)
    // 仍然存在且可由用户打开。
    expect(getComposeCurve(entity!)).toBeTruthy()
  })

  it('OpenSpec: dxf-import / DXF 图层在导入期被求值 / 锁定的图层', () => {
    const plan = planDxfImport(dxf(
      ...layers,
      ...section('ENTITIES',
        '0', 'LINE', '8', 'LOCKED', '10', '0', '20', '0', '11', '10', '21', '0'),
      '0', 'EOF',
    ), { createSeed })

    const [entity] = entities(plan)
    expect(getComposeLock(entity!).locked).toBe(true)
    // byLayer 颜色求值进描边：页面世界没有继承。
    expect(rendererProps(entity!).stroke).toBe('#ff0000')
    // 图层名落成 Entity 名。
    expect(entity!.name).toBe('LOCKED')
  })

  it('OpenSpec: dxf-import / DXF 图层在导入期被求值 / 未知图层名', () => {
    const plan = planDxfImport(dxf(
      ...layers,
      ...section('ENTITIES',
        '0', 'LINE', '8', 'TYPO', '10', '0', '20', '0', '11', '10', '21', '0'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.diagnostics).toContainEqual({
      code: 'dxf.unknown-layer',
      subject: 'TYPO',
      count: 1,
    })
    expect(getComposeVisibility(entities(plan)[0]!).visible).toBe(true)
  })
})

describe('文字', () => {
  it('居中对齐的锚点被换算成盒左上角', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'TEXT', '10', '100', '20', '100', '40', '10', '1', 'AB', '72', '1',
    ), '0', 'EOF'), { createSeed })

    const [entity] = entities(plan)
    const item = getComposeLayoutItem(entity!)
    // 盒走 Hug：它是会被看见的东西，不该停在估算值上。
    expect(item.width.mode).toBe('hug')
    // 单一实体时场景归一化把盒左上角挪到原点，因此这里断的是锚点换算没有把盒摆歪。
    expect(item.offset).toEqual({ x: 0, y: 0 })
    expect(rendererProps(entity!).textAlign).toBe('center')
  })
})

describe('场景归一化', () => {
  it('OpenSpec: dxf-import / 导入的几何归一化到场景 / 远离原点的图', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'LINE', '10', '10000', '20', '20000', '11', '10200', '21', '20000',
      '0', 'LINE', '10', '10000', '20', '20000', '11', '10000', '21', '20100',
    ), '0', 'EOF'), { createSeed })

    // 高是 101 不是 100：水平线的紧包围盒高为 0，`normalizeComposeCurveGeometry` 把退化轴
    // 钳到 `COMPOSE_CURVE_MIN_EXTENT`，那一格算进场景。
    expect(plan.scene.size).toEqual({ width: 200, height: 101 })
    const offsets = entities(plan).map((entity) => getComposeLayoutItem(entity).offset)
    // 内容从场景原点开始：横线在底边，竖线贴左边。
    expect(offsets).toEqual([{ x: 0, y: 100 }, { x: 0, y: 0 }])
  })
})

describe('诊断', () => {
  it('OpenSpec: dxf-import / 导入能导的，报告导不了的 / 混合可导与不可导的文件', () => {
    const plan = planDxfImport(dxf(...section(
      'ENTITIES',
      '0', 'SPLINE', '0', 'SPLINE', '0', 'SPLINE', '0', 'HATCH',
      '0', 'LINE', '10', '0', '20', '0', '11', '10', '21', '0',
    ), '0', 'EOF'), { createSeed })

    expect(entities(plan)).toHaveLength(1)
    expect(plan.diagnostics).toEqual([
      { code: 'dxf.unsupported-entity', subject: 'SPLINE', count: 3 },
      { code: 'dxf.unsupported-entity', subject: 'HATCH', count: 1 },
    ])
  })

  it('OpenSpec: dxf-import / 导入能导的，报告导不了的 / 缩放的插入', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS', ...TERMINAL),
      ...section('ENTITIES',
        '0', 'INSERT', '2', 'TERMINAL', '10', '0', '20', '0', '41', '2', '42', '2'),
      '0', 'EOF',
    ), { createSeed })

    expect(plan.diagnostics).toContainEqual({
      code: 'dxf.instance-scale',
      subject: 'TERMINAL',
      count: 1,
    })
    // 按 1 导入：实例仍然在，只是没有缩放。
    expect(plan.instances).toHaveLength(1)
  })
})

describe('装配', () => {
  it('缺任何一个实例都拒绝装配', () => {
    const plan = planDxfImport(dxf(
      ...section('BLOCKS', ...TERMINAL),
      ...section('ENTITIES', '0', 'INSERT', '2', 'TERMINAL', '10', '0', '20', '0'),
      '0', 'EOF',
    ), { createSeed })

    // 半份文档的 `Hierarchy` 会指向不存在的 Entity。
    expect(assembleDxfDocument(plan, {})).toBeNull()

    const instance: ComposeEntity = {
      id: plan.instances[0]!.id,
      name: 'TERMINAL',
      components: { Composition: { presetId: 'component-instance' } },
    }
    const document = assembleDxfDocument(plan, { [instance.id]: instance })
    expect(document?.rootIds).toEqual([plan.scene.frameId])
    expect(document?.entities[instance.id]).toBe(instance)
  })
})
