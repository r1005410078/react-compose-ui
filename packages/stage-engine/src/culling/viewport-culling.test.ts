import { describe, expect, it } from 'vitest'
import { rectContains, type StageRect, type StageViewport } from '../geometry'
import { createStageSceneIndex } from '../hit-testing'
import { ROOT_FRAME_ID, document, entity, layoutSnapshot } from '../test-fixtures'
import { resolveStageCullingWindow, resolveStageVisibleEntityIds } from './viewport-culling'

const SURFACE = { width: 800, height: 600 }

function indexFor(value: ReturnType<typeof document>) {
  return createStageSceneIndex(value, layoutSnapshot(value))
}

/** 视口在世界坐标下的矩形；窗口恒包含它是本模块唯一的正确性不变量。 */
function viewWorldRect(viewport: StageViewport): StageRect {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: SURFACE.width / viewport.zoom,
    height: SURFACE.height / viewport.zoom,
  }
}

describe('Stage 视口裁剪', () => {
  it('OpenSpec: 场景只渲染与裁剪窗口相交的子树 / 父在屏外而子在屏内', () => {
    // outer 自己远在窗口之外，它的子级 near 却落在原点附近。容器不裁剪，因此子级确实画在
    // 父盒之外——这正是「按自身盒裁」会整棵判掉的那一类。
    const near = entity('near', { x: -5000, y: 0, width: 100, height: 50 })
    const outer = entity('outer', {
      x: 5000,
      y: 0,
      width: 100,
      height: 50,
      childIds: ['near'],
      clip: false,
    })
    const index = indexFor(document([outer, near], ['outer']))
    const cullingWindow = resolveStageCullingWindow({ x: 0, y: 0, zoom: 1 }, SURFACE)

    // 夹具的判别性：outer **自身**的盒确实在窗口之外，否则这条用例什么都没有钉住。
    const ownBounds = index.getWorldBounds('outer')
    expect(ownBounds?.x).toBeGreaterThan(cullingWindow.x + cullingWindow.width)

    const visible = resolveStageVisibleEntityIds(index, cullingWindow)
    expect(visible.has('near')).toBe(true)
    expect(visible.has('outer')).toBe(true)
  })

  it('OpenSpec: 场景只渲染与裁剪窗口相交的子树 / 带 Clip 的容器子树包围盒等于自身盒', () => {
    const near = entity('near', { x: -5000, y: 0, width: 100, height: 50 })
    const clipped = entity('clipped', {
      x: 5000,
      y: 0,
      width: 100,
      height: 50,
      childIds: ['near'],
      clip: true,
    })
    const index = indexFor(document([clipped, near], ['clipped']))

    expect(index.getSubtreeWorldBounds('clipped')).toEqual(index.getWorldBounds('clipped'))
    // 后代画不到裁剪容器的盒外，因此整棵跳过是对的：near 在屏幕上本来就不存在。
    const visible = resolveStageVisibleEntityIds(
      index,
      resolveStageCullingWindow({ x: 0, y: 0, zoom: 1 }, SURFACE),
    )
    expect(visible.has('clipped')).toBe(false)
    expect(visible.has('near')).toBe(false)
  })

  it('OpenSpec: 裁剪窗口是量化的 / 连续平移不重建内容', () => {
    /*
     * 一格是四分之一屏，此处 200 世界单位。断的是**换窗频率**而不是某两个位置相等：格线的
     * 相位由世界原点决定，随便挑两个点可能恰好骑在一条格线上，那样的用例钉住的是相位而不是
     * 量化本身。横跨 1000 个世界单位最多只能出现 6 个窗口（5 格 + 起点那一格）。
     */
    const keys = new Set<string>()
    for (let x = 0; x <= 1000; x += 1) {
      keys.add(resolveStageCullingWindow({ x: -x, y: 0, zoom: 1 }, SURFACE).key)
    }
    expect(keys.size).toBeLessThanOrEqual(6)
    expect(keys.size).toBeGreaterThan(1)
  })

  it('OpenSpec: 裁剪窗口是量化的 / 档位内缩放不重建内容', () => {
    /*
     * 以视口中心为锚点在一个缩放档位内来回缩放时，窗口必须一动不动。少了这一条的那一版把
     * 窗口做成了缩放的连续函数，一次四十帧的滚轮缩放产生一万七千次 DOM 增删——比根本不裁剪
     * 还慢，而且只有真机上量才看得见。
     */
    const centered = (zoom: number) => resolveStageCullingWindow(
      { x: SURFACE.width / 2 - 400 * zoom, y: SURFACE.height / 2 - 300 * zoom, zoom },
      SURFACE,
    ).key
    // 2^±(1/8) 是一档的半宽，0.5 是档中心。
    const base = centered(0.5)
    expect(centered(0.5 * 2 ** 0.11)).toBe(base)
    expect(centered(0.5 / 2 ** 0.11)).toBe(base)
    expect(centered(0.5 * 2 ** 0.3)).not.toBe(base)
  })

  it('OpenSpec: 裁剪窗口是量化的 / 外扩量覆盖整个量化步长', () => {
    // 逐格扫过两个完整步长：任何一个平移位置上，窗口都必须完整包住可视区。就近吸而外扩量
    // 不足时，恰好存在这样一个位置——窗口尚未翻格而可视区已经越界，症状是边缘闪一下空白。
    for (let step = 0; step <= 160; step += 1) {
      const viewport: StageViewport = { x: -step * 5, y: -step * 3, zoom: 1 }
      const cullingWindow = resolveStageCullingWindow(viewport, SURFACE)
      expect(rectContains(cullingWindow, viewWorldRect(viewport))).toBe(true)
    }
    // 非整数缩放同样成立：格子按量化缩放算，可视区按真实缩放算，两者不是同一个尺寸。
    for (const zoom of [0.15, 0.7, 1.3, 2.9, 5.5]) {
      for (let step = 0; step <= 40; step += 1) {
        const viewport: StageViewport = { x: -step * 37, y: step * 23, zoom }
        const cullingWindow = resolveStageCullingWindow(viewport, SURFACE)
        expect(rectContains(cullingWindow, viewWorldRect(viewport))).toBe(true)
      }
    }
  })

  it('OpenSpec: 按 id 查 DOM 的目标必须豁免 / 节点级豁免只带上祖先链', () => {
    const leaf = entity('leaf', { x: 0, y: 0, width: 10, height: 10 })
    const sibling = entity('sibling', { x: 40, y: 0, width: 10, height: 10 })
    const far = entity('far', {
      x: 9000,
      y: 9000,
      width: 100,
      height: 50,
      childIds: ['leaf', 'sibling'],
      clip: true,
    })
    const index = indexFor(document([far, leaf, sibling], ['far']))
    const cullingWindow = resolveStageCullingWindow({ x: 0, y: 0, zoom: 1 }, SURFACE)

    const nodeExempt = resolveStageVisibleEntityIds(index, cullingWindow, { nodes: ['leaf'] })
    expect(nodeExempt.has('leaf')).toBe(true)
    // 祖先必须一起来，否则它自己在 DOM 里挂不上去。
    expect(nodeExempt.has('far')).toBe(true)
    expect(nodeExempt.has(ROOT_FRAME_ID)).toBe(true)
    // 兄弟不跟着来：豁免的理由是「有人按这个 id 去 DOM 里找它」，找的就是那一个。
    expect(nodeExempt.has('sibling')).toBe(false)

    const subtreeExempt = resolveStageVisibleEntityIds(index, cullingWindow, { subtrees: ['far'] })
    expect(subtreeExempt.has('leaf')).toBe(true)
    expect(subtreeExempt.has('sibling')).toBe(true)
  })

  it('OpenSpec: 场景只渲染与裁剪窗口相交的子树 / 小图上可见集等于全集', () => {
    const a = entity('a', { x: 0, y: 0, width: 100, height: 50 })
    const b = entity('b', { x: 120, y: 0, width: 100, height: 50 })
    const index = indexFor(document([a, b], ['a', 'b']))
    const visible = resolveStageVisibleEntityIds(
      index,
      resolveStageCullingWindow({ x: 0, y: 0, zoom: 1 }, SURFACE),
    )
    expect([...visible].sort()).toEqual([...index.order].sort())
  })

  it('图面尚未量到尺寸时窗口覆盖一切', () => {
    const a = entity('a', { x: 40000, y: 40000, width: 100, height: 50 })
    const index = indexFor(document([a], ['a']))
    const cullingWindow = resolveStageCullingWindow(
      { x: 0, y: 0, zoom: 1 },
      { width: 0, height: 0 },
    )
    expect(resolveStageVisibleEntityIds(index, cullingWindow).has('a')).toBe(true)
  })
})
