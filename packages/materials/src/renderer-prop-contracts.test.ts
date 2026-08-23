import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER } from './component-instance/definition'
import { DEFAULT_COMPOSE_IMAGE_RENDERER } from './image/definition'
import { DEFAULT_COMPOSE_SVG_RENDERER } from './svg/definition'
import { DEFAULT_COMPOSE_TEXT_RENDERER } from './text/definition'

function contractNames(definition: { readonly propContracts?: readonly { readonly name: string }[] }) {
  return definition.propContracts?.map((contract) => contract.name) ?? []
}

function validateValue(
  definition: typeof DEFAULT_COMPOSE_TEXT_RENDERER,
  name: string,
  value: unknown,
) {
  const contract = definition.propContracts?.find((item) => item.name === name)
  return contract?.kind === 'value' ? contract.validate(value) : false
}

describe('first-party Renderer Prop Contracts', () => {
  it('OpenSpec: component-registry / 完整顶层 Props Contract / 覆盖第一方 Renderer 的公开 Props', () => {
    expect(contractNames(DEFAULT_COMPOSE_TEXT_RENDERER)).toEqual([
      'text',
      'color',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'textAlign',
      'verticalAlign',
      'textCase',
      'textDecoration',
    ])
    expect(DEFAULT_COMPOSE_TEXT_RENDERER.inspectorPropNames).toEqual([
      'text',
      'color',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'textAlign',
      'verticalAlign',
      'textCase',
      'textDecoration',
    ])
    expect(DEFAULT_COMPOSE_TEXT_RENDERER.propCategories).toEqual([
      { id: 'text', label: '文本' },
      { id: 'typography', label: '排版' },
    ])
    expect(DEFAULT_COMPOSE_TEXT_RENDERER.propContracts?.map((contract) => contract.category))
      .toEqual([
        'text', 'text',
        'typography', 'typography', 'typography', 'typography', 'typography',
        'typography', 'typography', 'typography', 'typography',
      ])
    expect(contractNames(DEFAULT_COMPOSE_IMAGE_RENDERER)).toEqual(['asset', 'alt', 'fit'])
    expect(DEFAULT_COMPOSE_IMAGE_RENDERER.propCategories).toEqual([{ id: 'image', label: '图片' }])
    expect(DEFAULT_COMPOSE_IMAGE_RENDERER.inspectorPropNames).toEqual(['alt', 'fit'])
    expect(contractNames(DEFAULT_COMPOSE_SVG_RENDERER)).toEqual([
      'asset',
      'alt',
      'fit',
      'overrideFill',
      'fillColor',
      'overrideStroke',
      'strokeColor',
    ])
    expect(DEFAULT_COMPOSE_SVG_RENDERER.inspectorPropNames).toEqual([
      'alt',
      'fit',
      'overrideFill',
      'fillColor',
      'overrideStroke',
      'strokeColor',
    ])
    expect(DEFAULT_COMPOSE_SVG_RENDERER.propCategories).toEqual([{ id: 'svg', label: 'SVG' }])

    // 组件实例的两条 Prop 是「宿主怎么驱动这个实例」的全部入口；实例内不持有时钟，
    // 因此没有 playing / playbackMode 之类的第三条。
    expect(contractNames(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER))
      .toEqual(['animation', 'animationTime'])
    expect(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER.inspectorPropNames)
      .toEqual(['animation', 'animationTime'])
    expect(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER.propCategories)
      .toEqual([{ id: 'animation', label: '动画', inspectorDefaultExpanded: true }])
  })

  it('OpenSpec: component-registry / 字段绑定校验 / Contract 与 Inspector Schema 接受同一值域', () => {
    expect(validateValue(DEFAULT_COMPOSE_TEXT_RENDERER, 'text', 12)).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_TEXT_RENDERER, 'fontSize', 0)).not.toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_TEXT_RENDERER, 'textAlign', 'justify')).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_TEXT_RENDERER, 'textAlign', 'start')).not.toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_IMAGE_RENDERER, 'fit', 'scale-down')).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_IMAGE_RENDERER, 'fit', 'tile')).not.toBe(true)

    // `animation` 允许 null——「还没配」是合法状态；失效 id 不由 Contract 判定，
    // Contract 只看得见一个值，看不见清单。
    expect(validateValue(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER, 'animation', null)).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER, 'animation', 'gone')).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER, 'animation', 7)).not.toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER, 'animationTime', 250)).toBe(true)
    expect(validateValue(DEFAULT_COMPOSE_COMPONENT_INSTANCE_RENDERER, 'animationTime', Number.NaN))
      .not.toBe(true)
  })
})
