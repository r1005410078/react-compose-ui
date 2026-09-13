import { describe, expect, it } from 'vitest'
import { resolveComposeHatches } from './hatch-solve'
import { getComposeCurve, isPointInsideComposeCurve } from './curve'
import { getComposeHatch } from './hatch'
import type { ComposeDocument, ComposeLayoutSnapshot, JsonObject } from './document-types'
import type { ComposeCurve } from './curve'

const chrome = {
  Lock: { locked: false },
  Visibility: { visible: true },
  Transform: { rotation: 0 },
}

function layoutItem(x: number, y: number, width: number, height: number) {
  return {
    positioning: 'absolute',
    offset: { x, y },
    width: { mode: 'fixed', value: width, min: 1, max: null },
    height: { mode: 'fixed', value: height, min: 1, max: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    alignSelf: 'auto',
  }
}

interface Piece {
  readonly id: string
  readonly curve: ComposeCurve
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation?: number
  readonly hatch?: { seed: { x: number; y: number }; boundaryIds?: readonly string[] }
  readonly parent?: string
}

/** 一个单场景文档；除非显式指定，所有 Entity 都挂在 `frame` 下。 */
function scene(pieces: readonly Piece[]): {
  document: ComposeDocument
  snapshot: ComposeLayoutSnapshot
} {
  const entities: Record<string, JsonObject> = {}
  const boxes: Record<string, JsonObject> = {}
  const roots = ['frame', 'other']
  for (const root of roots) {
    entities[root] = {
      id: root,
      name: root,
      components: {
        ...chrome,
        Hierarchy: {
          childIds: pieces.filter((p) => (p.parent ?? 'frame') === root).map((p) => p.id),
        },
        Frame: { size: { width: 1000, height: 800 } },
        LayoutItem: layoutItem(0, 0, 1000, 800),
      },
    } as unknown as JsonObject
    boxes[root] = { x: 0, y: 0, width: 1000, height: 800 } as unknown as JsonObject
  }
  for (const piece of pieces) {
    entities[piece.id] = {
      id: piece.id,
      name: piece.id,
      components: {
        ...chrome,
        ...(piece.rotation ? { Transform: { rotation: piece.rotation } } : {}),
        Renderer: { type: 'curve', props: {} },
        Curve: piece.curve,
        LayoutItem: layoutItem(piece.x, piece.y, piece.width, piece.height),
        ...(piece.hatch ? { Hatch: piece.hatch } : {}),
      },
    } as unknown as JsonObject
    boxes[piece.id] = {
      x: piece.x, y: piece.y, width: piece.width, height: piece.height,
    } as unknown as JsonObject
  }
  return {
    document: { schemaVersion: 7, rootIds: roots, entities } as unknown as ComposeDocument,
    snapshot: { boxes, diagnostics: [] } as unknown as ComposeLayoutSnapshot,
  }
}

/** 盒局部的矩形几何——归一化之后紧包围盒的左上角恒为原点。 */
const rect = (w: number, h: number): ComposeCurve => ({
  kind: 'polyline',
  closed: true,
  vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
})
const vline = (h: number): ComposeCurve => ({
  kind: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: h },
})

/**
 * 一块被竖线切成两半的矩形，填充盖住左半边。
 *
 * 矩形 (100,100)–(500,400)，竖线在 x=300 从 y=50 到 y=450，填充是左半 (100,100)–(300,400)。
 */
function bisected(lineX: number) {
  return scene([
    { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
    { id: 'line', curve: vline(400), x: lineX, y: 50, width: 1, height: 400 },
    {
      id: 'fill',
      curve: rect(200, 300),
      x: 100, y: 100, width: 200, height: 300,
      // 锚点是 Entity 局部：父级局部 (200,250) 减去盒偏移 (100,100)。
      hatch: { seed: { x: 100, y: 150 }, boundaryIds: ['rect', 'line'] },
    },
  ])
}

/** 盒局部的整圆几何——扫掠 360 的弧，圆心在盒中心。 */
const disc = (r: number): ComposeCurve => ({
  kind: 'arc', center: { x: r, y: r }, radius: r, startAngle: 0, sweep: 360,
})

/**
 * 一个矩形中间挖一个圆洞，填充是整块带洞的面。
 *
 * 矩形 (100,100)–(500,400)，圆心 (300,250) 半径 60。
 */
function holed(circleX: number) {
  return scene([
    { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
    { id: 'disc', curve: disc(60), x: circleX, y: 190, width: 120, height: 120 },
    {
      id: 'fill',
      curve: {
        kind: 'path',
        fillRule: 'evenodd',
        subpaths: [],
      } as unknown as ComposeCurve,
      x: 100, y: 100, width: 400, height: 300,
      // 锚点落在洞与左边之间，不在洞里。
      hatch: { seed: { x: 50, y: 150 }, boundaryIds: ['rect', 'disc'] },
    },
  ])
}

describe('OpenSpec: compose-document / 填充几何跟着边界求解，不逐条路径回写', () => {
  it('边界移动之后填充跟上', () => {
    const { document, snapshot } = bisected(360)
    const resolved = resolveComposeHatches(document, snapshot)
    // 竖线从 300 挪到 360，左半边跟着变宽 60。
    expect(resolved.snapshot.boxes.fill!.width).toBeCloseTo(260, 1)
    expect(resolved.snapshot.boxes.fill!.x).toBeCloseTo(100, 1)
  })

  it('边界没动时几何不变', () => {
    const { document, snapshot } = bisected(300)
    const resolved = resolveComposeHatches(document, snapshot)
    expect(resolved.snapshot.boxes.fill!.width).toBeCloseTo(200, 1)
  })

  it('没有边界清单的填充不参与——缺席即不跟随', () => {
    const { document, snapshot } = scene([
      { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
      { id: 'line', curve: vline(400), x: 360, y: 50, width: 1, height: 400 },
      {
        id: 'fill',
        curve: rect(200, 300),
        x: 100, y: 100, width: 200, height: 300,
        hatch: { seed: { x: 100, y: 150 } },
      },
    ])
    // 引用不变：订阅方的记忆化不会失效。
    expect(resolveComposeHatches(document, snapshot).document).toBe(document)
  })

  it('没有任何填充时原样返回入参', () => {
    const { document, snapshot } = scene([
      { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
    ])
    const resolved = resolveComposeHatches(document, snapshot)
    expect(resolved.document).toBe(document)
    expect(resolved.snapshot).toBe(snapshot)
  })

  it('清单变了就不动几何——拓扑变了不替用户换形状', () => {
    // 竖线整条挪到矩形外面：此刻围出落点那块面的只剩矩形，清单从 {rect,line} 变成 {rect}。
    const { document, snapshot } = scene([
      { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
      { id: 'line', curve: vline(400), x: 900, y: 50, width: 1, height: 400 },
      {
        id: 'fill',
        curve: rect(200, 300),
        x: 100, y: 100, width: 200, height: 300,
        hatch: { seed: { x: 100, y: 150 }, boundaryIds: ['rect', 'line'] },
      },
    ])
    expect(resolveComposeHatches(document, snapshot).document).toBe(document)
  })

  it('跟随之后锚点重取到最大内切圆圆心', () => {
    const { document, snapshot } = bisected(360)
    const resolved = resolveComposeHatches(document, snapshot)
    const anchor = getComposeHatch(resolved.document.entities.fill)!.seed
    // 左半是 260×300 的矩形，内切圆圆心在它的中心；锚点是 Entity 局部，因此是 (130,150)。
    expect(anchor.x).toBeCloseTo(130, 0)
    expect(anchor.y).toBeCloseTo(150, 0)
  })

  it('跨父级的边界不跟随', () => {
    const { document, snapshot } = scene([
      { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
      { id: 'line', curve: vline(400), x: 360, y: 50, width: 1, height: 400, parent: 'other' },
      {
        id: 'fill',
        curve: rect(200, 300),
        x: 100, y: 100, width: 200, height: 300,
        hatch: { seed: { x: 100, y: 150 }, boundaryIds: ['rect', 'line'] },
      },
    ])
    expect(resolveComposeHatches(document, snapshot).document).toBe(document)
  })

  it('旋转过的边界不跟随——一个错的面比不跟随糟得多', () => {
    const { document, snapshot } = scene([
      { id: 'rect', curve: rect(400, 300), x: 100, y: 100, width: 400, height: 300 },
      { id: 'line', curve: vline(400), x: 360, y: 50, width: 1, height: 400, rotation: 30 },
      {
        id: 'fill',
        curve: rect(200, 300),
        x: 100, y: 100, width: 200, height: 300,
        hatch: { seed: { x: 100, y: 150 }, boundaryIds: ['rect', 'line'] },
      },
    ])
    expect(resolveComposeHatches(document, snapshot).document).toBe(document)
  })

  it('边界被删掉时保留作者几何', () => {
    const { document, snapshot } = bisected(360)
    const without: ComposeDocument = {
      ...document,
      entities: Object.fromEntries(
        Object.entries(document.entities).filter(([id]) => id !== 'line'),
      ),
    }
    const resolved = resolveComposeHatches(without, snapshot)
    expect(resolved.document).toBe(without)
    expect(getComposeCurve(without.entities.fill)).toBeDefined()
  })
})

describe('OpenSpec: compose-document / 填充几何跟着边界求解 / 洞也是边界', () => {
  it('挖洞的那个对象在清单里，跟随之后洞还在', () => {
    /*
     * 判别性落在 `fillRule` 上：清单里少了挖洞的那个圆时，它根本不在这一次求解的输入里，
     * 洞会被**悄悄补平**成一块实心的面——而用户没有动过它。这条曾经真的发生过：出处只报
     * 外环，于是落地时写下的清单里就没有那个圆。
     */
    const { document, snapshot } = holed(240)
    const resolved = resolveComposeHatches(document, snapshot)
    const curve = getComposeCurve(resolved.document.entities.fill!)
    expect(curve?.kind).toBe('path')
    if (curve?.kind !== 'path') return
    expect(curve.fillRule).toBe('evenodd')
    expect(curve.subpaths).toHaveLength(2)
  })

  it('洞挪了位置，填充跟着挪', () => {
    const before = holed(240)
    const after = holed(300)
    const holeOf = (scene_: ReturnType<typeof holed>) => {
      const curve = getComposeCurve(resolveComposeHatches(scene_.document, scene_.snapshot)
        .document.entities.fill!)
      if (curve?.kind !== 'path') throw new Error('expected path')
      return curve.subpaths[1]!.start.x
    }
    expect(holeOf(after) - holeOf(before)).toBeCloseTo(60, 6)
  })

  it('锚点不会被重取到洞里', () => {
    // 最大内切圆圆心按 `fillRule` 判内外，因此洞把它推开——看得见的洞与推开圆心的洞是同一个。
    const { document, snapshot } = holed(240)
    const resolved = resolveComposeHatches(document, snapshot)
    const fill = resolved.document.entities.fill!
    const hatch = getComposeHatch(fill)!
    const curve = getComposeCurve(fill)!
    expect(isPointInsideComposeCurve(curve, hatch.seed)).toBe(true)
  })
})

describe('OpenSpec: compose-document / 填充几何跟着边界求解 / 几何没变时不重取锚点', () => {
  it('求出来的几何逐位相同就到此为止，锚点保持原值', () => {
    /*
     * 刚填出来的那块面，用户点的地方就是他心里那块面——此时把锚点挪到内切圆圆心会让
     * 「重新生成」变得不可预测。这一道同时是全部的性能账：求面 0.011ms，取锚点 1.16ms。
     */
    const settled = resolveComposeHatches(bisected(300).document, bisected(300).snapshot)
    const once = getComposeHatch(settled.document.entities.fill!)!
    const twice = resolveComposeHatches(settled.document, settled.snapshot)
    // 第二遍什么都不写，因此连文档的引用都不变。
    expect(twice.document).toBe(settled.document)
    expect(getComposeHatch(twice.document.entities.fill!)).toEqual(once)
  })
})
