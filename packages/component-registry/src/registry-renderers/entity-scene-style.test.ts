import type { ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  composeEntityAppearanceStyle,
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
      transformOrigin: 'center',
    })
    expect(styled.overflow).toBeUndefined()
  })
})
