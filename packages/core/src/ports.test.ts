import { describe, expect, it } from 'vitest'
import {
  collectComposePortsValidationIssues,
  getComposeEntityPorts,
  getComposePortItems,
  isValidComposePorts,
} from './ports'
import type { ComposeEntity, JsonObject } from './document-types'

describe('Ports Component', () => {
  it('接受一个带有限位置的端口', () => {
    expect(isValidComposePorts({ items: [{ id: 'a', position: { x: 0, y: 12.5 } }] })).toBe(true)
  })

  it('拒绝重复 id', () => {
    const issues = collectComposePortsValidationIssues({
      items: [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'a', position: { x: 10, y: 0 } }],
    })
    expect(issues.map(({ message }) => message)).toContain('端口 id a 重复')
  })

  it('拒绝空列表', () => {
    // 一个不带任何端口的端口声明读不出意图：不再需要端口时删掉整个 Component。
    expect(isValidComposePorts({ items: [] })).toBe(false)
  })

  it('拒绝非有限位置与未知字段', () => {
    expect(isValidComposePorts({ items: [{ id: 'a', position: { x: 0, y: Number.NaN } }] })).toBe(false)
    expect(isValidComposePorts({ items: [{ id: 'a', position: { x: 0, y: 0 }, name: 'L1' }] })).toBe(false)
  })

  it('缺席即没有端口', () => {
    const entity = { id: 'a', name: 'a', components: {} } satisfies ComposeEntity
    expect(getComposePortItems(entity)).toEqual([])
    expect(getComposePortItems(undefined)).toEqual([])
  })
})

describe('getComposeEntityPorts', () => {
  const componentRoot: ComposeEntity = {
    id: 'root',
    name: 'root',
    components: { Ports: { items: [{ id: 'L1', position: { x: 4, y: 8 } }] } },
  }
  const instance = (own?: JsonObject): ComposeEntity => ({
    id: 'instance',
    name: 'instance',
    components: {
      ...(own ? { Ports: own } : {}),
      Renderer: {
        type: 'component-instance',
        props: {
          resolvedSnapshot: {
            document: { rootIds: ['root'], entities: { root: componentRoot } },
          },
        },
      },
    } as unknown as ComposeEntity['components'],
  })

  it('实例带出组件根的端口', () => {
    expect(getComposeEntityPorts(instance())).toEqual([{ id: 'L1', position: { x: 4, y: 8 } }])
  })

  it('实例自己声明的端口压过组件根的', () => {
    const own = { items: [{ id: 'L1', position: { x: 0, y: 0 } }] }
    expect(getComposeEntityPorts(instance(own))).toEqual(own.items)
  })

  it('快照形状不合时当作没有端口', () => {
    const broken: ComposeEntity = {
      id: 'a',
      name: 'a',
      components: { Renderer: { type: 'component-instance', props: { resolvedSnapshot: 1 } } },
    }
    expect(getComposeEntityPorts(broken)).toEqual([])
  })
})
