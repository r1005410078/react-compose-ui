import { describe, expect, it } from 'vitest'
import type { DockviewApi } from 'dockview-react'
import {
  COMPOSE_WORKSPACE_SNAPSHOT_FORMAT,
  applyWorkspaceLayout,
  captureWorkspaceSnapshot,
  validateWorkspaceSnapshot,
  workspacePresetSignature,
  workspaceSnapshotSignature,
} from './workspace-snapshot'
import type { ComposeWorkspaceLayoutSnapshot } from './workspace-definition'
import { DEFAULT_WORKSPACE_LAYOUT_PRESET } from './workspace-definition'
import { WORKSPACE_PANEL_IDS } from './workspace-ids'

const ALL = new Set(Object.values(WORKSPACE_PANEL_IDS))

/** 默认四区的序列化结果（按 Dockview 7 的形状）；`extra` 往里加面板。 */
function serialized(options?: {
  readonly leftViews?: string[]
  readonly bottomViews?: string[]
  readonly toolsSize?: number
  readonly withoutCanvas?: boolean
}) {
  const tools = options?.leftViews ?? [WORKSPACE_PANEL_IDS.componentLibrary, WORKSPACE_PANEL_IDS.history]
  return {
    grid: {
      root: {
        type: 'branch',
        data: [
          {
            type: 'branch',
            data: [
              { type: 'leaf', data: { views: [WORKSPACE_PANEL_IDS.scene], activeView: WORKSPACE_PANEL_IDS.scene, id: 'compose-left-0' }, size: 300 },
              { type: 'leaf', data: { views: tools, activeView: tools[0], id: 'compose-left-1' }, size: options?.toolsSize ?? 200 },
            ],
            size: 280,
          },
          { type: 'leaf', data: { views: options?.withoutCanvas ? [] : [WORKSPACE_PANEL_IDS.canvas], id: 'compose-canvas-group' }, size: 600 },
          { type: 'leaf', data: { views: [WORKSPACE_PANEL_IDS.inspector], id: 'compose-right-0' }, size: 400 },
        ],
        size: 660,
      },
      width: 1280,
      height: 660,
      orientation: 'HORIZONTAL',
    },
    panels: {},
    edgeGroups: {
      bottom: {
        size: 280,
        visible: true,
        collapsed: true,
        group: {
          views: options?.bottomViews ?? [WORKSPACE_PANEL_IDS.assetBrowser, WORKSPACE_PANEL_IDS.command, WORKSPACE_PANEL_IDS.transactionLog],
          id: 'compose-bottom-edge',
        },
      },
    },
  }
}

function snapshot(data: unknown, format = COMPOSE_WORKSPACE_SNAPSHOT_FORMAT): ComposeWorkspaceLayoutSnapshot {
  return { kind: 'snapshot', format, data }
}

describe('工作区布局快照', () => {
  it('OpenSpec: editor-workspace-layout / 工作区布局快照 / 快照失配回退', () => {
    expect(validateWorkspaceSnapshot(snapshot(serialized()), ALL)).toBeNull()
    // 三种失配：Dockview 大版本变了、面板 id 不认识（宿主关掉了某个面板）、没有画布。
    expect(validateWorkspaceSnapshot(snapshot(serialized(), 'dockview@6'), ALL)).toBe('format')
    expect(validateWorkspaceSnapshot(snapshot(serialized({ leftViews: ['host-only-panel'] })), ALL)).toBe('unknown-panel')
    expect(validateWorkspaceSnapshot(snapshot(serialized({ withoutCanvas: true })), ALL)).toBe('no-canvas')
    expect(validateWorkspaceSnapshot(snapshot({ nope: true }), ALL)).toBe('shape')
  })

  it('OpenSpec: editor-workspace-layout / 时间线是可摆放的工作区面板 / 时间线随快照走', () => {
    const api = {
      toJSON: () => serialized({
        bottomViews: [WORKSPACE_PANEL_IDS.assetBrowser],
        leftViews: [WORKSPACE_PANEL_IDS.animation],
      }),
    } as unknown as DockviewApi
    const captured = captureWorkspaceSnapshot(api)!
    // 用户把时间线拖到左栏：快照记住它在那儿，切走再切回仍在左栏。
    expect(JSON.stringify(captured.data)).toContain(WORKSPACE_PANEL_IDS.animation)
    expect(captured.format).toBe(COMPOSE_WORKSPACE_SNAPSHOT_FORMAT)
    expect(validateWorkspaceSnapshot(captured, ALL)).toBeNull()
    // 时间线挪位算修改：它是布局的一部分，不再是某个模式叠加的东西。
    const base = workspaceSnapshotSignature(snapshot(serialized()))
    expect(workspaceSnapshotSignature(captured)).not.toBe(base)
  })

  it('OpenSpec: editor-workspace-layout / 工作区管理 / 修改点与重置：签名只看面板在哪个组', () => {
    const base = workspaceSnapshotSignature(snapshot(serialized()))
    // 分栏尺寸变了、历史标签出现或消失：不点亮。
    expect(workspaceSnapshotSignature(snapshot(serialized({ toolsSize: 320 })))).toBe(base)
    expect(workspaceSnapshotSignature(snapshot(serialized({ leftViews: [WORKSPACE_PANEL_IDS.componentLibrary] })))).toBe(base)
    // 面板挪位：点亮。
    expect(workspaceSnapshotSignature(snapshot(serialized({ leftViews: [WORKSPACE_PANEL_IDS.inspector] })))).not.toBe(base)
    // 内建 preset 算出来的签名与默认四区的快照一致，因此没拖过的内建没有修改点。
    expect(workspacePresetSignature(DEFAULT_WORKSPACE_LAYOUT_PRESET, ALL)).toBe(base)
  })

  it('OpenSpec: editor-workspace-layout / 工作区布局快照 / 三级回退：快照失败回 preset，preset 也没有则 invalid', () => {
    const calls: string[] = []
    const api = {
      fromJSON: () => { throw new Error('dockview: bad layout') },
      clear: () => { calls.push('clear') },
    } as unknown as DockviewApi
    const build = () => { calls.push('build') }
    const afterSnapshot = () => { calls.push('snapshot') }
    expect(applyWorkspaceLayout(api, DEFAULT_WORKSPACE_LAYOUT_PRESET, snapshot(serialized()), { build, afterSnapshot }))
      .toBe('preset')
    expect(calls).toEqual(['clear', 'build'])
    expect(applyWorkspaceLayout(api, snapshot(serialized()), undefined, { build, afterSnapshot })).toBe('invalid')

    const okApi = { fromJSON: () => { calls.push('fromJSON') }, clear: () => { calls.push('clear') } } as unknown as DockviewApi
    calls.length = 0
    expect(applyWorkspaceLayout(okApi, DEFAULT_WORKSPACE_LAYOUT_PRESET, snapshot(serialized()), { build, afterSnapshot }))
      .toBe('snapshot')
    expect(calls).toEqual(['fromJSON', 'snapshot'])
  })
})
