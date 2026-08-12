import type { ComposeEntity, ComposeFlexLayout } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { applyChildReorder, resolveStageDropTarget } from './drop-target'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from './test-fixtures'

/** 带 Auto Layout 的容器；boxes 由 offset/size 派生，因此 offset 即已求解的局部位置。 */
function layoutContainer(
  id: string,
  options: {
    readonly x?: number
    readonly y?: number
    readonly width: number
    readonly height: number
    readonly childIds: readonly string[]
    readonly layout?: Partial<ComposeFlexLayout>
  },
): ComposeEntity {
  const base = entity(id, {
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width,
    height: options.height,
    childIds: options.childIds,
  })
  return {
    ...base,
    components: {
      ...base.components,
      Layout: {
        type: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignContent: 'stretch',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        rowGap: 0,
        columnGap: 0,
        ...options.layout,
      },
    },
  }
}

function flowChild(id: string, x: number, y: number, width: number, height: number): ComposeEntity {
  const base = entity(id, { x, y, width, height })
  return {
    ...base,
    components: {
      ...base.components,
      LayoutItem: { ...base.components.LayoutItem, positioning: 'flow' },
    },
  } as ComposeEntity
}

function indexFor(entities: readonly ComposeEntity[], rootIds: readonly string[]) {
  const value = document(entities, rootIds)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage-engine / 画布拖拽 reparent 会话', () => {
  it('指针深入目标容器内部时给出 reparent 落点', () => {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 500, y: 100 },
      zoom: 1,
    })).toEqual({ kind: 'reparent', containerId: 'target' })
  })

  it('贴边掠过不产生落点', () => {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])

    // 距左边缘 4px < 16px 留白。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 404, y: 100 },
      zoom: 1,
    })).toBeNull()
  })

  it('留白按屏幕像素定义，缩小后所需世界距离变大', () => {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])
    const worldPoint = { x: 420, y: 100 }

    expect(resolveStageDropTarget({ index, draggedIds: ['dragged'], worldPoint, zoom: 1 }))
      .toEqual({ kind: 'reparent', containerId: 'target' })
    // zoom 0.5 时 16 屏幕像素等于 32 世界单位，20 世界单位不再算深入。
    expect(resolveStageDropTarget({ index, draggedIds: ['dragged'], worldPoint, zoom: 0.5 }))
      .toBeNull()
  })

  it('不把节点放进自己或自己的后代', () => {
    const leaf = entity('leaf', { width: 100, height: 60, childIds: [] })
    const dragged = entity('dragged', { width: 200, height: 120, childIds: ['leaf'] })
    const outer = entity('outer', { x: 0, y: 0, width: 400, height: 300, childIds: ['dragged'] })
    const index = indexFor([outer, dragged, leaf], ['outer'])

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 50, y: 40 },
      zoom: 1,
    })).toBeNull()
  })

  it('锁定容器不作为落点', () => {
    const target = entity('target', {
      x: 400, y: 0, width: 200, height: 200, childIds: [], locked: true,
    })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 500, y: 100 },
      zoom: 1,
    })).toBeNull()
  })
})

describe('OpenSpec: stage-engine / Auto Layout 容器内原地重排', () => {
  const container = (layout?: Partial<ComposeFlexLayout>) => layoutContainer('container', {
    width: 300,
    height: 100,
    childIds: ['a', 'b', 'c'],
    layout,
  })
  const children = [
    flowChild('a', 0, 0, 100, 100),
    flowChild('b', 100, 0, 100, 100),
    flowChild('c', 200, 0, 100, 100),
  ]

  it('nowrap 容器内按主轴中点给出插入位置', () => {
    const index = indexFor([container(), ...children], ['container'])

    // 指针落在 c 的中点之后 → 追加到末尾。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 280, y: 50 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 3 })

    // 指针落在 b 与 c 中点之间 → 插到 c 之前。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 200, y: 50 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 2 })
  })

  it('顺序未变化时不产生落点', () => {
    const index = indexFor([container(), ...children], ['container'])

    // a 仍在 b 之前 → 结果顺序与原顺序一致。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 20, y: 50 },
      zoom: 1,
    })).toBeNull()
  })

  it('row-reverse 下比较方向翻转', () => {
    // 真实的 row-reverse 求解结果：childIds 首项 a 落在最右，末项 c 落在最左。
    const reverseChildren = [
      flowChild('a', 200, 0, 100, 100),
      flowChild('b', 100, 0, 100, 100),
      flowChild('c', 0, 0, 100, 100),
    ]
    const index = indexFor(
      [container({ flexDirection: 'row-reverse' }), ...reverseChildren],
      ['container'],
    )

    // 把最左（逻辑末位）的 c 拖到最右侧，应成为逻辑首位。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['c'],
      worldPoint: { x: 280, y: 50 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 0 })

    // 停在原处不产生落点。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['c'],
      worldPoint: { x: 20, y: 50 },
      zoom: 1,
    })).toBeNull()
  })

  it('wrap 容器维持现状不做重排', () => {
    const index = indexFor([container({ flexWrap: 'wrap' }), ...children], ['container'])

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 280, y: 50 },
      zoom: 1,
    })).toBeNull()
  })

  it('拖动 Absolute 子项不进入重排分支', () => {
    const absolute = entity('a', { x: 0, y: 0, width: 100, height: 100 })
    const index = indexFor([container(), absolute, children[1]!, children[2]!], ['container'])

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 280, y: 50 },
      zoom: 1,
    })).toBeNull()
  })
})

describe('applyChildReorder', () => {
  it('复刻 entity.move 的原始下标语义', () => {
    expect(applyChildReorder(['a', 'b', 'c'], ['a'], 3)).toEqual(['b', 'c', 'a'])
    expect(applyChildReorder(['a', 'b', 'c'], ['a'], 2)).toEqual(['b', 'a', 'c'])
    expect(applyChildReorder(['a', 'b', 'c'], ['a'], 0)).toEqual(['a', 'b', 'c'])
    expect(applyChildReorder(['a', 'b', 'c'], ['a', 'b'], 3)).toEqual(['c', 'a', 'b'])
  })
})
