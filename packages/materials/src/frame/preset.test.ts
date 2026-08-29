import { describe, expect, it } from 'vitest'
import { createContainerPreset } from '../container/preset'
import { createFramePreset } from './preset'

describe('OpenSpec: basic-materials / 场景 Entity Preset', () => {
  it('场景 Preset 默认 Clip 为不裁剪，与「新建场景」命令及初始场景一致', () => {
    const components = createFramePreset().createComponents()
    expect(components.Clip).toEqual({
      enabled: false,
      horizontal: 'visible',
      vertical: 'visible',
    })
    // 场景语义不受影响：仍是携带 Frame 的容器组合。
    expect(components.Frame).toBeDefined()
    expect(components.Hierarchy).toEqual({ childIds: [] })
  })

  it('场景 Preset 背景透明而容器不透明', () => {
    // 场景背景是会被发布出去的真实像素，由用户决定用什么底；两者同色时用户读不出手上这块
    // 到底是场景还是容器。
    const scene = createFramePreset().createComponents().Appearance
    const container = createContainerPreset().createComponents().Appearance

    expect(scene).toMatchObject({ backgroundPaint: { kind: 'solid', color: 'transparent' } })
    expect(container).not.toMatchObject({
      backgroundPaint: { kind: 'solid', color: 'transparent' },
    })
  })
})
