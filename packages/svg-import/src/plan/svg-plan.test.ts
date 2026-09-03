import { describe, expect, it } from 'vitest'
import {
  getComposeCurve,
  getComposeHierarchy,
  getComposeLayoutItem,
  validateComposeDocument,
  type ComposeEntity,
} from '@compose-ui/core'
import { planSvgImport } from './svg-plan'
import type { SvgEntitySeed } from './svg-types'

/**
 * 一份最小的假 Registry：只提供本包会问到的那几个 Preset。
 *
 * @remarks
 * 用例因此不依赖 `@compose-ui/materials`——那正是「Preset seed 由调用方注入」这条边界要换来的
 * 东西，也是这个包能在 node 环境下测的原因。
 */
function createSeed(presetId: string): SvgEntitySeed | null {
  const base = {
    Composition: { presetId, baseComponentKeys: [], capabilityIds: [] },
    Transform: { rotation: 0 },
    LayoutItem: {
      positioning: 'absolute',
      offset: { x: 0, y: 0 },
      width: { mode: 'fixed', value: 1, min: null, max: null },
      height: { mode: 'fixed', value: 1, min: null, max: null },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      alignSelf: 'auto',
    },
    Visibility: { visible: true },
    Lock: { locked: false },
  }
  const appearance = {
    backgroundPaint: { kind: 'solid', color: 'transparent' },
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    opacity: 1,
    shadow: null,
  }
  if (presetId === 'frame') {
    return {
      name: 'Frame',
      components: {
        ...base,
        Appearance: appearance,
        Frame: { size: { width: 1, height: 1 } },
        Hierarchy: { childIds: [] },
        Clip: { enabled: false },
      },
    }
  }
  if (presetId === 'curve' || presetId === 'rect' || presetId === 'circle') {
    return {
      name: presetId === 'curve' ? 'Curve' : presetId === 'rect' ? 'Rectangle' : 'Circle',
      components: {
        ...base,
        Appearance: appearance,
        Renderer: { type: 'curve', props: { stroke: '#d8e2f1', strokeWidth: 1 } },
        Curve: { kind: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
      },
    }
  }
  if (presetId === 'text') {
    return {
      name: 'Text',
      components: {
        ...base,
        Appearance: appearance,
        Renderer: { type: 'text', props: { text: 'Text', fontSize: 12 } },
      },
    }
  }
  if (presetId === 'image') {
    return {
      name: 'Image',
      components: {
        ...base,
        Appearance: appearance,
        Renderer: { type: 'image', props: { asset: null, alt: '', fit: 'contain' } },
      },
    }
  }
  return null
}

let counter = 0
const idFactory = () => `id-${(counter += 1)}`

function plan(markup: string, name = 'symbol') {
  counter = 0
  return planSvgImport(markup, { createSeed, idFactory, name })
}

/** 取根 Frame 的直接子级。 */
function rootChildren(document: { entities: Readonly<Record<string, ComposeEntity>>; rootIds: readonly string[] }) {
  const root = document.entities[document.rootIds[0]!]!
  return (getComposeHierarchy(root)?.childIds ?? []).map((id) => document.entities[id]!)
}

describe('OpenSpec: svg-import / SVG 导入产出组件导入计划', () => {
  const knife = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60" width="40" height="60">
    <style>.lead{stroke:#333;stroke-width:2}</style>
    <g id="terminals">
      <circle class="lead" cx="20" cy="10" r="3" fill="none"/>
      <circle class="lead" cx="20" cy="50" r="3" fill="none"/>
    </g>
    <line id="blade" class="lead" x1="20" y1="47" x2="32" y2="16"/>
  </svg>`

  it('产出一份根为 Frame 的合法组件文档，尺寸取自 viewBox', () => {
    const result = plan(knife)!
    expect(result.component.size).toEqual({ width: 40, height: 60 })
    expect(validateComposeDocument(result.component.document).valid).toBe(true)
    expect(result.component.document.rootIds).toHaveLength(1)
  })

  it('每个图元都是可独立选中的 Entity，分组保持层级', () => {
    const result = plan(knife)!
    const children = rootChildren(result.component.document)
    expect(children).toHaveLength(2)
    const [group, blade] = children
    expect(getComposeHierarchy(group!)?.childIds).toHaveLength(2)
    expect(getComposeCurve(blade!)?.kind).toBe('line')
  })

  it('元素 id 落成 Entity 名称——用户要在场景树里认出哪个是刀', () => {
    const result = plan(knife)!
    const names = Object.values(result.component.document.entities).map(({ name }) => name)
    expect(names).toContain('blade')
    expect(names).toContain('terminals')
  })

  it('class 里的描边求值成每个 Entity 自己的 props，文档里不留 class', () => {
    const result = plan(knife)!
    const blade = rootChildren(result.component.document)[1]!
    const renderer = blade.components.Renderer as { props: Record<string, unknown> }
    expect(renderer.props.stroke).toBe('#333333')
    expect(renderer.props.strokeWidth).toBe(2)
    expect(JSON.stringify(result.component.document)).not.toContain('lead')
  })

  it('计划里不含组件实例，也不写盘', () => {
    const result = plan(knife)!
    expect(result.assets).toEqual([])
    const presets = Object.values(result.component.document.entities)
      .map((entity) => (entity.components.Composition as { presetId: string }).presetId)
    expect(presets).not.toContain('component-instance')
  })

  it('没有 svg 根时返回 null', () => {
    expect(plan('<html><body>nope</body></html>')).toBeNull()
  })
})

describe('OpenSpec: svg-import / 结构元素的映射', () => {
  it('viewBox 与 width 不一致时内容按比例缩放', () => {
    const result = plan(`<svg viewBox="0 0 10 10" width="20" height="20">
      <line x1="0" y1="0" x2="10" y2="0"/></svg>`)!
    expect(result.component.size).toEqual({ width: 20, height: 20 })
    const line = rootChildren(result.component.document)[0]!
    // 内容跟着放大一倍：漏掉这一步的症状是「导进来的图标只有四分之一大」。
    expect(getComposeLayoutItem(line)!.width.value).toBe(20)
  })

  it('viewBox 的 min-x/min-y 被平移掉', () => {
    const result = plan(`<svg viewBox="100 100 10 10">
      <line x1="100" y1="100" x2="110" y2="100"/></svg>`)!
    expect(getComposeLayoutItem(rootChildren(result.component.document)[0]!)!.offset)
      .toEqual({ x: 0, y: 0 })
  })

  it('defs 与 style 不产出 Entity', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <defs><rect width="5" height="5"/></defs><style>.a{fill:red}</style>
      <line x1="0" y1="0" x2="5" y2="5"/></svg>`)!
    expect(rootChildren(result.component.document)).toHaveLength(1)
  })

  it('use 就地展开并叠加自己的偏移', () => {
    const result = plan(`<svg viewBox="0 0 20 20">
      <defs><line id="tick" x1="0" y1="0" x2="4" y2="0"/></defs>
      <use href="#tick" x="10" y="5"/></svg>`)!
    const expanded = rootChildren(result.component.document)[0]!
    expect(getComposeCurve(expanded)?.kind).toBe('line')
    expect(getComposeLayoutItem(expanded)!.offset).toEqual({ x: 10, y: 5 })
  })

  it('空的 g 不产出 Entity', () => {
    const result = plan('<svg viewBox="0 0 10 10"><g id="empty"></g></svg>')!
    expect(rootChildren(result.component.document)).toHaveLength(0)
  })
})

describe('OpenSpec: svg-import / 不能表达的属性降级，元素永不丢弃', () => {
  it('带滤镜的图元照常导入，并给出诊断', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <line filter="url(#f0)" x1="0" y1="0" x2="5" y2="5"/></svg>`)!
    expect(rootChildren(result.component.document)).toHaveLength(1)
    expect(result.diagnostics.map(({ code }) => code)).toContain('svg.unsupported-paint-effect')
  })

  it('script 与事件属性不进文档', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <script>alert(1)</script>
      <line onclick="alert(1)" x1="0" y1="0" x2="5" y2="5"/></svg>`)!
    const serialized = JSON.stringify(result.component.document)
    expect(serialized).not.toContain('alert')
    expect(serialized).not.toContain('onclick')
    expect(result.diagnostics.map(({ code }) => code)).toContain('svg.executable-content')
  })

  it('渐变降级成纯色并报告', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <defs><linearGradient id="g"><stop stop-color="#f00"/><stop stop-color="#00f"/></linearGradient></defs>
      <rect width="10" height="10" fill="url(#g)"/></svg>`)!
    const rect = rootChildren(result.component.document)[0]!
    const appearance = rect.components.Appearance as { backgroundPaint: { color: string } }
    expect(appearance.backgroundPaint.color).toBe('#ff0000')
    expect(result.diagnostics.map(({ code }) => code)).toContain('svg.gradient-flattened')
  })

  it('display:none 落成不可见而不是被丢掉', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <line style="display:none" x1="0" y1="0" x2="5" y2="5"/></svg>`)!
    const line = rootChildren(result.component.document)[0]!
    expect(line.components.Visibility).toEqual({ visible: false })
  })
})

describe('OpenSpec: svg-import / 内嵌图片由计划带出、宿主写盘', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('data URI 落成待写资源，并指明要回填的 Entity', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <image id="logo" href="${png}" x="1" y="2" width="8" height="4"/></svg>`)!
    expect(result.assets).toHaveLength(1)
    const [asset] = result.assets
    expect(asset!.mediaType).toBe('image/png')
    expect(asset!.base64).toBe('iVBORw0KGgo=')
    expect(result.component.document.entities[asset!.entityId]).toBeDefined()
  })

  it('外链图片被丢弃并报告', () => {
    const result = plan(`<svg viewBox="0 0 10 10">
      <image href="https://example.com/a.png" width="8" height="4"/></svg>`)!
    expect(result.assets).toHaveLength(0)
    expect(rootChildren(result.component.document)).toHaveLength(0)
    expect(result.diagnostics.map(({ code }) => code)).toContain('svg.executable-content')
  })

  it('尺寸未知的图片跳过并报告', () => {
    const result = plan(`<svg viewBox="0 0 10 10"><image href="${png}"/></svg>`)!
    expect(result.diagnostics.map(({ code }) => code)).toContain('svg.unknown-image-size')
  })
})

describe('OpenSpec: svg-import / 文字映射为文字物料', () => {
  it('居中文字换算成盒左上角，盒走 Hug', () => {
    const result = plan(`<svg viewBox="0 0 100 20">
      <text x="50" y="15" font-size="10" text-anchor="middle">ON</text></svg>`)!
    const text = rootChildren(result.component.document)[0]!
    const item = getComposeLayoutItem(text)!
    expect(item.width.mode).toBe('hug')
    expect(item.height.mode).toBe('hug')
    // 两个字符、字号 10：估算宽 12，因此左上角在 50 − 6 = 44；基线上移 0.8 × 10。
    expect(item.offset).toEqual({ x: 44, y: 7 })
    const renderer = text.components.Renderer as { props: Record<string, unknown> }
    expect(renderer.props.text).toBe('ON')
    expect(renderer.props.textAlign).toBe('center')
  })
})
