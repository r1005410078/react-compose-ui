import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposeEntity } from '@compose-ui/core'
import type { ComposeHatchEditPort, ComposeHatchState } from '@compose-ui/component-registry'
import { createHatchInspector } from './inspector'

const HatchInspector = createHatchInspector()

function hatchEntity(): ComposeEntity {
  return {
    id: 'fill-1',
    name: '填充',
    components: {
      Composition: { presetId: 'hatch', baseComponentKeys: [], capabilityIds: [] },
      Curve: { kind: 'polyline', closed: true, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
      Hatch: { seed: { x: 4, y: 6 }, boundaryIds: ['rect', 'line'] },
    },
  }
}

function renderInspector(port?: ComposeHatchEditPort) {
  render(
    <HatchInspector
      componentKey="Hatch"
      dispatch={vi.fn()}
      entity={hatchEntity()}
      readOnly={false}
      value={{ seed: { x: 4, y: 6 }, boundaryIds: ['rect', 'line'] }}
      {...(port ? { hatchEditPort: port } : {})}
    />,
  )
}

function portSaying(state: ComposeHatchState): ComposeHatchEditPort {
  return { state: () => state, regenerate: vi.fn(), detach: vi.fn() }
}

describe('OpenSpec: basic-materials / 填充的 Inspector 有重新生成与失效标记', () => {
  afterEach(cleanup)

  it('那一行读作锚点——跟随成功时它被重取到最大内切圆圆心，说的是这块面的身份', () => {
    renderInspector()
    expect(screen.getByTestId('compose-material-hatch-seed').textContent).toBe('4, 6')
    expect(screen.getByText('锚点')).toBeTruthy()
    expect(screen.queryByText('取点')).toBeNull()
  })

  it('三档互不相同：跟得上、跟不上了、边界没了各一句话', () => {
    const seen = new Set<string>()
    const states: readonly ComposeHatchState[] = ['current', 'stale', 'broken']
    states.forEach((state) => {
      renderInspector(portSaying(state))
      const cell = screen.getByTestId('compose-material-hatch-state')
      expect(cell.getAttribute('data-hatch-state')).toBe(state)
      seen.add(cell.textContent ?? '')
      cleanup()
    })
    // 三句话各不相同才谈得上「可区分」——收成两句就分不出「按一下就好」与「先去补那条缝」。
    expect(seen.size).toBe(3)
  })

  it('重新生成按下去就把那一下交给宿主', () => {
    const port = portSaying('stale')
    renderInspector(port)
    fireEvent.click(screen.getByTestId('compose-material-hatch-regenerate'))
    expect(port.regenerate).toHaveBeenCalledWith({ entityId: 'fill-1' })
  })

  it('断开关联按下去就把那一下交给宿主', () => {
    const port = portSaying('current')
    renderInspector(port)
    fireEvent.click(screen.getByTestId('compose-material-hatch-detach'))
    expect(port.detach).toHaveBeenCalledWith({ entityId: 'fill-1' })
  })

  it('端口缺席时不画那两颗按钮', () => {
    // 一个按下去什么都不会发生的入口比没有更糟，与导线「自由端不给解除按钮」同一条判断。
    renderInspector()
    expect(screen.queryByTestId('compose-material-hatch-regenerate')).toBeNull()
    expect(screen.queryByTestId('compose-material-hatch-detach')).toBeNull()
    expect(screen.getByTestId('compose-material-hatch-state').getAttribute('data-hatch-state'))
      .toBe('current')
  })
})
