import { describe, expect, it } from 'vitest'
import {
  COMPOSE_SCENE_SIZE_PRESETS,
  COMPOSE_SNAP_RADIUS,
  formatComposeAspectRatio,
  snapComposeScreenSize,
} from './frame'

const FULL_HD = { width: 1920, height: 1080 }

describe('formatComposeAspectRatio', () => {
  it('最简分数命中通名表时写精确通名', () => {
    expect(formatComposeAspectRatio(FULL_HD)).toBe('16:9')
    expect(formatComposeAspectRatio({ width: 1440, height: 900 })).toBe('16:10')
    expect(formatComposeAspectRatio({ width: 1024, height: 768 })).toBe('4:3')
  })

  it('只是接近通名时写 ~，不写成精确值', () => {
    // 1366 × 768 约掉是 683:384，只是接近 16:9。写成精确的 16:9 会让用户以为换到
    // 1920 × 1080 不改变形状。
    expect(formatComposeAspectRatio({ width: 1366, height: 768 })).toBe('~16:9')
  })

  it('组件那类小盒子同样给得出通名', () => {
    expect(formatComposeAspectRatio({ width: 88, height: 132 })).toBe('2:3')
  })

  it('落在通名表外时退回最简分数，分母过大才退回小数', () => {
    expect(formatComposeAspectRatio({ width: 1000, height: 800 })).toBe('5:4')
    expect(formatComposeAspectRatio({ width: 1000, height: 371 })).toBe('2.7:1')
  })

  it('没有答案时不编一个', () => {
    expect(formatComposeAspectRatio({ width: 100, height: 0 })).toBe('')
  })
})

describe('snapComposeScreenSize', () => {
  it('落在预设容差内时吸附到该预设并报告命中了谁', () => {
    const result = snapComposeScreenSize({ width: 1274, height: 716 }, {
      targetSize: FULL_HD,
      zoom: 1,
    })
    expect(result.size).toEqual({ width: 1280, height: 720 })
    expect(result.snapped?.kind).toBe('preset')
    expect(result.snapped?.preset?.name).toBe('HD')
  })

  it('目标自身尺寸压过距离更近的预设', () => {
    // 目标 1288 × 724 距落点 8.5px，预设 1280 × 720 只有 2.8px——优先级严格先于距离。
    const result = snapComposeScreenSize({ width: 1282, height: 722 }, {
      targetSize: { width: 1288, height: 724 },
      zoom: 1,
    })
    expect(result.snapped?.kind).toBe('target')
    expect(result.size).toEqual({ width: 1288, height: 724 })
  })

  it('容差按屏幕距离折算：同一个分辨率差在不同缩放下结果不同', () => {
    const size = { width: 1280 + 20, height: 720 }
    expect(snapComposeScreenSize(size, { targetSize: FULL_HD, zoom: 1 }).snapped).toBeNull()
    expect(snapComposeScreenSize(size, { targetSize: FULL_HD, zoom: 0.25 }).snapped?.preset?.name)
      .toBe('HD')
  })

  it('宽命中而高不命中不吸附——预设是一整个分辨率', () => {
    const result = snapComposeScreenSize({ width: 1280, height: 900 }, {
      targetSize: FULL_HD,
      zoom: 1,
    })
    expect(result.snapped).toBeNull()
    expect(result.size).toEqual({ width: 1280, height: 900 })
  })

  it('未命中时返回取整并钳过下限的输入值', () => {
    const result = snapComposeScreenSize({ width: 1000.4, height: -5 }, {
      targetSize: FULL_HD,
      zoom: 1,
    })
    expect(result).toEqual({ size: { width: 1000, height: 1 }, snapped: null })
  })

  it('目标尺寸带小数时吸附回它逐位相等，不被取整挪走', () => {
    const targetSize = { width: 1920.5, height: 1080.25 }
    const result = snapComposeScreenSize({ width: 1921, height: 1080 }, { targetSize, zoom: 1 })
    expect(result.size).toBe(targetSize)
  })

  it('目标恰好是某个预设时不产生两个候选，并带上它的通名', () => {
    const result = snapComposeScreenSize({ width: 1919, height: 1081 }, {
      targetSize: FULL_HD,
      zoom: 1,
    })
    expect(result.snapped?.kind).toBe('target')
    expect(result.snapped?.preset?.name).toBe('Full HD')
  })

  it('zoom 非正时不吸附', () => {
    expect(snapComposeScreenSize(FULL_HD, { targetSize: FULL_HD, zoom: 0 }).snapped).toBeNull()
  })

  it('默认容差就是 COMPOSE_SNAP_RADIUS', () => {
    const justInside = { width: 1920 - (COMPOSE_SNAP_RADIUS - 1), height: 1080 }
    const justOutside = { width: 1920 - (COMPOSE_SNAP_RADIUS + 1), height: 1080 }
    expect(snapComposeScreenSize(justInside, { targetSize: FULL_HD, zoom: 1 }).snapped).not.toBeNull()
    expect(snapComposeScreenSize(justOutside, { targetSize: FULL_HD, zoom: 1 }).snapped).toBeNull()
  })

  it('候选预设可以由调用方替换', () => {
    const result = snapComposeScreenSize({ width: 3838, height: 1081 }, {
      targetSize: FULL_HD,
      zoom: 1,
      presets: [...COMPOSE_SCENE_SIZE_PRESETS, {
        id: '3840x1080',
        name: '双拼',
        size: { width: 3840, height: 1080 },
      }],
    })
    expect(result.snapped?.preset?.name).toBe('双拼')
  })
})
