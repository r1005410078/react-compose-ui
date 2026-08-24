import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createComposeFrameEntity, createDefaultCanvasSettings, type ComposeDocument, type ComposeEntity } from '@compose-ui/core'
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
  const Inspector = createWireInspector()
  render(
    <Inspector
      componentKey="Wire"
      dispatch={vi.fn()}
      document={documentWith(entities)}
      entity={{ id: 'wire', name: 'wire', components: {} }}
      readOnly={false}
      value={wire as never}
    />,
  )
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
