import type { DockviewApi } from 'dockview-react'
import { getEditorMessages } from '../editor-i18n'
import type { ComposeI18nContextValue, ComposeLocale } from '@compose-ui/ui-context'
import type { ComposeWorkspaceLayoutPreset, ComposeWorkspacePanelName } from './workspace-definition'
import {
  DEFAULT_WORKSPACE_LAYOUT_PRESET,
  WORKSPACE_PANEL_ID_BY_NAME,
} from './workspace-definition'
import {
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIDE_GROUP_PREFIX,
  WORKSPACE_SIZES,
} from './workspace-ids'
import { normalizeWorkspacePreset } from './workspace-snapshot'

export {
  WORKSPACE_CARD_GAP,
  WORKSPACE_COMPONENT_IDS,
  WORKSPACE_GROUP_IDS,
  WORKSPACE_HEADER_HEIGHT,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_SIDE_GROUP_PREFIX,
  WORKSPACE_SIZES,
} from './workspace-ids'

const ASSET_DOCUMENT_PANEL_PREFIX = 'compose-asset-document:'
const PAGE_DOCUMENT_PANEL_PREFIX = 'compose-page-document:'
const COMPONENT_DOCUMENT_PANEL_PREFIX = 'compose-component-document:'

/**
 * 从 Provider 与稳定资源 key 派生当前 Editor 实例中的资源文档 key。
 *
 * @remarks
 * 文档是编辑器会话而不是 Dockview panel，这个 key 只用来在会话表里寻址、写在文档标签的
 * `data-workspace-tab` 上。只读标签追加 `:readonly` 后缀，使同一文件可以同时以可编辑标签与
 * 只读标签打开而不互相覆盖。
 * @internal
 */
export function createAssetDocumentPanelId(
  providerId: string,
  assetIdentity: string,
  options?: { readonly readOnly?: boolean },
) {
  const base = `${ASSET_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(assetIdentity)}`
  return options?.readOnly === true ? `${base}:readonly` : base
}

/** 判断文档 key 是否为 Editor 临时资源文档。 @internal */
export function isAssetDocumentPanelId(panelId: string) {
  return panelId.startsWith(ASSET_DOCUMENT_PANEL_PREFIX)
}

/**
 * 从 Provider 与页面稳定 key 派生页面文档 key。
 *
 * @remarks
 * 与资源文档使用不同前缀，因此同一页面文件可同时以页面标签与资源标签打开而不互相覆盖。
 * @internal
 */
export function createPageDocumentPanelId(providerId: string, pageKey: string) {
  return `${PAGE_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(pageKey)}`
}

/** 判断文档 key 是否为页面文档。 @internal */
export function isPageDocumentPanelId(panelId: string) {
  return panelId.startsWith(PAGE_DOCUMENT_PANEL_PREFIX)
}

/** 从 Provider 与组件稳定 key 派生独立 Base/Variant 文档 key。 @internal */
export function createComponentDocumentPanelId(providerId: string, assetKey: string) {
  return `${COMPONENT_DOCUMENT_PANEL_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(assetKey)}`
}

/** 判断文档 key 是否为组件或变体文档。 @internal */
export function isComponentDocumentPanelId(panelId: string) {
  return panelId.startsWith(COMPONENT_DOCUMENT_PANEL_PREFIX)
}

/** 判断文档 key 是否为可关闭的文档（资源、页面或组件）。 @internal */
export function isWorkspaceDocumentPanelId(panelId: string) {
  return isAssetDocumentPanelId(panelId)
    || isPageDocumentPanelId(panelId)
    || isComponentDocumentPanelId(panelId)
}

const TAB_COMPONENT = 'workspaceTab'
const DEFAULT_LAYOUT_HEIGHT = 480

/** 工具组占左栏高度的默认比例：场景 60% / 工具 40%。 @internal */
export const DEFAULT_TOOLS_WEIGHT = 0.4

/**
 * 一份 preset 里工具组占左栏的高度比例。
 *
 * @remarks
 * `leftWeights` 是**权重**不是百分比，因此要除以总和；只有两组以上时才有意义。快照没有权重
 * 可言——它自己带着每个组的尺寸。
 * @internal
 */
export function resolveToolsWeight(preset: ComposeWorkspaceLayoutPreset) {
  const weights = normalizeWorkspacePreset(preset).leftWeights
  if (!weights || weights.length < 2 || weights.some((weight) => weight <= 0)) return DEFAULT_TOOLS_WEIGHT
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights[1]! / total
}

/**
 * 场景组与工具组的高度折算：工具组取可用高度的一个比例，但受最小高度双向夹紧。
 *
 * @remarks
 * 比例由工作区给（绘图把工具组拉高），缺省是 {@link DEFAULT_TOOLS_WEIGHT}。
 * @internal
 */
export function computeToolsHeight(availableHeight: number, weight = DEFAULT_TOOLS_WEIGHT) {
  const usable = availableHeight > 0 ? availableHeight : DEFAULT_LAYOUT_HEIGHT
  return Math.min(
    Math.max(WORKSPACE_SIZES.tools.minimumHeight, Math.round(usable * weight)),
    Math.max(WORKSPACE_SIZES.tools.minimumHeight, usable - WORKSPACE_SIZES.scene.minimumHeight),
  )
}

/** 初始化选项。 @internal */
export interface InitializeWorkspaceOptions {
  /** 宿主提供了历史控制器或显式历史面板；历史作为工具组的第二个标签加入。 @defaultValue false */
  readonly historyEnabled?: boolean
}

export function localizeWorkspace(
  api: DockviewApi,
  locale: ComposeLocale,
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const titles = {
    [WORKSPACE_PANEL_IDS.scene]: messages.sceneGraph,
    [WORKSPACE_PANEL_IDS.componentLibrary]: messages.componentLibrary,
    [WORKSPACE_PANEL_IDS.history]: messages.history,
    [WORKSPACE_PANEL_IDS.canvas]: messages.canvas,
    [WORKSPACE_PANEL_IDS.inspector]: messages.inspector,
    [WORKSPACE_PANEL_IDS.transactionLog]: messages.transactionLog,
    [WORKSPACE_PANEL_IDS.command]: messages.command,
    [WORKSPACE_PANEL_IDS.assetBrowser]: messages.assets,
    [WORKSPACE_PANEL_IDS.animation]: messages.animation,
  }
  for (const [panelId, title] of Object.entries(titles)) {
    const getPanel = (api as Partial<DockviewApi>).getPanel
    const panel = typeof getPanel === 'function' ? getPanel.call(api, panelId) : undefined
    if (typeof panel?.api.setTitle === 'function') panel.api.setTitle(title)
  }
}

/**
 * 把物料面板的标签名换成当前工作区的货架标题。
 *
 * @remarks
 * 标签名是**工作区**的东西（页面叫「基础组件」、绘图叫「符号库」），而 {@link localizeWorkspace}
 * 只知道界面语言。因此两处都要调它：换语言之后与换工作区之后。
 * @internal
 */
export function setWorkspacePaletteTitle(api: DockviewApi, title: string) {
  setWorkspacePanelTitle(api, WORKSPACE_PANEL_IDS.componentLibrary, title)
}

/**
 * 改一个面板标签上的字。
 *
 * @remarks
 * 属性面板的对象语义住在**标签**上（`属性 · 矩形`）而不是面板里另起一条标题行——同一个名字
 * 写两遍时，占地更大的那一遍是 52px 的一整条。跟着选区变的是文字，标签左侧的图标与标签本身
 * 的位置不变，因此用户不会以为面板被换掉了。
 * @internal
 */
export function setWorkspacePanelTitle(api: DockviewApi, panelId: string, title: string) {
  const getPanel = (api as Partial<DockviewApi>).getPanel
  const panel = typeof getPanel === 'function' ? getPanel.call(api, panelId) : undefined
  if (typeof panel?.api.setTitle === 'function') panel.api.setTitle(title)
}

/**
 * 让历史标签与宿主是否提供历史一致。
 *
 * @remarks
 * 历史是基础组件旁边的第二个标签而不是第二个组：它与基础组件轮流占同一块面积。基础组件不在
 * 布局里时退到场景图所在的组，再没有就不加。宿主撤掉历史控制器时标签一并关掉，不留一个空标签。
 * @internal
 */
export function syncWorkspaceHistoryPanel(
  api: DockviewApi,
  historyEnabled: boolean,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const existing = api.getPanel(WORKSPACE_PANEL_IDS.history)
  if (historyEnabled && !existing) {
    const anchor = api.getPanel(WORKSPACE_PANEL_IDS.componentLibrary)
      ?? api.getPanel(WORKSPACE_PANEL_IDS.scene)
    if (!anchor) return
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.history,
      component: WORKSPACE_COMPONENT_IDS.history,
      tabComponent: TAB_COMPONENT,
      title: messages.history,
      inactive: true,
      position: { referencePanel: anchor.id, direction: 'within' },
    })
  }
  else if (!historyEnabled && existing) {
    existing.api.close()
  }
}

/** 面板 id → 组件名与本地化标题，建组时按它落面板。 */
function panelDescriptor(
  panelId: string,
  messages: ReturnType<typeof getEditorMessages>['workspace'],
): { readonly component: string; readonly title: string } | null {
  switch (panelId) {
    case WORKSPACE_PANEL_IDS.scene:
      return { component: WORKSPACE_COMPONENT_IDS.scene, title: messages.sceneGraph }
    case WORKSPACE_PANEL_IDS.componentLibrary:
      return { component: WORKSPACE_COMPONENT_IDS.componentLibrary, title: messages.componentLibrary }
    case WORKSPACE_PANEL_IDS.history:
      return { component: WORKSPACE_COMPONENT_IDS.history, title: messages.history }
    case WORKSPACE_PANEL_IDS.inspector:
      return { component: WORKSPACE_COMPONENT_IDS.inspector, title: messages.inspector }
    case WORKSPACE_PANEL_IDS.assetBrowser:
      return { component: WORKSPACE_COMPONENT_IDS.assetBrowser, title: messages.assets }
    case WORKSPACE_PANEL_IDS.command:
      return { component: WORKSPACE_COMPONENT_IDS.command, title: messages.command }
    case WORKSPACE_PANEL_IDS.transactionLog:
      return { component: WORKSPACE_COMPONENT_IDS.transactionLog, title: messages.transactionLog }
    case WORKSPACE_PANEL_IDS.animation:
      return { component: WORKSPACE_COMPONENT_IDS.animation, title: messages.animation }
    default:
      return null
  }
}

/** 按 preset 描述展开成 Dockview 面板 id：历史只在宿主提供了历史时出现。 */
function resolvePresetGroups(
  groups: readonly (readonly ComposeWorkspacePanelName[])[],
  historyEnabled: boolean,
) {
  return groups
    .map((names) => names
      .map((name) => WORKSPACE_PANEL_ID_BY_NAME[name])
      .filter((id) => historyEnabled || id !== WORKSPACE_PANEL_IDS.history))
    .filter((ids) => ids.length > 0)
}

/** 往一个组里落一列面板，第一个活动。 */
function addPanelsToGroup(
  api: DockviewApi,
  groupId: string,
  panelIds: readonly string[],
  messages: ReturnType<typeof getEditorMessages>['workspace'],
  extra?: { readonly minimumHeight?: number },
) {
  let first: ReturnType<DockviewApi['addPanel']> | undefined
  for (const panelId of panelIds) {
    if (api.getPanel(panelId)) continue
    const descriptor = panelDescriptor(panelId, messages)
    if (!descriptor) continue
    const panel = api.addPanel({
      id: panelId,
      component: descriptor.component,
      tabComponent: TAB_COMPONENT,
      title: descriptor.title,
      inactive: first !== undefined,
      ...(extra ?? {}),
      position: { referenceGroup: groupId },
    })
    first ??= panel
  }
  first?.api.setActive()
}

/** 一侧的组上下堆叠：第一组放在画布旁边，其余依次放在上一组下面。 */
function buildSideColumn(
  api: DockviewApi,
  side: 'left' | 'right',
  groups: readonly (readonly string[])[],
  messages: ReturnType<typeof getEditorMessages>['workspace'],
  weights: readonly number[] | undefined,
) {
  const initialWidth = side === 'left'
    ? WORKSPACE_SIZES.scene.initialWidth
    : WORKSPACE_SIZES.inspector.initialWidth
  const minimumWidth = side === 'left'
    ? WORKSPACE_SIZES.scene.minimumWidth
    : WORKSPACE_SIZES.inspector.minimumWidth
  const usableHeight = api.height > 0 ? api.height : DEFAULT_LAYOUT_HEIGHT
  let previousGroupId: string | null = null
  groups.forEach((panelIds, index) => {
    const groupId = `${WORKSPACE_SIDE_GROUP_PREFIX[side]}${index}`
    const group = api.getGroup(groupId) ?? (previousGroupId === null
      ? api.addGroup({
          direction: side,
          referenceGroup: WORKSPACE_GROUP_IDS.canvas,
          id: groupId,
          initialWidth,
          // 左侧第一组是场景树，至少要露出几行；右侧第一组是属性面板，高度由列决定。
          constraints: side === 'left'
            ? { minimumWidth, minimumHeight: WORKSPACE_SIZES.scene.minimumHeight }
            : { minimumWidth },
        })
      : api.addGroup({
          direction: 'below',
          referenceGroup: previousGroupId,
          id: groupId,
          initialHeight: sideGroupHeight(usableHeight, groups.length, index, weights),
          constraints: { minimumHeight: WORKSPACE_SIZES.tools.minimumHeight },
        }))
    addPanelsToGroup(api, group.id, panelIds, messages, {
      // 左侧第一组是场景树，至少要露出几行；其余组的瓦片至少要露出一排。
      minimumHeight: side === 'left' && index === 0
        ? WORKSPACE_SIZES.scene.minimumHeight
        : WORKSPACE_SIZES.tools.minimumHeight,
    })
    previousGroupId = group.id
  })
}

/**
 * 一侧第 `index` 组的初始高度：给了权重按权重分，没给按「第一组 60%、其余平分 40%」。
 *
 * @remarks
 * 只对第二组起有意义（第一组的高度是余下的）。
 */
function sideGroupHeight(
  usableHeight: number,
  count: number,
  index: number,
  weights: readonly number[] | undefined,
) {
  if (count <= 1) return usableHeight
  const resolved = weights && weights.length === count && weights.every((weight) => weight > 0)
    ? weights
    : [0.6, ...Array.from({ length: count - 1 }, () => 0.4 / (count - 1))]
  const total = resolved.reduce((sum, weight) => sum + weight, 0)
  return Math.max(
    WORKSPACE_SIZES.tools.minimumHeight,
    Math.round((usableHeight * resolved[index]!) / total),
  )
}

/**
 * 按 preset 在**一个** Dockview 实例里摆出布局：画布组在中央，左右两侧各一列上下堆叠的组，
 * 底部原生边缘组承载资源 / 命令 / 日志（动画工作区还有时间线——它与别的面板一样随布局走）。
 *
 * @remarks
 * 组的创建顺序就是网格的拓扑：画布先落地成根；左侧第一组放在它左边（根变成横向 [左, 画布]），
 * 后续左侧组放在上一组下面（那一格变成纵向分栏），右侧同理；最后底部边缘组包在整个网格之下，
 * 横跨全宽。可重放：每一步都先查已有的组与面板，Strict Mode 重放挂载不会建出第二份。
 *
 * 画布组保持 `locked: 'no-drop-target'`：它只承载画布，别的面板落进来会被隐藏的组头吞掉。
 * 其余组不锁——面板可拖是「自定义工作区」的全部前提。
 * @internal
 */
export function buildWorkspaceLayout(
  api: DockviewApi,
  preset: ComposeWorkspaceLayoutPreset,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
  options?: InitializeWorkspaceOptions,
) {
  const messages = getEditorMessages(locale, formatMessage).workspace
  const historyEnabled = options?.historyEnabled ?? false
  const normalized = normalizeWorkspacePreset(preset)

  const canvasGroup =
    api.getGroup(WORKSPACE_GROUP_IDS.canvas) ??
    api.addGroup({
      direction: 'right',
      id: WORKSPACE_GROUP_IDS.canvas,
      // 画布组只有一个面板，文档标签在 Dockview 之外的通栏标签条上：它自己的头只会是一条
      // 写着「画布」的空标签条。
      hideHeader: true,
      locked: 'no-drop-target',
    })
  if (!api.getPanel(WORKSPACE_PANEL_IDS.canvas)) {
    api.addPanel({
      id: WORKSPACE_PANEL_IDS.canvas,
      component: WORKSPACE_COMPONENT_IDS.canvas,
      tabComponent: TAB_COMPONENT,
      title: messages.canvas,
      position: { referenceGroup: canvasGroup.id },
    })
  }

  buildSideColumn(api, 'left', resolvePresetGroups(normalized.left, historyEnabled), messages, normalized.leftWeights)
  buildSideColumn(api, 'right', resolvePresetGroups(normalized.right, historyEnabled), messages, undefined)

  const bottomPanels = resolvePresetGroups([normalized.bottom], historyEnabled)[0] ?? []
  if (bottomPanels.length > 0) {
    const existing = api.getEdgeGroup('bottom')
    const bottomGroup = existing ?? api.addEdgeGroup('bottom', {
      id: WORKSPACE_GROUP_IDS.bottom,
      ...WORKSPACE_SIZES.bottom,
      collapsed: normalized.bottomCollapsed,
    })
    // 边缘组不随 `clear` 一起消失：换到另一个 preset 时它还是上一个布局留下的那一个，折叠状态
    // 也是。preset 说的折叠与否要落到它身上，否则动画工作区的「底部展开」只在首次建组时成立。
    // 只在状态真的不同的时候动它：对一个已折叠的组再 collapse 一次同样会发布局变化事件。
    if (existing && typeof existing.isCollapsed === 'function' && existing.isCollapsed() !== normalized.bottomCollapsed) {
      if (normalized.bottomCollapsed) existing.collapse()
      else existing.expand()
    }
    addPanelsToGroup(api, bottomGroup.id, bottomPanels, messages)
  }

  localizeWorkspace(api, locale, formatMessage)
  applyWorkspaceInitialSizes(api, resolveToolsWeight(preset))
}

/**
 * 摆出内建的默认四区：左栏场景图在上、基础组件（与可选历史）在下，右栏属性，底部
 * 资源 / 命令 / 日志。就是 {@link buildWorkspaceLayout} 喂默认 preset。
 */
export function initializeWorkspace(
  api: DockviewApi,
  locale: ComposeLocale = 'zh-CN',
  formatMessage?: ComposeI18nContextValue['formatMessage'],
  options?: InitializeWorkspaceOptions,
) {
  buildWorkspaceLayout(api, DEFAULT_WORKSPACE_LAYOUT_PRESET, locale, formatMessage, options)
}

/**
 * 把默认布局的初始尺寸落到组上。
 *
 * @remarks
 * `addGroup` 的 `initialWidth` / `initialHeight` 只在网格当时有真实尺寸时才有意义：Dockview 的
 * gridview 按比例重排，容器还是 0 时加进去的尺寸在第一次真实布局后会被摊成等份。因此建完组
 * 再显式 `setSize` 一次，且在容器量到真实尺寸之前不算数——调用方（`compose-editor`）在 api
 * 报出非零尺寸后再调一次，两次都幂等。只管两侧的第一组与左侧的第二组：那是内建布局的三个
 * 尺寸；用户拖出来的布局由快照自己带尺寸。
 * @internal
 */
export function applyWorkspaceInitialSizes(api: DockviewApi, toolsWeight = DEFAULT_TOOLS_WEIGHT) {
  const setSize = (id: string, size: { readonly width?: number; readonly height?: number }) => {
    const groupApi = api.getGroup(id)?.api
    if (groupApi && typeof groupApi.setSize === 'function') groupApi.setSize(size)
  }
  setSize(WORKSPACE_GROUP_IDS.scene, { width: WORKSPACE_SIZES.scene.initialWidth })
  setSize(WORKSPACE_GROUP_IDS.inspector, { width: WORKSPACE_SIZES.inspector.initialWidth })
  setSize(WORKSPACE_GROUP_IDS.tools, { height: computeToolsHeight(api.height, toolsWeight) })
}
