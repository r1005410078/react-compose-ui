import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_CURVE_PICK_TOLERANCE,
  COMPOSE_JUNCTION_DIAMETER_RATIO,
  composeJunctionSize,
  getComposeCurve,
  getComposeLayoutItem,
  getComposeRenderer,
  type ComposeEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'

import { DEFAULT_COMPOSE_JUNCTION_PRESET } from './definition'

afterEach(cleanup)

function curveSeed(): {
  readonly entity: ComposeEntity
  readonly materials: ReturnType<typeof createComposeBasicMaterials>
} {
  const materials = createComposeBasicMaterials()
  const result = materials.registry.createSeed('curve')
  if (!result.ok) throw new Error(result.error.message)
  return { entity: { id: 'curve-1', ...result.seed }, materials }
}

describe('curve 物料', () => {
  it('Preset 携带 Curve 几何且盒与几何一致', () => {
    const { entity } = curveSeed()
    const curve = getComposeCurve(entity)!
    const item = getComposeLayoutItem(entity)!
    expect(curve.kind).toBe('line')
    // 默认是斜线：退化盒不应当成为首次体验。
    expect(curve.start).toEqual({ x: 0, y: 0 })
    expect(curve.end).toEqual({ x: item.width.value, y: item.height.value })
  })

  it('OpenSpec: basic-materials / 基础 Entity Presets / 导线是红色粗实线', () => {
    const materials = createComposeBasicMaterials()
    const curve = materials.registry.createSeed('curve')
    const wire = materials.registry.createSeed('wire')
    if (!curve.ok || !wire.ok) throw new Error('curve 与 wire Preset 都必须可创建')
    const curveProps = getComposeRenderer({ id: 'curve', ...curve.seed })?.props ?? {}
    const wireProps = getComposeRenderer({ id: 'wire', ...wire.seed })?.props ?? {}
    expect(Number(wireProps.strokeWidth)).toBeGreaterThan(Number(curveProps.strokeWidth))
    /*
     * 颜色**必须不同**，而且必须是红：一次接线图里红 = 合闸/带电，而储能、光伏这类图画的是
     * 正常运行的系统，整条一次回路本来就是带电的。绿在这里表示分闸/停电，正好相反——这条
     * 断言同时挡住「顺手改回中性」与「照抄 PCB 原理图的绿」两种回退。
     */
    expect(wireProps.stroke).not.toBe(curveProps.stroke)
    expect(wireProps.stroke).toBe('#ff3b30')
    expect(wireProps.strokeLinecap).toBe(curveProps.strokeLinecap)
    expect(wireProps.markerStart).toBe(curveProps.markerStart)
    expect(wireProps.markerEnd).toBe(curveProps.markerEnd)
  })

  it('OpenSpec: basic-materials / 基础 Entity Presets / 四个曲线起点共用一个 Renderer', () => {
    const materials = createComposeBasicMaterials()
    const types = ['curve', 'arrow', 'circle', 'wire'].map((id) => {
      const seed = materials.registry.createSeed(id)
      if (!seed.ok) throw new Error(`${id} Preset 必须可创建`)
      expect(getComposeCurve({ id, ...seed.seed })).toBeDefined()
      return getComposeRenderer({ id, ...seed.seed })?.type
    })
    expect(new Set(types)).toEqual(new Set(['curve']))
  })

  it('OpenSpec: basic-materials / 曲线按 viewBox 跟随盒伸缩 / 曲线有盒手柄', () => {
    const { entity } = curveSeed()
    // 曾经写死 `resize: 'none'`，理由是「盒缩放该不该等比缩放几何点还没定」。定了：盒自由，
    // 几何按 viewBox 与盒的比例呈现，因此曲线走所有 Entity 共用的那一条缩放路径。
    expect(entity.components.GeometryConstraints).toBeUndefined()
  })

  it('渲染读 Curve Component 而不是 Renderer props', () => {
    const { entity, materials } = curveSeed()
    const moved: ComposeEntity = {
      ...entity,
      components: {
        ...entity.components,
        Curve: { kind: 'line', start: { x: 5, y: 7 }, end: { x: 60, y: 90 } },
      },
    }
    render(
      <ComposeRegistryEntityRenderer entity={moved} mode="editor" registry={materials.registry} />,
    )
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke).toHaveAttribute('x1', '5')
    expect(stroke).toHaveAttribute('y1', '7')
    expect(stroke).toHaveAttribute('x2', '60')
    expect(stroke).toHaveAttribute('y2', '90')
  })

  it('命中交给透明加宽 stroke，盒本身不拦截点击', () => {
    const { entity, materials } = curveSeed()
    render(
      <ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />,
    )
    const hit = screen.getByTestId('compose-material-curve-hit')
    expect(hit).toHaveAttribute('stroke', 'transparent')
    expect(hit).toHaveAttribute('pointer-events', 'stroke')
    // 宽度是容差的两倍，且事实来源在 core——本包另取一个数会与 Stage 的拾取框漂移。
    expect(Number(hit.getAttribute('stroke-width')))
      .toBe(COMPOSE_CURVE_PICK_TOLERANCE * 2)
    // 命中层的 cap 与描边层刻意不同：`round` 会让命中区从两端各伸出半个带宽，成为包围盒的
    // 超集，而端点正是接线图上密度最高的地方。
    expect(hit).toHaveAttribute('stroke-linecap', 'butt')
  })

  it('Inspector 编辑端点派发几何漏斗命令，坐标是 parent 局部', () => {
    const { entity, materials } = curveSeed()
    const positioned: ComposeEntity = {
      ...entity,
      components: {
        ...entity.components,
        LayoutItem: {
          ...(entity.components.LayoutItem as Record<string, unknown>),
          offset: { x: 100, y: 40 },
        },
      },
    }
    const dispatch = vi.fn()
    render(
      <ComposeRegistryComponentInspector
        componentKey="Curve"
        dispatch={dispatch}
        entity={positioned}
        readOnly={false}
        registry={materials.registry}
      />,
    )
    // 面板显示 parent 局部坐标：盒局部 (0,0) 加上 offset。
    const startX = screen.getAllByRole('spinbutton')[0]!
    expect(startX).toHaveValue(100)

    fireEvent.change(startX, { target: { value: '130' } })
    fireEvent.blur(startX)

    const calls = dispatch.mock.calls
    const command = calls[calls.length - 1]?.[0]
    expect(command?.type).toBe(BUILTIN_COMMAND_TYPES.setCurve)
    expect(command?.payload).toMatchObject({
      entityId: 'curve-1',
      curve: { kind: 'line', start: { x: 130, y: 40 } },
    })
  })

  it('描边走 Renderer props Inspector', () => {
    const { entity, materials } = curveSeed()
    render(
      <ComposeRegistryRendererInspector
        dispatch={vi.fn()}
        entity={entity}
        propCategory={{ id: 'stroke', label: '描边' }}
        readOnly={false}
        registry={materials.registry}
      />,
    )
    expect(screen.getByRole('spinbutton', { name: '线条粗细' })).toHaveValue(1)
    expect(screen.getByRole('combobox', { name: '线条样式' })).toHaveValue('none')
  })
})

describe('curve 物料的弧与多段线渲染', () => {
  function withCurve(curve: unknown, props?: Record<string, unknown>) {
    const { entity, materials } = curveSeed()
    const renderer = entity.components.Renderer as { readonly props?: Record<string, unknown> }
    return {
      materials,
      entity: {
        ...entity,
        components: {
          ...entity.components,
          Curve: curve,
          ...(props
            ? { Renderer: { ...renderer, props: { ...renderer.props, ...props } } }
            : {}),
        },
      } as ComposeEntity,
    }
  }

  it('OpenSpec: basic-materials / curve 物料 / 整圆用 circle 渲染', () => {
    const { entity, materials } = withCurve({
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 50,
      startAngle: 0,
      sweep: 360,
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    // SVG 的 `A` 命令在起终点重合时画不出东西——整圆是这条判断里唯一需要分支的地方。
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.tagName.toLowerCase()).toBe('circle')
    expect(stroke).toHaveAttribute('r', '50')
  })

  it('非整圆的弧用 path 渲染', () => {
    const { entity, materials } = withCurve({
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 50,
      startAngle: 0,
      sweep: 90,
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.tagName.toLowerCase()).toBe('path')
    expect(stroke.getAttribute('d')).toMatch(/^M .+ A 50 50 /)
  })

  it('OpenSpec: basic-materials / curve 物料 / 多段线是一个元素', () => {
    const { entity, materials } = withCurve({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }],
      closed: false,
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    // 一条多段线在 DOM 里是一个元素而不是 N 个 `<line>`，命中由加宽 stroke 承担。
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.tagName.toLowerCase()).toBe('polyline')
    expect(stroke).toHaveAttribute('points', '0,0 40,0 40,40 0,40')
  })

  it('闭合多段线用 polygon 渲染', () => {
    const { entity, materials } = withCurve({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }],
      closed: true,
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    expect(screen.getByTestId('compose-material-curve-stroke').tagName.toLowerCase())
      .toBe('polygon')
  })

  it('OpenSpec: basic-materials / 圆角多段线走 path，缺席时一个字节不变', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 60 }, { x: 0, y: 60 }]
    const sharp = withCurve({ kind: 'polyline', vertices, closed: true })
    const { unmount } = render(
      <ComposeRegistryEntityRenderer entity={sharp.entity} mode="editor" registry={sharp.materials.registry} />,
    )
    expect(screen.getByTestId('compose-material-curve-stroke').tagName.toLowerCase())
      .toBe('polygon')
    unmount()

    const rounded = withCurve({ kind: 'polyline', vertices, closed: true, cornerRadius: 12 })
    render(
      <ComposeRegistryEntityRenderer entity={rounded.entity} mode="editor" registry={rounded.materials.registry} />,
    )
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.tagName.toLowerCase()).toBe('path')
    // 四条直段加四段角弧，闭合再补一个 Z；角弧恒不超过 180°，因此 large-arc 全是 0。
    const d = stroke.getAttribute('d')!
    expect(d.match(/A /g)).toHaveLength(4)
    expect(d.match(/L /g)).toHaveLength(4)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('命中元素与可见元素同形，且仍是透明加宽 stroke', () => {
    const { entity, materials } = withCurve({
      kind: 'arc',
      center: { x: 50, y: 50 },
      radius: 50,
      startAngle: 0,
      sweep: 360,
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    const hit = screen.getByTestId('compose-material-curve-hit')
    expect(hit.tagName.toLowerCase()).toBe('circle')
    expect(hit).toHaveAttribute('stroke', 'transparent')
    expect(hit).toHaveAttribute('pointer-events', 'stroke')
  })

  it('OpenSpec: materials / 曲线线宽 / 线宽反向除掉画布缩放，虚线不除', () => {
    const { entity, materials } = withCurve({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 30 },
    })
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    // 线宽是显示宽度，必须除掉画布缩放；`--compose-canvas-zoom` 缺席即 1，因此预览与任何
    // 不发这个变量的宿主自动回到页面单位。属性上仍是作者写的那个数（页面单位）。
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.getAttribute('style'))
      .toContain('calc(1px / var(--compose-canvas-zoom, 1))')
    expect(stroke).toHaveAttribute('stroke-width', '1')

    // 命中容差表达的是鼠标能点多准，同样是屏幕量。
    expect(screen.getByTestId('compose-material-curve-hit').getAttribute('style'))
      .toContain(`calc(${COMPOSE_CURVE_PICK_TOLERANCE * 2}px / var(--compose-canvas-zoom, 1))`)
  })

  it('虚线间隔留在世界单位', () => {
    const { entity, materials } = withCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
      { strokeDasharray: '8 4' },
    )
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    // 间隔是图上的实际长度（AutoCAD 的 linetype），跟着缩放变才携带长度信息——与线宽相反。
    // 一个除一个不除是有意的，不是漏写。
    // 图案由作者写的线宽推出（4 倍划、2 倍空），单位是**世界**——线宽已经改成屏幕像素，
    // 这里刻意不跟着走。
    const dash = screen.getByTestId('compose-material-curve-stroke').getAttribute('stroke-dasharray')
    expect(dash).toBe('4 2')
    expect(screen.getByTestId('compose-material-curve-stroke').getAttribute('style'))
      .not.toContain('stroke-dasharray')
  })

  it('OpenSpec: basic-materials / 曲线的虚线偏移 / 缺席即不偏移', () => {
    // 引入 `strokeDashoffset` 之前的曲线不写这个 prop，渲染输出必须与那时逐字一致——
    // 这是决策 A 的回归护栏：新属性不许让任何既有文档动一下。
    const { entity, materials } = withCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
      { strokeDasharray: '8 4' },
    )
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    expect(screen.getByTestId('compose-material-curve-stroke'))
      .not.toHaveAttribute('stroke-dashoffset')
  })

  it('OpenSpec: basic-materials / 曲线的虚线偏移 / 写成 0 与缺席同结果', () => {
    // 偏移 0 就是不偏移。两者渲染出不同的属性集会让「设过」与「没设过」在 DOM 上可分，
    // 而它们在屏幕上一模一样。
    const { entity, materials } = withCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
      { strokeDasharray: '8 4', strokeDashoffset: 0 },
    )
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    expect(screen.getByTestId('compose-material-curve-stroke'))
      .not.toHaveAttribute('stroke-dashoffset')
  })

  it('OpenSpec: basic-materials / 曲线的虚线偏移 / 偏移与图案同单位，负值合法', () => {
    const { entity, materials } = withCurve(
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
      { strokeDasharray: '8 4', strokeDashoffset: -6 },
    )
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)

    const stroke = screen.getByTestId('compose-material-curve-stroke')
    // 负值把图案朝线的终点推，正是「流动」要的方向，因此不钳制符号。
    expect(stroke).toHaveAttribute('stroke-dashoffset', '-6')
    // 偏移沿着图案量，必须与 `strokeDasharray` 同单位——两者都不除画布缩放。
    expect(stroke.getAttribute('style')).not.toContain('stroke-dashoffset')
  })
})

describe('OpenSpec: basic-materials / 曲线按 viewBox 跟随盒伸缩', () => {
  /**
   * 渲染一条几何紧包围盒为 100×100 的对角线。
   *
   * @remarks
   * 断言的数值与 `stage-engine` 的 `curve-hit.test.ts` **是同一组**：渲染侧证明浏览器会怎么
   * 拉伸，索引侧证明命中跟着同一个比例走。两侧各做各的变换，只验一边挡不住分叉。
   */
  function renderDiagonal() {
    const { entity, materials } = curveSeed()
    const stretched: ComposeEntity = {
      ...entity,
      components: {
        ...entity.components,
        Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
      },
    }
    render(
      <ComposeRegistryEntityRenderer
        entity={stretched}
        mode="editor"
        registry={materials.registry}
      />,
    )
    // 盒尺寸由宿主写在外层节点上，物料只负责取景框——因此这里不需要造一个盒。
    return { node: screen.getByTestId(`compose-material-curve-${entity.id}`) }
  }

  it('取景框是几何的紧包围盒，且允许非等比拉伸', () => {
    const { node } = renderDiagonal()

    expect(node).toHaveAttribute('viewBox', '0 0 100 100')
    // 默认值会保持长宽比并留白，那样盒变了形状却不跟着变，等于这条能力没有生效。
    expect(node).toHaveAttribute('preserveAspectRatio', 'none')
  })

  it('描边不参与 viewBox 变换', () => {
    const { node } = renderDiagonal()

    // SVG 没有「只中和线宽、不中和虚线」的开关，因此规则收成一句：几何参与、描边不参与。
    for (const testId of ['compose-material-curve-hit', 'compose-material-curve-stroke']) {
      expect(node.querySelector(`[data-testid="${testId}"]`))
        .toHaveAttribute('vector-effect', 'non-scaling-stroke')
    }
  })

  it('水平线的取景框退化轴被钳住，不产生除零', () => {
    const { entity, materials } = curveSeed()
    const horizontal: ComposeEntity = {
      ...entity,
      components: {
        ...entity.components,
        Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 80, y: 0 } },
      },
    }
    render(
      <ComposeRegistryEntityRenderer
        entity={horizontal}
        mode="editor"
        registry={materials.registry}
      />,
    )

    expect(screen.getByTestId(`compose-material-curve-${entity.id}`))
      .toHaveAttribute('viewBox', '0 0 80 1')
  })
})

describe('junction Preset', () => {
  const { registry } = createComposeBasicMaterials()

  it('与导线共用同一个 Renderer，且带 Curve', () => {
    const junction = registry.createSeed('junction')
    const wire = registry.createSeed('wire')
    expect(junction.ok).toBe(true)
    expect(wire.ok).toBe(true)
    if (!junction.ok || !wire.ok) return
    const junctionRenderer = junction.seed.components.Renderer as { type: string }
    const wireRenderer = wire.seed.components.Renderer as { type: string }
    expect(junctionRenderer.type).toBe(wireRenderer.type)
    expect(junction.seed.components.Curve).toBeDefined()
  })

  it('是填实的整圆，并带恰好一个落在盒心的端口', () => {
    const created = registry.createSeed('junction')
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const curve = created.seed.components.Curve as { kind: string; sweep: number }
    expect(curve.kind).toBe('arc')
    expect(Math.abs(curve.sweep)).toBe(360)
    // 填实是节点对「曲线默认空心」的例外：空心的接头读作两个同心小圆圈。
    const appearance = created.seed.components.Appearance as { backgroundPaint: { color: string } }
    expect(appearance.backgroundPaint.color).not.toBe('transparent')
    const item = created.seed.components.LayoutItem as {
      width: { value: number }
      height: { value: number }
    }
    const ports = created.seed.components.Ports as {
      items: readonly { id: string; position: { x: number; y: number } }[]
    }
    expect(ports.items).toHaveLength(1)
    expect(ports.items[0]!.position).toEqual({
      x: item.width.value / 2,
      y: item.height.value / 2,
    })
  })

  it('直径跟着线宽走', () => {
    // 绝对值会让粗线把自己的接头盖住，因此直径必须由线宽推出。
    expect(composeJunctionSize(2).width).toBeLessThan(composeJunctionSize(6).width)
    expect(composeJunctionSize(2).width).toBe(2 * COMPOSE_JUNCTION_DIAMETER_RATIO)
  })

  it('默认不出现在 Palette', () => {
    expect(DEFAULT_COMPOSE_JUNCTION_PRESET.paletteHidden).toBe(true)
  })
})

/*
 * `path` 的判别性用例都围绕一句话：**全部子路径写进同一个 `d`**。拆成多个元素时形状看起来
 * 一样，只有带洞图形会露馅——因此这里断的是元素个数与 `fill-rule`，不是「画出来了」。
 */
describe('OpenSpec: basic-materials / curve 物料渲染并编辑曲线 Entity / path', () => {
  /** 外环加内环：`evenodd` 下内环是洞。 */
  const nested = {
    kind: 'path',
    subpaths: [ring(0, 0, 100), ring(25, 25, 50)],
    fillRule: 'evenodd',
  } as const

  function ring(x: number, y: number, size: number) {
    const corners = [
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ]
    let from = { x, y }
    const segments = corners.map((to) => {
      const segment = {
        c1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
        c2: { x: from.x + ((to.x - from.x) * 2) / 3, y: from.y + ((to.y - from.y) * 2) / 3 },
        to,
      }
      from = to
      return segment
    })
    return { start: { x, y }, segments, closed: true }
  }

  function pathEntity(curve: unknown): {
    readonly entity: ComposeEntity
    readonly materials: ReturnType<typeof createComposeBasicMaterials>
  } {
    const { entity, materials } = curveSeed()
    return {
      entity: { ...entity, components: { ...entity.components, Curve: curve as never } },
      materials,
    }
  }

  it('全部子路径写进同一个 d，只产出一个几何元素', () => {
    const { entity, materials } = pathEntity(nested)
    const { container } = render(
      <ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />,
    )
    // 描边层与命中层各一个，没有第三个——两条子路径没有被拆成两个元素。
    expect(container.querySelectorAll('path')).toHaveLength(2)
    const stroke = screen.getByTestId('compose-material-curve-stroke')
    expect(stroke.getAttribute('d')?.match(/M /g)).toHaveLength(2)
    expect(stroke.getAttribute('d')?.endsWith('Z')).toBe(true)
  })

  it('fill-rule 写在描边层与命中层上——洞不该接住点击', () => {
    const { entity, materials } = pathEntity(nested)
    render(
      <ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />,
    )
    expect(screen.getByTestId('compose-material-curve-stroke'))
      .toHaveAttribute('fill-rule', 'evenodd')
    expect(screen.getByTestId('compose-material-curve-hit'))
      .toHaveAttribute('fill-rule', 'evenodd')
  })

  it('缺席 fillRule 时不写这个属性——缺席与显式 nonzero 是同一件事', () => {
    const { entity, materials } = pathEntity({ kind: 'path', subpaths: [ring(0, 0, 100)] })
    render(
      <ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />,
    )
    expect(screen.getByTestId('compose-material-curve-stroke'))
      .not.toHaveAttribute('fill-rule')
  })

  it('Inspector 不为 path 列出逐控制点字段', () => {
    const { entity, materials } = pathEntity(nested)
    render(
      <ComposeRegistryComponentInspector
        componentKey="Curve"
        dispatch={vi.fn()}
        entity={entity}
        readOnly={false}
        registry={materials.registry}
      />,
    )
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })
})
