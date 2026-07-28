import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import * as v from 'valibot'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMPOSE_PROPERTY_PANEL_BASE_EDITOR_IDS,
  ComposePropertyPanel,
} from '../index'
import type { ComposePropertyPanelRenderer } from '../index'

afterEach(cleanup)

const semanticSchema = v.object({
  position: v.pipe(
    v.object({ x: v.number(), y: v.number() }),
    v.title('位置'),
    v.metadata({ propertyPanel: { editor: 'vector2', binding: { enabled: true } } }),
  ),
  size: v.pipe(
    v.object({
      preset: v.pipe(
        v.picklist(['custom', 'hd', 'full-hd']),
        v.metadata({ propertyPanel: { optionLabels: {
          custom: '自定义', hd: '1280 × 720', 'full-hd': '1920 × 1080',
        } } }),
      ),
      width: v.pipe(v.number(), v.minValue(1)),
      height: v.pipe(v.number(), v.minValue(1)),
    }),
    v.title('尺寸'),
    v.metadata({
      propertyPanel: {
        editor: 'size',
        sizePresets: [
          { value: 'hd', width: 1280, height: 720 },
          { value: 'full-hd', width: 1920, height: 1080 },
        ],
      },
    }),
  ),
  background: v.pipe(
    v.string(),
    v.minLength(1),
    v.title('背景'),
    v.metadata({ propertyPanel: { editor: 'color' } }),
  ),
})

type SemanticValue = v.InferInput<typeof semanticSchema>

const semanticValue: SemanticValue = {
  position: { x: 12, y: 24 },
  size: { preset: 'hd' as const, width: 1280, height: 720 },
  background: 'transparent',
}

describe('OpenSpec: property-panel / 内建语义属性编辑器', () => {
  it('OpenSpec: property-panel / 内建语义属性编辑器 / 自动使用内建 editor', () => {
    render(
      <ComposePropertyPanel
        binding={{ value: [], variables: [], onChange: vi.fn() }}
        schema={semanticSchema}
        value={semanticValue}
      />,
    )

    expect(screen.getByTestId('semantic-editor-vector2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '绑定 X' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '绑定 Y' })).toBeInTheDocument()
    expect(screen.getByTestId('semantic-editor-vector2').closest('.property-panel__field'))
      .toHaveAttribute('data-property-layout', 'inline')
    expect(screen.getByTestId('semantic-editor-size').closest('.property-panel__field'))
      .toHaveAttribute('data-property-layout', 'inline')
    expect(COMPOSE_PROPERTY_PANEL_BASE_EDITOR_IDS).toEqual([
      'vector2', 'size', 'angle', 'opacity', 'corner-radius', 'stroke-width', 'visibility', 'color', 'alignment',
    ])
  })

  it('OpenSpec: property-panel / 内建语义属性编辑器 / 宿主覆盖内建 editor', () => {
    const renderer: ComposePropertyPanelRenderer = {
      id: 'vector2',
      component: (props) => (
        <output data-testid="host-vector2">{(props as { label?: string }).label}</output>
      ),
    }
    render(
      <ComposePropertyPanel
        renderers={[renderer]}
        schema={semanticSchema}
        value={semanticValue}
      />,
    )

    expect(screen.getByTestId('host-vector2')).toHaveTextContent('位置')
    expect(screen.queryByTestId('semantic-editor-vector2')).not.toBeInTheDocument()
  })
})

describe('OpenSpec: property-panel / Size 预设与 Color Picker', () => {
  it('OpenSpec: property-panel / Size 预设与 Color Picker / 选择并退出 Size 预设', () => {
    function Harness() {
      const [value, setValue] = useState<SemanticValue>(semanticValue)
      return <ComposePropertyPanel schema={semanticSchema} value={value} onValueChange={setValue} />
    }
    render(<Harness />)

    const size = screen.getByTestId('semantic-editor-size')
    expect(size).toContainElement(screen.getByRole('combobox', { name: '尺寸预设' }))
    expect(document.querySelector('[data-property-path="size.preset"]')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '尺寸预设' }), {
      target: { value: 'full-hd' },
    })
    expect(screen.getByRole('spinbutton', { name: '尺寸宽度' })).toHaveValue(1920)
    expect(screen.getByRole('spinbutton', { name: '尺寸高度' })).toHaveValue(1080)
    fireEvent.change(screen.getByRole('spinbutton', { name: '尺寸宽度' }), {
      target: { value: '0' },
    })
    fireEvent.blur(screen.getByRole('spinbutton', { name: '尺寸宽度' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: '尺寸宽度' }), {
      target: { value: '1600' },
    })
    fireEvent.blur(screen.getByRole('spinbutton', { name: '尺寸宽度' }))
    expect(screen.getByRole('combobox', { name: '尺寸预设' })).toHaveValue('custom')
  })

  it('OpenSpec: property-panel / Size 预设与 Color Picker / 隐藏 CSS 字符串并通过 Picker 提交', () => {
    function Harness() {
      const [value, setValue] = useState<SemanticValue>(semanticValue)
      return <ComposePropertyPanel schema={semanticSchema} value={value} onValueChange={setValue} />
    }
    render(<Harness />)

    const picker = screen.getByTestId('semantic-editor-color')
    expect(picker).toHaveAttribute('data-color-fallback', 'true')
    expect(screen.queryByRole('textbox', { name: '背景' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '选择背景颜色' }))
    fireEvent.keyDown(screen.getByLabelText('背景色盘'), { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '选择背景颜色' }))
      .toHaveAttribute('data-color-fallback', 'false')
  })
})

describe('OpenSpec: property-panel / 基础 editor 的只读与重置', () => {
  it('OpenSpec: property-panel / 基础 editor 的只读与重置 / 保留统一字段操作', () => {
    const schema = v.object({
      opacity: v.pipe(
        v.number(),
        v.title('不透明度'),
        v.metadata({ propertyPanel: { editor: 'opacity' } }),
      ),
      visible: v.pipe(
        v.boolean(),
        v.title('可见性'),
        v.metadata({ propertyPanel: { editor: 'visibility', readOnly: true } }),
      ),
    })
    const onValueChange = vi.fn()
    render(
      <ComposePropertyPanel
        defaultValue={{ opacity: 1, visible: true }}
        schema={schema}
        value={{ opacity: 0.5, visible: true }}
        onValueChange={onValueChange}
      />,
    )

    expect(screen.getByRole('checkbox', { name: '可见性' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '重置 不透明度' }))
    expect(onValueChange).toHaveBeenCalledWith(
      { opacity: 1, visible: true },
      expect.objectContaining({ path: ['opacity'], reason: 'reset' }),
    )
  })
})

describe('OpenSpec: property-panel / Color editor 可访问名称', () => {
  it('OpenSpec: property-panel / Color editor 可访问名称 / 不重复颜色后缀', () => {
    const schema = v.object({
      borderColor: v.pipe(
        v.string(),
        v.title('边框颜色'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
    })
    render(<ComposePropertyPanel schema={schema} value={{ borderColor: 'transparent' }} />)

    expect(screen.getByRole('button', { name: '选择边框颜色' })).toBeInTheDocument()
  })

  it('OpenSpec: property-panel / Color editor 可访问名称 / 拒绝不符合宿主 Schema 的 Picker 输出', () => {
    const schema = v.object({
      background: v.pipe(
        v.literal('transparent'),
        v.title('背景'),
        v.metadata({ propertyPanel: { editor: 'color' } }),
      ),
    })
    render(<ComposePropertyPanel schema={schema} value={{ background: 'transparent' }} />)

    fireEvent.click(screen.getByRole('button', { name: '选择背景颜色' }))
    fireEvent.keyDown(screen.getByLabelText('背景色盘'), { key: 'ArrowRight' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
