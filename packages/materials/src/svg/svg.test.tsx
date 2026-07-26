import type { ComposeAssetResolver } from '@compose-ui/assets'
import { RegistryComponent } from '@compose-ui/component-registry'
import type { ComposeComponentNode } from '@compose-ui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createBasicMaterials } from '../index'

const maliciousSvg = `
  <svg viewBox="0 0 64 32" onclick="alert(1)">
    <script>alert(1)</script>
    <foreignObject><iframe src="https://evil.test"/></foreignObject>
    <style>.shape { fill: url(https://evil.test/a) }</style>
    <defs><linearGradient id="safe"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
    <rect class="shape" width="64" height="32" fill="url(#safe)" stroke="#111"/>
    <path d="M0 0h10v10z" fill="none"/>
    <animate attributeName="x" dur="1s"/>
  </svg>
`

function svgNode(): ComposeComponentNode {
  return {
    id: 'svg-1',
    kind: 'component',
    name: 'logo.svg',
    visible: true,
    locked: false,
    transform: { x: 0, y: 0, width: 64, height: 32, rotation: 0 },
    componentType: 'svg',
    props: {
      asset: {
        providerId: 'library',
        assetKey: 'logo',
        scope: 'persistent',
      },
      alt: 'Logo',
      fit: 'contain',
      overrideFill: true,
      fillColor: '#ff0000',
      overrideStroke: true,
      strokeColor: '#00ff00',
    },
  }
}

describe('@compose-ui/materials SVG', () => {
  afterEach(cleanup)

  it('OpenSpec: basic-materials / 安全可改色 SVG 基础物料 / 净化恶意 SVG', async () => {
    const resolver: ComposeAssetResolver = {
      resolve: async () => ({
        blob: new Blob([maliciousSvg], { type: 'image/svg+xml' }),
        revision: '1',
        mediaType: 'image/svg+xml',
      }),
    }
    const materials = createBasicMaterials()
    render(
      <RegistryComponent
        assetResolver={resolver}
        mode="preview"
        node={svgNode()}
        registry={materials.registry}
      />,
    )
    const host = await screen.findByRole('img', { name: 'Logo' })
    await waitFor(() => expect(host.querySelector('svg')).not.toBeNull())
    expect(host.querySelector('script,foreignObject,style,animate')).toBeNull()
    expect(host.querySelector('svg')).not.toHaveAttribute('onclick')
    expect(host.innerHTML).not.toContain('evil.test')
    expect(host.querySelector('linearGradient#safe')).not.toBeNull()
  })

  it('OpenSpec: basic-materials / 安全可改色 SVG 基础物料 / 覆盖填充与描边', async () => {
    const resolver: ComposeAssetResolver = {
      resolve: async () => ({
        blob: new Blob([maliciousSvg], { type: 'image/svg+xml' }),
        revision: '1',
        mediaType: 'image/svg+xml',
      }),
    }
    const materials = createBasicMaterials()
    render(
      <RegistryComponent
        assetResolver={resolver}
        mode="editor"
        node={svgNode()}
        registry={materials.registry}
      />,
    )
    const host = await screen.findByRole('img', { name: 'Logo' })
    await waitFor(() => expect(host.querySelector('rect')).not.toBeNull())
    expect(host.querySelector('rect')).toHaveAttribute('fill', '#ff0000')
    expect(host.querySelector('rect')).toHaveAttribute('stroke', '#00ff00')
    expect(host.querySelector('path')).toHaveAttribute('fill', 'none')
    expect(host.querySelector('path')).not.toHaveAttribute('stroke')
  })
})
