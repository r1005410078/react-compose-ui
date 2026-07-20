import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  createInitialValue,
  getObjectEntries,
  inspectSchema,
  setValueAtPath,
} from './schema-model'

describe('OpenSpec: property-panel / Schema 类型自动映射 / 显示基础属性类型', () => {
  it('解包 pipe 并读取名称、说明、metadata 与数值约束', () => {
    const schema = v.pipe(
      v.number(),
      v.minValue(1),
      v.maxValue(9),
      v.multipleOf(2),
      v.title('宽度'),
      v.description('组件宽度'),
      v.metadata({ propertyPanel: { order: 2, unit: 'px' } }),
    )

    expect(inspectSchema(schema)).toMatchObject({
      type: 'number',
      title: '宽度',
      description: '组件宽度',
      metadata: { order: 2, unit: 'px' },
      constraints: { min: 1, max: 9, step: 2 },
    })
  })

  it('解包可空与可选包装器并保留基础 Schema', () => {
    const schema = v.nullable(v.optional(v.string(), '默认值'))
    const info = inspectSchema(schema)

    expect(info.type).toBe('string')
    expect(info.optional).toBe(true)
    expect(info.nullable).toBe(true)
    expect(info.base.type).toBe('string')
  })
})

describe('OpenSpec: property-panel / Metadata 驱动的展示属性 / 应用展示 metadata', () => {
  it('按 order 排列对象字段并生成稳定路径', () => {
    const schema = v.object({
      later: v.pipe(v.string(), v.title('稍后'), v.metadata({ propertyPanel: { order: 20 } })),
      first: v.pipe(v.string(), v.title('最先'), v.metadata({ propertyPanel: { order: 1 } })),
    })

    expect(getObjectEntries(schema)).toEqual([
      expect.objectContaining({ key: 'first', path: ['first'] }),
      expect.objectContaining({ key: 'later', path: ['later'] }),
    ])
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 编辑嵌套对象', () => {
  it('只替换目标路径并保持原值不可变', () => {
    const input = { appearance: { opacity: 1, color: '#fff' }, visible: true }
    const output = setValueAtPath(input, ['appearance', 'opacity'], 0.5)

    expect(output).toEqual({ appearance: { opacity: 0.5, color: '#fff' }, visible: true })
    expect(output).not.toBe(input)
    expect((output as typeof input).appearance).not.toBe(input.appearance)
    expect(input.appearance.opacity).toBe(1)
  })
})

describe('OpenSpec: property-panel / 嵌套与集合属性编辑 / 修改数组和元组', () => {
  it('为内置 Schema 生成确定性初值', () => {
    const schema = v.object({
      title: v.string(),
      count: v.number(),
      enabled: v.boolean(),
      mode: v.picklist(['bar', 'line']),
      items: v.array(v.string()),
      point: v.tuple([v.number(), v.number()]),
    })

    expect(createInitialValue(schema)).toEqual({
      title: '',
      count: 0,
      enabled: false,
      mode: 'bar',
      items: [],
      point: [0, 0],
    })
  })
})
