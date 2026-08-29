import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_COMMAND_TYPES,
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { createWireInspector } from './inspector'

afterEach(cleanup)

const device: ComposeEntity = {
  id: 'device',
  name: 'device',
  components: { Ports: { items: [{ id: 'L1', position: { x: 0, y: 0 } }] } },
}

function documentWith(entities: readonly ComposeEntity[]): ComposeDocument {
  return {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['frame'],
    entities: {
      ...Object.fromEntries(entities.map((entity) => [entity.id, entity])),
      frame: createComposeFrameEntity({ id: 'frame', childIds: entities.map(({ id }) => id) }),
    },
  }
}

function renderInspector(wire: Record<string, unknown>, entities: readonly ComposeEntity[]) {
  const Inspector = createWireInspector(() => 'command-id')
  const dispatch = vi.fn()
  render(
    <Inspector
      componentKey="Wire"
      dispatch={dispatch}
      document={documentWith(entities)}
      entity={{ id: 'wire', name: 'wire', components: { Wire: wire as never } }}
      readOnly={false}
      value={wire as never}
    />,
  )
  return dispatch
}

describe('OpenSpec: Wire Inspector 显示两端的绑定状态', () => {
  it('三种状态各自可读', () => {
    renderInspector({ start: { entityId: 'device', portId: 'L1' } }, [device])

    expect(screen.getByTestId('compose-material-wire-start')).toHaveAttribute('data-wire-end', 'bound')
    expect(screen.getByTestId('compose-material-wire-end')).toHaveAttribute('data-wire-end', 'free')

    cleanup()
    // 目标被删掉：几何与自由端一模一样，含义完全不同，因此必须可区分。
    renderInspector({ start: { entityId: 'device', portId: 'L1' } }, [])
    expect(screen.getByTestId('compose-material-wire-start')).toHaveAttribute('data-wire-end', 'dangling')

    cleanup()
    // 实体还在但端口 id 没了，同样是失效。
    renderInspector({ start: { entityId: 'device', portId: 'gone' } }, [device])
    expect(screen.getByTestId('compose-material-wire-start')).toHaveAttribute('data-wire-end', 'dangling')
  })
})

describe('OpenSpec: Wire Inspector 显示两端的绑定状态 / 解除绑定', () => {
  const port = { entityId: 'device', portId: 'L1' }

  it('解除一端只改绑定，几何不动', () => {
    const dispatch = renderInspector({ start: port, end: port }, [device])

    fireEvent.click(screen.getByTestId('compose-material-wire-unbind-start'))

    // 判别点：写的是 `Wire` 这一个 Component，载荷里没有任何几何——画布上没有能只解除
    // 绑定而不动几何的手势，拖开端点会连位置一起改。
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.updateComponent,
      payload: { entityId: 'wire', key: 'Wire', value: { end: port } },
    }))
  })

  it('解除最后一端即删掉整个 Wire', () => {
    const dispatch = renderInspector({ start: port }, [device])

    fireEvent.click(screen.getByTestId('compose-material-wire-unbind-start'))

    // 不带任何绑定的 `Wire` 读不出意图，与曲线外观「三项全清就整个删掉」是同一条判断。
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: BUILTIN_COMMAND_TYPES.removeComponent,
      payload: { entityId: 'wire', key: 'Wire' },
    }))
  })

  it('失效的那一端也能解除', () => {
    // 「配错了」与「还没配」必须可区分，而失效那一端同样需要一条出路。
    const dispatch = renderInspector({ start: { entityId: 'gone', portId: 'L1' } }, [])
    fireEvent.click(screen.getByTestId('compose-material-wire-unbind-start'))
    expect(dispatch).toHaveBeenCalled()
  })

  it('自由端没有解除入口', () => {
    // 恒为禁用的按钮只会让人以为它坏了。
    renderInspector({ start: port }, [device])
    expect(screen.queryByTestId('compose-material-wire-unbind-end')).toBeNull()
  })
})
