import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import type { ComposeDocument } from '@compose-ui/core'
import { createStageInteractionController } from '@compose-ui/stage-engine'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComposeComponentPalette } from './compose-component-palette'

const transform = {
  rotation: 0,
}

const layoutItem = {
  positioning: 'absolute' as const,
  offset: { x: 0, y: 0 },
  width: { mode: 'fixed' as const, value: 100, min: 1, max: null },
  height: { mode: 'fixed' as const, value: 50, min: 1, max: null },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  alignSelf: 'auto' as const,
}

const registry = createComposeEntityRegistry({
  presets: [
    {
      id: 'container',
      label: '容器',
      createComponents: () => ({
        Transform: transform,
        LayoutItem: layoutItem,
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
        LayoutItem: layoutItem,
        Visibility: { visible: true },
        Lock: { locked: false },
        Appearance: { backgroundPaint: { kind: 'solid', color: '#2463eb' } },
        Renderer: { type: 'rectangle', props: {} },
      }),
    },
  ],
})

const document: ComposeDocument = {
  schemaVersion: 6,
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
    output: { width: 1280, height: 720, backgroundPaint: { kind: 'solid', color: '#111827' } },
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
      layoutSnapshot: { revision: 1, boxes: {}, diagnostics: [] },
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
