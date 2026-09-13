import { describe, expect, it } from 'vitest'
import {
  applyDocumentPatches,
  createBuiltinCommandHandlers,
  getComposeHatch,
  type ComposeDocument,
} from '@compose-ui/core'
import { planStageHatchDetach, type StageDraftingCommitContext } from './index'

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
