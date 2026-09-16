import type { ComposeEntity, ComposeFlexLayout } from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import {
  applyChildReorder,
  resolveStageDropIndicator,
  resolveStageDropTarget,
} from './drop-target'
import { createStageSceneIndex } from './scene-index'
import { document, entity, layoutSnapshot } from '../test-fixtures'

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

  it('Alt 强制以指针命中容器为落点，绕过边缘留白', () => {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])
    // 指针在留白区内：默认不产生落点，Alt 强制命中。
    const edgePoint = { x: 405, y: 100 }

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: edgePoint,
      zoom: 1,
    })).toBeNull()
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: edgePoint,
      zoom: 1,
      modifiers: { alt: true },
    })).toEqual({ kind: 'reparent', containerId: 'target' })
  })

  it('Space 锁定原父级，深入其他容器也不产生 reparent 落点', () => {
    const target = entity('target', { x: 400, y: 0, width: 200, height: 200, childIds: [] })
    const dragged = entity('dragged', { x: 0, y: 0, width: 50, height: 50 })
    const index = indexFor([target, dragged], ['target', 'dragged'])
    const deepPoint = { x: 500, y: 100 }

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: deepPoint,
      zoom: 1,
      modifiers: { space: true },
    })).toBeNull()
    // Alt 与 Space 同按时锁定优先：结构意图的否决权高于命中放宽。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: deepPoint,
      zoom: 1,
      modifiers: { alt: true, space: true },
    })).toBeNull()
  })

  it('Space 不阻止原容器内的重排', () => {
    const container = layoutContainer('container', {
      width: 300,
      height: 100,
      childIds: ['a', 'b'],
    })
    const index = indexFor(
      [container, flowChild('a', 0, 0, 100, 100), flowChild('b', 100, 0, 100, 100)],
      ['container'],
    )

    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 180, y: 50 },
      zoom: 1,
      modifiers: { space: true },
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 2 })
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

  it('wrap 容器按行聚类后跨行重排', () => {
    // 两行布局：a、b 在第一行，c 换行到第二行。
    const wrapContainer = layoutContainer('container', {
      width: 250,
      height: 100,
      childIds: ['a', 'b', 'c'],
      layout: { flexWrap: 'wrap' },
    })
    const wrapChildren = [
      flowChild('a', 0, 0, 100, 50),
      flowChild('b', 100, 0, 100, 50),
      flowChild('c', 0, 50, 100, 50),
    ]
    const index = indexFor([wrapContainer, ...wrapChildren], ['container'])

    // 把第二行的 c 拖到第一行 a、b 之间 → 插到 b 之前。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['c'],
      worldPoint: { x: 105, y: 25 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 1 })

    // 把第一行的 a 拖到第二行 c 之后 → 追加到末尾。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['a'],
      worldPoint: { x: 180, y: 75 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 3 })

    // 指针停在 c 原位 → 顺序未变，不产生落点。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['c'],
      worldPoint: { x: 30, y: 75 },
      zoom: 1,
    })).toBeNull()
  })

  it('wrap-reverse 容器按逻辑行序重排', () => {
    // wrap-reverse 求解结果：第一逻辑行贴交叉轴末端（下方），换行向上堆叠。
    const wrapContainer = layoutContainer('container', {
      width: 250,
      height: 100,
      childIds: ['a', 'b', 'c'],
      layout: { flexWrap: 'wrap-reverse' },
    })
    const wrapChildren = [
      flowChild('a', 0, 50, 100, 50),
      flowChild('b', 100, 50, 100, 50),
      flowChild('c', 0, 0, 100, 50),
    ]
    const index = indexFor([wrapContainer, ...wrapChildren], ['container'])

    // 把上方（第二逻辑行）的 c 拖到下方第一逻辑行 a、b 之间 → 插到 b 之前。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['c'],
      worldPoint: { x: 105, y: 75 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'container', index: 1 })
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

describe('resolveStageDropIndicator', () => {
  const rowContainer = layoutContainer('container', {
    width: 300,
    height: 100,
    childIds: ['a', 'b', 'c'],
  })
  const rowChildren = [
    flowChild('a', 0, 0, 100, 100),
    flowChild('b', 100, 0, 100, 100),
    flowChild('c', 200, 0, 100, 100),
  ]

  it('reparent 给出目标容器的世界包围盒', () => {
    const target = entity('target', { x: 400, y: 20, width: 200, height: 150, childIds: [] })
    const index = indexFor([target], ['target'])

    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reparent', containerId: 'target' },
      draggedIds: ['dragged'],
    })).toEqual({
      kind: 'reparent',
      bounds: { x: 400, y: 20, width: 200, height: 150 },
    })
  })

  it('重排落点线贴在目标兄弟的起始边并横跨交叉轴', () => {
    const index = indexFor([rowContainer, ...rowChildren], ['container'])

    // 插到 c 之前 → 贴 c 的左边缘 x=200。
    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 2 },
      draggedIds: ['a'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 200, y: 0 },
      end: { x: 200, y: 100 },
    })
  })

  it('追加到末尾时贴最后一个兄弟的结束边', () => {
    const index = indexFor([rowContainer, ...rowChildren], ['container'])

    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 3 },
      draggedIds: ['a'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 300, y: 0 },
      end: { x: 300, y: 100 },
    })
  })

  it('wrap 容器插入线只横跨目标行的交叉轴区间', () => {
    const wrapContainer = layoutContainer('container', {
      width: 250,
      height: 100,
      childIds: ['a', 'b', 'c'],
      layout: { flexWrap: 'wrap' },
    })
    const wrapChildren = [
      flowChild('a', 0, 0, 100, 50),
      flowChild('b', 100, 0, 100, 50),
      flowChild('c', 0, 50, 100, 50),
    ]
    const index = indexFor([wrapContainer, ...wrapChildren], ['container'])

    // 插到第一行 b 之前 → 线在 x=100，只覆盖第一行 y 0..50。
    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 1 },
      draggedIds: ['c'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 100, y: 0 },
      end: { x: 100, y: 50 },
    })

    // 追加到末尾 → 贴第二行 c 的右边缘，只覆盖第二行 y 50..100。
    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 3 },
      draggedIds: ['a'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 100, y: 50 },
      end: { x: 100, y: 100 },
    })
  })

  it('row-reverse 下落点线贴在相反的一侧', () => {
    const reverseChildren = [
      flowChild('a', 200, 0, 100, 100),
      flowChild('b', 100, 0, 100, 100),
      flowChild('c', 0, 0, 100, 100),
    ]
    const index = indexFor(
      [layoutContainer('container', {
        width: 300,
        height: 100,
        childIds: ['a', 'b', 'c'],
        layout: { flexDirection: 'row-reverse' },
      }), ...reverseChildren],
      ['container'],
    )

    // 成为逻辑首位 → 视觉最右侧，贴 a 的右边缘 x=300。
    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 0 },
      draggedIds: ['c'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 300, y: 0 },
      end: { x: 300, y: 100 },
    })
  })

  it('column 方向落点线横跨宽度', () => {
    const index = indexFor(
      [layoutContainer('container', {
        width: 100,
        height: 300,
        childIds: ['a', 'b'],
        layout: { flexDirection: 'column' },
      }), flowChild('a', 0, 0, 100, 100), flowChild('b', 0, 100, 100, 100)],
      ['container'],
    )

    expect(resolveStageDropIndicator({
      index,
      target: { kind: 'reorder', containerId: 'container', index: 1 },
      draggedIds: ['a'],
    })).toEqual({
      kind: 'reorder',
      start: { x: 0, y: 100 },
      end: { x: 100, y: 100 },
    })
  })
})

/** Flow 定位的**容器**：带 Hierarchy，因此它自己也是一个合法落点。 */
function flowContainer(
  id: string, x: number, y: number, width: number, height: number,
): ComposeEntity {
  const base = entity(id, { x, y, width, height, childIds: [] })
  return {
    ...base,
    components: {
      ...base.components,
      LayoutItem: { ...base.components.LayoutItem, positioning: 'flow' },
    },
  } as ComposeEntity
}

describe('OpenSpec: stage-engine / 跨容器落进 Flex 容器时解算插入位', () => {
  /** 一个横向排队容器，两个 Flow 子级各占一半、合起来盖满父级。 */
  function queueFixture() {
    const board = layoutContainer('board', {
      x: 400, y: 0, width: 200, height: 200, childIds: ['a', 'b'],
    })
    return [
      board,
      /*
       * 子级的 offset 是**局部**坐标：board 在世界 x=400，因此 a 局部 0、b 局部 100。
       * 两个子级都是**容器**（带 Hierarchy）——这正是 L-2 的复现形状：它们各自都是合法
       * 落点，且合起来盖满了父级。是叶子的话「最深的容器」本来就是 board，断不出东西。
       */
      flowContainer('a', 0, 0, 100, 200),
      flowContainer('b', 100, 0, 100, 200),
      entity('dragged', { x: 0, y: 0, width: 50, height: 50 }),
    ]
  }

  it('拖到已占满父级的 Flow 子级上，落点仍是 Flex 父级', () => {
    /*
     * 判别性的那一半：排队容器里第一个子级本来就盖住了父容器中心。按「最深的容器赢」，
     * 此后每一次拖放都落进上一个子级，「拖第二个同级子项」在画布上根本做不到。
     */
    const index = indexFor(queueFixture(), ['board', 'dragged'])
    const target = resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 430, y: 100 },
      zoom: 1,
    })
    expect(target).toEqual({ kind: 'reorder', containerId: 'board', index: 0 })
  })

  it('插入位说明落在哪两个之间', () => {
    const index = indexFor(queueFixture(), ['board', 'dragged'])
    // 越过 a 的中点、未越过 b 的中点：插在两者之间。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 480, y: 100 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'board', index: 1 })
    // 越过 b 的中点：插到末尾。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 580, y: 100 },
      zoom: 1,
    })).toEqual({ kind: 'reorder', containerId: 'board', index: 2 })
  })

  it('Alt 下钻进 Flow 子级', () => {
    const index = indexFor(queueFixture(), ['board', 'dragged'])
    // `alt` 的既有语义就是以命中的最内层合法容器为落点，这条不因为上面那条而收走。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 430, y: 100 },
      zoom: 1,
      modifiers: { alt: true },
    })).toEqual({ kind: 'reparent', containerId: 'a' })
  })

  it('没有 Layout 的普通容器仍然追加到末尾', () => {
    // 只断上面几条时，「所有容器都产出插入位」同样绿——而普通容器根本没有队列可言。
    const plain = entity('plain', { x: 400, y: 0, width: 200, height: 200, childIds: ['inner'] })
    const index = indexFor(
      [plain, entity('inner', { x: 400, y: 0, width: 20, height: 20 }),
        entity('dragged', { x: 0, y: 0, width: 50, height: 50 })],
      ['plain', 'dragged'],
    )
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 500, y: 100 },
      zoom: 1,
    })).toEqual({ kind: 'reparent', containerId: 'plain' })
  })

  it('落在边缘留白里时上浮到祖先，而不是没有落点', () => {
    /*
     * 判别性的那一半：此前这一档返回 null，用户看到的是「拖过去松手什么都没发生」——
     * 而边缘留白想表达的恰恰是「你不是要放进这个，是要放进它外面那个」。
     */
    const outer = entity('outer', { x: 0, y: 0, width: 400, height: 400, childIds: ['inner'] })
    const inner = entity('inner', { x: 100, y: 100, width: 200, height: 200, childIds: [] })
    const index = indexFor(
      [outer, inner, entity('dragged', { x: 900, y: 900, width: 10, height: 10 })],
      ['outer', 'dragged'],
    )
    // 距 inner 左边 4px，落在它的 16px 留白里；outer 在这一点上深入成立。
    expect(resolveStageDropTarget({
      index,
      draggedIds: ['dragged'],
      worldPoint: { x: 104, y: 200 },
      zoom: 1,
    })).toEqual({ kind: 'reparent', containerId: 'outer' })
  })
})
