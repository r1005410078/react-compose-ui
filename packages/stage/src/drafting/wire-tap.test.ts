import { describe, expect, it } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  COMPOSE_JUNCTION_PORT_ID,
  createComposeFrameEntity,
  createComposeLineCurve,
  getComposeLayoutItem,
  normalizeComposeCurveGeometry,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
  type ComposeWire,
  type EditorCommand,
} from '@compose-ui/core'
import { createStageSceneIndex } from '@compose-ui/stage-engine'
import { createStageDraftingCurveCommand, type StageDraftingCommitContext } from './drafting-entity'
import { planStageWireTap } from './wire-tap'

const FRAME_ID = 'frame-root'

/** 一条水平导线；几何与盒都按 `normalizeComposeCurveGeometry` 落地，与真实新建路径一致。 */
function wireEntity(
  id: string,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  options: { readonly wire?: ComposeWire; readonly locked?: boolean } = {},
): ComposeEntity {
  const next = normalizeComposeCurveGeometry(createComposeLineCurve(start, end))
  return {
    id,
    name: id,
    components: {
      Composition: { presetId: 'wire', baseComponentKeys: [], capabilityIds: [] },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: next.offset,
        width: { mode: 'fixed', value: next.size.width, min: 1, max: null },
        height: { mode: 'fixed', value: next.size.height, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      Visibility: { visible: true },
      Lock: { locked: options.locked ?? false },
      Renderer: { type: 'curve', props: { stroke: '#ff3b30', strokeWidth: 2 } },
      Curve: next.curve,
      Wire: options.wire ?? {},
    },
  } as unknown as ComposeEntity
}

function documentWith(entities: readonly ComposeEntity[], childIds: readonly string[]): ComposeDocument {
  const frame = createComposeFrameEntity({ id: FRAME_ID, childIds })
  return {
    schemaVersion: 7,
    canvas: {
      grid: { stepX: 8, stepY: 8, offsetX: 0, offsetY: 0, primaryLineEvery: 5, snapEnabled: false },
      smartSnap: { nodes: false, guides: false },
    },
    rootIds: [FRAME_ID],
    entities: {
      ...Object.fromEntries(entities.map((item) => [item.id, item])),
      [FRAME_ID]: frame,
    },
  } as unknown as ComposeDocument
}

function snapshotOf(value: ComposeDocument): ComposeLayoutSnapshot {
  return {
    revision: 1,
    boxes: Object.fromEntries(Object.values(value.entities).map((item) => {
      const layoutItem = getComposeLayoutItem(item)!
      return [item.id, {
        x: layoutItem.offset.x,
        y: layoutItem.offset.y,
        width: layoutItem.width.value,
        height: layoutItem.height.value,
        positioning: layoutItem.positioning,
      }]
    })),
    diagnostics: [],
  } as unknown as ComposeLayoutSnapshot
}

/** 只认 `junction` 与其余曲线两种 seed 的窄替身：`stage` 不依赖 `materials`。 */
function contextFor(value: ComposeDocument): StageDraftingCommitContext {
  let serial = 0
  const layoutSnapshot = snapshotOf(value)
  return {
    document: value,
    layoutSnapshot,
    index: createStageSceneIndex(value, layoutSnapshot),
    registry: {
      createSeed(presetId: string) {
        return {
          ok: true,
          seed: {
            name: presetId,
            components: {
              Composition: { presetId },
              Transform: { rotation: 0 },
              Appearance: { backgroundPaint: { kind: 'solid', color: '#ff3b30' } },
              LayoutItem: {
                positioning: 'absolute',
                offset: { x: 0, y: 0 },
                width: { mode: 'fixed', value: 6, min: 1, max: null },
                height: { mode: 'fixed', value: 6, min: 1, max: null },
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                alignSelf: 'auto',
              },
              Visibility: { visible: true },
              Lock: { locked: false },
              Renderer: { type: 'curve', props: {} },
              Curve: { kind: 'arc', center: { x: 3, y: 3 }, radius: 3, startAngle: 0, sweep: 360 },
              Ports: { items: [{ id: COMPOSE_JUNCTION_PORT_ID, position: { x: 3, y: 3 } }] },
            },
          },
        }
      },
    } as never,
    idFactory: () => `id-${++serial}`,
    activeFrameId: FRAME_ID,
  }
}

function payloadOf(command: EditorCommand): Record<string, unknown> {
  return command.payload as unknown as Record<string, unknown>
}

describe('planStageWireTap', () => {
  const target = wireEntity('w', { x: 0, y: 0 }, { x: 200, y: 0 })
  const value = documentWith([target], ['w'])

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 线身中间断成两段', () => {
    const plan = planStageWireTap(contextFor(value), { entityId: 'w', point: { x: 100, y: 0 } }, FRAME_ID)

    expect(plan).not.toBeNull()
    // 原 Entity 改成第一段 → 第二段是新 Entity；建节点那一条单独交出来，由调用方排到最后。
    expect(plan!.edits.map((command) => command.type)).toEqual([
      BUILTIN_COMMAND_TYPES.setCurve,
      BUILTIN_COMMAND_TYPES.createEntity,
    ])
    expect(plan!.junction.type).toBe(BUILTIN_COMMAND_TYPES.createEntity)
    expect(plan!.binding.portId).toBe(COMPOSE_JUNCTION_PORT_ID)
    // 两段各把靠近落点的那一端绑到节点。
    expect(payloadOf(plan!.edits[0]!).wire).toEqual({ end: plan!.binding })
    const second = payloadOf(plan!.edits[1]!).entity as ComposeEntity
    expect(second.components.Wire).toEqual({ start: plan!.binding })
  })

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 落在端点上不断线', () => {
    const plan = planStageWireTap(contextFor(value), { entityId: 'w', point: { x: 200, y: 0 } }, FRAME_ID)

    // 那里没有需要断开的线身：只建节点、只改绑，几何一个字节不动。
    expect(plan!.edits.map((command) => command.type)).toEqual([
      BUILTIN_COMMAND_TYPES.updateComponent,
    ])
    expect(payloadOf(plan!.edits[0]!).value).toEqual({ end: plan!.binding })
  })

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 断开的两段继承原来的绑定', () => {
    const bound = wireEntity('w', { x: 0, y: 0 }, { x: 200, y: 0 }, {
      wire: {
        start: { entityId: 'left', portId: 'L' },
        end: { entityId: 'right', portId: 'R' },
      },
    })
    const withPorts = documentWith([bound], ['w'])
    const plan = planStageWireTap(contextFor(withPorts), { entityId: 'w', point: { x: 100, y: 0 } }, FRAME_ID)

    expect(payloadOf(plan!.edits[0]!).wire).toEqual({
      start: { entityId: 'left', portId: 'L' },
      end: plan!.binding,
    })
    const second = payloadOf(plan!.edits[1]!).entity as ComposeEntity
    expect(second.components.Wire).toEqual({
      end: { entityId: 'right', portId: 'R' },
      start: plan!.binding,
    })
  })

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 跨父级不接入', () => {
    // 不接是**可见的**降级（那一端显示自由），而 `wire.parent-mismatch` 是不可见的文档非法。
    expect(planStageWireTap(contextFor(value), { entityId: 'w', point: { x: 100, y: 0 } }, null))
      .toBeNull()
  })

  it('不是导线、或已锁定时不接入', () => {
    const plain = wireEntity('p', { x: 0, y: 0 }, { x: 200, y: 0 })
    /*
     * 普通曲线：既没有 `Wire`，Preset 也不是 `wire`。**两条都要去掉**——判据是两者任一成立，
     * 因为两端都还没接上的导线根本不写 `Wire`，那时它唯一的身份就是 Preset。
     */
    const noWire: ComposeEntity = {
      ...plain,
      components: {
        ...Object.fromEntries(
          Object.entries(plain.components).filter(([key]) => key !== 'Wire'),
        ),
        Composition: { presetId: 'curve', baseComponentKeys: [], capabilityIds: [] },
      },
    } as ComposeEntity
    const locked = wireEntity('l', { x: 0, y: 0 }, { x: 200, y: 0 }, { locked: true })
    const mixed = documentWith([noWire, locked], ['p', 'l'])

    expect(planStageWireTap(contextFor(mixed), { entityId: 'p', point: { x: 100, y: 0 } }, FRAME_ID))
      .toBeNull()
    expect(planStageWireTap(contextFor(mixed), { entityId: 'l', point: { x: 100, y: 0 } }, FRAME_ID))
      .toBeNull()
  })
})

describe('createStageDraftingCurveCommand 的接入', () => {
  const target = wireEntity('w', { x: 0, y: 0 }, { x: 200, y: 0 })
  const value = documentWith([target], ['w'])

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 一次接入收成一个事务', () => {
    const context = contextFor(value)
    const created = createStageDraftingCurveCommand(
      context,
      { kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: 80 } },
      { taps: { start: { entityId: 'w', point: { x: 100, y: 0 } } }, tapLabel: '接线' },
    )

    expect(created).not.toBeNull()
    // 撤销一步必须回到接入之前，而不是回到「接了一半」。
    expect(created!.command.type).toBe(BUILTIN_COMMAND_TYPES.batch)
    const commands = payloadOf(created!.command).commands as readonly EditorCommand[]
    expect(commands).toHaveLength(4)
    /*
     * **节点排在最后**：子级顺序就是绘制顺序。它排在新画的那条导线之前时，接头正中央按下去
     * 抓到的是那条线——而接头是三条支路唯一的公共入口。
     */
    const junctionEntity = payloadOf(commands[3]!).entity as ComposeEntity
    expect((junctionEntity.components.Composition as { presetId: string }).presetId)
      .toBe('junction')
    // 批次的 targetIds 仍指向新画的这条线：`LINE` 的 `U` 靠它出栈。
    const drawn = commands[2]!
    expect(created!.command.meta?.targetIds).toEqual(drawn.meta?.targetIds)
    const entity = payloadOf(drawn).entity as ComposeEntity
    expect(entity.components.Wire).toMatchObject({
      start: { portId: COMPOSE_JUNCTION_PORT_ID },
    })
  })

  it('OpenSpec: stage / 导线落地使用导线 Preset / 接到导线上的线也是导线', () => {
    const context = contextFor(value)
    const created = createStageDraftingCurveCommand(
      context,
      { kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: 80 } },
      { taps: { start: { entityId: 'w', point: { x: 100, y: 0 } } } },
    )
    const commands = payloadOf(created!.command).commands as readonly EditorCommand[]
    // 倒数第二条才是新画的那条线：最后一条是节点。
    const entity = payloadOf(commands[commands.length - 2]!).entity as ComposeEntity
    // 事实上接上了的线就是导线，与「顺手吸上端口」同一条判据。
    expect((entity.components.Composition as { presetId: string }).presetId).toBe('wire')
  })

  it('OpenSpec: stage-engine / 取点落在导线上即接入节点 / 跨父级不接入并报出来', () => {
    // 导线在场景里，而这一段线落进了场景里的一个容器——两者父级不同。
    const container: ComposeEntity = {
      id: 'box',
      name: 'box',
      components: {
        Composition: { presetId: 'container', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: {
          positioning: 'absolute',
          offset: { x: 400, y: 400 },
          width: { mode: 'fixed', value: 200, min: 1, max: null },
          height: { mode: 'fixed', value: 200, min: 1, max: null },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          alignSelf: 'auto',
        },
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
      },
    } as unknown as ComposeEntity
    const context = contextFor(documentWith([target, container], ['w', 'box']))
    const created = createStageDraftingCurveCommand(
      context,
      { kind: 'line', start: { x: 450, y: 450 }, end: { x: 550, y: 550 } },
      { taps: { start: { entityId: 'w', point: { x: 100, y: 0 } } } },
    )

    // 不接是**可见的**降级；接上会产出 `wire.parent-mismatch` 这条不可见的文档非法。
    expect(created!.command.type).toBe(BUILTIN_COMMAND_TYPES.createEntity)
    expect(created!.droppedWireEnds).toContain('start')
  })
})
