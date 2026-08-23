import type { ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  composeEntityAppearanceStyle,
  composeEntityOverflowStyle,
  composeEntitySceneStyle,
  composeEntityVisualStyle,
} from './entity-scene-style'

function entity(components: Readonly<Record<string, JsonObject>>): ComposeEntity {
  return {
    id: 'entity-a',
    name: 'Entity',
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: {
        position: { x: 12, y: 34 },
        size: { width: 200, height: 100 },
        rotation: 45,
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      ...components,
    },
  }
}

describe('composeEntityVisualStyle', () => {
  it('OpenSpec: 共享外观与 overflow 行为解耦 / appearance 入口不决定 overflow', () => {
    const styled = composeEntityAppearanceStyle(entity({
      Hierarchy: { childIds: [] },
      Clip: { enabled: true, horizontal: 'scroll', vertical: 'clip' },
    }))
    expect(styled.overflow).toBeUndefined()
    expect(styled.overflowX).toBeUndefined()
    expect(styled.overflowY).toBeUndefined()
  })

  it('OpenSpec: 共享渲染语义 / 边框覆盖层与阴影独立渲染，裁剪决定 overflow', () => {
    const styled = composeEntityVisualStyle(entity({
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#102030' },
        borderColor: '#405060',
        borderWidth: 2,
        borderRadius: 8,
        opacity: 0.5,
        shadow: { color: '#00000040', offsetX: 1, offsetY: 2, blur: 3, spread: 4 },
      },
    }))
    // Solid 色也保留在 Entity 壳上：透明/纯色容器都拥有稳定的浏览器命中区域；
    // 渐变仍仅由共享 Paint Layer 渲染，避免 CSS/SVG 解释分叉。
    expect(styled.backgroundColor).toBe('#102030')
    expect(styled.borderRadius).toBe(8)
    expect(styled.opacity).toBe(0.5)
    expect(styled.isolation).toBe('isolate')
    expect(styled.outline).toBeUndefined()
    expect(styled.boxShadow).toBe('1px 2px 3px 4px #00000040')
    expect(styled.overflow).toBe('hidden')

    const plain = composeEntityVisualStyle(entity({}))
    expect(plain.backgroundColor).toBe('transparent')
    expect(plain.boxShadow).toBe('none')
  })

  it('曲线的填色不写进宿主盒：盒是矩形而形状不是', () => {
    const curve = composeEntityAppearanceStyle(entity({
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#2f7df6' },
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      },
      Renderer: { type: 'curve', props: {} },
      Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 60 } },
    }))
    // 颜色仍在文档里，由物料自己的 SVG `fill` 画出来。
    expect(curve.backgroundColor).toBe('transparent')

    const rectangle = composeEntityAppearanceStyle(entity({
      Appearance: {
        backgroundPaint: { kind: 'solid', color: '#2f7df6' },
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        opacity: 1,
        shadow: null,
      },
      Renderer: { type: 'rectangle', props: {} },
    }))
    expect(rectangle.backgroundColor).toBe('#2f7df6')
  })

  it('OpenSpec: 共享渲染语义 / Container 的 overflow 由 Clip 控制', () => {
    const clipped = composeEntityVisualStyle(entity({
      Hierarchy: { childIds: [] },
      Clip: { enabled: true },
    }))
    expect(clipped.overflow).toBe('hidden')

    const open = composeEntityVisualStyle(entity({
      Hierarchy: { childIds: [] },
      Clip: { enabled: false },
    }))
    expect(open.overflow).toBe('visible')

    const noClip = composeEntityVisualStyle(entity({ Hierarchy: { childIds: [] } }))
    expect(noClip.overflow).toBe('visible')
  })
})

describe('composeEntityOverflowStyle', () => {
  it('OpenSpec: 共享 Entity overflow 解析辅助 / 叶子 hidden、分轴 scroll→auto', () => {
    expect(composeEntityOverflowStyle(entity({}))).toEqual({ overflow: 'hidden' })

    const mixed = composeEntityOverflowStyle(entity({
      Hierarchy: { childIds: [] },
      Clip: { enabled: true, horizontal: 'scroll', vertical: 'clip' },
    }))
    expect(mixed).toEqual({ overflowX: 'auto', overflowY: 'hidden' })

    const bothScroll = composeEntityOverflowStyle(entity({
      Hierarchy: { childIds: [] },
      Clip: { enabled: true, horizontal: 'scroll', vertical: 'scroll' },
    }))
    expect(bothScroll).toEqual({ overflow: 'auto' })
  })

  it('OpenSpec: 共享 Entity overflow 解析辅助 / 带 Curve 的叶子不裁剪', () => {
    // 曲线的盒是几何的派生（紧包围盒），描边以几何为中心画，必然向外超出半个线宽。
    // 按叶子裁掉的后果是尖角被削平、端点圆头被切、水平线连命中都只剩几何那一条线。
    const curve = composeEntityOverflowStyle(entity({
      Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 30 } },
    }))
    expect(curve).toEqual({ overflow: 'visible' })

    // 普通叶子照旧裁剪——borderRadius 要靠它裁 Paint 与物料子层。
    expect(composeEntityOverflowStyle(entity({}))).toEqual({ overflow: 'hidden' })
  })
})

describe('composeEntitySceneStyle', () => {
  it('OpenSpec: 共享渲染语义 / Transform 映射为几何与旋转样式', () => {
    const styled = composeEntitySceneStyle(entity({}), {
      x: 12,
      y: 34,
      width: 200,
      height: 100,
      positioning: 'absolute',
    })
    expect(styled).toMatchObject({
      left: 12,
      top: 34,
      width: 200,
      height: 100,
      position: 'absolute',
      transform: 'rotate(45deg)',
      // 未设基点仍居中：零迁移护栏。
      transformOrigin: '50% 50%',
    })
    expect(styled.overflow).toBeUndefined()
  })

  it('OpenSpec: 共享渲染语义 / 基点反映到变换原点', () => {
    const styled = composeEntitySceneStyle(
      entity({ Transform: { rotation: 45, pivot: { x: 0, y: 0.5 } } }),
      { x: 12, y: 34, width: 200, height: 100, positioning: 'absolute' },
    )

    // 左边中点。Stage、Preview 与组件实例三条渲染路径共用本函数。
    expect(styled.transformOrigin).toBe('0% 50%')
  })
})
