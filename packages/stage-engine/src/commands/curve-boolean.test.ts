import { describe, expect, it } from 'vitest'
import {
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  COMPOSE_GEOMETRY_QUANTUM,
  composeCurveBounds,
  resolveComposeCurveRegion,
  type ComposeOutlinePiece,
  flattenComposeCurves,
  normalizeComposeCurveGeometry,
  type ComposeCurve,
  type ComposeEntity,
} from '@compose-ui/core'
import { resolveStageBoolean, resolveStageFlatten } from './curve-boolean'
import { stageWorldQuantum } from './curve-world'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'

function curveEntity(
  id: string,
  curve: ComposeCurve,
  options: { readonly locked?: boolean; readonly extra?: Record<string, unknown> } = {},
): ComposeEntity {
  const normalized = normalizeComposeCurveGeometry(curve)
  const base = entity(id, {
    x: normalized.offset.x,
    y: normalized.offset.y,
    width: normalized.size.width,
    height: normalized.size.height,
    ...(options.locked ? { locked: true } : {}),
  })
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve,
      ...options.extra,
    },
  } as ComposeEntity
}

/** 不带 `Curve` 的普通盒：容器、文字、图片在这条判据下是同一类。 */
function boxEntity(id: string): ComposeEntity {
  return entity(id, { x: 0, y: 0, width: 40, height: 40 })
}

const rect = (x: number, y: number, w: number, h: number): ComposeCurve => ({
  kind: 'polyline',
  closed: true,
  vertices: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
})

function indexOf(entities: readonly ComposeEntity[]) {
  const value = document(entities)
  return createStageSceneIndex(value, layoutSnapshot(value))
}

describe('OpenSpec: stage-engine / 拍平的解算', () => {
  it('一个矩形拍平成一条 path', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 100, 60))])
    const resolution = resolveStageFlatten(index, ['a'])
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.pieces).toHaveLength(1)
    expect(resolution.pieces[0]!.curve.kind).toBe('path')
  })

  it('三个操作数交回三条几何，顺序与层序一致', () => {
    /*
     * 判别性所在：交回的是**逐个**的产物而不是一条合并的。交回一条合并的，宿主除了新建一个
     * 对象之外无事可做——而一个对象只有一个填充，那正是「拍平会丢颜色」的来路。
     */
    // `document()` 按传入顺序建 `rootIds`，先建的画在下面。
    const index = indexOf([
      curveEntity('bottom', rect(0, 0, 40, 40)),
      curveEntity('middle', rect(20, 20, 40, 40)),
      curveEntity('top', rect(40, 40, 40, 40)),
    ])
    const resolution = resolveStageFlatten(index, ['top', 'bottom', 'middle'])
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.pieces.map((piece) => piece.operand.entityId))
      .toEqual(['bottom', 'middle', 'top'])
    resolution.pieces.forEach((piece) => { expect(piece.curve.kind).toBe('path') })
  })

  it('一个闭合多段线与一个整圆拍平，两条产物都是 path', () => {
    const index = indexOf([
      curveEntity('box', rect(0, 0, 40, 40)),
      curveEntity('ring', {
        kind: 'arc',
        center: { x: 80, y: 20 },
        radius: 20,
        startAngle: 0,
        sweep: 360,
      }),
    ])
    const resolution = resolveStageFlatten(index, ['box', 'ring'])
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.pieces.map((piece) => piece.curve.kind)).toEqual(['path', 'path'])
  })

  it('一个操作数都没有时以 too-few 拒绝', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40))])
    expect(resolveStageFlatten(index, []).status).toBe('rejected')
    expect(resolveStageFlatten(index, [])).toMatchObject({ reason: 'too-few' })
  })

  it('不带几何的对象以 no-geometry 拒绝，并指出是哪一个', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40)), boxEntity('panel')])
    const resolution = resolveStageFlatten(index, ['a', 'panel'])
    expect(resolution).toMatchObject({ status: 'rejected', reason: 'no-geometry' })
    if (resolution.status !== 'rejected') return
    expect(resolution.entityName).toBe(index.document.entities.panel!.name)
  })

  it('锁定的操作数拒绝，MUST NOT 静默跳过它', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40), { locked: true })])
    expect(resolveStageFlatten(index, ['a'])).toMatchObject({
      status: 'rejected',
      reason: 'locked',
    })
  })

  it('被导线绑着的操作数拒绝——删掉它会让绑定悬空，而那个错只在 Inspector 里现形', () => {
    const wire = curveEntity('wire', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }, {
      extra: {
        [COMPOSE_BUILTIN_COMPONENT_KEYS.wire]: { start: { entityId: 'a', portId: 'p1' } },
      },
    })
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40)), wire])
    expect(resolveStageFlatten(index, ['a'])).toMatchObject({
      status: 'rejected',
      reason: 'wired',
    })
  })

  it('贝塞尔与直线都放行——拍平不求交，那两条限制的理由在这里不成立', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 10, y: 30 }, c2: { x: 40, y: 30 }, to: { x: 50, y: 0 } }],
        closed: false,
      }],
    }
    const index = indexOf([
      curveEntity('curvy', path),
      curveEntity('straight', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 30, y: 20 } }),
    ])
    expect(resolveStageFlatten(index, ['curvy', 'straight']).status).toBe('resolved')
  })
})

describe('OpenSpec: stage-engine / 布尔解算与操作数次序', () => {
  it('两个重叠矩形求并集', () => {
    const index = indexOf([
      curveEntity('a', rect(0, 0, 40, 40)),
      curveEntity('b', rect(20, 20, 40, 40)),
    ])
    const resolution = resolveStageBoolean(index, ['a', 'b'], 'union')
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    expect(resolution.curve.kind).toBe('polyline')
  })

  it('差集减的是层序最靠后那个，与选中次序无关', () => {
    const index = indexOf([
      curveEntity('bottom', rect(0, 0, 40, 40)),
      curveEntity('top', rect(20, 20, 40, 40)),
    ])
    // 两种选中次序给出同一个结果：次序由层序定，不由用户点的先后定。
    for (const ids of [['top', 'bottom'], ['bottom', 'top']]) {
      const resolution = resolveStageBoolean(index, ids, 'subtract')
      expect(resolution.status).toBe('resolved')
      if (resolution.status !== 'resolved') continue
      expect(resolution.operands[0]!.entityId).toBe('bottom')
    }
  })

  it('不相交的两个形状求交集：报「没有面积」而不是求解退化', () => {
    const index = indexOf([
      curveEntity('a', rect(0, 0, 20, 20)),
      curveEntity('b', rect(100, 100, 20, 20)),
    ])
    expect(resolveStageBoolean(index, ['a', 'b'], 'intersect')).toMatchObject({
      status: 'rejected',
      reason: 'empty',
    })
  })

  it('区域运算拒绝自由曲线段与直线——拍平放行的那两条在这里挡得住', () => {
    const path: ComposeCurve = {
      kind: 'path',
      subpaths: [{
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 10, y: 30 }, c2: { x: 40, y: 30 }, to: { x: 50, y: 0 } }],
        closed: true,
      }],
    }
    const index = indexOf([
      curveEntity('box', rect(0, 0, 40, 40)),
      curveEntity('curvy', path),
      curveEntity('straight', { kind: 'line', start: { x: 0, y: 0 }, end: { x: 30, y: 20 } }),
    ])
    expect(resolveStageBoolean(index, ['box', 'curvy'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'bezier',
    })
    expect(resolveStageBoolean(index, ['box', 'straight'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'line',
    })
    // 同一批对象拍平照样成立：判据按运算分，不是一份全局清单。
    expect(resolveStageFlatten(index, ['box', 'curvy', 'straight']).status).toBe('resolved')
  })

  it('只选一个对象时区域运算以 too-few 拒绝', () => {
    const index = indexOf([curveEntity('a', rect(0, 0, 40, 40))])
    expect(resolveStageBoolean(index, ['a'], 'union')).toMatchObject({
      status: 'rejected',
      reason: 'too-few',
    })
  })
})

describe('OpenSpec: stage-engine / 操作数合不合格在解算层判定，命令会话只管数量 / 由弧围成的路径参与区域运算', () => {
  /** 一个整圆；填充求面与拍平产出的 `path` 的弧边都是从这样的弧转成贝塞尔的。 */
  const circle = (cx: number, cy: number, r: number): ComposeCurve => ({
    kind: 'arc',
    center: { x: cx, y: cy },
    radius: r,
    startAngle: 0,
    sweep: 360,
  })

  it('一块由圆围出来的 path 与矩形求并集能算出来', () => {
    /*
     * 判别性夹具：操作数是一条**真的 `path`**（拍平一个整圆得到的四段弧形贝塞尔），而不是
     * 一条 `arc`。旧实现在 `curve.kind === 'path'` 那一行就整个拒掉，这一条因此在它上面红。
     */
    const round = flattenComposeCurves([circle(50, 50, 40)])
    expect(round.kind).toBe('path')
    const index = indexOf([
      curveEntity('ring', round),
      curveEntity('box', rect(40, 40, 80, 80)),
    ])
    const resolution = resolveStageBoolean(index, ['ring', 'box'], 'union')
    expect(resolution.status).toBe('resolved')
  })

  it('两条弧形 path 的交集是它们真的重叠的那一块，不是包围盒', () => {
    const left = flattenComposeCurves([circle(0, 0, 50)])
    const right = flattenComposeCurves([circle(60, 0, 50)])
    const index = indexOf([curveEntity('left', left), curveEntity('right', right)])
    const resolution = resolveStageBoolean(index, ['left', 'right'], 'intersect')
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return

    /*
     * 两圆心距 60、半径各 50，透镜形交集的宽度是 2×50 − 60 = 40、高度 2×√(50² − 30²) = 80。
     * 断这个尺寸而不是断「算出来了」：把弧拍成折线同样能算出来，但那样的产物边上有棱，
     * 而尺寸对不上正是棱的直接后果。
     */
    const bounds = composeCurveBounds(resolution.curve)
    expect(bounds.width).toBeCloseTo(40, 0)
    expect(bounds.height).toBeCloseTo(80, 0)
  })

  it('不相交的两条弧形 path 求交集仍然报「没有面积」', () => {
    const a = flattenComposeCurves([circle(0, 0, 20)])
    const b = flattenComposeCurves([circle(200, 0, 20)])
    const index = indexOf([curveEntity('a', a), curveEntity('b', b)])
    expect(resolveStageBoolean(index, ['a', 'b'], 'intersect')).toMatchObject({
      status: 'rejected',
      reason: 'empty',
    })
  })

  it('区域运算的产物可以再当操作数——往返稳定', () => {
    /*
     * 结果落地时 `composeCurveFromOutline` 把弧边再转回同一个闭式解的贝塞尔，因此「算一次
     * 就再也算不了」这条不该成立。它是这次变更的收口：产品自己产出的东西产品自己要认。
     */
    const first = resolveStageBoolean(
      indexOf([
        curveEntity('a', flattenComposeCurves([circle(0, 0, 50)])),
        curveEntity('b', flattenComposeCurves([circle(60, 0, 50)])),
      ]),
      ['a', 'b'],
      'union',
    )
    expect(first.status).toBe('resolved')
    if (first.status !== 'resolved') return

    const second = resolveStageBoolean(
      indexOf([
        curveEntity('merged', first.curve),
        curveEntity('box', rect(-10, -10, 40, 40)),
      ]),
      ['merged', 'box'],
      'intersect',
    )
    expect(second.status).toBe('resolved')
  })
})

describe('OpenSpec: stage-engine / 求解的调用方说出自己的坐标量化步长', () => {
  it('盒放大到取景框十倍时，交下去的步长跟着放大十倍', () => {
    /*
     * 判据是**盒 / 取景框**而不是文档精度本身：几何的舍入发生在几何空间，而交给求解的是世界
     * 片段。盒被拉大十倍时，几何上相差一个步长的两个点在世界上就相差十个。
     */
    const curve = rect(0, 0, 100, 100)
    const normalized = normalizeComposeCurveGeometry(curve)
    const stretched = entity('wide', {
      x: normalized.offset.x,
      y: normalized.offset.y,
      width: normalized.size.width * 10,
      height: normalized.size.height * 10,
    })
    const wide = {
      ...stretched,
      components: {
        ...stretched.components,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
        [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve,
      },
    } as ComposeEntity
    const index = indexOf([wide, curveEntity('plain', rect(0, 0, 100, 100))])
    expect(stageWorldQuantum(index, 'wide', index.getWorldMatrix('wide')!))
      .toBeCloseTo(COMPOSE_GEOMETRY_QUANTUM * 10, 6)
    expect(stageWorldQuantum(index, 'plain', index.getWorldMatrix('plain')!))
      .toBeCloseTo(COMPOSE_GEOMETRY_QUANTUM, 6)
  })

})

describe('OpenSpec: compose-document / 重合的边界在建图之前归一到同一条支撑', () => {
  it('两块共用一段弧边界的填充，走完整条落地管线之后求得出并集', () => {
    /*
     * 用户报的那张图：两个相交的圆、油漆桶填出的几块面，全选求并集。共用的那段弧在图里存了
     * **两份**，各自经归一化与盒尺寸量化写进文档，读回来再由三点定圆反解——两份的圆心因此
     * 差到三个量化步长。
     *
     * 断的是**几何尺寸**：左月牙 ∪ 透镜恰好是整个左边那个圆，120 × 120。断「算出来了」会被
     * 一个几像素大的退化产物骗过，上一个变更就栽在这里。
     */
    const boundaries: ComposeOutlinePiece[] = [
      { kind: 'arc', arc: { center: { x: 100, y: 100 }, radius: 60, startAngle: 0, sweep: 360 } },
      { kind: 'arc', arc: { center: { x: 160, y: 100 }, radius: 60, startAngle: 0, sweep: 360 } },
    ]
    const left = resolveComposeCurveRegion(boundaries, { x: 60, y: 100 })
    const lens = resolveComposeCurveRegion(boundaries, { x: 130, y: 100 })
    expect(left.status).toBe('resolved')
    expect(lens.status).toBe('resolved')
    if (left.status !== 'resolved' || lens.status !== 'resolved') return

    const index = indexOf([curveEntity('left', left.curve), curveEntity('lens', lens.curve)])
    const resolution = resolveStageBoolean(index, ['left', 'lens'], 'union')
    expect(resolution.status).toBe('resolved')
    if (resolution.status !== 'resolved') return
    const bounds = composeCurveBounds(resolution.curve)
    expect(bounds.width).toBeCloseTo(120, 1)
    expect(bounds.height).toBeCloseTo(120, 1)
  })
})
