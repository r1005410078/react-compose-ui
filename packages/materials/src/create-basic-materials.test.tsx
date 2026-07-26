import type { ComposeComponentDefinition } from '@compose-ui/component-registry'
import { describe, expect, it } from 'vitest'
import * as materialsEntry from './index'
import {
  DEFAULT_COMPOSE_BASIC_COMPONENT_DEFINITIONS,
  DEFAULT_COMPOSE_BASIC_FRAME_PRESETS,
  createComposeBasicMaterials,
} from './index'
import type {
  ComposeBasicMaterials,
  ComposeCreateBasicMaterialsOptions,
} from './index'

const extension: ComposeComponentDefinition = {
  type: 'extension',
  label: 'Extension',
  defaultSize: { width: 100, height: 80 },
  createDefaultProps: () => ({ source: 'host' }),
  renderer: () => <div>Extension</div>,
}

describe('@compose-ui/materials factory', () => {
  it('OpenSpec: basic-materials / 独立基础物料包 / 覆盖默认值并追加扩展', () => {
    const options: ComposeCreateBasicMaterialsOptions = {
      frame: {
        label: 'Desktop Frame',
        name: 'Desktop',
        defaultSize: { width: 1440, height: 900 },
      },
      rectangle: {
        label: 'Box',
        name: 'Box node',
        defaultSize: { width: 320, height: 160 },
        defaultStyle: { backgroundColor: '#ff0000', borderRadius: 4 },
      },
      extensions: [extension],
    }
    const materials: ComposeBasicMaterials = createComposeBasicMaterials(options)

    expect(DEFAULT_COMPOSE_BASIC_FRAME_PRESETS.map((item) => item.label)).toEqual(['Frame'])
    expect(DEFAULT_COMPOSE_BASIC_COMPONENT_DEFINITIONS.map((item) => item.type))
      .toEqual(['rectangle', 'text', 'image', 'svg'])
    expect(materials.framePresets.map((item) => item.label)).toEqual(['Desktop Frame'])
    expect(materials.componentDefinitions.map((item) => item.type))
      .toEqual(['rectangle', 'text', 'image', 'svg', 'extension'])
    expect(materials.registry.list().map((item) => item.label))
      .toEqual(['Box', 'Text', 'Image', 'SVG', 'Extension'])
    expect(materials.framePresets[0]?.defaultSize).toEqual({ width: 1440, height: 900 })
    expect(materials.registry.createSeed('rectangle')).toMatchObject({
      ok: true,
      seed: {
        width: 320,
        height: 160,
        props: {},
        style: { backgroundColor: '#ff0000', borderRadius: 4 },
      },
    })
  })

  it('OpenSpec: basic-materials / 独立基础物料包 / 创建默认物料 bundle', () => {
    const materials = createComposeBasicMaterials()
    const first = materials.registry.createSeed('rectangle')
    const second = materials.registry.createSeed('rectangle')
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.seed.props).not.toBe(second.seed.props)
    expect(first.seed.style).not.toBe(second.seed.style)
    expect(first.seed).toMatchObject({
      props: {},
      style: {
        backgroundColor: '#2f7df6',
        borderRadius: 12,
      },
    })
    expect(materials.framePresets[0]).toMatchObject({
      label: 'Frame',
      name: 'Frame',
      defaultSize: { width: 1280, height: 720 },
    })
    expect(materials.registry.createSeed('text')).toMatchObject({
      ok: true,
      seed: {
        name: 'Text',
        width: 280,
        height: 72,
        props: { text: 'Text', color: '#172033', fontSize: 24 },
      },
    })
  })

  it('保持根入口的公共值导出兼容', () => {
    expect(materialsEntry).toMatchObject({
      COMPOSE_UI_MATERIALS_PACKAGE: '@compose-ui/materials',
      DEFAULT_COMPOSE_FRAME_PRESET: expect.any(Object),
      DEFAULT_COMPOSE_RECTANGLE_DEFINITION: expect.any(Object),
      DEFAULT_COMPOSE_TEXT_DEFINITION: expect.any(Object),
      DEFAULT_COMPOSE_BASIC_FRAME_PRESETS: expect.any(Array),
      DEFAULT_COMPOSE_BASIC_COMPONENT_DEFINITIONS: expect.any(Array),
      createComposeBasicMaterials: expect.any(Function),
    })
  })
})
