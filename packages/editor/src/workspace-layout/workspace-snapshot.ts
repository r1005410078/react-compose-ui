import type { DockviewApi } from 'dockview-react'
import type {
  ComposeWorkspaceLayoutPreset,
  ComposeWorkspaceLayoutSnapshot,
  ComposeWorkspacePanelName,
} from './workspace-definition'
import { WORKSPACE_PANEL_ID_BY_NAME } from './workspace-definition'
import { WORKSPACE_PANEL_IDS } from './workspace-ids'

/**
 * 快照格式：与生成它的 Dockview 大版本绑定。
 *
 * @remarks
 * Dockview 升大版本时手动改这个串——旧快照随之全部失配、回到 preset，而不是喂给一个读不懂
 * 它的 `fromJSON`。
 */
export const COMPOSE_WORKSPACE_SNAPSHOT_FORMAT = 'dockview@7'

/** 快照里允许出现的面板 id。 */
const KNOWN_PANEL_IDS: ReadonlySet<string> = new Set(Object.values(WORKSPACE_PANEL_IDS))

interface SerializedLeaf {
  readonly type: 'leaf'
  readonly data: { readonly views: readonly string[]; readonly activeView?: string; readonly id: string }
  readonly size?: number
  readonly visible?: boolean
}

interface SerializedBranch {
  readonly type: 'branch'
  readonly data: readonly SerializedNode[]
  readonly size?: number
  readonly visible?: boolean
}

type SerializedNode = SerializedLeaf | SerializedBranch

/** 本模块只读写 Dockview 序列化结果里用得到的这几个字段；其余原样透传。 */
interface SerializedLayoutLike {
  readonly grid: { readonly root: SerializedNode; readonly orientation: string; readonly width: number; readonly height: number }
  readonly panels: Readonly<Record<string, unknown>>
  readonly activeGroup?: string
  readonly floatingGroups?: readonly unknown[]
  readonly popoutGroups?: readonly unknown[]
  readonly edgeGroups?: Readonly<Record<string, {
    readonly size: number
    readonly visible: boolean
    readonly collapsed?: boolean
    readonly group?: { readonly views: readonly string[]; readonly activeView?: string; readonly id: string }
  }>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSerializedNode(value: unknown): value is SerializedNode {
  if (!isRecord(value)) return false
  if (value.type === 'leaf') {
    return isRecord(value.data) && Array.isArray(value.data.views)
      && value.data.views.every((view) => typeof view === 'string')
  }
  if (value.type === 'branch') {
    return Array.isArray(value.data) && value.data.every(isSerializedNode)
  }
  return false
}

function isSerializedLayout(value: unknown): value is SerializedLayoutLike {
  return isRecord(value)
    && isRecord(value.grid) && isSerializedNode(value.grid.root)
    && isRecord(value.panels)
}

function collectViews(node: SerializedNode, into: string[]) {
  if (node.type === 'leaf') into.push(...node.data.views)
  else node.data.forEach((child) => collectViews(child, into))
}

/**
 * 把 Dockview 当前布局收成一份快照。
 *
 * @remarks
 * 每一个面板都进快照，时间线也不例外：它是布局的一部分，用户把它拖到哪儿就记到哪儿。
 * @internal
 */
export function captureWorkspaceSnapshot(api: DockviewApi): ComposeWorkspaceLayoutSnapshot | null {
  // 宿主测试替身可能只实现部分 api。
  if (typeof (api as Partial<DockviewApi>).toJSON !== 'function') return null
  const raw: unknown = api.toJSON()
  if (!isSerializedLayout(raw)) return null
  // 浮动组与弹出窗口本来就关着；快照里也不留它们的位置。
  const data: SerializedLayoutLike = {
    ...raw,
    floatingGroups: [],
    popoutGroups: [],
  }
  return { kind: 'snapshot', format: COMPOSE_WORKSPACE_SNAPSHOT_FORMAT, data }
}

/** 快照校验失败的原因；只用于用例与日志。 @internal */
export type WorkspaceSnapshotProblem = 'format' | 'shape' | 'unknown-panel' | 'no-canvas'

/**
 * 校验一份快照能不能交给 `fromJSON`。
 *
 * @remarks
 * 三条判据：格式一致（Dockview 大版本没变）、面板 id 全部已知（宿主没有关掉某个面板，也不是
 * 别的编辑器写的）、画布面板存在。`allowedPanelIds` 由调用方给出，因此宿主没提供历史时带着
 * 历史标签的快照会失配——那是对的，`fromJSON` 遇到未注册的组件会抛。
 * @internal
 */
export function validateWorkspaceSnapshot(
  snapshot: ComposeWorkspaceLayoutSnapshot,
  allowedPanelIds: ReadonlySet<string>,
): WorkspaceSnapshotProblem | null {
  if (snapshot.format !== COMPOSE_WORKSPACE_SNAPSHOT_FORMAT) return 'format'
  if (!isSerializedLayout(snapshot.data)) return 'shape'
  const views: string[] = []
  collectViews(snapshot.data.grid.root, views)
  for (const entry of Object.values(snapshot.data.edgeGroups ?? {})) {
    if (entry.group) views.push(...entry.group.views)
  }
  if (views.some((view) => !allowedPanelIds.has(view) || !KNOWN_PANEL_IDS.has(view))) return 'unknown-panel'
  if (!views.includes(WORKSPACE_PANEL_IDS.canvas)) return 'no-canvas'
  return null
}

/** 快照里出现的面板 id，供调用方判断哪些面板要在 `fromJSON` 之前注册。 @internal */
export function listWorkspaceSnapshotPanels(snapshot: ComposeWorkspaceLayoutSnapshot): readonly string[] {
  if (!isSerializedLayout(snapshot.data)) return []
  const views: string[] = []
  collectViews(snapshot.data.grid.root, views)
  for (const entry of Object.values(snapshot.data.edgeGroups ?? {})) {
    if (entry.group) views.push(...entry.group.views)
  }
  return views
}

/**
 * 布局的**结构签名**：哪些面板在哪个组、组怎么嵌套；不含尺寸、折叠、可见性与活动标签。
 *
 * @remarks
 * 修改点读它：面板挪位后点亮，调分栏、折叠、换活动标签不点亮——后三样太频繁，点只回答
 * 「面板挪过位没有」。历史面板不计：它随宿主配置出现或消失，不是用户挪的。时间线**计**——
 * 它是布局的一部分，把它拖去右栏就是一次修改。
 */
type SignatureNode =
  | { readonly t: 'leaf'; readonly v: readonly string[] }
  | { readonly t: 'branch'; readonly c: readonly SignatureNode[] }

const IGNORED_IN_SIGNATURE: ReadonlySet<string> = new Set([
  WORKSPACE_PANEL_IDS.history,
])

function signatureNode(node: SerializedNode): SignatureNode | null {
  if (node.type === 'leaf') {
    const views = node.data.views.filter((view) => !IGNORED_IN_SIGNATURE.has(view)).sort()
    return views.length === 0 ? null : { t: 'leaf', v: views }
  }
  const children = node.data
    .map(signatureNode)
    .filter((child): child is SignatureNode => child !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]!
  return { t: 'branch', c: children }
}

/** 快照的结构签名。 @internal */
export function workspaceSnapshotSignature(snapshot: ComposeWorkspaceLayoutSnapshot): string | null {
  if (!isSerializedLayout(snapshot.data)) return null
  const grid = signatureNode(snapshot.data.grid.root)
  const edges = Object.fromEntries(
    Object.entries(snapshot.data.edgeGroups ?? {})
      .map(([position, entry]) => [
        position,
        (entry.group?.views ?? []).filter((view) => !IGNORED_IN_SIGNATURE.has(view)).sort(),
      ])
      .filter(([, views]) => (views as string[]).length > 0),
  )
  return JSON.stringify({ grid, edges })
}

/** 把 preset 里的面板名换成 Dockview 面板 id，并按当前可用面板过滤。 */
function presetPanelIds(
  names: readonly ComposeWorkspacePanelName[],
  available: ReadonlySet<string>,
) {
  return names
    .map((name) => WORKSPACE_PANEL_ID_BY_NAME[name])
    .filter((id) => available.has(id))
}

/** preset 各字段的缺省值。 @internal */
export function normalizeWorkspacePreset(preset: ComposeWorkspaceLayoutPreset) {
  return {
    left: preset.left ?? [['sceneGraph'], ['componentLibrary', 'history']],
    right: preset.right ?? [['inspector']],
    bottom: preset.bottom ?? ['assetBrowser', 'command', 'transactionLog'],
    bottomCollapsed: preset.bottomCollapsed ?? true,
    leftWeights: preset.leftWeights,
  } satisfies Required<Omit<ComposeWorkspaceLayoutPreset, 'kind' | 'leftWeights'>> & { leftWeights?: readonly number[] }
}

/**
 * preset 摆出来之后的结构签名，与 {@link workspaceSnapshotSignature} 同一套归一化。
 *
 * @remarks
 * 建组的算法是确定的：一侧的组上下堆叠成一个纵向分支（只有一个组时就是那一个叶子），根是
 * 横向的 [左, 画布, 右]，底部是边缘组。这里按同一条算法直接算出签名，因此内建工作区的修改点
 * 不需要真的建一遍再比。
 * @internal
 */
export function workspacePresetSignature(
  preset: ComposeWorkspaceLayoutPreset,
  available: ReadonlySet<string>,
): string {
  const normalized = normalizeWorkspacePreset(preset)
  const column = (groups: readonly (readonly ComposeWorkspacePanelName[])[]): SignatureNode | null => {
    const leaves = groups
      .map((names) => presetPanelIds(names, available).filter((id) => !IGNORED_IN_SIGNATURE.has(id)).sort())
      .filter((views) => views.length > 0)
      .map((views): SignatureNode => ({ t: 'leaf', v: views }))
    if (leaves.length === 0) return null
    return leaves.length === 1 ? leaves[0]! : { t: 'branch', c: leaves }
  }
  const children = [
    column(normalized.left),
    { t: 'leaf', v: [WORKSPACE_PANEL_IDS.canvas] } as SignatureNode,
    column(normalized.right),
  ].filter((node): node is SignatureNode => node !== null)
  const grid: SignatureNode = children.length === 1 ? children[0]! : { t: 'branch', c: children }
  const bottom = presetPanelIds(normalized.bottom, available)
    .filter((id) => !IGNORED_IN_SIGNATURE.has(id)).sort()
  const edges = bottom.length > 0 ? { bottom } : {}
  return JSON.stringify({ grid, edges })
}

/** 应用一份布局的结果：用了快照、用了 preset，还是两样都不成。 @internal */
export type ApplyWorkspaceLayoutResult = 'snapshot' | 'preset' | 'invalid'

/**
 * 把一个工作区的布局落到 Dockview 上：用户拖过的快照优先，失配回到定义自带的布局。
 *
 * @remarks
 * 三级回退里的后两级在这里：快照校验失败或 `fromJSON` 抛错 → 定义里的 preset；定义里只有
 * 快照且它也不成 → `'invalid'`，由调用方把这个工作区从列表里删掉并提示。任何一级都不抛。
 * @internal
 */
export function applyWorkspaceLayout(
  api: DockviewApi,
  layout: ComposeWorkspaceLayoutPreset | ComposeWorkspaceLayoutSnapshot,
  userSnapshot: ComposeWorkspaceLayoutSnapshot | undefined,
  options: {
    readonly build: (preset: ComposeWorkspaceLayoutPreset) => void
    readonly afterSnapshot: () => void
  },
): ApplyWorkspaceLayoutResult {
  const candidates = [userSnapshot, layout.kind === 'snapshot' ? layout : undefined]
  const partial = api as Partial<DockviewApi>
  for (const candidate of candidates) {
    if (!candidate || typeof partial.fromJSON !== 'function') continue
    if (validateWorkspaceSnapshot(candidate, KNOWN_PANEL_IDS) !== null) continue
    try {
      api.fromJSON(candidate.data as Parameters<DockviewApi['fromJSON']>[0])
      options.afterSnapshot()
      return 'snapshot'
    }
    catch (error) {
      // 读得懂形状不等于 Dockview 认：例如面板尺寸不满足约束。丢掉这份，试下一级——但要说
      // 一声，否则「拖过的布局怎么没了」在屏幕上没有任何解释。
      console.warn('[compose-editor] workspace layout snapshot could not be restored', error)
    }
  }
  if (layout.kind === 'preset') {
    if (typeof partial.clear === 'function') api.clear()
    options.build(layout)
    return 'preset'
  }
  return 'invalid'
}
