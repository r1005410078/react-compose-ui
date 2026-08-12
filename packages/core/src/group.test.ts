import { describe, expect, it } from 'vitest'
import type { ComposeEntity } from './document-types'
import * as coreApi from './index'

interface GroupApi {
  readonly createComposeGroupEntitySeed?: (input: {
    readonly id: string
    readonly name?: string
    readonly childIds?: readonly string[]
    readonly position?: { readonly x: number; readonly y: number }
    readonly size?: { readonly width: number; readonly height: number }
  }) => ComposeEntity
}

const groupApi = coreApi as GroupApi

describe('Compose Group seed', () => {
  it('OpenSpec: basic-materials / Group 基础物料 / Group 与 Container 分离', () => {
    expect(groupApi.createComposeGroupEntitySeed).toBeTypeOf('function')
    const group = groupApi.createComposeGroupEntitySeed!({
      id: 'group-1',
      childIds: ['a', 'b'],
      position: { x: 20, y: 30 },
      size: { width: 220, height: 80 },
    })

    expect(group.name).toBe('Group')
    expect(group.components).toEqual({
      Composition: {
        presetId: 'group',
        baseComponentKeys: [
          'Transform',
          'LayoutItem',
          'GeometryConstraints',
          'Visibility',
          'Lock',
          'Hierarchy',
        ],
        capabilityIds: [],
      },
      Transform: { rotation: 0 },
      LayoutItem: {
        positioning: 'absolute',
        offset: { x: 20, y: 30 },
        width: { mode: 'fixed', value: 220, min: 1, max: null },
        height: { mode: 'fixed', value: 80, min: 1, max: null },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        alignSelf: 'auto',
      },
      GeometryConstraints: { movable: true, resize: 'none', rotatable: false },
      Visibility: { visible: true },
      Lock: { locked: false },
      Hierarchy: { childIds: ['a', 'b'] },
    })
  })
})
