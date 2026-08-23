import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  ComposeRegistryComponentInspector,
  ComposeRegistryEntityRenderer,
  ComposeRegistryRendererInspector,
} from '@compose-ui/component-registry'
import {
  BUILTIN_COMMAND_TYPES,
  getComposeCurve,
  getComposeLayoutItem,
  type ComposeEntity,
} from '@compose-ui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../create-basic-materials'

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

  it('v1 不接受盒 resize', () => {
    const { entity } = curveSeed()
    expect(entity.components.GeometryConstraints).toMatchObject({ resize: 'none' })
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
    // 细线的视觉宽度只有 2px，命中宽度必须显著更大，否则用户会反复点空。
    expect(Number(hit.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(12)
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
    expect(screen.getByRole('spinbutton', { name: '线条粗细' })).toHaveValue(2)
    expect(screen.getByRole('combobox', { name: '线条样式' })).toHaveValue('none')
  })
})

describe('curve 物料的弧与多段线渲染', () => {
  function withCurve(curve: unknown) {
    const { entity, materials } = curveSeed()
    return {
      materials,
      entity: { ...entity, components: { ...entity.components, Curve: curve } } as ComposeEntity,
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

    // CAD 侧一条多段线在 DOM 里是 N 个 `<line>`；页面这边是一个元素，命中由加宽 stroke 承担。
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

  it('OpenSpec: materials / 曲线线宽 / 编辑画布按屏幕像素、预览按页面单位', () => {
    const { entity, materials } = withCurve({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 40, y: 30 },
    })

    // Stage 的 Scene 靠 `transform: scale(zoom)` 整体缩放，描边会被一起乘；命中容差同理。
    render(<ComposeRegistryEntityRenderer entity={entity} mode="editor" registry={materials.registry} />)
    expect(screen.getByTestId('compose-material-curve-stroke'))
      .toHaveAttribute('vector-effect', 'non-scaling-stroke')
    expect(screen.getByTestId('compose-material-curve-hit'))
      .toHaveAttribute('vector-effect', 'non-scaling-stroke')

    cleanup()

    // 预览可能被宿主的 `fit` 整体缩放，非缩放描边会让它不再是页面的忠实缩略图。
    render(<ComposeRegistryEntityRenderer entity={entity} mode="preview" registry={materials.registry} />)
    expect(screen.getByTestId('compose-material-curve-stroke'))
      .not.toHaveAttribute('vector-effect')
  })
})
