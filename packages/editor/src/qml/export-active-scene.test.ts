import {
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { describe, expect, it } from 'vitest'
import { exportActiveSceneAsQml } from './export-active-scene'

const messages = {
  exported: '已导出 QML',
  exportPartial: '已导出 QML，部分内容做了降级',
  exportFailed: 'QML 导出失败',
  fontsNeeded: '目标机需要安装字体',
}

function input(children: ComposeDocument['entities'] = {}, activeFrameId: string | null = 'b') {
  const a = { ...createComposeFrameEntity({ id: 'a', childIds: [], size: { width: 100, height: 50 } }), name: '场景 A' }
  const b = { ...createComposeFrameEntity({ id: 'b', childIds: Object.keys(children), size: { width: 200, height: 80 } }), name: '主屏/总览' }
  const layoutDocument: ComposeDocument = {
    schemaVersion: 7,
    canvas: createDefaultCanvasSettings(),
    rootIds: ['a', 'b'],
    entities: { a, b, ...children },
  }
  const layoutSnapshot: ComposeLayoutSnapshot = {
    revision: 1,
    diagnostics: [],
    boxes: {
      a: { x: 0, y: 0, width: 100, height: 50, positioning: 'absolute' },
      b: { x: 200, y: 0, width: 200, height: 80, positioning: 'absolute' },
      ...Object.fromEntries(Object.keys(children).map((id) => [id, { x: 0, y: 0, width: 40, height: 20, positioning: 'absolute' as const }])),
    },
  }
  return { layoutDocument, layoutSnapshot, activeFrameId, messages }
}

describe('OpenSpec: qml-export / 编辑器导出入口', () => {
  it('导出激活场景，文件名取场景名并去掉文件系统不接受的字符', () => {
    const outcome = exportActiveSceneAsQml(input())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.fileName).toBe('主屏总览.qml')
    expect(outcome.qml).toContain('objectName: "b"')
    expect(outcome.notice).toBe('已导出 QML：主屏总览.qml。')
  })

  it('没有记录激活场景时退回第一块根场景（与预览默认目标同一个回退）', () => {
    const outcome = exportActiveSceneAsQml(input({}, null))
    expect(outcome.ok && outcome.qml).toContain('objectName: "a"')
  })

  it('导出时有降级：文件照常交付，提示按类聚合并列出要装的字体', () => {
    const frame = createComposeFrameEntity({ id: 'x', childIds: [], size: { width: 1, height: 1 } })
    const chart = (id: string) => ({
      ...frame,
      id,
      name: id,
      components: {
        Composition: { presetId: 'chart-bar', baseComponentKeys: [], capabilityIds: [] },
        Transform: { rotation: 0 },
        LayoutItem: frame.components.LayoutItem!,
        Visibility: { visible: true },
        Lock: { locked: false },
        Renderer: { type: 'chart', props: {} },
      },
    })
    const label = {
      ...chart('label'),
      components: {
        ...chart('label').components,
        Renderer: { type: 'text', props: { text: 'Hi', fontFamily: 'DejaVu Sans' } },
      },
    }
    const outcome = exportActiveSceneAsQml(input({ c1: chart('c1'), c2: chart('c2'), label }))
    expect(outcome.ok).toBe(true)
    expect(outcome.notice).toContain('已导出 QML，部分内容做了降级（主屏总览.qml）')
    expect(outcome.notice).toContain('（共 2 处）')
    expect(outcome.notice).toContain('目标机需要安装字体：DejaVu Sans')
  })

  it('激活场景不在文档根里时给出带原因的失败提示，而不是抛出', () => {
    const empty = input()
    const outcome = exportActiveSceneAsQml({
      ...empty,
      layoutDocument: { ...empty.layoutDocument, rootIds: [] },
    })
    expect(outcome.ok).toBe(false)
    expect(outcome.notice).toBe('QML 导出失败：「b」不是文档的根场景')
  })
})
