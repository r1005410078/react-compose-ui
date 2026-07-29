import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeDocument } from '@compose-ui/core'
import { createStageInteractionController } from '@compose-ui/stage-engine'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeComponentPalette } from './compose-component-palette'

const transform = {
  position: { x: 0, y: 0 },
  size: { width: 100, height: 50 },
  rotation: 0,
}

const registry = createComposeEntityRegistry({
  presets: [
    {
      id: 'container',
      label: '容器',
      createComponents: () => ({
        Transform: transform,
        Visibility: { visible: true },
        Lock: { locked: false },
        Hierarchy: { childIds: [] },
        Clip: { enabled: true },
        Appearance: {},
      }),
    },
    {
      id: 'rectangle',
      label: '矩形',
      createComponents: () => ({
        Transform: transform,
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#2463eb' } },
        Renderer: { type: 'rectangle', props: {} },
      }),
    },
  ],
})

const document: ComposeDocument = {
  schemaVersion: 5,
  canvas: {
    grid: {
      stepX: 8,
      stepY: 8,
      offsetX: 0,
      offsetY: 0,
      primaryLineEvery: 5,
      snapEnabled: true,
    },
    smartSnap: { nodes: true, guides: true },
    guides: [],
  },
  output: { width: 1280, height: 720, backgroundColor: '#111827' },
  rootIds: [],
  entities: {},
}

describe('ComposeComponentPalette ECS Presets', () => {
  afterEach(cleanup)

  it('OpenSpec: 统一 Preset Palette / Container 与 Renderer Preset 使用同一列表', () => {
    const controller = createStageInteractionController()
    const effects = vi.fn()
    controller.connectSurface({
      resolveClientPoint: (point) => point,
      applyEffects: effects,
    })
    controller.updateContext({
      document,
      viewport: { x: 0, y: 0, zoom: 1 },
      surfaceSize: { width: 800, height: 600 },
      tool: 'select',
      selectedIds: [],
      idFactory: () => 'id',
    })
    render(
      <ComposeComponentPalette
        interactionController={controller}
        registry={registry}
      />,
    )
    expect(screen.getByRole('button', { name: '添加 容器' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加 矩形' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '添加 矩形' }))
    expect(effects).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'external.drop',
        item: { kind: 'preset', presetId: 'rectangle' },
      }),
    ])
  })
})
