import { createContext, useContext } from 'react'

/** Paint 语义 editor 与宿主编辑会话之间的可选桥接。 @public */
export interface ComposePropertyPanelPaintEditorPort {
  /** 填充 Popover 打开或关闭时通知宿主。 */
  readonly onOpenChange?: (open: boolean) => void
  /** 原生吸管不可用时请求宿主开始画布图层取色。 */
  readonly onEyedropperFallback?: () => void
}

/** 纯色语义 editor 与宿主取色会话之间的可选桥接。 @public */
export interface ComposePropertyPanelColorEditorPort {
  /** 原生吸管不可用时请求宿主开始画布图层取色。 */
  readonly onEyedropperFallback?: () => void
}

/**
 * node editor 可选择的一个候选节点。
 *
 * @public
 */
export interface ComposePropertyPanelNodeCandidate {
  /** 候选在当前列表中的稳定标识。 */
  readonly id: string
  /** 面板展示与筛选使用的可读名称。 */
  readonly label: string
  readonly description?: string
  /** 提交前必须通过字段 Schema 校验的候选值。 */
  readonly value: unknown
}

/**
 * node 语义 editor 与宿主节点目录之间的桥接。
 *
 * @remarks
 * 属性面板不理解候选值的领域含义：它只做「类型交集判定 → 交给端口解析 → Schema 校验 →
 * 提交」。因此同一个 editor 可以被页面引用之外的节点种类复用。
 * @public
 */
export interface ComposePropertyPanelNodeEditorPort {
  /**
   * 宿主接受的拖拽媒体类型。
   *
   * @remarks
   * editor 仅在拖拽数据的类型与此列表存在交集时才接受拖放并阻止默认行为，避免吞掉页面上
   * 其他拖放交互。
   */
  readonly dragMediaTypes: readonly string[]
  /** 当前可选候选；面板自身负责按输入筛选。 */
  readonly candidates: readonly ComposePropertyPanelNodeCandidate[]
  /**
   * 把命中的媒体类型与其文本载荷解析为候选。
   *
   * @returns 无法识别时返回 null，此时 editor 不产生任何变更。
   */
  parseDrop: (data: Readonly<Record<string, string>>) => ComposePropertyPanelNodeCandidate | null
  /**
   * 把已保存的值渲染为人类可读标签。
   *
   * @returns 值已无法解析时应返回可辨识的占位文案，而不是空字符串。
   */
  resolveLabel: (value: unknown) => string
}

/** Property Panel 内部注入的编辑端口集合。 @internal */
export interface PropertyPanelEditorPorts {
  readonly color?: ComposePropertyPanelColorEditorPort
  readonly paint?: ComposePropertyPanelPaintEditorPort
  readonly node?: ComposePropertyPanelNodeEditorPort
}

/** 编辑端口只在当前 Property Panel 子树内生效，避免将 Stage 依赖泄漏进字段模型。 @internal */
export const PropertyPanelEditorPortsContext = createContext<PropertyPanelEditorPorts>({})

/** 读取当前属性面板注入的 Paint 编辑端口。 @public */
export function useComposePropertyPanelPaintEditorPort(): ComposePropertyPanelPaintEditorPort | undefined {
  return useContext(PropertyPanelEditorPortsContext).paint
}

/** 读取当前属性面板注入的纯色取色端口。 @public */
export function useComposePropertyPanelColorEditorPort(): ComposePropertyPanelColorEditorPort | undefined {
  return useContext(PropertyPanelEditorPortsContext).color
}

/** 读取当前属性面板注入的节点目录端口。 @public */
export function useComposePropertyPanelNodeEditorPort(): ComposePropertyPanelNodeEditorPort | undefined {
  return useContext(PropertyPanelEditorPortsContext).node
}
