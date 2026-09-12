import { describe, expect, it } from 'vitest'
import {
  composeGridCellAtPoint,
  composeGridColumnWidth,
  composeGridContentHeight,
  findComposeGridVacancy,
  projectComposeGridCell,
  solveComposeGrid,
  type ComposeGridCell,
  type ComposeGridMetrics,
} from './grid-geometry'

const metrics: ComposeGridMetrics = {
  columns: 12,
  rowHeight: 48,
  rowGap: 6,
  columnGap: 6,
  contentWidth: 720,
}

function cell(id: string, x: number, y: number, w: number, h: number): ComposeGridCell {
  return { id, x, y, w, h }
}

function at(solved: readonly ComposeGridCell[], id: string) {
  const found = solved.find((item) => item.id === id)
  expect(found, `期望解算结果里有 ${id}`).toBeDefined()
  return found!
}

describe('OpenSpec: compose-document / 网格求解是 core 的纯函数', () => {
  it('落点占住已有卡片时向下推挤', () => {
    const solved = solveComposeGrid([
      cell('a', 0, 0, 4, 2),
      cell('trend', 0, 2, 7, 2),
      cell('list', 7, 2, 5, 2),
      cell('drop', 0, 2, 4, 2),
    ], { columns: 12, float: true, anchorId: 'drop' })

    expect(at(solved, 'drop')).toMatchObject({ x: 0, y: 2 })
    // 被压住的那张下移到不再重叠的第一行。
    expect(at(solved, 'trend')).toMatchObject({ x: 0, y: 4 })
    // 没有被压住的一动不动——推挤是碰撞驱动的，不是整块重排。
    expect(at(solved, 'list')).toMatchObject({ x: 7, y: 2 })
    expect(at(solved, 'a')).toMatchObject({ x: 0, y: 0 })
  })

  it('重力填上空洞，列坐标不变', () => {
    // 中间那一行（原来的 trend）已被删除。
    const solved = solveComposeGrid([
      cell('p', 0, 0, 6, 1),
      cell('q', 6, 0, 6, 1),
      cell('s', 0, 2, 6, 1),
      cell('t', 6, 2, 6, 1),
    ], { columns: 12, float: false })

    expect(at(solved, 's')).toMatchObject({ x: 0, y: 1 })
    expect(at(solved, 't')).toMatchObject({ x: 6, y: 1 })
  })

  it('重力关闭时保持作者行号', () => {
    const solved = solveComposeGrid([
      cell('p', 0, 0, 6, 1),
      cell('s', 0, 2, 6, 1),
    ], { columns: 12, float: true })

    expect(at(solved, 's')).toMatchObject({ y: 2 })
  })

  it('重力只向上，不向左靠', () => {
    const solved = solveComposeGrid([cell('right', 8, 0, 4, 2)], { columns: 12, float: false })
    expect(at(solved, 'right')).toMatchObject({ x: 8, y: 0 })
  })

  it('同尺寸也不交换，只向下推', () => {
    const solved = solveComposeGrid([
      cell('held', 0, 0, 4, 2),
      cell('drop', 0, 0, 4, 2),
    ], { columns: 12, float: true, anchorId: 'drop' })

    expect(at(solved, 'drop')).toMatchObject({ x: 0, y: 0 })
    expect(at(solved, 'held')).toMatchObject({ x: 0, y: 2 })
  })

  it('连锁推挤逐级下移且终止', () => {
    const solved = solveComposeGrid([
      cell('a', 0, 0, 12, 1),
      cell('b', 0, 1, 12, 1),
      cell('c', 0, 2, 12, 1),
      cell('drop', 0, 0, 12, 1),
    ], { columns: 12, float: true, anchorId: 'drop' })

    expect(at(solved, 'drop').y).toBe(0)
    expect(at(solved, 'a').y).toBe(1)
    expect(at(solved, 'b').y).toBe(2)
    expect(at(solved, 'c').y).toBe(3)
  })

  it('二十张卡的连锁推挤终止', () => {
    const many = Array.from({ length: 20 }, (_, index) => cell(`n${index}`, 0, index, 12, 1))
    const solved = solveComposeGrid(
      [...many, cell('drop', 0, 0, 12, 1)],
      { columns: 12, float: true, anchorId: 'drop' },
    )
    expect(solved).toHaveLength(21)
    expect(at(solved, 'n19').y).toBe(20)
  })

  it('手势目标同样受重力作用，因此求解幂等', () => {
    const once = solveComposeGrid([cell('drop', 0, 5, 4, 2)], {
      columns: 12,
      float: false,
      anchorId: 'drop',
    })
    // 拖到空网格的第 5 行即贴着上方落下——豁免它会让下一次重新求解时它自己跳上去。
    expect(at(once, 'drop')).toMatchObject({ x: 0, y: 0 })

    const twice = solveComposeGrid(once, { columns: 12, float: false })
    expect(twice).toEqual(once)
  })

  it('对任意一组连续求解两次结果相同', () => {
    const input = [
      cell('a', 0, 0, 4, 2),
      cell('b', 2, 1, 4, 2),
      cell('c', 9, 3, 3, 1),
      cell('d', 0, 7, 12, 2),
    ]
    const once = solveComposeGrid(input, { columns: 12, float: false })
    expect(solveComposeGrid(once, { columns: 12, float: false })).toEqual(once)
  })

  it('跨度超出列数在读取时钳制而不回写', () => {
    const input = [cell('wide', 0, 0, 16, 2)]
    expect(at(solveComposeGrid(input, { columns: 12, float: false }), 'wide').w).toBe(12)
    // 输入本身不被修改：文档里的 16 保留，容器改回 16 列时恢复原跨度。
    expect(input[0]!.w).toBe(16)
    expect(at(solveComposeGrid(input, { columns: 16, float: false }), 'wide').w).toBe(16)
  })

  it('起点钳制进列范围', () => {
    const solved = solveComposeGrid([cell('a', 20, 0, 4, 2)], { columns: 12, float: false })
    expect(at(solved, 'a').x).toBe(8)
  })

  it('不修改输入数组', () => {
    const input = [cell('a', 0, 3, 4, 2)]
    const snapshot = structuredClone(input)
    solveComposeGrid(input, { columns: 12, float: false })
    expect(input).toEqual(snapshot)
  })
})

describe('OpenSpec: layout-engine / 网格容器的预解算', () => {
  it('列宽由内容宽、列数与列间距推出', () => {
    // 720 = 12 * w + 11 * 6 → w = 54.5
    expect(composeGridColumnWidth(metrics)).toBeCloseTo(54.5, 6)
  })

  it('格矩形投影到内容盒像素', () => {
    const rect = projectComposeGridCell({ x: 4, y: 0, w: 4, h: 2 }, metrics)
    expect(rect.x).toBeCloseTo(4 * (54.5 + 6), 6)
    expect(rect.width).toBeCloseTo(4 * (54.5 + 6) - 6, 6)
    expect(rect.height).toBe(2 * (48 + 6) - 6)
  })

  it('最后一列的右边缘恰好落在内容盒右边', () => {
    const rect = projectComposeGridCell({ x: 8, y: 0, w: 4, h: 2 }, metrics)
    expect(rect.x + rect.width).toBeCloseTo(metrics.contentWidth, 6)
  })

  it('容器变宽时列宽跟着变而格坐标与行高不变', () => {
    const wider = { ...metrics, contentWidth: 900 }
    const before = projectComposeGridCell({ x: 4, y: 1, w: 4, h: 2 }, metrics)
    const after = projectComposeGridCell({ x: 4, y: 1, w: 4, h: 2 }, wider)
    expect(after.width).toBeGreaterThan(before.width)
    expect(after.y).toBe(before.y)
    expect(after.height).toBe(before.height)
  })

  it('内容高度由最下面一张卡决定', () => {
    expect(composeGridContentHeight([cell('a', 0, 0, 4, 2), cell('b', 4, 4, 4, 2)], metrics))
      .toBe(6 * (48 + 6) - 6)
  })

  it('空网格的内容高度是 0', () => {
    expect(composeGridContentHeight([], metrics)).toBe(0)
  })

  it('落点取该点所在的格而不是最近的格线', () => {
    const step = 54.5 + 6
    // 落在第 1 格靠右侧：仍然是第 1 格，不因为离第 2 格的线更近而跳过去。
    expect(composeGridCellAtPoint({ x: step * 1.9, y: 0 }, metrics)).toMatchObject({ x: 1 })
    expect(composeGridCellAtPoint({ x: step * 2.1, y: 0 }, metrics)).toMatchObject({ x: 2 })
  })

  it('落点的列钳制在范围内，行不设上界', () => {
    expect(composeGridCellAtPoint({ x: 99999, y: 0 }, metrics).x).toBe(11)
    expect(composeGridCellAtPoint({ x: -50, y: -50 }, metrics)).toMatchObject({ x: 0, y: 0 })
    expect(composeGridCellAtPoint({ x: 0, y: 54 * 40 }, metrics).y).toBeGreaterThan(30)
  })
})

describe('OpenSpec: stage-engine / 往网格里新建对象', () => {
  it('取第一块放得下的空位，不是最下面一行', () => {
    // 右边整片空着时，新卡片该落在那里而不是被甩到最下面。
    const cells = [cell('a', 0, 0, 4, 2), cell('b', 0, 2, 4, 2)]
    expect(findComposeGridVacancy(cells, { columns: 12, w: 4, h: 2 }))
      .toEqual({ x: 4, y: 0 })
  })

  it('整行放不下时换下一行', () => {
    const cells = [cell('a', 0, 0, 10, 1)]
    expect(findComposeGridVacancy(cells, { columns: 12, w: 4, h: 1 }))
      .toEqual({ x: 0, y: 1 })
  })

  it('空网格落在原点', () => {
    expect(findComposeGridVacancy([], { columns: 12, w: 4, h: 2 })).toEqual({ x: 0, y: 0 })
  })

  it('每一行都占满时落到最下面一行之后', () => {
    const cells = [cell('a', 0, 0, 12, 1), cell('b', 0, 1, 12, 1)]
    expect(findComposeGridVacancy(cells, { columns: 12, w: 4, h: 1 })).toEqual({ x: 0, y: 2 })
  })

  it('跨度超出列数时先钳制再找位', () => {
    expect(findComposeGridVacancy([], { columns: 12, w: 99, h: 1 })).toEqual({ x: 0, y: 0 })
  })
})
