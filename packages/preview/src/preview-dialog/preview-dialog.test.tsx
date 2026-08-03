import { createComposeEntityRegistry } from '@compose-ui/component-registry'
import {
  createDefaultCanvasSettings,
  createDefaultOutputSettings,
  type ComposeDocument,
  type ComposeEntity,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ComposePreviewDialog } from '../index'

afterEach(cleanup)

const container: ComposeEntity = {
  id: 'container',
  name: 'Container',
  components: {
    Composition: { presetId: null, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 320, min: 1, max: null },
      height: { mode: 'fixed', value: 180, min: 1, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
    Hierarchy: { childIds: [] },
  },
}

const document: ComposeDocument = {
  schemaVersion: 6,
  canvas: createDefaultCanvasSettings(),
  output: { ...createDefaultOutputSettings(), width: 640, height: 360 },
  rootIds: [container.id],
  entities: { [container.id]: container },
}

const layoutSnapshot: ComposeLayoutSnapshot = {
  revision: 1,
  boxes: {
    [container.id]: { x: 0, y: 0, width: 320, height: 180, positioning: 'absolute' },
  },
  diagnostics: [],
}

const registry = createComposeEntityRegistry()

function renderDialog(overrides: Partial<ComponentProps<typeof ComposePreviewDialog>> = {}) {
  const onOpenChange = vi.fn()
  return {
    onOpenChange,
    ...render(
      <ComposePreviewDialog
        document={document}
        layoutSnapshot={layoutSnapshot}
        open
        registry={registry}
        onOpenChange={onOpenChange}
        {...overrides}
      />,
    ),
  }
}

describe('ComposePreviewDialog', () => {
  it('OpenSpec: compose-preview / 受控 Preview Dialog / 打开完整文档预览', () => {
    const { onOpenChange } = renderDialog()

    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selected container' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    fireEvent.mouseDown(screen.getByTestId('compose-preview-dialog-backdrop'))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('OpenSpec: compose-preview / 受控 Preview Dialog / 切换指定 Container 预览', () => {
    renderDialog({ containerId: container.id })

    fireEvent.click(screen.getByRole('button', { name: 'Selected container' }))
    expect(screen.getByTestId('compose-preview-container')).toBeInTheDocument()
  })

  it('OpenSpec: compose-preview / Preview Dialog 视图控制 / 调整预览缩放', () => {
    renderDialog()

    fireEvent.change(screen.getByRole('combobox', { name: 'Preview scale' }), {
      target: { value: '0.5' },
    })
    expect(screen.getByTestId('compose-preview-dialog-artboard')).toHaveStyle('--compose-preview-dialog-scale: 0.5')
  })
})
