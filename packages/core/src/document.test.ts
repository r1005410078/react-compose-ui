import { describe, expect, it } from 'vitest'
import * as core from './index'

type ValidationIssue = {
  code: string
  path: readonly (string | number)[]
  message: string
}

type ValidationResult =
  | { valid: true; document: unknown }
  | { valid: false; issues: readonly ValidationIssue[] }

type FixtureNode = {
  id: string
  kind: 'frame' | 'group' | 'component'
  name: string
  visible: boolean
  locked: boolean
  transform: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
  }
  childIds?: string[]
  componentType?: string
  props?: Record<string, unknown>
  style?: Record<string, unknown>
}

type FixtureDocument = {
  schemaVersion: number
  canvas: {
    grid: {
      stepX: number
      stepY: number
      offsetX: number
      offsetY: number
      primaryLineEvery: number
      snapEnabled: boolean
    }
    smartSnap: { nodes: boolean; guides: boolean }
    guides: { id: string; axis: 'x' | 'y'; position: number }[]
  }
  rootIds: string[]
  nodes: Record<string, FixtureNode>
}

const validateComposeDocument = (
  core as unknown as {
    validateComposeDocument(input: unknown): ValidationResult
  }
).validateComposeDocument

function validDocument(): FixtureDocument {
  return {
    schemaVersion: 2,
    canvas: {
      grid: {
        stepX: 8,
        stepY: 8,
        offsetX: 0,
        offsetY: 0,
        primaryLineEvery: 8,
        snapEnabled: true,
      },
      smartSnap: { nodes: true, guides: true },
      guides: [],
    },
    rootIds: ['frame-a', 'frame-b'],
    nodes: {
      'frame-a': {
        id: 'frame-a',
        kind: 'frame',
        name: 'Frame A',
        visible: true,
        locked: false,
        transform: { x: -320, y: 24, width: 1920, height: 1080, rotation: 0 },
        childIds: ['group-a'],
      },
      'group-a': {
        id: 'group-a',
        kind: 'group',
        name: 'Group A',
        visible: true,
        locked: false,
        transform: { x: 100, y: 80, width: 400, height: 240, rotation: 15 },
        childIds: ['text-a'],
      },
      'text-a': {
        id: 'text-a',
        kind: 'component',
        name: 'Heading',
        visible: true,
        locked: false,
        transform: { x: 12, y: 16, width: 240, height: 48, rotation: 0 },
        componentType: 'text',
        props: { text: '季度销售额', lines: [1, true, null] },
      },
      'frame-b': {
        id: 'frame-b',
        kind: 'frame',
        name: 'Frame B',
        visible: true,
        locked: false,
        transform: { x: 1800, y: -400, width: 1280, height: 720, rotation: 0 },
        childIds: [],
      },
    },
  }
}

describe('ComposeDocument', () => {
  it('OpenSpec: compose-document / 可选通用节点样式 / 解析没有 style 的 v2 节点', () => {
    const input = validDocument()
    const resolveNodeStyle = (
      core as unknown as {
        resolveNodeStyle(node: FixtureNode): Record<string, unknown>
      }
    ).resolveNodeStyle

    expect(validateComposeDocument(input)).toEqual({ valid: true, document: input })
    expect(resolveNodeStyle(input.nodes['frame-a'])).toEqual({
      backgroundColor: '#f8fafc',
      borderColor: '#4a5667',
      borderWidth: 1,
      borderRadius: 0,
      opacity: 1,
      shadow: null,
    })
    expect(resolveNodeStyle(input.nodes['group-a'])).toEqual({
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      opacity: 1,
      shadow: null,
    })
    expect(input.nodes['frame-a'].style).toBeUndefined()
  })

  it('OpenSpec: compose-document / 可选通用节点样式 / 校验合法部分 style', () => {
    const input = validDocument()
    input.nodes['text-a'].style = {
      backgroundColor: '#102030',
      shadow: {
        color: 'rgba(0, 0, 0, 0.3)',
        offsetX: 4,
        offsetY: 8,
        blur: 16,
        spread: -2,
      },
    }
    const resolveNodeStyle = (
      core as unknown as {
        resolveNodeStyle(node: FixtureNode): Record<string, unknown>
      }
    ).resolveNodeStyle

    expect(validateComposeDocument(input)).toEqual({ valid: true, document: input })
    expect(resolveNodeStyle(input.nodes['text-a'])).toMatchObject({
      backgroundColor: '#102030',
      borderWidth: 0,
      opacity: 1,
      shadow: input.nodes['text-a'].style.shadow,
    })
  })

  it('OpenSpec: compose-document / 可选通用节点样式 / 拒绝非法 style', () => {
    const cases = [
      { style: { unknown: true }, path: ['nodes', 'text-a', 'style', 'unknown'] },
      { style: { backgroundColor: '' }, path: ['nodes', 'text-a', 'style', 'backgroundColor'] },
      { style: { opacity: 1.2 }, path: ['nodes', 'text-a', 'style', 'opacity'] },
      { style: { opacity: undefined }, path: ['nodes', 'text-a', 'style', 'opacity'] },
      { style: { borderWidth: -1 }, path: ['nodes', 'text-a', 'style', 'borderWidth'] },
      { style: { shadow: '0 0 2px black' }, path: ['nodes', 'text-a', 'style', 'shadow'] },
      {
        style: {
          shadow: {
            color: '#000',
            offsetX: 0,
            offsetY: 0,
            blur: -1,
            spread: 0,
          },
        },
        path: ['nodes', 'text-a', 'style', 'shadow', 'blur'],
      },
    ]

    cases.forEach(({ style, path }) => {
      const input = validDocument()
      input.nodes['text-a'].style = style
      const result = validateComposeDocument(input)

      expect(result.valid).toBe(false)
      if (result.valid) return
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: 'style.invalid',
        path,
      }))
    })
  })

  it('OpenSpec: compose-document / 版本化 JSON 文档 / 校验合法 v2 多 Frame 文档', () => {
    const input = validDocument()
    const result = validateComposeDocument(input)

    expect(result).toEqual({ valid: true, document: input })
    expect(JSON.parse(JSON.stringify(input))).toEqual(input)
  })

  it('OpenSpec: compose-document / 版本化 JSON 文档 / 拒绝非 JSON 属性', () => {
    const input = validDocument()
    input.nodes['text-a'].props = {
      onClick: () => undefined,
      infinite: Number.POSITIVE_INFINITY,
    } as never

    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'json.unsupported',
        path: ['nodes', 'text-a', 'props', 'onClick'],
      }),
      expect.objectContaining({
        code: 'json.non-finite-number',
        path: ['nodes', 'text-a', 'props', 'infinite'],
      }),
    ]))
  })

  it('OpenSpec: compose-document / 版本化 JSON 文档 / 拒绝 v1 与未知版本', () => {
    for (const schemaVersion of [1, 3]) {
      const input = { ...validDocument(), schemaVersion }
      const result = validateComposeDocument(input)

      expect(result).toEqual({
        valid: false,
        issues: [expect.objectContaining({
          code: 'document.unsupported-version',
          path: ['schemaVersion'],
        })],
      })
    }
  })

  it('OpenSpec: compose-document / 可持久化画布设置与辅助线 / 创建默认画布设置', () => {
    const createDefaultCanvasSettings = (
      core as unknown as {
        createDefaultCanvasSettings(): FixtureDocument['canvas']
      }
    ).createDefaultCanvasSettings

    expect(createDefaultCanvasSettings()).toEqual(validDocument().canvas)
    expect(createDefaultCanvasSettings()).not.toBe(createDefaultCanvasSettings())
  })

  it('OpenSpec: compose-document / 可持久化画布设置与辅助线 / 保存全局辅助线', () => {
    const input = validDocument()
    input.canvas.guides = [
      { id: 'vertical', axis: 'x', position: -32.5 },
      { id: 'horizontal', axis: 'y', position: 48 },
    ]

    expect(validateComposeDocument(input)).toEqual({ valid: true, document: input })
    expect(JSON.parse(JSON.stringify(input)).canvas.guides).toEqual(input.canvas.guides)
  })

  it('OpenSpec: compose-document / 可持久化画布设置与辅助线 / 拒绝非法画布配置', () => {
    const input = validDocument()
    input.canvas.grid.stepX = 0
    input.canvas.grid.offsetY = Number.POSITIVE_INFINITY
    input.canvas.grid.primaryLineEvery = 1.5
    input.canvas.smartSnap.nodes = 'yes' as never
    input.canvas.guides = [
      { id: 'guide', axis: 'x', position: -32 },
      { id: 'guide', axis: 'y', position: 16 },
      { id: 'bad', axis: 'x', position: Number.NaN },
    ]

    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'canvas.invalid-step', path: ['canvas', 'grid', 'stepX'] }),
      expect.objectContaining({ code: 'canvas.invalid-offset', path: ['canvas', 'grid', 'offsetY'] }),
      expect.objectContaining({
        code: 'canvas.invalid-primary-interval',
        path: ['canvas', 'grid', 'primaryLineEvery'],
      }),
      expect.objectContaining({
        code: 'canvas.invalid',
        path: ['canvas', 'smartSnap', 'nodes'],
      }),
      expect.objectContaining({
        code: 'canvas.duplicate-guide',
        path: ['canvas', 'guides', 1, 'id'],
      }),
      expect.objectContaining({
        code: 'canvas.invalid-guide',
        path: ['canvas', 'guides', 2],
      }),
    ]))
  })

  it('OpenSpec: compose-document / 规范化节点拓扑 / 使用合法 Frame 子树', () => {
    const input = validDocument()
    const result = validateComposeDocument(input)

    expect(result.valid).toBe(true)
    expect(input.nodes['frame-a'].childIds).toEqual(['group-a'])
  })

  it('OpenSpec: compose-document / 规范化节点拓扑 / 拒绝悬空或重复父节点', () => {
    const input = validDocument()
    input.nodes['frame-a'].childIds?.push('missing')
    input.nodes['frame-b'].childIds?.push('text-a')
    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'document.missing-child',
      'document.multiple-parents',
    ]))
  })

  it('OpenSpec: compose-document / 规范化节点拓扑 / 拒绝根级普通节点或循环', () => {
    const input = validDocument()
    input.rootIds.push('group-a')
    input.nodes['group-a'].childIds?.push('group-a')
    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'document.invalid-root-kind',
      'document.cycle',
    ]))
  })

  it('OpenSpec: compose-document / 节点变换与显示状态 / 拒绝非法变换', () => {
    const input = validDocument()
    input.nodes['frame-a'].transform.rotation = 1
    input.nodes['group-a'].transform.width = 0
    input.nodes['text-a'].transform.x = Number.NaN
    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'transform.frame-rotation',
        path: ['nodes', 'frame-a', 'transform', 'rotation'],
      }),
      expect.objectContaining({
        code: 'transform.invalid-size',
        path: ['nodes', 'group-a', 'transform', 'width'],
      }),
      expect.objectContaining({
        code: 'transform.non-finite',
        path: ['nodes', 'text-a', 'transform', 'x'],
      }),
    ]))
  })

  it('OpenSpec: compose-document / 节点变换与显示状态 / 接受无限空间负坐标', () => {
    const input = validDocument()
    input.nodes['frame-a'].transform.x = -10_000
    input.nodes['group-a'].transform.y = -2_400

    const result = validateComposeDocument(input)

    expect(result).toEqual({ valid: true, document: input })
    expect(input.nodes['frame-a'].transform.x).toBe(-10_000)
    expect(input.nodes['group-a'].transform.y).toBe(-2_400)
  })

  it('OpenSpec: compose-document / 可序列化组件节点 / 保存未知组件类型', () => {
    const input = validDocument()
    input.nodes['text-a'].componentType = 'host.unknown'

    expect(validateComposeDocument(input)).toEqual({ valid: true, document: input })
  })

  it('OpenSpec: compose-document / 可序列化组件节点 / 拒绝空组件类型', () => {
    const input = validDocument()
    input.nodes['text-a'].componentType = ''
    const result = validateComposeDocument(input)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'component.empty-type',
      path: ['nodes', 'text-a', 'componentType'],
    }))
  })
})
