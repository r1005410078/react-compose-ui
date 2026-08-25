import { describe, expect, it } from 'vitest'
import { COMPOSE_BUILTIN_COMPONENT_KEYS } from '@compose-ui/core'
import { createStageSceneIndex } from '../hit-testing'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { applyStageCurveGrip, stageCurveGrips } from './curve-grips'
import type { ComposeArcCurve, ComposeCurve, ComposeEntity } from '@compose-ui/core'

/** 几何是 100×50 的斜线，盒可以另给——夹点必须跟着**画出来的**那条线走。 */
function curveEntity(width: number, height: number): ComposeEntity {
  const base = entity('curve-a', { width, height })
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: {
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 50 },
      },
    },
  }
}

describe('stageCurveGrips', () => {
  it('夹点跟着盒的非等比缩放走', () => {
    const value = document([curveEntity(200, 50)])
    const index = createStageSceneIndex(value, layoutSnapshot(value))

    const grips = stageCurveGrips(value, index, 'curve-a')

    // 盒宽翻倍而高不变：终点的 x 跟着翻倍，y 不动——与命中、捕捉读的是同一个投影。
    expect(grips.map(({ id }) => id)).toEqual(['start', 'move', 'end'])
    expect(grips[1]!.point).toMatchObject({ x: 100, y: 25 })
    expect(grips[2]!.point).toMatchObject({ x: 200, y: 50 })
  })

  it('多段线出顶点加每段中点，弧不受影响', () => {
    const withCurve = (curve: ComposeCurve, width: number, height: number): ComposeEntity => {
      const base = curveEntity(width, height)
      return {
        ...base,
        components: { ...base.components, [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: curve as never },
      }
    }
    const polyline = document([withCurve({
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
      closed: false,
    }, 100, 50)])
    // 弧的盒必须与它的紧包围盒等比，否则投影会把它拍成多段线——那是另一条规则，不是本条。
    const arcDoc = document([withCurve({
      kind: 'arc', center: { x: 0, y: 0 }, radius: 25, startAngle: 0, sweep: 90,
    }, 25, 25)])

    // 段中点表示「在这里插入一个顶点」——这兑现的正是当初把它留白时写下的用途。
    const polylineGrips = stageCurveGrips(
      polyline, createStageSceneIndex(polyline, layoutSnapshot(polyline)), 'curve-a',
    )
    expect(polylineGrips.map(({ id }) => id)).toEqual(['v0', 'v1', 'v2', 'm0', 'm1'])
    expect(polylineGrips.map(({ role }) => role))
      .toEqual(['vertex', 'vertex', 'vertex', 'insert', 'insert'])
    // 条形按段的方向摆；第一段是 45 度下坡。
    expect(polylineGrips[3]).toMatchObject({ point: { x: 25, y: 25 }, angle: 45 })
    expect(
      stageCurveGrips(arcDoc, createStageSceneIndex(arcDoc, layoutSnapshot(arcDoc)), 'curve-a')
        .map(({ id }) => id),
    ).toEqual(['center', 'start', 'end', 'mid'])
  })

  it('闭合多段线的收尾段也有中点', () => {
    const base = curveEntity(100, 100)
    const closed = document([{
      ...base,
      components: {
        ...base.components,
        [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: {
          kind: 'polyline',
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
          closed: true,
        } as never,
      },
    }])

    // 收尾那一段在屏幕上与其他段没有任何区别，漏掉它会让一条闭合折线上恰好少一个可抓的
    // 位置，而用户看不出为什么。
    expect(
      stageCurveGrips(closed, createStageSceneIndex(closed, layoutSnapshot(closed)), 'curve-a')
        .map(({ id }) => id),
    ).toEqual(['v0', 'v1', 'v2', 'v3', 'm0', 'm1', 'm2', 'm3'])
  })

  it('不是曲线时没有夹点', () => {
    const value = document([entity('a')])
    const index = createStageSceneIndex(value, layoutSnapshot(value))

    expect(stageCurveGrips(value, index, 'a')).toEqual([])
  })
})

const arc: ComposeArcCurve = {
  kind: 'arc',
  center: { x: 0, y: 0 },
  radius: 100,
  startAngle: 0,
  sweep: 90,
}

describe('applyStageCurveGrip', () => {
  it('直线的两个端点各自可拖', () => {
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }
    expect(applyStageCurveGrip(line, 'end', { x: 100, y: 60 }))
      .toEqual({ kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 60 } })
    expect(applyStageCurveGrip(line, 'nope', { x: 0, y: 0 })).toBeNull()
  })

  it('中点夹点平移整条线：两端位移相同，长度与方向不变', () => {
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 40 } }

    // 中点原本在 (50,20)，落点在 (63,27)：位移 (13,7)，两端各加同一份。
    expect(applyStageCurveGrip(line, 'move', { x: 63, y: 27 }))
      .toEqual({ kind: 'line', start: { x: 13, y: 7 }, end: { x: 113, y: 47 } })
  })

  it('多段线只替换被拖的那个顶点', () => {
    const polyline: ComposeCurve = {
      kind: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }],
      closed: false,
    }
    const next = applyStageCurveGrip(polyline, 'v1', { x: 70, y: 10 })
    expect(next).toEqual({ ...polyline, vertices: [{ x: 0, y: 0 }, { x: 70, y: 10 }, { x: 50, y: 50 }] })
    expect(applyStageCurveGrip(polyline, 'v3', { x: 0, y: 0 })).toBeNull()
  })

  it('拖弧的终点时圆心、半径与起始角都不动', () => {
    const next = applyStageCurveGrip(arc, 'end', { x: 0, y: -100 }) as ComposeArcCurve
    expect(next.center).toEqual(arc.center)
    expect(next.radius).toBe(arc.radius)
    expect(next.startAngle).toBe(arc.startAngle)
    // −90° 归一化到同号（正）的区间即 270。
    expect(next.sweep).toBe(270)
  })

  it('拖弧的起点时终点一动不动', () => {
    // 起点拖到 −90°，终止角仍是 90°，因此扫掠角变成 180。
    const next = applyStageCurveGrip(arc, 'start', { x: 0, y: -100 }) as ComposeArcCurve
    expect(next.startAngle).toBeCloseTo(-90)
    expect(next.sweep).toBeCloseTo(180)
  })

  it('终点拖回起点得到整圆而不是空弧', () => {
    const next = applyStageCurveGrip(arc, 'end', { x: 100, y: 0 }) as ComposeArcCurve
    expect(next.sweep).toBe(360)
    const reversed = applyStageCurveGrip({ ...arc, sweep: -90 }, 'end', { x: 100, y: 0 }) as ComposeArcCurve
    // 符号保持不变：拖动不该把一段逆时针的弧翻成顺时针。
    expect(reversed.sweep).toBe(-360)
  })

  it('中点只改半径，圆心与角度不动', () => {
    const next = applyStageCurveGrip(arc, 'mid', { x: 30, y: 30 }) as ComposeArcCurve
    expect(next.radius).toBeCloseTo(Math.hypot(30, 30))
    expect(next.startAngle).toBe(arc.startAngle)
    expect(next.sweep).toBe(arc.sweep)
    // 半径归零之后再没有夹点能把它拉回来，因此拒绝这次写入。
    expect(applyStageCurveGrip(arc, 'mid', { x: 0, y: 0 })).toBeNull()
  })

  it('圆心平移整条弧', () => {
    const next = applyStageCurveGrip(arc, 'center', { x: 20, y: 20 }) as ComposeArcCurve
    expect(next).toEqual({ ...arc, center: { x: 20, y: 20 } })
  })
})

describe('OpenSpec: stage-engine / 多段线夹点 / 拖段中点插入一个顶点', () => {
  const polyline: ComposeCurve = {
    kind: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
    closed: false,
  }

  it('新顶点排在那一段的两个顶点之间，且落在落点上', () => {
    const next = applyStageCurveGrip(polyline, 'm0', { x: 10, y: 90 })

    expect(next?.kind === 'polyline' ? next.vertices : []).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 90 }, { x: 50, y: 50 }, { x: 100, y: 0 },
    ])
  })

  it('每次求解只插一个', () => {
    // 拖动期每一帧都拿**文档**里的几何加同一个 id 重求一次，因此顶点数永远是原数加一。
    for (const point of [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]) {
      const next = applyStageCurveGrip(polyline, 'm1', point)
      expect(next?.kind === 'polyline' ? next.vertices : []).toHaveLength(4)
    }
  })

  it('段下标越界时放弃这次写入', () => {
    // 开放三顶点多段线只有两段；`m2` 不属于它。
    expect(applyStageCurveGrip(polyline, 'm2', { x: 0, y: 0 })).toBeNull()
  })

  it('直线没有插入夹点', () => {
    // 护栏：直线插一个顶点就不是直线了。
    const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }
    expect(applyStageCurveGrip(line, 'm0', { x: 5, y: 5 })).toBeNull()
  })
})
