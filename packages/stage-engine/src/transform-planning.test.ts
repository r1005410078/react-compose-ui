import { describe, expect, it } from 'vitest'
import { getComposeLayoutItem, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from './test-fixtures'
import { planTransformCommit, resolveTransformTargets } from './transform-planning'
import type { StageTransform } from './geometry'

/*
 * 这两段逻辑此前埋在 begin()/finish() 的闭包里，只能经由完整手势间接覆盖。抽成纯函数后
 * 这里直接钉住它们编码的业务规则。
 */

interface PlannedUpdate {
  readonly transform: { readonly position: { readonly x: number; readonly y: number }; readonly size: { readonly width: number; readonly height: number }; readonly rotation: number }
}

/** 从规划出的 effect 中取出 setTransform 的 updates；先用判别式收窄再取 payload。 */
function commandUpdates(effect: ReturnType<typeof planTransformCommit>): readonly PlannedUpdate[] {
  if (effect?.type !== 'command.dispatch') throw new Error('期望一条 command.dispatch effect')
  const payload = effect.command.payload as unknown as { readonly updates: readonly PlannedUpdate[] }
  return payload.updates
}

function indexOf(value: ComposeDocument) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

/** StageTransform 是扁平世界盒；toComposeTransform 才把它转成 position/size 形状。 */
function transformOf(overrides: Partial<StageTransform> = {}): StageTransform {
  return { x: 200, y: 300, width: 400, height: 250, rotation: 0, ...overrides }
}

/** 把 Entity 的 LayoutItem 改成 Flow，用于验证 move 的 Flow 排除规则。 */
function asFlow(source: ComposeEntity): ComposeEntity {
  const item = getComposeLayoutItem(source)
  return {
    ...source,
    components: {
      ...source.components,
      LayoutItem: { ...item, positioning: 'flow' },
    },
  }
}

describe('OpenSpec: stage-engine / 受约束变换 System / 目标解析可脱离会话调用', () => {
  it('按 resize 模式与手柄配对过滤', () => {
    const value = document([entity('h', { resize: 'horizontal' })])
    const index = indexOf(value)

    const east = resolveTransformTargets({ document: value, index, type: 'resize', ids: ['h'], handle: 'e' })
    const north = resolveTransformTargets({ document: value, index, type: 'resize', ids: ['h'], handle: 'n' })

    expect(east?.editableIds).toEqual(['h'])
    // 只允许水平方向的目标不接受南北手柄，因此没有可变换目标。
    expect(north).toBeNull()
  })

  it('preserve-aspect 只接受四角手柄', () => {
    const value = document([entity('a', { resize: 'preserve-aspect' })])
    const index = indexOf(value)
    const at = (handle: 'ne' | 'e') =>
      resolveTransformTargets({ document: value, index, type: 'resize', ids: ['a'], handle })

    expect(at('ne')?.editableIds).toEqual(['a'])
    expect(at('e')).toBeNull()
  })

  it('resize:none 不可缩放但仍可移动与旋转', () => {
    const value = document([entity('a', { resize: 'none' })])
    const index = indexOf(value)
    const at = (type: 'resize' | 'move' | 'rotate') =>
      resolveTransformTargets({ document: value, index, type, ids: ['a'], handle: 'se' })

    expect(at('resize')).toBeNull()
    expect(at('move')?.editableIds).toEqual(['a'])
    expect(at('rotate')?.editableIds).toEqual(['a'])
  })

  it('锁定与不可见目标被排除', () => {
    const value = document([entity('locked', { locked: true }), entity('hidden', { visible: false, x: 300 })])
    const index = indexOf(value)

    expect(resolveTransformTargets({ document: value, index, type: 'move', ids: ['locked'] })).toBeNull()
    expect(resolveTransformTargets({ document: value, index, type: 'move', ids: ['hidden'] })).toBeNull()
  })

  it('没有目标时返回 null 而不是抛错', () => {
    const value = document([entity('a')])

    expect(resolveTransformTargets({ document: value, index: indexOf(value), type: 'move', ids: [] })).toBeNull()
  })

  it('bounds 是可变换目标的世界包围盒并集', () => {
    const value = document([entity('a', { x: 0, y: 0, width: 100, height: 50 }), entity('b', { x: 200, y: 100, width: 100, height: 50 })])

    const targets = resolveTransformTargets({ document: value, index: indexOf(value), type: 'move', ids: ['a', 'b'] })

    expect(targets?.bounds).toEqual({ x: 0, y: 0, width: 300, height: 150 })
  })
})

describe('OpenSpec: stage-engine / 受约束变换 System / 提交规划可脱离会话调用', () => {
  const plan = (value: ComposeDocument, finished: Parameters<typeof planTransformCommit>[0]['finished']) =>
    planTransformCommit({
      document: value,
      layoutSnapshot: layoutSnapshot(value),
      index: indexOf(value),
      finished,
      idFactory: () => 'cmd-1',
    })

  it('move 排除 Flow 目标', () => {
    const base = document([entity('a')])
    const value: ComposeDocument = {
      ...base,
      entities: { ...base.entities, a: asFlow(base.entities.a!) },
    }

    // Flow 目标的位置由 Auto Layout 决定，写 offset 只会留下无效值。
    expect(plan(value, { type: 'move', ids: ['a'], transforms: { a: transformOf() } })).toBeNull()
  })

  it('move 的非 Fill 轴保留持久尺寸', () => {
    const value = document([entity('a', { width: 100, height: 50 })])

    const effect = plan(value, { type: 'move', ids: ['a'], transforms: { a: transformOf() } })

    // 手势几何里是 400×250，但两轴都不是 Fill，因此不得把求解尺寸误记成一次 Resize。
    const updates = commandUpdates(effect)
    expect(updates[0]!.transform.size).toEqual({ width: 100, height: 50 })
    // 位置必须是实数：夹具形状写错时这里会变成 NaN。
    expect(Number.isFinite(updates[0]!.transform.position.x)).toBe(true)
  })

  it('resize 只让被拖动的轴取新尺寸', () => {
    const value = document([entity('a', { width: 100, height: 50 })])

    const effect = plan(value, {
      type: 'resize',
      ids: ['a'],
      handle: 'e',
      transforms: { a: transformOf() },
    })

    const updates = commandUpdates(effect)
    expect(updates[0]!.transform.size).toEqual({ width: 400, height: 50 })
  })

  it('rotate 的位置与尺寸都取持久值', () => {
    const value = document([entity('a', { x: 10, y: 20, width: 100, height: 50 })])

    const effect = plan(value, {
      type: 'rotate',
      ids: ['a'],
      transforms: { a: transformOf({ rotation: 30 }) },
    })

    const updates = commandUpdates(effect)
    expect(updates[0]!.transform.size).toEqual({ width: 100, height: 50 })
    expect(updates[0]!.transform.rotation).toBe(30)
  })

  it('命令声明正确的操作语义与目标', () => {
    const value = document([entity('a')])

    const effect = plan(value, { type: 'resize', ids: ['a'], handle: 'se', transforms: { a: transformOf() } })

    expect(effect).toMatchObject({
      type: 'command.dispatch',
      command: {
        id: 'cmd-1',
        payload: { operation: 'resize' },
        meta: { source: 'stage', targetIds: ['a'] },
      },
    })
  })

  it('没有更新时返回 null', () => {
    const value = document([entity('a')])

    expect(plan(value, { type: 'move', ids: [], transforms: {} })).toBeNull()
  })
})
