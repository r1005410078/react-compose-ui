import { describe, expect, it } from 'vitest'
import {
  applyDocumentPatches,
  createBuiltinCommandHandlers,
  getComposeHatch,
  type ComposeDocument,
  type EditorCommand,
} from '@compose-ui/core'
import { createStageSceneIndex } from '@compose-ui/stage-engine'
import {
  planStageHatchDetach,
  planStageHatchRegeneration,
  type StageDraftingCommitContext,
} from './index'

const CURVE = {
  kind: 'polyline',
  closed: true,
  vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }],
} as const

/** 一份只有一块填充的文档；断开关联不读盒也不读索引，因此其余字段都用窄替身。 */
function sceneWithFill(): ComposeDocument {
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
          Lock: { locked: false },
          Hierarchy: { childIds: ['fill'] },
        },
      },
      fill: {
        id: 'fill',
        name: '填充',
        components: {
          Composition: { presetId: 'hatch', baseComponentKeys: ['Renderer'], capabilityIds: [] },
          Lock: { locked: false },
          Renderer: { type: 'curve', props: {} },
          Curve: CURVE,
          Appearance: { backgroundPaint: { kind: 'solid', color: '#2f3b4d' } },
          Hatch: { seed: { x: 20, y: 15 }, boundaryIds: ['rect', 'line'] },
        },
      },
    },
  } as never
}

function context(document: ComposeDocument): StageDraftingCommitContext {
  let serial = 0
  return {
    document,
    layoutSnapshot: { entities: {} } as never,
    index: {} as never,
    registry: {} as never,
    idFactory: () => `cmd-${(serial += 1)}`,
  }
}

/** 把命令真的跑一遍，断言的才是「断开之后文档变成什么样」而不是「载荷长什么样」。 */
function run(document: ComposeDocument, command: NonNullable<ReturnType<typeof planStageHatchDetach>>) {
  const handler = createBuiltinCommandHandlers().find((item) => item.type === command.type)!
  const result = handler.execute(document, command)
  if (result.status !== 'patches') throw new Error(`命令没有产生修改：${result.status}`)
  const applied = applyDocumentPatches(document, result.patches)
  if (!('document' in applied)) throw new Error('Patch 应用失败')
  return applied.document
}

describe('OpenSpec: basic-materials / 断开关联之后变回普通曲线', () => {
  it('Hatch 消失，而几何与填充色一个字节不动', () => {
    const before = sceneWithFill()
    const command = planStageHatchDetach(context(before), 'fill', (name) => `断开「${name}」的关联`)
    expect(command).not.toBeNull()

    const after = run(before, command!)
    const entity = after.entities.fill!
    expect(getComposeHatch(entity)).toBeUndefined()
    // 断开的是「跟着边界走」这件事，不是这块墨——它本来就是一条闭合多段线。
    expect(entity.components.Curve).toEqual(CURVE)
    expect(entity.components.Appearance).toEqual({
      backgroundPaint: { kind: 'solid', color: '#2f3b4d' },
    })
  })

  it('标签带上对象名——历史里要读得出断的是哪一块', () => {
    const document = sceneWithFill()
    const command = planStageHatchDetach(context(document), 'fill', (name) => `断开「${name}」的关联`)
    expect(command?.meta?.label).toBe('断开「填充」的关联')
  })

  it('本来就不是填充时什么都不发', () => {
    // 一条普通曲线上没有可断的关联；发一条会被 `component.missing` 拒掉的命令比不发更糟。
    const document = sceneWithFill()
    const plain = { ...document, entities: { ...document.entities } } as ComposeDocument
    delete (plain.entities.fill!.components as Record<string, unknown>).Hatch
    expect(planStageHatchDetach(context(plain), 'fill', (name) => name)).toBeNull()
  })
})

/** 一个被竖线切成两半的矩形，左半边填上色；`hatch` 给什么就写什么。 */
function bisectedScene(hatch: Record<string, unknown>): ComposeDocument {
  const chrome = { Lock: { locked: false }, Visibility: { visible: true }, Transform: { rotation: 0 } }
  const item = (x: number, y: number, width: number, height: number) => ({
    positioning: 'absolute',
    offset: { x, y },
    width: { mode: 'fixed', value: width, min: 1, max: null },
    height: { mode: 'fixed', value: height, min: 1, max: null },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    alignSelf: 'auto',
  })
  const piece = (
    id: string,
    curve: unknown,
    x: number, y: number, width: number, height: number,
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    name: id,
    components: {
      ...chrome,
      Composition: { presetId: 'curve', baseComponentKeys: ['Renderer'], capabilityIds: [] },
      Renderer: { type: 'curve', props: {} },
      Curve: curve,
      LayoutItem: item(x, y, width, height),
      ...extra,
    },
  })
  const box = (w: number, h: number) => ({
    kind: 'polyline',
    closed: true,
    vertices: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
  })
  return {
    schemaVersion: 7,
    rootIds: ['frame'],
    canvas: {},
    entities: {
      frame: {
        id: 'frame',
        name: '场景',
        components: {
          ...chrome,
          Composition: { presetId: 'frame', baseComponentKeys: [], capabilityIds: [] },
          Hierarchy: { childIds: ['rect', 'line', 'fill'] },
          Frame: { size: { width: 1000, height: 800 } },
          LayoutItem: item(0, 0, 1000, 800),
        },
      },
      rect: piece('rect', box(400, 300), 100, 100, 400, 300),
      line: piece(
        'line',
        { kind: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 400 } },
        300, 50, 1, 400,
      ),
      /*
       * 这块填充是**过期**的：存着的几何只有 150 宽，而现在那条线在 x=300，重求出来是 200 宽。
       * 夹具必须过期——与当前的面逐位相同时求解会说「这一下是改它的颜色」，那时本来就没有什么
       * 可重新生成的。
       */
      fill: piece('fill', box(150, 300), 100, 100, 150, 300, {
        Composition: { presetId: 'hatch', baseComponentKeys: ['Renderer'], capabilityIds: [] },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#2f3b4d' } },
        Hatch: hatch,
      }),
    },
  } as never
}

function solvingContext(document: ComposeDocument): StageDraftingCommitContext {
  let serial = 0
  const boxes: Record<string, unknown> = {
    frame: { x: 0, y: 0, width: 1000, height: 800 },
    rect: { x: 100, y: 100, width: 400, height: 300 },
    line: { x: 300, y: 50, width: 1, height: 400 },
    fill: { x: 100, y: 100, width: 150, height: 300 },
  }
  const snapshot = { boxes, diagnostics: [] } as never
  return {
    document,
    layoutSnapshot: snapshot,
    index: createStageSceneIndex(document, snapshot),
    registry: {} as never,
    idFactory: () => `cmd-${(serial += 1)}`,
    activeFrameId: 'frame',
  }
}

/** batch 里那条写 `Hatch` 的命令。 */
function hatchWrite(command: EditorCommand) {
  const children = (command.payload as { commands?: readonly EditorCommand[] }).commands ?? [command]
  return children.find((child) => child.payload.key === 'Hatch')
}

describe('OpenSpec: stage / 重新生成把几何、锚点与清单一起写回', () => {
  it('一块没有清单的既有填充，第一次重新生成就把清单补上', () => {
    /*
     * 这是这次变更的**迁移路径**：已落地的每一块填充都没有 `boundaryIds`，缺席即不跟随。
     * 补上那一下之后它才开始跟着边界走；不补的话那些填充永远停在手动关联，而用户按下的
     * 那一下什么迁移都没做。
     */
    const document = bisectedScene({ seed: { x: 100, y: 150 } })
    const command = planStageHatchRegeneration(solvingContext(document), 'fill')
    expect(command).not.toBeNull()
    const write = hatchWrite(command!)
    expect((write?.payload.value as { boundaryIds?: readonly string[] })?.boundaryIds)
      .toEqual(['rect', 'line'])
  })

  it('锚点重取到最大内切圆圆心，而不是留着那个相对盒的旧值', () => {
    // 左半边是 (100,100)–(300,400) 的矩形，盒局部的内切圆圆心就是 (100,150)。
    const document = bisectedScene({ seed: { x: 20, y: 20 }, boundaryIds: ['rect', 'line'] })
    const write = hatchWrite(planStageHatchRegeneration(solvingContext(document), 'fill')!)
    const seed = (write?.payload.value as { seed: { x: number; y: number } }).seed
    expect(seed.x).toBeCloseTo(100, 0)
    expect(seed.y).toBeCloseTo(150, 0)
  })
})
