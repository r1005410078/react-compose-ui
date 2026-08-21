import { describe, expect, it } from 'vitest'
import type { ComposeDocument, ComposeEntity } from '@compose-ui/core'
import {
  isStageSelectionEditable,
  isStageSelectionRotatable,
  resolveStageResizeHandles,
  resolveStageSelectionConstraints,
  unlockedStageIds,
} from './stage-selection-derivations'

interface Options {
  readonly resize?: 'free' | 'none' | 'horizontal' | 'vertical' | 'preserve-aspect'
  readonly rotatable?: boolean
  readonly locked?: boolean
  readonly visible?: boolean
  readonly rendererType?: string
}

function entity(id: string, options: Options = {}): ComposeEntity {
  const {
    locked = false,
    rendererType = 'rectangle',
    resize = 'free',
    rotatable = true,
    visible = true,
  } = options
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      GeometryConstraints: { resize, rotatable, movable: true },
      Renderer: { type: rendererType, props: {} },
      Visibility: { visible },
      Lock: { locked },
    },
  } as unknown as ComposeEntity
}

function doc(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: {} as ComposeDocument['canvas'],
    rootIds: entities.map((item) => item.id),
    entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  }
}

describe('OpenSpec: stage / 选区派生可独立求值', () => {
  it('组件实例即使落盘为 resize:none 也按 free 处理', () => {
    // 旧实例可能仍带 resize:none，但页面组合必须始终可四角缩放。
    const value = doc([entity('a', { resize: 'none', rendererType: 'component-instance' })])
    const constraints = resolveStageSelectionConstraints(value, ['a'])

    expect(constraints[0]!.resize).toBe('free')
    expect(resolveStageResizeHandles(constraints).visible).toEqual(['ne', 'se', 'sw', 'nw'])
  })

  it('free 只画四角，边方向仍可拖动', () => {
    const constraints = resolveStageSelectionConstraints(doc([entity('a')]), ['a'])
    const { enabled, visible } = resolveStageResizeHandles(constraints)

    expect(enabled).toEqual(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])
    expect(visible).toEqual(['ne', 'se', 'sw', 'nw'])
  })

  it('horizontal 没有角可用，因此把边控点画出来', () => {
    const constraints = resolveStageSelectionConstraints(
      doc([entity('a', { resize: 'horizontal' })]),
      ['a'],
    )
    const { enabled, visible } = resolveStageResizeHandles(constraints)

    expect(enabled).toEqual(['e', 'w'])
    expect(visible).toEqual(['e', 'w'])
  })

  it('多选取交集：任一项禁止即整体不可用', () => {
    const value = doc([
      entity('a', { resize: 'horizontal' }),
      entity('b', { resize: 'vertical' }),
    ])
    const constraints = resolveStageSelectionConstraints(value, ['a', 'b'])

    expect(resolveStageResizeHandles(constraints).enabled).toEqual([])
  })

  it('resize:none 不产生任何手柄', () => {
    const constraints = resolveStageSelectionConstraints(
      doc([entity('a', { resize: 'none' })]),
      ['a'],
    )
    expect(resolveStageResizeHandles(constraints).enabled).toEqual([])
  })

  it('空选区不可旋转，全体可旋转才算可旋转', () => {
    const value = doc([entity('a'), entity('b', { rotatable: false })])

    expect(isStageSelectionRotatable([])).toBe(false)
    expect(isStageSelectionRotatable(resolveStageSelectionConstraints(value, ['a']))).toBe(true)
    expect(isStageSelectionRotatable(resolveStageSelectionConstraints(value, ['a', 'b'])))
      .toBe(false)
  })

  it('「整体可编辑」要求全体合格，「未锁定项」只做过滤', () => {
    const value = doc([
      entity('a'),
      entity('locked', { locked: true }),
      entity('hidden', { visible: false }),
    ])

    expect(isStageSelectionEditable(value, [])).toBe(false)
    expect(isStageSelectionEditable(value, ['a'])).toBe(true)
    expect(isStageSelectionEditable(value, ['a', 'locked'])).toBe(false)
    expect(isStageSelectionEditable(value, ['a', 'hidden'])).toBe(false)
    // 过滤只看锁定：隐藏项仍是合法的命令目标。
    expect(unlockedStageIds(value, ['a', 'locked', 'hidden'])).toEqual(['a', 'hidden'])
  })

  it('选区里不存在的 ID 被跳过而不是产生空约束', () => {
    const value = doc([entity('a')])
    expect(resolveStageSelectionConstraints(value, ['a', 'ghost'])).toHaveLength(1)
    expect(unlockedStageIds(value, ['a', 'ghost'])).toEqual(['a'])
    expect(isStageSelectionEditable(value, ['a', 'ghost'])).toBe(false)
  })
})
