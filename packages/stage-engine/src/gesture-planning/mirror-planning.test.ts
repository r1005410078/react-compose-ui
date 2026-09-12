import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMAND_TYPES, COMPOSE_BUILTIN_COMPONENT_KEYS } from '@compose-ui/core'
import { createStageSceneIndex } from '../hit-testing'
import { applyMatrix, matrixFromTransform, multiplyMatrices } from '../geometry'
import { document, entity, layoutSnapshot } from '../test-fixtures'
import { planStageMirror } from './mirror-planning'
import type { ComposeCurve, ComposeEntity } from '@compose-ui/core'

function withCurve(base: ComposeEntity, curve: ComposeCurve): ComposeEntity {
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type: 'curve', props: {} },
      [COMPOSE_BUILTIN_COMPONENT_KEYS.curve]: curve as never,
    },
  }
}

function withRenderer(base: ComposeEntity, type: string, props: Record<string, unknown>) {
  return {
    ...base,
    components: {
      ...base.components,
      [COMPOSE_BUILTIN_COMPONENT_KEYS.renderer]: { type, props: props as never },
    },
  }
}

function plan(entities: readonly ComposeEntity[], ids: readonly string[], axis: {
  readonly a: { readonly x: number; readonly y: number }
  readonly b: { readonly x: number; readonly y: number }
}) {
  const value = document(entities)
  const snapshot = layoutSnapshot(value)
  let seed = 0
  return planStageMirror({
    document: value,
    layoutSnapshot: snapshot,
    index: createStageSceneIndex(value, snapshot),
    entityIds: ids,
    axis,
    idFactory: () => `cmd-${seed += 1}`,
  })
}

/**
 * 逐边比对，容许浮点残渣。
 *
 * @remarks
 * 180° 旋转的 `cos(π)` 差在第十六位上；写进文档的值由 `toComposeTransform` 量化到两位，
 * 因此这点残渣在用户那一侧根本不存在——它只在这里、在量化之前现形。
 */
function expectBox(
  actual: { x: number, y: number, right: number, bottom: number },
  expected: { x: number, y: number, right: number, bottom: number },
) {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
  expect(actual.right).toBeCloseTo(expected.right, 6)
  expect(actual.bottom).toBeCloseTo(expected.bottom, 6)
}

/** 竖直轴 `x = 200`。 */
const VERTICAL = { a: { x: 200, y: 0 }, b: { x: 200, y: 1 } }

/*
 * 判别性来自**盒落在镜像位置**与**几何真的翻过来**两条同时成立：只断位置的用例，在一个把
 * 整个对象原样平移过去的实现上同样会绿；只断几何的用例，在一个原地翻转、根本没搬家的实现上
 * 同样会绿。
 */
describe('OpenSpec: stage-engine / MIRROR 命令 / 曲线烘进几何', () => {
  const diagonal = withCurve(
    entity('line', { x: 100, y: 50, width: 40, height: 20 }),
    { kind: 'line', start: { x: 0, y: 0 }, end: { x: 40, y: 20 } },
  )

  it('几何写在前、变换写在后，两条共享一个 mergeKey', () => {
    const commands = plan([diagonal], ['line'], VERTICAL)
    expect(commands).toHaveLength(2)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.setCurve)
    expect(commands[1]?.type).toBe(BUILTIN_COMMAND_TYPES.setTransform)
    // 同步派发，因此合成一步撤销——「整棵子树一起回来」正是这条要求的内容。
    expect(commands[0]?.meta?.mergeKey).toBe(commands[1]?.meta?.mergeKey)
    expect(commands[0]?.meta?.mergeKey).toBeTruthy()
  })

  it('几何绕自己盒的水平中线翻转，盒尺寸因此一个像素不变', () => {
    const commands = plan([diagonal], ['line'], VERTICAL)
    // 载荷是 parent 局部坐标（盒局部翻转之后加上**旧的** offset）：紧包围盒不变，
    // 紧接着的变换命令才写最终位置。
    expect(commands[0]?.payload).toEqual({
      entityId: 'line',
      curve: { kind: 'line', start: { x: 100, y: 70 }, end: { x: 140, y: 50 } },
    })
  })

  it('盒落在镜像位置上，角度补成 2φ − θ', () => {
    const commands = plan([diagonal], ['line'], VERTICAL)
    const updates = (commands[1]?.payload as { updates: readonly {
      entityId: string
      transform: { position: { x: number, y: number }, rotation: number }
    }[] }).updates
    expect(updates).toHaveLength(1)
    // 世界盒本来是 [100,140]×[50,70]，绕 x = 200 镜像之后是 [260,300]×[50,70]。
    expect(updates[0]?.transform.position).toEqual({ x: 260, y: 50 })
    /*
     * 一次反射的行列式是负的，而 `Transform` 里只有 `rotation`——它表达不了反射。拆成
     * 「刚体运动 × 盒内翻转」之后，这一半恰好是绕竖直轴时的 180°，另一半由上面那条几何承担。
     */
    expect(updates[0]?.transform.rotation).toBe(180)
  })

  it('退化成一个点的轴什么都不产出', () => {
    expect(plan([diagonal], ['line'], { a: { x: 5, y: 5 }, b: { x: 5, y: 5 } })).toEqual([])
  })
})

describe('OpenSpec: stage-engine / MIRROR 命令 / 容器整棵子树', () => {
  const subtree = [
    entity('box', { x: 100, y: 0, width: 200, height: 100, childIds: ['child'] }),
    entity('child', { x: 10, y: 10, width: 20, height: 20 }),
  ]

  /**
   * 按规划出来的变换重建子级的**世界**盒。
   *
   * @remarks
   * 断的必须是世界位置而不是那个局部 `offset`：父级带着 180° 旋转，左右翻转由它承担，
   * 因此子级的局部 x 反而不变而 y 变——只看局部值会把一个正确的结果读成错的。
   *
   * 合成走 `matrixFromTransform`，也就是渲染那一侧用的同一个函数，因此这不是把实现抄一遍。
   */
  const childWorldBox = (commands: ReturnType<typeof plan>) => {
    const updates = (commands[0]?.payload as { updates: readonly {
      entityId: string
      transform: {
        position: { x: number, y: number }
        size: { width: number, height: number }
        rotation: number
      }
    }[] }).updates
    const byId = new Map(updates.map((update) => [update.entityId, update.transform]))
    const toMatrix = (id: string) => {
      const found = byId.get(id)!
      return matrixFromTransform({
        x: found.position.x,
        y: found.position.y,
        width: found.size.width,
        height: found.size.height,
        rotation: found.rotation,
        pivot: { x: 0.5, y: 0.5 },
      })
    }
    const world = multiplyMatrices(toMatrix('box'), toMatrix('child'))
    const size = byId.get('child')!.size
    const corners = [
      applyMatrix(world, { x: 0, y: 0 }),
      applyMatrix(world, { x: size.width, y: size.height }),
    ]
    return {
      x: Math.min(corners[0]!.x, corners[1]!.x),
      y: Math.min(corners[0]!.y, corners[1]!.y),
      right: Math.max(corners[0]!.x, corners[1]!.x),
      bottom: Math.max(corners[0]!.y, corners[1]!.y),
    }
  }

  it('子级与父级在同一条规划里一起反射', () => {
    const commands = plan(subtree, ['box'], VERTICAL)
    const updates = (commands[0]?.payload as { updates: readonly { entityId: string }[] }).updates
    expect(updates.map(({ entityId }) => entityId).sort()).toEqual(['box', 'child'])
    // 子级世界盒 [110,130]×[10,30] 绕 x = 200 镜像之后是 [270,290]×[10,30]。
    expectBox(childWorldBox(commands), { x: 270, y: 10, right: 290, bottom: 30 })
  })

  it('容器自己也搬家时，子级仍然落在它里面', () => {
    // 轴挪到 x = 0：容器 [100,300] 镜像成 [-300,-100]，子级 [110,130] 镜像成 [-130,-110]。
    // 拿**旧的**父级矩阵算子级会让它落在 [-230,-210]，也就是跑到容器外面去。
    const commands = plan(subtree, ['box'], { a: { x: 0, y: 0 }, b: { x: 0, y: 1 } })
    expectBox(childWorldBox(commands), { x: -130, y: 10, right: -110, bottom: 30 })
  })

  it('锁定的对象连同它的子树一起留在原处', () => {
    const commands = plan([
      entity('locked', { x: 100, y: 0, width: 200, height: 100, childIds: ['kid'], locked: true }),
      entity('kid', { x: 10, y: 10, width: 20, height: 20 }),
    ], ['locked'], VERTICAL)
    expect(commands).toEqual([])
  })
})

describe('OpenSpec: basic-materials / 组件实例的翻转 / 镜像走呈现层', () => {
  it('实例写 flip 而不是烘进几何：定义是共享的', () => {
    const instance = withRenderer(
      entity('inst', { x: 100, y: 50, width: 40, height: 20 }),
      'component-instance',
      { reference: { assetKey: 'k' } },
    )
    const commands = plan([instance], ['inst'], VERTICAL)
    expect(commands[0]?.type).toBe(BUILTIN_COMMAND_TYPES.setRendererProps)
    expect(commands[0]?.payload).toEqual({
      entityId: 'inst',
      // 既有 props 原样带上：整份写入会把 reference 一起抹掉。
      props: { reference: { assetKey: 'k' }, flip: 'y' },
    })
  })

  it('再镜像一次回到不翻转：反射是自己的逆', () => {
    const instance = withRenderer(
      entity('inst', { x: 100, y: 50, width: 40, height: 20 }),
      'component-instance',
      { flip: 'y' },
    )
    const commands = plan([instance], ['inst'], VERTICAL)
    expect((commands[0]?.payload as { props: { flip: string } }).props.flip).toBe('none')
  })
})
