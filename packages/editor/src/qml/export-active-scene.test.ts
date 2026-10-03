import {
  createComposeFrameEntity,
  createDefaultCanvasSettings,
  type ComposeDocument,
  type ComposeLayoutSnapshot,
} from '@compose-ui/core'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { exportActiveSceneAsQml } from './export-active-scene'

const messages = {
  exporting: '正在导出 QML…',
  exported: '已导出 QML',
  exportPartial: '已导出 QML，部分内容做了降级',
  exportFailed: 'QML 导出失败',
  fontsNeeded: '目标机需要安装字体',
  scriptSkipped: '页面脚本没有随导出：宿主未提供脚本编译器。',
  scriptCompileFailed: '页面脚本编译失败',
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
  it('导出激活场景，文件名取场景名并去掉文件系统不接受的字符', async () => {
    const outcome = await exportActiveSceneAsQml(input())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.fileName).toBe('主屏总览.qml')
    expect(outcome.content).toContain('objectName: "b"')
    expect(outcome.notice).toBe('已导出 QML：主屏总览.qml。')
  })

  it('没有记录激活场景时退回第一块根场景（与预览默认目标同一个回退）', async () => {
    const outcome = await exportActiveSceneAsQml(input({}, null))
    expect(outcome.ok && outcome.content).toContain('objectName: "a"')
  })

  it('导出时有降级：文件照常交付，提示按类聚合并列出要装的字体', async () => {
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
    const outcome = await exportActiveSceneAsQml(input({ c1: chart('c1'), c2: chart('c2'), label }))
    expect(outcome.ok).toBe(true)
    expect(outcome.notice).toContain('已导出 QML，部分内容做了降级（主屏总览.qml）')
    expect(outcome.notice).toContain('（共 2 处）')
    expect(outcome.notice).toContain('目标机需要安装字体：DejaVu Sans')
  })

  it('激活场景不在文档根里时给出带原因的失败提示，而不是抛出', async () => {
    const empty = input()
    const outcome = await exportActiveSceneAsQml({
      ...empty,
      layoutDocument: { ...empty.layoutDocument, rootIds: [] },
    })
    expect(outcome.ok).toBe(false)
    expect(outcome.notice).toBe('QML 导出失败：「b」不是文档的根场景')
  })

  it('实例经宿主注入的求解交给导出器：以激活场景为起点，结果按复合地址展开', async () => {
    const frame = createComposeFrameEntity({ id: 'x', childIds: [], size: { width: 1, height: 1 } })
    const instance = {
      ...frame,
      id: 'inst',
      components: { ...frame.components, Renderer: { type: 'component-instance', props: {} } },
    }
    const nestedRoot = createComposeFrameEntity({ id: 'root', childIds: [], size: { width: 40, height: 20 } })
    const roots: string[] = []
    const outcome = await exportActiveSceneAsQml({
      ...input({ inst: instance }),
      resolveInstances: async ({ rootId }) => {
        roots.push(rootId)
        return new Map([['inst', {
          document: {
            schemaVersion: 7,
            canvas: createDefaultCanvasSettings(),
            rootIds: ['root'],
            entities: { root: nestedRoot },
          },
          snapshot: {
            revision: 1,
            diagnostics: [],
            boxes: { root: { x: 0, y: 0, width: 40, height: 20, positioning: 'absolute' } },
          },
          contentFit: 'layout',
          rootSize: { width: 40, height: 20 },
          contentScale: { x: 1, y: 1 },
          flipScale: { x: 1, y: 1 },
        }]])
      },
    })
    expect(roots).toEqual(['b'])
    expect(outcome.ok && outcome.content).toContain('objectName: "inst/root"')
  })

  it('页面有 setup：降级后的脚本与运行时一起打成 zip', async () => {
    const outcome = await exportActiveSceneAsQml({
      ...input(),
      loadSetupSource: async () => 'export function setup() { return {} }',
      scriptCompiler: { compile: async (source) => `// lowered\n${source}` },
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.fileName).toBe('主屏总览.zip')
    expect(outcome.content).toBeInstanceOf(Uint8Array)
    const unzipped = unzipSync(outcome.content as Uint8Array)
    expect(Object.keys(unzipped).sort()).toEqual([
      'ComposeRuntime/ComposePage.qml',
      'ComposeRuntime/globals.mjs',
      'ComposeRuntime/qmldir',
      'ComposeRuntime/script-runtime.mjs',
      'Scene.qml',
      'page.setup.mjs',
    ])
    expect(strFromU8(unzipped['page.setup.mjs']!)).toBe('// lowered\nexport function setup() { return {} }')
    expect(strFromU8(unzipped['ComposeRuntime/script-runtime.mjs']!)).toContain('createComposePageScriptScope')
  })

  it('有 setup 而宿主没给编译器：交付静态场景并说明脚本没有随导出', async () => {
    const outcome = await exportActiveSceneAsQml({
      ...input(),
      loadSetupSource: async () => 'export function setup() { return {} }',
    })
    expect(outcome.ok && outcome.fileName).toBe('主屏总览.qml')
    expect(outcome.notice).toContain('页面脚本没有随导出')
  })

  it('setup 编译失败：不交付文件，提示带编译器的说明', async () => {
    const outcome = await exportActiveSceneAsQml({
      ...input(),
      loadSetupSource: async () => 'export function setup( {',
      scriptCompiler: { compile: async () => { throw new Error('page.setup.js:1:24: Unexpected "{"') } },
    })
    expect(outcome).toEqual({ ok: false, notice: '页面脚本编译失败：page.setup.js:1:24: Unexpected "{"' })
  })
})
