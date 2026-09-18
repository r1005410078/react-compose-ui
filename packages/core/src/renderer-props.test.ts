import { describe, expect, it } from 'vitest'
import { findComposeMixedRendererProps, planComposeSetRendererProps } from './renderer-props'
import { createTransactionRuntime } from './runtime'
import { documentFixture, rendererEntity } from './test-fixtures'
import type { ComposeDocument, ComposeEntity, JsonObject } from './document-types'

function curve(id: string, props: Record<string, unknown>, locked = false): ComposeEntity {
  return rendererEntity(id, {
    locked,
    components: { Renderer: { type: 'curve', props: props as JsonObject } },
  })
}

/** 容器没有 Renderer，是「跳过」那一支的判别性夹具。 */
function container(id: string): ComposeEntity {
  const entity = rendererEntity(id, { components: { Hierarchy: { childIds: [] } } })
  const components = { ...entity.components }
  delete (components as Record<string, unknown>).Renderer
  return { ...entity, components }
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return documentFixture(
    Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    entities.map((entity) => entity.id),
  )
}

let counter = 0
const idFactory = () => `cmd-${(counter += 1)}`

describe('OpenSpec: compose-document / Renderer Props 的批量规划', () => {
  it('patch 合到各自的 props 上，不相干的字段不受影响', () => {
    const document = documentWith([
      curve('a', { stroke: '#fff', strokeWidth: 2 }),
      curve('b', { stroke: '#000', strokeWidth: 5 }),
    ])
    const command = planComposeSetRendererProps({
      document, entityIds: ['a', 'b'], patch: { stroke: '#ff3b30' }, idFactory,
    })
    const runtime = createTransactionRuntime({ document })
    expect(runtime.dispatch(command!).status).toBe('committed')
    const next = runtime.document
    expect(next.entities.a!.components.Renderer)
      .toMatchObject({ props: { stroke: '#ff3b30', strokeWidth: 2 } })
    expect(next.entities.b!.components.Renderer)
      .toMatchObject({ props: { stroke: '#ff3b30', strokeWidth: 5 } })
  })

  it('批量写入只占一步撤销', () => {
    const document = documentWith([
      curve('a', { stroke: '#fff' }),
      curve('b', { stroke: '#fff' }),
      curve('c', { stroke: '#fff' }),
    ])
    const runtime = createTransactionRuntime({ document })
    runtime.dispatch(planComposeSetRendererProps({
      document, entityIds: ['a', 'b', 'c'], patch: { stroke: '#ff3b30' }, idFactory,
    })!)
    runtime.undo()
    const back = runtime.document
    for (const id of ['a', 'b', 'c']) {
      expect(back.entities[id]!.components.Renderer).toMatchObject({ props: { stroke: '#fff' } })
    }
  })

  it('跳过没有 Renderer 与锁定的目标', () => {
    const document = documentWith([
      curve('a', { stroke: '#fff' }),
      curve('locked', { stroke: '#fff' }, true),
      container('box'),
    ])
    const command = planComposeSetRendererProps({
      document, entityIds: ['a', 'locked', 'box'], patch: { stroke: '#ff3b30' }, idFactory,
    })
    /*
     * 不跑事务：一个没有 Renderer 的 Entity 过不了文档校验，而规划是纯函数，本来就不该要求
     * 调用方先有一份合法文档。断的是「谁进了这条 batch」。
     */
    expect(command?.meta?.targetIds).toEqual(['a'])
    const payload = command?.payload as { readonly commands: readonly { payload: { entityId: string } }[] }
    expect(payload.commands.map((item) => item.payload.entityId)).toEqual(['a'])
  })

  it('一个可写目标都没有时返回 null，而不是一条空 batch', () => {
    const document = documentWith([curve('locked', { stroke: '#fff' }, true)])
    expect(planComposeSetRendererProps({
      document, entityIds: ['locked', 'missing'], patch: { stroke: '#ff3b30' }, idFactory,
    })).toBeNull()
  })

  it('单选是恰好一个成员的退化情形', () => {
    const document = documentWith([curve('a', { stroke: '#fff', strokeWidth: 2 })])
    const command = planComposeSetRendererProps({
      document, entityIds: ['a'], patch: { strokeWidth: 4 }, idFactory,
    })
    const runtime = createTransactionRuntime({ document })
    runtime.dispatch(command!)
    expect(runtime.document.entities.a!.components.Renderer)
      .toMatchObject({ props: { stroke: '#fff', strokeWidth: 4 } })
  })
})

describe('OpenSpec: compose-document / 取值不一致的 Prop', () => {
  it('只报列出的那些字段，取值相同的不算混合', () => {
    const document = documentWith([
      curve('a', { stroke: '#fff', strokeWidth: 2 }),
      curve('b', { stroke: '#fff', strokeWidth: 5 }),
    ])
    const mixed = findComposeMixedRendererProps({
      document, entityIds: ['a', 'b'], propNames: ['stroke', 'strokeWidth'],
    })
    expect([...mixed]).toEqual(['strokeWidth'])
  })

  it('缺席与显式写下的值算不同', () => {
    const document = documentWith([
      curve('a', { stroke: '#fff' }),
      curve('b', { stroke: '#fff', strokeWidth: 2 }),
    ])
    const mixed = findComposeMixedRendererProps({
      document, entityIds: ['a', 'b'], propNames: ['strokeWidth'],
    })
    expect([...mixed]).toEqual(['strokeWidth'])
  })

  it('少于两个目标恒为空集', () => {
    const document = documentWith([curve('a', { stroke: '#fff' })])
    expect(findComposeMixedRendererProps({
      document, entityIds: ['a'], propNames: ['stroke'],
    }).size).toBe(0)
  })
})
