import { describe, expect, it } from 'vitest'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'

/*
 * 注册表本身的排序与去重语义住在 `@compose-ui/interaction-kernel` 的用例里。这里只锁定
 * Stage 自己的那张优先级表——顺序即语义，写错会静默改变「同一次按下由谁接管」。
 */

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 优先级表锁定', () => {
  /*
   * 这张表抄自 begin() 级联的实际行序，顺序即语义。本变更阶段它尚未生效（legacy 内部仍走
   * 原级联），这里先锁定，等步骤 3 拆出第二个插件时才承担仲裁职责。
   */
  it('顺序与 begin() 级联的行序一致', () => {
    expect(STAGE_GESTURE_PRIORITY.map(({ id }) => id)).toEqual([
      'text-edit-guard',
      'pan',
      'drafting-point',
      'paint-sample',
      'path',
      'paint',
      'curve-corner',
      'gizmo',
      'draw',
      'geometry-edit-fallback',
      'hollow-move-fallback',
      'marquee-converge',
      'entity-select-move',
      'resize',
      'guide-create',
      'guide-move',
      'marquee-fallback',
    ])
  })

  it('priority 严格递减，且与抄录的原行号同序', () => {
    for (let i = 1; i < STAGE_GESTURE_PRIORITY.length; i += 1) {
      const previous = STAGE_GESTURE_PRIORITY[i - 1]!
      const current = STAGE_GESTURE_PRIORITY[i]!
      expect(previous.priority).toBeGreaterThan(current.priority)
    }
  })

  it('抄录而来的项行号同序', () => {
    // 行号同序是抄录正确性的独立校验：级联在源文件里是自上而下的。后来新增的插件没有原行号，
    // 因此只在带行号的项之间比较。
    const transcribed = STAGE_GESTURE_PRIORITY
      .filter((entry): entry is typeof entry & { readonly sourceLine: number } =>
        entry.sourceLine !== undefined)
    for (let i = 1; i < transcribed.length; i += 1) {
      expect(transcribed[i - 1]!.sourceLine).toBeLessThan(transcribed[i]!.sourceLine)
    }
  })

  it('id 唯一，可直接作为注册表键', () => {
    const ids = STAGE_GESTURE_PRIORITY.map(({ id }) => id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
