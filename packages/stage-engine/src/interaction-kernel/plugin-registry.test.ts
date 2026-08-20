import { describe, expect, it } from 'vitest'
import { createStagePluginRegistry } from './plugin-registry'
import {
  STAGE_GESTURE_PRIORITY,
  STAGE_LEGACY_MONOLITH_PRIORITY,
} from './gesture-priority'
import type { StageInteractionPlugin } from './kernel-types'

function plugin(id: string, priority: number): StageInteractionPlugin {
  return { id, priority, claim: () => null }
}

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 注册表按优先级排序', () => {
  it('按 priority 降序排列', () => {
    const registry = createStagePluginRegistry([
      plugin('c', 1),
      plugin('a', 30),
      plugin('b', 20),
    ])

    expect(registry.ordered().map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  it('同优先级保持注册顺序', () => {
    const registry = createStagePluginRegistry([
      plugin('first', 10),
      plugin('second', 10),
      plugin('third', 10),
    ])

    expect(registry.ordered().map(({ id }) => id)).toEqual(['first', 'second', 'third'])
  })

  it('重复 id 被拒绝', () => {
    expect(() => createStagePluginRegistry([plugin('dup', 10), plugin('dup', 20)]))
      .toThrow(/Duplicate Stage interaction plugin id: dup/)
  })

  it('排序结果引用稳定，不在每次询问时重排', () => {
    const registry = createStagePluginRegistry([plugin('a', 10)])

    expect(registry.ordered()).toBe(registry.ordered())
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 优先级表锁定', () => {
  /*
   * 这张表抄自 begin() 级联的实际行序，顺序即语义。本变更阶段它尚未生效（legacy 内部仍走
   * 原级联），这里先锁定，等步骤 3 拆出第二个插件时才承担仲裁职责。
   */
  it('顺序与 begin() 级联的行序一致', () => {
    expect(STAGE_GESTURE_PRIORITY.map(({ id }) => id)).toEqual([
      'text-edit-guard',
      'pan',
      'rotate-tool',
      'paint-sample',
      'path',
      'paint',
      'segment-resize',
      'marquee-tool',
      'draw',
      'move-axis',
      'marquee-converge',
      'entity-select-move',
      'resize',
      'legacy-rotate-hit',
      'guide-create',
      'guide-move',
      'rotate-tool-fallback',
      'marquee-fallback',
    ])
  })

  it('priority 严格递减，且与抄录的原行号同序', () => {
    for (let i = 1; i < STAGE_GESTURE_PRIORITY.length; i += 1) {
      const previous = STAGE_GESTURE_PRIORITY[i - 1]!
      const current = STAGE_GESTURE_PRIORITY[i]!
      expect(previous.priority).toBeGreaterThan(current.priority)
      // 行号同序是抄录正确性的独立校验：级联在源文件里是自上而下的。
      expect(previous.sourceLine).toBeLessThan(current.sourceLine)
    }
  })

  it('legacy 单体插件排在全部真实插件之后', () => {
    const lowest = Math.min(...STAGE_GESTURE_PRIORITY.map(({ priority }) => priority))

    expect(STAGE_LEGACY_MONOLITH_PRIORITY).toBeLessThan(lowest)
  })

  it('id 唯一，可直接作为注册表键', () => {
    const ids = STAGE_GESTURE_PRIORITY.map(({ id }) => id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
