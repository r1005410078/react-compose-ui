import { describe, expect, it } from 'vitest'
import type { StageSceneIndex } from '@compose-ui/stage-engine'
import {
  STAGE_CULLING_BATCH_FRAMES,
  STAGE_CULLING_BATCH_SIZE,
  appliedStageCulledIds,
  drainStageCullingReveal,
  initialStageCullingReveal,
  planStageCullingReveal,
} from './stage-culling-reveal'

const index = {} as StageSceneIndex
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
const position = (order: readonly string[]) => new Map(order.map((id, i) => [id, i] as const))

describe('场景层的分批规划', () => {
  it('OpenSpec: 裁剪窗口是量化的 / 换窗不落在平移帧上——键没变时差集全部排队', () => {
    const before = ids('a', 40)
    const after = ids('b', 40)
    const previous = initialStageCullingReveal({ batchKey: 'k', detail: new Set(), index, target: new Set(before) })
    const next = planStageCullingReveal(previous, { batchKey: 'k', detail: new Set(), index, target: new Set(after) }, position([...before, ...after]))
    expect(next.pendingReveal).toEqual(before)
    expect(next.pendingCull).toEqual(after)
    // 换窗那一帧实际生效的与上一帧相同：什么都不挂不卸。
    expect([...appliedStageCulledIds(next)].sort()).toEqual([...before].sort())
  })

  it('OpenSpec: 裁剪窗口是量化的 / 跨过可读阈值时文字分批回来，窗口带进来的当帧到齐', () => {
    /*
     * 键变了（缩放跨档）。上一趟被裁的里有 40 个是因为读不出来（detail），20 个是窗口外；这一趟
     * 都要露出来。可读性带回来的排队，窗口带回来的当帧到齐——后者可能已在可视区里。
     */
    const tiny = ids('t', 40)
    const outside = ids('o', 20)
    const previous = initialStageCullingReveal({
      batchKey: 'step-1', detail: new Set(tiny), index, target: new Set([...tiny, ...outside]),
    })
    const next = planStageCullingReveal(previous, { batchKey: 'step-2', detail: new Set(), index, target: new Set() }, position([...tiny, ...outside]))
    expect(next.pendingReveal).toEqual(tiny)
    expect(next.pendingCull).toEqual([])
    const applied = appliedStageCulledIds(next)
    for (const id of outside) expect(applied.has(id)).toBe(false)
    for (const id of tiny) expect(applied.has(id)).toBe(true)
  })

  it('OpenSpec: 裁剪窗口是量化的 / 缩小跨档时因读不出来而裁掉的排队，离开窗口的当帧到齐', () => {
    const tiny = ids('t', 40)
    const outside = ids('o', 20)
    const previous = initialStageCullingReveal({ batchKey: 'step-2', detail: new Set(), index, target: new Set() })
    const next = planStageCullingReveal(previous, {
      batchKey: 'step-1', detail: new Set(tiny), index, target: new Set([...tiny, ...outside]),
    }, position([...tiny, ...outside]))
    expect(next.pendingCull).toEqual(tiny)
    const applied = appliedStageCulledIds(next)
    for (const id of outside) expect(applied.has(id)).toBe(true)
    for (const id of tiny) expect(applied.has(id)).toBe(false)
  })

  it('OpenSpec: 裁剪窗口是量化的 / 文档变了全部当帧到齐', () => {
    const tiny = ids('t', 40)
    const previous = initialStageCullingReveal({ batchKey: 'k', detail: new Set(tiny), index, target: new Set(tiny) })
    const next = planStageCullingReveal(previous, { batchKey: 'k', detail: new Set(), index: {} as StageSceneIndex, target: new Set() }, position(tiny))
    expect(next.pendingReveal).toEqual([])
    expect(next.pendingCull).toEqual([])
  })

  it('一批装得下就当帧到齐；长队列按文档顺序、几帧内摊完', () => {
    const few = ids('f', STAGE_CULLING_BATCH_SIZE)
    const previous = initialStageCullingReveal({ batchKey: 'k', detail: new Set(), index, target: new Set(few) })
    const fits = planStageCullingReveal(previous, { batchKey: 'k', detail: new Set(), index, target: new Set() }, position(few))
    expect(fits.pendingReveal).toEqual([])

    const many = ids('m', STAGE_CULLING_BATCH_SIZE * STAGE_CULLING_BATCH_FRAMES * 3)
    const shuffled = [...many].reverse()
    const long = planStageCullingReveal(
      initialStageCullingReveal({ batchKey: 'k', detail: new Set(), index, target: new Set(shuffled) }),
      { batchKey: 'k', detail: new Set(), index, target: new Set() },
      position(many),
    )
    expect(long.pendingReveal).toEqual(many)
    let current = long
    let frames = 0
    while (current.pendingReveal.length > 0) {
      current = drainStageCullingReveal(current)
      frames += 1
    }
    expect(frames).toBeLessThanOrEqual(STAGE_CULLING_BATCH_FRAMES)
  })
})
