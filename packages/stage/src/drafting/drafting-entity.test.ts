import { describe, expect, it } from 'vitest'
import {
  anchorKey,
  createStageDraftingCurveCommand,
  sameParentWireEnds,
  wireBindingsFor,
  type StageDraftingCommitContext,
} from './drafting-entity'
import type { ComposeCurve, ComposeDocument, ComposeWireBinding } from '@compose-ui/core'

describe('wireBindingsFor', () => {
  const port: ComposeWireBinding = { entityId: 'device', portId: 'L1' }
  const anchors = new Map([[anchorKey({ x: 10, y: 20 }), port]])

  it('只有被记下来源的那一端才绑定', () => {
    const wire = wireBindingsFor(anchors, {
      kind: 'line',
      start: { x: 10, y: 20 },
      end: { x: 200, y: 300 },
    })

    expect(wire).toEqual({ start: port })
  })

  it('坐标相同但没有记录时不绑定', () => {
    // 绑定来自取点，不是事后按坐标反查：反查会让一条恰好路过端口的普通线莫名其妙地绑上。
    expect(wireBindingsFor(new Map(), {
      kind: 'line',
      start: { x: 10, y: 20 },
      end: { x: 200, y: 300 },
    })).toEqual({})
  })

  it('非直线没有绑定', () => {
    expect(wireBindingsFor(anchors, {
      kind: 'arc',
      center: { x: 10, y: 20 },
      radius: 5,
      startAngle: 0,
      sweep: 90,
    })).toBeUndefined()
  })
})

/*
 * Registry 与场景索引都用窄替身：`stage` 不依赖 `materials`，搭一套真实 Preset 要把整包物料
 * 拖进来，而这里要断言的只有一件事——落地时按哪个 id 取 seed。
 */
function commitContext(created: string[]): StageDraftingCommitContext {
  let serial = 0
  return {
    document: {
      schemaVersion: 7,
      rootIds: [],
      entities: {},
    } as never,
    layoutSnapshot: { entities: {} } as never,
    index: { containerAtPoint: () => null } as never,
    registry: {
      createSeed(presetId: string) {
        created.push(presetId)
        return {
          ok: true,
          seed: {
            name: presetId,
            components: {
              Composition: { presetId },
              LayoutItem: {
                width: { mode: 'fixed', value: 0 },
                height: { mode: 'fixed', value: 0 },
              },
            },
          },
        }
      },
    } as never,
    idFactory: () => `id-${++serial}`,
  }
}

const line: ComposeCurve = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } }
const port: ComposeWireBinding = { entityId: 'device', portId: 'L1' }

describe('createStageDraftingCurveCommand 的 Preset 选择', () => {
  it('OpenSpec: stage / 导线落地使用导线 Preset / 绑上端口的线走 wire Preset', () => {
    const created: string[] = []
    /*
     * 判据是**这条线真的绑上了端口**而不是走了哪条命令：`WIRE` 合并进 `LINE` 之后没有第二种
     * 线可分，绑定跟着取点来源走，「是不是导线」只能从绑定读出来。
     */
    expect(createStageDraftingCurveCommand(commitContext(created), line, { wire: { start: port } }))
      .not.toBeNull()
    expect(created).toEqual(['wire'])
  })

  it('OpenSpec: stage / 导线落地使用导线 Preset / 没碰过端口的线仍是普通曲线', () => {
    const created: string[] = []
    // 空对象是「两端都没碰过端口」——普通线一个字节都不变，外观也不该宣称它是导线。
    createStageDraftingCurveCommand(commitContext(created), line, { wire: {} })
    createStageDraftingCurveCommand(commitContext(created), line)
    createStageDraftingCurveCommand(commitContext(created), line, { arrow: true })
    expect(created).toEqual(['curve', 'curve', 'arrow'])
  })

  it('OpenSpec: stage / 导线落地使用导线 Preset / Preset 缺失时不回退', () => {
    const context = commitContext([])
    const registry = {
      createSeed: () => ({ ok: false, error: { message: '缺失' } }),
    } as never
    // 静默回退到 `curve` 会画出一条看起来像标注线的导线，而它是主回路且带着看不见的绑定。
    expect(createStageDraftingCurveCommand({ ...context, registry }, line, { wire: { start: port } }))
      .toBeNull()
  })
})

describe('createStageDraftingCurveCommand 的替换那一支', () => {
  /** 真实文档里每个 Entity 都带着这两个 Component；替身少了它们读出来是 undefined。 */
  const chrome = {
    Lock: { locked: false },
    Visibility: { visible: true },
    Transform: { rotation: 0 },
  }
  /** 一条已经落地的导线，住在 `frame-a` 里；`frame-b` 在别处。 */
  const withWire = (wire?: unknown): ComposeDocument => ({
    schemaVersion: 7,
    rootIds: ['frame-a', 'frame-b'],
    entities: {
      'frame-a': {
        id: 'frame-a',
        components: { ...chrome, Hierarchy: { childIds: ['device', 'wire-1'] } },
      },
      device: { id: 'device', components: { ...chrome } },
      'frame-b': { id: 'frame-b', components: { ...chrome, Hierarchy: { childIds: [] } } },
      'wire-1': {
        id: 'wire-1',
        name: '导线',
        components: {
          ...chrome,
          Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 90, y: 30 } },
          LayoutItem: {
            offset: { x: -10, y: -20 },
            width: { mode: 'fixed', value: 90 },
            height: { mode: 'fixed', value: 30 },
          },
          ...(wire ? { Wire: wire } : {}),
        },
      },
    },
  } as unknown as ComposeDocument)

  const snapshot = {
    revision: 1,
    boxes: {
      'frame-a': { x: 10, y: 20, width: 500, height: 500 },
      'frame-b': { x: 300, y: 300, width: 500, height: 500 },
      'wire-1': { x: 0, y: 0, width: 90, height: 30 },
    },
  } as never

  /** 落地上下文：`containerAtPoint` 故意指向**另一个**容器。 */
  const context = (document: ComposeDocument, created: string[]): StageDraftingCommitContext => ({
    ...commitContext(created),
    document,
    layoutSnapshot: snapshot,
    index: { containerAtPoint: () => 'frame-b' } as never,
  })

  it('OpenSpec: stage / 会话把已落地的几何扩到同一个 Entity 上 / 改的是同一个 Entity', () => {
    const created: string[] = []
    const result = createStageDraftingCurveCommand(
      context(withWire(), created),
      { kind: 'polyline', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }], closed: false },
      { wiring: true, replace: 'wire-1' },
    )

    expect(result?.command.type).toBe('entity.curve.set')
    expect(result?.command.meta?.targetIds).toEqual(['wire-1'])
    // 不向 Registry 取 seed：Preset 在这个 Entity 建出来的那一刻就定下了。
    expect(created).toEqual([])
  })

  it('OpenSpec: stage / 会话把已落地的几何扩到同一个 Entity 上 / 父级不重算', () => {
    const created: string[] = []
    const result = createStageDraftingCurveCommand(
      context(withWire(), created),
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } },
      { wiring: true, replace: 'wire-1' },
    )

    /*
     * 判别点在**换算用的是哪个父级**：`containerAtPoint` 指着 `frame-b`（300,300），重算的话
     * 局部坐标会是 (-300,-300)；取当前父级 `frame-a`（10,20）才得到 (-10,-20)。
     */
    expect(result?.command.payload).toMatchObject({
      entityId: 'wire-1',
      curve: { kind: 'line', start: { x: -10, y: -20 }, end: { x: 90, y: 30 } },
    })
  })

  it('OpenSpec: stage / 会话把已落地的几何扩到同一个 Entity 上 / 目标不在了就退回新建', () => {
    const created: string[] = []
    const result = createStageDraftingCurveCommand(
      context(withWire(), created),
      line,
      { wiring: true, replace: 'gone' },
    )

    // 它已经被外部撤销掉了；退回新建让会话自己愈合，而不是从此每一步都写不进去。
    expect(result?.command.type).toBe('entity.create')
    expect(created).toEqual(['wire'])
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 替换时按当前几何重算绑定', () => {
    const bound = createStageDraftingCurveCommand(
      context(withWire(), []),
      line,
      { wiring: true, replace: 'wire-1', wire: { end: { entityId: 'device', portId: 'L1' } } },
    )
    expect(bound?.command.payload).toMatchObject({ wire: { end: { portId: 'L1' } } })

    // 末端走开：原来有绑定就要清掉，否则文档里留着一条指向别处的线。
    const cleared = createStageDraftingCurveCommand(
      context(withWire({ end: { entityId: 'device', portId: 'L1' } }), []),
      line,
      { wiring: true, replace: 'wire-1', wire: {} },
    )
    expect((cleared?.command.payload as { wire?: unknown }).wire).toBeNull()

    // 从来没碰过端口的线不写 `Wire`，也不产生一条无谓的补丁。
    const untouched = createStageDraftingCurveCommand(
      context(withWire(), []),
      line,
      { wiring: true, replace: 'wire-1', wire: {} },
    )
    expect('wire' in (untouched?.command.payload as object)).toBe(false)
  })
})

describe('sameParentWireEnds', () => {
  /** 两块场景，`device` 在 `frame-a` 里。 */
  const document = {
    schemaVersion: 7,
    canvas: { grid: {}, smartSnap: {} },
    rootIds: ['frame-a', 'frame-b'],
    entities: {
      'frame-a': { id: 'frame-a', components: { Hierarchy: { childIds: ['device'] } } },
      'frame-b': { id: 'frame-b', components: { Hierarchy: { childIds: [] } } },
      device: { id: 'device', components: {} },
    },
  } as unknown as ComposeDocument

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 同父级的绑定原样保留', () => {
    expect(sameParentWireEnds(document, { start: port }, 'frame-a')).toEqual({
      dropped: [],
      wire: { start: port },
    })
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 跨父级那一端被丢掉并报出来', () => {
    // 判别点：`wire.parent-mismatch` 是**文档非法**而不是警告，而落地父级按线段包围盒中心
    // 判定，因此「从帧内符号的端口拉一条线到帧外」这个平常手势绑上就会让整份文档校验失败。
    // 不绑是可见的降级（Inspector 显示该端自由），非法文档是不可见的。
    expect(sameParentWireEnds(document, { start: port }, 'frame-b')).toEqual({
      dropped: ['start'],
      wire: undefined,
    })
  })

  it('OpenSpec: stage-engine / LINE 取点落在端口上即绑定 / 只丢跨父级的那一端', () => {
    const other: ComposeWireBinding = { entityId: 'frame-a', portId: 'X' }
    expect(sameParentWireEnds(document, { start: port, end: other }, 'frame-a')).toEqual({
      dropped: ['end'],
      wire: { start: port },
    })
  })
})
