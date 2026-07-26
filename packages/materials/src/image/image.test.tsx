import type {
  ComposeAssetReference,
  ComposeAssetResolver,
} from '@compose-ui/assets'
import { ComposeRegistryComponent } from '@compose-ui/component-registry'
import type { ComposeComponentNode } from '@compose-ui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createComposeBasicMaterials } from '../index'

const reference: ComposeAssetReference = {
  providerId: 'library',
  assetKey: 'hero',
  scope: 'persistent',
}

function imageNode(): ComposeComponentNode {
  return {
    id: 'image-1',
    kind: 'component',
    name: 'hero.png',
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, width: 320, height: 180, rotation: 0 },
    componentType: 'image',
    props: { asset: reference, alt: 'Hero', fit: 'cover' },
  }
}

describe('@compose-ui/materials Image', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:hero'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('OpenSpec: basic-materials / Image 基础物料 / 渲染并更新图片', async () => {
    const listeners = new Set<() => void>()
    const resolver: ComposeAssetResolver = {
      resolve: vi.fn(async () => ({
        blob: new Blob(['png'], { type: 'image/png' }),
        revision: '1',
        mediaType: 'image/png',
      })),
      subscribe(_reference, listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
    const materials = createComposeBasicMaterials()
    const view = render(
      <ComposeRegistryComponent
        assetResolver={resolver}
        mode="preview"
        node={imageNode()}
        registry={materials.registry}
      />,
    )

    const image = await screen.findByRole('img', { name: 'Hero' })
    expect(image).toHaveAttribute('src', 'blob:hero')
    expect(image).toHaveStyle({ objectFit: 'cover' })
    listeners.forEach((listener) => listener())
    await waitFor(() => expect(resolver.resolve).toHaveBeenCalledTimes(2))
    view.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('缺少 resolver 时显示可访问占位', () => {
    const materials = createComposeBasicMaterials()
    render(
      <ComposeRegistryComponent
        mode="editor"
        node={imageNode()}
        registry={materials.registry}
      />,
    )
    expect(screen.getByRole('status', { name: /hero\.png/ })).toBeInTheDocument()
  })
})
