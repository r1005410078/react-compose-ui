import { describe, expect, it } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_BUILTIN_COMPONENT_KEYS,
  applyDocumentPatches,
  createBuiltinCommandHandlers,
  getComposeCurve,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type EditorCommand,
} from '@compose-ui/core'
import { createStageSceneIndex } from '@compose-ui/stage-engine'
import { planStageBoolean, planStageFlatten } from './boolean-plan'
import type { StageDraftingCommitContext } from './drafting-entity'

const rect = (x: number, y: number, w: number, h: number) => ({
  kind: 'polyline' as const,
  closed: true,
  vertices: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
})

/** 一条曲线 Entity；盒等于紧包围盒，与绘制路径落地时的初值一致。 */
function curveEntity(id: string, name: string, geometry: ReturnType<typeof rect>): ComposeEntity {
  const normalized = normalizeComposeCurveGeometry(geometry)
  return {
    id,
    name,
    components: {
      Composition: { presetId: 'curve', baseComponentKeys: ['Renderer'], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: normalized.offset,
        width: { mode: 'fixed', value: normalized.size.width },
        height: { mode: 'fixed', value: normalized.size.height },
      },
      Visibility: { visible: true },
      Lock: { locked: false },
      Renderer: { type: 'curve', props: { stroke: '#ff3b30' } },
      Appearance: { backgroundPaint: { kind: 'solid', color: '#2f3b4d' } },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: normalized.curve,
    },
  } as never
}

function scene(children: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    rootIds: ['frame'],
    canvas: {},
    entities: {
      frame: {
        id: 'frame',
        name: '场景',
        components: {
          Composition: { presetId: 'frame', baseComponentKeys: [], capabilityIds: [] },
          Transform: { rotation: 0 },
          LayoutItem: {
            positioning: 'absolute',
            offset: { x: 0, y: 0 },
            width: { mode: 'fixed', value: 800 },
            height: { mode: 'fixed', value: 600 },
          },
          Visibility: { visible: true },
          Lock: { locked: false },
          Hierarchy: { childIds: children.map((child) => child.id) },
          Frame: { size: { width: 800, height: 600 } },
        },
      },
      ...Object.fromEntries(children.map((child) => [child.id, child])),
    },
  } as never
}

function snapshotOf(document: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.values(document.entities).map((item) => {
      const layout = (item as never as { components: Record<string, never> })
        .components.LayoutItem as never as {
          offset: { x: number; y: number }
          width: { value: number }
          height: { value: number }
          positioning: string
        }
      return [item.id, {
        x: layout.offset.x,
        y: layout.offset.y,
        width: layout.width.value,
        height: layout.height.value,
        positioning: layout.positioning,
      }]
    })),
    diagnostics: [],
  } as never
}

function context(document: ComposeDocument): StageDraftingCommitContext {
  let serial = 0
  const layoutSnapshot = snapshotOf(document)
  return {
    document,
    layoutSnapshot,
    index: createStageSceneIndex(document, layoutSnapshot),
    registry: {
      createSeed: () => ({
        ok: true,
        seed: {
          id: 'seed',
          name: '曲线',
          components: {
            Composition: { presetId: 'curve', baseComponentKeys: ['Renderer'], capabilityIds: [] },
            Transform: { rotation: 0 },
            LayoutItem: {
              positioning: 'absolute',
              offset: { x: 0, y: 0 },
              width: { mode: 'fixed', value: 1 },
              height: { mode: 'fixed', value: 1 },
            },
            Visibility: { visible: true },
            Lock: { locked: false },
            Renderer: { type: 'curve', props: {} },
            Appearance: {},
          },
        },
      }),
    } as never,
    idFactory: () => `cmd-${(serial += 1)}`,
    activeFrameId: 'frame',
  }
}

const OPTIONS = {
  label: (name: string) => `拍平 ${name}`,
  rejection: (reason: string, entityName?: string) => `${reason}:${entityName ?? ''}`,
}

/**
 * 把命令跑进文档，断言的才是「拍平之后文档变成什么样」。
 *
 * 批次由事务运行时展开而不是由某个 handler 执行，因此这里按同样的语义把它摊平。
 */
function flatten(commands: readonly EditorCommand[]): readonly EditorCommand[] {
  return commands.flatMap((command) => (
    command.type === BUILTIN_COMMAND_TYPES.batch
      ? flatten((command.payload as never as { commands: readonly EditorCommand[] }).commands)
      : [command]
  ))
}

function run(document: ComposeDocument, commands: readonly EditorCommand[]): ComposeDocument {
  const handlers = createBuiltinCommandHandlers()
  return flatten(commands).reduce((current, command) => {
    const handler = handlers.find((item) => item.type === command.type)!
    const result = handler.execute(current, command)
    if (result.status !== 'patches') throw new Error(`命令没有产生修改：${result.status}`)
    const applied = applyDocumentPatches(current, result.patches)
    if (!('document' in applied)) throw new Error('Patch 应用失败')
    return applied.document
  }, document)
}

describe('OpenSpec: stage / 布尔运算的落地规划', () => {
  it('一个操作数原地改几何：id、名称与外观全部留着', () => {
    const before = scene([curveEntity('a', '外框', rect(0, 0, 100, 60))])
    const plan = planStageFlatten(context(before), ['a'], OPTIONS)
    expect(plan.branch).toBe('in-place')
    expect(plan.commands).toHaveLength(1)
    expect(plan.commands[0]!.type).toBe(BUILTIN_COMMAND_TYPES.setCurve)

    const after = run(before, plan.commands)
    // 同一个 Entity 还在，而它的几何换成了 path。
    expect(Object.keys(after.entities)).toEqual(Object.keys(before.entities))
    expect(getComposeCurve(after.entities.a!)?.kind).toBe('path')
    expect(after.entities.a!.name).toBe('外框')
  })

  it('原地那一支的 `resultId` 就是它自己——这个字段的含义只有一句话', () => {
    // 它本来就在选区里，写出来是为了让呈现层不必分支「有时候是产物、有时候是 null」。
    const before = scene([curveEntity('only', '矩形', rect(0, 0, 40, 30))])
    expect(planStageFlatten(context(before), ['only'], OPTIONS).resultId).toBe('only')
  })

  it('多个操作数合并成一个新对象，操作数在同一个事务里删掉', () => {
    const before = scene([
      curveEntity('bottom', '底板', rect(0, 0, 40, 40)),
      curveEntity('top', '盖板', rect(20, 20, 40, 40)),
    ])
    const plan = planStageFlatten(context(before), ['top', 'bottom'], OPTIONS)
    expect(plan.branch).toBe('create')
    // 一个事务：撤销一步 MUST 回到运算之前，而不是回到「删了一半」。
    expect(plan.commands).toHaveLength(1)
    expect(plan.commands[0]!.type).toBe(BUILTIN_COMMAND_TYPES.batch)
  })

  it('合并产物的外观与名称取层序最靠后那个操作数', () => {
    const bottom = curveEntity('bottom', '底板', rect(0, 0, 40, 40))
    const top = curveEntity('top', '盖板', rect(20, 20, 40, 40))
    const before = scene([
      bottom,
      {
        ...top,
        components: {
          ...top.components,
          Appearance: { backgroundPaint: { kind: 'solid', color: '#ffffff' } },
        },
      } as ComposeEntity,
    ])
    const plan = planStageFlatten(context(before), ['top', 'bottom'], OPTIONS)
    const after = run(before, plan.commands)
    const created = Object.values(after.entities)
      .find((item) => item.id !== 'frame') as ComposeEntity
    expect(created.name).toBe('底板')
    expect(created.components.Appearance).toEqual({
      backgroundPaint: { kind: 'solid', color: '#2f3b4d' },
    })
    // 两个操作数都没了。
    expect(after.entities.bottom).toBeUndefined()
    expect(after.entities.top).toBeUndefined()
  })

  it('被拒绝时一条命令都不发，并带上原因与对象名', () => {
    const locked = curveEntity('a', '外框', rect(0, 0, 40, 40))
    const before = scene([{
      ...locked,
      components: { ...locked.components, Lock: { locked: true } },
    } as ComposeEntity])
    const plan = planStageFlatten(context(before), ['a'], OPTIONS)
    expect(plan.branch).toBe('rejected')
    expect(plan.commands).toHaveLength(0)
    expect(plan.notice).toBe('locked:外框')
  })
})

describe('OpenSpec: stage / 区域运算恒走合并那一支', () => {
  it('并集产出一个新曲线 Entity，两个操作数在同一个事务里删掉', () => {
    const before = scene([
      curveEntity('bottom', '底板', rect(0, 0, 40, 40)),
      curveEntity('top', '盖板', rect(20, 20, 40, 40)),
    ])
    const plan = planStageBoolean(context(before), ['top', 'bottom'], 'union', OPTIONS)
    expect(plan.branch).toBe('create')
    expect(plan.commands).toHaveLength(1)

    const after = run(before, plan.commands)
    expect(after.entities.bottom).toBeUndefined()
    expect(after.entities.top).toBeUndefined()
    const created = Object.values(after.entities).find((item) => item.id !== 'frame')!
    // 外观与名称取层序最靠后那一个，与拍平的合并支同一条规则。
    expect(created.name).toBe('底板')
  })

  it('交集为空时一条命令都不发', () => {
    const before = scene([
      curveEntity('a', '左', rect(0, 0, 20, 20)),
      curveEntity('b', '右', rect(100, 100, 20, 20)),
    ])
    const plan = planStageBoolean(context(before), ['a', 'b'], 'intersect', OPTIONS)
    expect(plan.branch).toBe('rejected')
    expect(plan.commands).toHaveLength(0)
    expect(plan.notice).toBe('empty:')
  })

  it('产物的 id 由 `resultId` 报出来，呈现层据此把选区挪过去', () => {
    /*
     * 一次**消费选区**、产出一个对象的操作，做完之后用户手上握着的应当是结果，与编组同一条。
     * 不报的话操作数被删掉、用户自己建立的那份选区跟着被静默清空——他读到的是「我按了一下，
     * 东西没了」。断的是「它指向真的建出来的那个 Entity」而不是某个具体字符串：id 由
     * `idFactory` 给，钉住字面量只会钉住夹具。
     */
    const before = scene([
      curveEntity('bottom', '底板', rect(0, 0, 40, 40)),
      curveEntity('top', '盖板', rect(20, 0, 40, 40)),
    ])
    const plan = planStageBoolean(context(before), ['bottom', 'top'], 'union', OPTIONS)
    expect(plan.resultId).not.toBeNull()

    const after = run(before, plan.commands)
    expect(after.entities[plan.resultId!]).toBeDefined()
    // 被删掉的那两个都不是它——挪过去的必须是产物。
    expect(plan.resultId).not.toBe('bottom')
    expect(plan.resultId).not.toBe('top')
  })

  it('被拒绝时 `resultId` 是 null——没有产物可以挪过去', () => {
    const before = scene([
      curveEntity('a', '左', rect(0, 0, 20, 20)),
      curveEntity('b', '右', rect(100, 100, 20, 20)),
    ])
    expect(planStageBoolean(context(before), ['a', 'b'], 'intersect', OPTIONS).resultId).toBeNull()
  })

  it('区域运算不走原地那一支——产物不再是原来任何一个', () => {
    const before = scene([
      curveEntity('a', '左', rect(0, 0, 40, 40)),
      curveEntity('b', '右', rect(20, 0, 40, 40)),
    ])
    expect(planStageBoolean(context(before), ['a', 'b'], 'subtract', OPTIONS).branch).toBe('create')
  })
})
