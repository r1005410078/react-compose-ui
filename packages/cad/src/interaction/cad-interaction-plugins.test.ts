import { describe, expect, it } from 'vitest'
import type { ComposeCommandPrompt } from '@compose-ui/commands'
import { createCadLineEntity, createEmptyCadDocument, type CadDocument } from '../document'
import { createCadSceneIndex } from './cad-scene-index'
import {
  CAD_GESTURE_PRIORITY,
  createCadInteractionPlugins,
} from './cad-interaction-plugins'
import {
  createCadPluginRegistry,
  createCadSessionArbiter,
  type CadInteractionContext,
  type CadInteractionEffect,
  type CadInteractionEvent,
  type CadInteractionSnapshot,
  type CadPluginContext,
  type CadPointerDownEvent,
} from './cad-kernel-profile'

const NO_MODIFIERS = { shift: false, alt: false, command: false } as const

function documentWith(lines: readonly { id: string; start: { x: number; y: number }; end: { x: number; y: number } }[]): CadDocument {
  const base = createEmptyCadDocument()
  return {
    ...base,
    rootIds: lines.map(({ id }) => id),
    entities: Object.fromEntries(
      lines.map((line) => [
        line.id,
        createCadLineEntity(line.id, { layerId: '0', start: line.start, end: line.end }),
      ]),
    ),
  }
}

/** 记录效果与快照的探针；插件的全部可观测输出都从这里流出。 */
function harness(input: {
  readonly document: CadDocument
  readonly prompt?: ComposeCommandPrompt | null
  readonly selection?: readonly string[]
}) {
  const effects: CadInteractionEffect[] = []
  const published: CadInteractionSnapshot[] = []
  const context: CadInteractionContext = {
    document: input.document,
    prompt: input.prompt ?? null,
    selection: input.selection ?? [],
    hitTolerance: 5,
  }
  let snapshot: CadInteractionSnapshot = { selection: context.selection, marquee: null }
  const ctx: CadPluginContext = {
    context,
    index: createCadSceneIndex(input.document, context),
    get snapshot() {
      return snapshot
    },
    apply: (next) => { effects.push(...next) },
    publish: (next) => { published.push(next); snapshot = next },
    idleSnapshot: () => ({ selection: snapshot.selection, marquee: null }),
  }
  const arbiter = createCadSessionArbiter(createCadPluginRegistry(createCadInteractionPlugins()))
  return { arbiter, ctx, effects, published, latest: () => snapshot }
}

const down = (x: number, y: number, overrides: Partial<CadPointerDownEvent> = {}): CadPointerDownEvent => ({
  type: 'pointer.down',
  pointerId: 1,
  button: 0,
  point: { x, y },
  modifiers: NO_MODIFIERS,
  ...overrides,
})

const move = (x: number, y: number): CadInteractionEvent => ({
  type: 'pointer.move',
  pointerId: 1,
  point: { x, y },
  modifiers: NO_MODIFIERS,
})

const up = (x: number, y: number): CadInteractionEvent => ({
  type: 'pointer.up',
  pointerId: 1,
  point: { x, y },
  modifiers: NO_MODIFIERS,
})

const line = { id: 'l1', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } }

describe('OpenSpec: cad-document / CAD 指针手势仲裁 / 优先级表', () => {
  it('顺序是命令取点 > 点选 > 框选，且严格递减', () => {
    expect(CAD_GESTURE_PRIORITY.map(({ id }) => id)).toEqual([
      'cad.command-point',
      'cad.select',
      'cad.marquee',
    ])
    for (let i = 1; i < CAD_GESTURE_PRIORITY.length; i += 1) {
      expect(CAD_GESTURE_PRIORITY[i - 1]!.priority).toBeGreaterThan(CAD_GESTURE_PRIORITY[i]!.priority)
    }
  })
})

describe('OpenSpec: cad-document / CAD 指针手势仲裁 / 命令取点压过点选', () => {
  const pointPrompt: ComposeCommandPrompt = { message: '指定下一点', accepts: ['point'] }

  it('命令等待取点时，点在既有线上得到的是一个点而不是选中', () => {
    const h = harness({ document: documentWith([line]), prompt: pointPrompt })

    expect(h.arbiter.begin(down(50, 0), h.ctx)).toBe('consumed')

    expect(h.effects).toEqual([{ kind: 'command.point', point: { x: 50, y: 0 } }])
    expect(h.published).toEqual([])
  })

  it('没有活动命令时同一次按下选中那条线', () => {
    const h = harness({ document: documentWith([line]) })

    expect(h.arbiter.begin(down(50, 0), h.ctx)).toBe('consumed')

    expect(h.latest().selection).toEqual(['l1'])
    expect(h.effects).toEqual([])
  })

  it('命令等待的不是点时不接管，按下落回点选', () => {
    const h = harness({
      document: documentWith([line]),
      prompt: { message: '选择对象', accepts: ['selection'] },
    })

    h.arbiter.begin(down(50, 0), h.ctx)

    expect(h.latest().selection).toEqual(['l1'])
  })
})

describe('OpenSpec: cad-document / CAD 选择集语义 / 点选', () => {
  it('点选累积，不需要修饰键', () => {
    const document = documentWith([line, { id: 'l2', start: { x: 0, y: 50 }, end: { x: 100, y: 50 } }])
    const first = harness({ document })
    first.arbiter.begin(down(50, 0), first.ctx)

    const second = harness({ document, selection: first.latest().selection })
    second.arbiter.begin(down(50, 50), second.ctx)

    expect(second.latest().selection).toEqual(['l1', 'l2'])
  })

  it('Shift 点选把已选中的移出', () => {
    const h = harness({ document: documentWith([line]), selection: ['l1'] })

    h.arbiter.begin(down(50, 0, { modifiers: { ...NO_MODIFIERS, shift: true } }), h.ctx)

    expect(h.latest().selection).toEqual([])
  })

  it('命令等待选择对象时，点选结果同时喂给命令', () => {
    const h = harness({
      document: documentWith([line]),
      prompt: { message: '选择对象', accepts: ['selection'] },
    })

    h.arbiter.begin(down(50, 0), h.ctx)

    expect(h.effects).toEqual([{ kind: 'command.selection', ids: ['l1'] }])
  })
})

describe('OpenSpec: cad-document / CAD 指针手势仲裁 / 空白处按下开始框选', () => {
  it('拖动中发布选框并按方向给出模式', () => {
    const h = harness({ document: documentWith([line]) })
    h.arbiter.begin(down(0, 200), h.ctx)
    h.arbiter.update(move(120, 260), h.ctx)

    expect(h.effects[0]).toEqual({ kind: 'pointer.capture', pointerId: 1 })
    expect(h.latest().marquee).toEqual({
      bounds: { minX: 0, minY: 200, maxX: 120, maxY: 260 },
      mode: 'window',
    })
  })

  it('右→左拖动给出交叉模式', () => {
    const h = harness({ document: documentWith([line]) })
    h.arbiter.begin(down(120, 200), h.ctx)
    h.arbiter.update(move(0, 260), h.ctx)

    expect(h.latest().marquee?.mode).toBe('crossing')
  })

  it('松手时按判定模式更新选择集并收起选框', () => {
    const h = harness({ document: documentWith([line]) })
    h.arbiter.begin(down(-10, -10), h.ctx)
    h.arbiter.commit(up(110, 10), h.ctx)

    expect(h.latest()).toEqual({ selection: ['l1'], marquee: null })
    expect(h.effects).toContainEqual({ kind: 'pointer.release', pointerId: 1 })
  })

  it('交叉模式抓住穿过选框的线，窗口模式抓不住', () => {
    const document = documentWith([{ id: 'wire', start: { x: -100, y: 0 }, end: { x: 100, y: 0 } }])

    const crossing = harness({ document })
    crossing.arbiter.begin(down(50, -10), crossing.ctx)
    crossing.arbiter.commit(up(-50, 10), crossing.ctx)
    expect(crossing.latest().selection).toEqual(['wire'])

    const window = harness({ document })
    window.arbiter.begin(down(-50, -10), window.ctx)
    window.arbiter.commit(up(50, 10), window.ctx)
    expect(window.latest().selection).toEqual([])
  })

  it('原地松手清空选择集', () => {
    const h = harness({ document: documentWith([line]), selection: ['l1'] })
    h.arbiter.begin(down(200, 200), h.ctx)
    h.arbiter.commit(up(200, 200), h.ctx)

    expect(h.latest().selection).toEqual([])
  })

  it('取消恢复按下之前的选择集并收起选框', () => {
    const h = harness({ document: documentWith([line]), selection: ['l1'] })
    h.arbiter.begin(down(200, 200), h.ctx)
    h.arbiter.update(move(400, 400), h.ctx)

    h.arbiter.cancel(h.ctx)

    expect(h.latest()).toEqual({ selection: ['l1'], marquee: null })
    expect(h.effects).toContainEqual({ kind: 'pointer.release', pointerId: 1 })
  })
})

describe('OpenSpec: cad-document / CAD 指针手势仲裁 / 中键平移走兜底路径', () => {
  it('非主键的按下无人接管', () => {
    const h = harness({ document: documentWith([line]) })

    expect(h.arbiter.begin(down(50, 0, { button: 1 }), h.ctx)).toBe('declined')
    expect(h.effects).toEqual([])
    expect(h.published).toEqual([])
  })

  it('框选进行中的第二次按下被拒绝', () => {
    const h = harness({ document: documentWith([line]) })
    h.arbiter.begin(down(200, 200), h.ctx)

    expect(h.arbiter.begin({ ...down(300, 300), pointerId: 2 }, h.ctx)).toBe('declined')
  })
})
