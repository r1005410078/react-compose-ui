import { describe, expect, it } from 'vitest'
import { createStagePanPlugin, STAGE_PAN_PLUGIN_ID } from './pan-plugin'
import { createStagePluginRegistry } from './plugin-registry'
import { createStageSessionArbiter } from './session-arbiter'
import { STAGE_GESTURE_PRIORITY } from './gesture-priority'
import type {
  StageInteractionEffect,
  StageInteractionSnapshot,
} from '../interaction-controller'
import type { StagePluginContext, StagePointerDownEvent } from './kernel-types'

const MODIFIERS = { shift: false, alt: false, command: false } as const
const VIEWPORT = { x: 100, y: 50, zoom: 2 }

/** 只保留 pan 判定与发布需要的字段；插件不读文档与场景索引。 */
function harness(options: {
  readonly tool?: string
  readonly temporaryPan?: boolean
} = {}) {
  const effects: StageInteractionEffect[] = []
  const published: StageInteractionSnapshot[] = []
  const idle = { phase: 'idle', temporaryPan: options.temporaryPan ?? false }
  const ctx = {
    get context() {
      return { tool: options.tool ?? 'select', viewport: VIEWPORT }
    },
    get index() {
      throw new Error('pan 插件不得读取场景索引')
    },
    get snapshot() {
      return { ...idle }
    },
    apply: (next: readonly StageInteractionEffect[]) => { effects.push(...next) },
    publish: (next: StageInteractionSnapshot) => { published.push(next) },
    idleSnapshot: () => ({ ...idle }),
  } as unknown as StagePluginContext
  return { ctx, effects, published }
}

function pointerDown(overrides: Partial<StagePointerDownEvent> = {}): StagePointerDownEvent {
  return {
    type: 'pointer.down',
    pointerId: 7,
    button: 0,
    point: { x: 10, y: 20 },
    hit: { kind: 'surface' },
    modifiers: MODIFIERS,
    ...overrides,
  } as StagePointerDownEvent
}

describe('OpenSpec: stage-engine / 平移手势插件 / 三种入口都接管平移', () => {
  it('pan 工具下接管', () => {
    const { ctx, effects } = harness({ tool: 'pan' })

    const session = createStagePanPlugin().claim(pointerDown(), ctx)

    expect(session).not.toBeNull()
    expect(effects).toContainEqual({ type: 'pointer.capture', pointerId: 7 })
  })

  it('临时平移状态下即使工具是 select 也接管', () => {
    const { ctx } = harness({ tool: 'select', temporaryPan: true })

    expect(createStagePanPlugin().claim(pointerDown(), ctx)).not.toBeNull()
  })

  it('中键按下与工具无关地接管', () => {
    const { ctx } = harness({ tool: 'select' })

    expect(createStagePanPlugin().claim(pointerDown({ button: 1 }), ctx)).not.toBeNull()
  })

  it('三个条件都不满足时不接管', () => {
    const { ctx, effects, published } = harness({ tool: 'select' })

    expect(createStagePanPlugin().claim(pointerDown(), ctx)).toBeNull()
    // 不接管就不得有任何副作用，否则后续插件会在被污染的状态上判定。
    expect(effects).toEqual([])
    expect(published).toEqual([])
  })

  it('接管时发布 pan phase 且保留 temporaryPan', () => {
    const { ctx, published } = harness({ tool: 'select', temporaryPan: true })

    createStagePanPlugin().claim(pointerDown(), ctx)

    expect(published).toEqual([expect.objectContaining({ phase: 'pan', temporaryPan: true })])
  })
})

describe('OpenSpec: stage-engine / 平移手势插件 / 位移以按下时视口为基线', () => {
  it('每帧位移都相对按下点与按下时视口', () => {
    const { ctx, effects } = harness({ tool: 'pan' })
    const session = createStagePanPlugin().claim(pointerDown(), ctx)
    if (session === null || session === 'consumed') throw new Error('应当接管')

    session.update({ type: 'pointer.move', pointerId: 7, point: { x: 30, y: 25 }, modifiers: MODIFIERS }, ctx)
    session.update({ type: 'pointer.move', pointerId: 7, point: { x: 40, y: 20 }, modifiers: MODIFIERS }, ctx)

    // 第二帧不得在第一帧结果上再累加：基线是按下时的视口。
    expect(effects.filter((item) => item.type === 'viewport.change')).toEqual([
      { type: 'viewport.change', viewport: { x: 120, y: 55, zoom: 2 } },
      { type: 'viewport.change', viewport: { x: 130, y: 50, zoom: 2 } },
    ])
  })

  it('忽略与平移无关的事件', () => {
    const { ctx, effects } = harness({ tool: 'pan' })
    const session = createStagePanPlugin().claim(pointerDown(), ctx)
    if (session === null || session === 'consumed') throw new Error('应当接管')
    effects.length = 0

    session.update({ type: 'temporary-pan.start' }, ctx)

    expect(effects).toEqual([])
  })
})

describe('OpenSpec: stage-engine / 平移手势插件 / 平移不产生文档命令', () => {
  it('松手只回到空闲并释放捕获', () => {
    const { ctx, effects, published } = harness({ tool: 'pan' })
    const session = createStagePanPlugin().claim(pointerDown(), ctx)
    if (session === null || session === 'consumed') throw new Error('应当接管')
    effects.length = 0
    published.length = 0

    session.commit(ctx)

    expect(effects).toEqual([{ type: 'pointer.release', pointerId: 7 }])
    expect(published).toEqual([expect.objectContaining({ phase: 'idle' })])
    // 平移不引用任何 Entity，因此不得请求命令。
    expect(effects.some((item) => item.type === 'command.dispatch')).toBe(false)
  })
})

describe('OpenSpec: stage-engine / Stage 交互插件仲裁 / 依据活动插件身份处理非指针事件', () => {
  it('接管后暴露插件 id，释放后归空', () => {
    const { ctx } = harness({ tool: 'pan' })
    const arbiter = createStageSessionArbiter(
      createStagePluginRegistry([createStagePanPlugin()]),
    )

    expect(arbiter.activePluginId()).toBeNull()

    arbiter.begin(pointerDown(), ctx)
    expect(arbiter.activePluginId()).toBe(STAGE_PAN_PLUGIN_ID)

    arbiter.cancel(ctx)
    expect(arbiter.activePluginId()).toBeNull()
  })

  it('未被接管时不记录插件 id', () => {
    const { ctx } = harness({ tool: 'select' })
    const arbiter = createStageSessionArbiter(
      createStagePluginRegistry([createStagePanPlugin()]),
    )

    expect(arbiter.begin(pointerDown(), ctx)).toBe('declined')
    expect(arbiter.activePluginId()).toBeNull()
  })
})

describe('OpenSpec: stage-engine / 平移手势插件 / 优先级取自表', () => {
  it('注册优先级与 STAGE_GESTURE_PRIORITY 中的 pan 一致', () => {
    const fromTable = STAGE_GESTURE_PRIORITY.find(({ id }) => id === STAGE_PAN_PLUGIN_ID)

    expect(createStagePanPlugin().priority).toBe(fromTable?.priority)
  })

  it('排在单体插件之前', () => {
    const registry = createStagePluginRegistry([
      { id: 'legacy-monolith', priority: 0, claim: () => null },
      createStagePanPlugin(),
    ])

    expect(registry.ordered().map(({ id }) => id)).toEqual([STAGE_PAN_PLUGIN_ID, 'legacy-monolith'])
  })
})
