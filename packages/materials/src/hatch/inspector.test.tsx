import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeEntity } from '@compose-ui/core'
import { createHatchInspector } from './inspector'

const HatchInspector = createHatchInspector()

function hatchEntity(): ComposeEntity {
  return {
    id: 'fill-1',
    name: '填充',
    components: {
      Composition: { presetId: 'hatch', baseComponentKeys: [], capabilityIds: [] },
      Curve: { kind: 'polyline', closed: true, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
      Hatch: { seed: { x: 4, y: 6 } },
    },
  }
}

function renderInspector(port?: { isStale: () => boolean; regenerate: () => void }) {
  render(
    <HatchInspector
      componentKey="Hatch"
      dispatch={vi.fn()}
      entity={hatchEntity()}
      readOnly={false}
      value={{ seed: { x: 4, y: 6 } }}
      {...(port ? { hatchEditPort: port } : {})}
    />,
  )
}

describe('OpenSpec: basic-materials / 填充的 Inspector 有重新生成与失效标记', () => {
  afterEach(cleanup)

  it('把取点读出来——那是 Hatch 存的唯一一样东西', () => {
    renderInspector()
    expect(screen.getByTestId('compose-material-hatch-seed').textContent).toBe('4, 6')
  })

  it('端口说过期就标出来', () => {
    renderInspector({ isStale: () => true, regenerate: vi.fn() })
    const state = screen.getByTestId('compose-material-hatch-state')
    expect(state.getAttribute('data-hatch-state')).toBe('stale')
  })

  it('重新生成按下去就把那一下交给宿主', () => {
    const regenerate = vi.fn()
    renderInspector({ isStale: () => false, regenerate })
    fireEvent.click(screen.getByTestId('compose-material-hatch-regenerate'))
    expect(regenerate).toHaveBeenCalledWith({ entityId: 'fill-1' })
  })

  it('端口缺席时不画那颗按钮', () => {
    // 一个按下去什么都不会发生的入口比没有更糟，与导线「自由端不给解除按钮」同一条判断。
    renderInspector()
    expect(screen.queryByTestId('compose-material-hatch-regenerate')).toBeNull()
    expect(screen.getByTestId('compose-material-hatch-state').getAttribute('data-hatch-state'))
      .toBe('current')
  })
})
