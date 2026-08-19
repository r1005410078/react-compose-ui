import { describe, expect, it } from 'vitest'
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
})
