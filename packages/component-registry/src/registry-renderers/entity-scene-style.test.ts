import type { ComposeEntity, JsonObject } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { composeEntitySceneStyle, composeEntityVisualStyle } from './entity-scene-style'

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
  it('OpenSpec: 共享渲染语义 / 边框与阴影合成 boxShadow，裁剪决定 overflow', () => {
    const styled = composeEntityVisualStyle(entity({
      Appearance: {
        backgroundColor: '#102030',
        borderColor: '#405060',
        borderWidth: 2,
        borderRadius: 8,
        opacity: 0.5,
        shadow: { color: '#00000040', offsetX: 1, offsetY: 2, blur: 3, spread: 4 },
      },
    }))
    expect(styled.backgroundColor).toBe('#102030')
    expect(styled.borderRadius).toBe(8)
    expect(styled.opacity).toBe(0.5)
    expect(styled.boxShadow).toBe('inset 0 0 0 2px #405060, 1px 2px 3px 4px #00000040')
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
    const styled = composeEntitySceneStyle(entity({}))
    expect(styled).toMatchObject({
      left: 12,
      top: 34,
      width: 200,
      height: 100,
      transform: 'rotate(45deg)',
      transformOrigin: 'center',
      overflow: 'hidden',
    })
  })
})
